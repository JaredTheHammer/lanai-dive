/**
 * Push Notification Lambda -- Polls live conditions, compares against
 * each subscriber's thresholds, and sends web push notifications
 * when triggers fire.
 *
 * Invoked every 15 min by EventBridge.
 *
 * Environment:
 *   TABLE_NAME       - DynamoDB subscriptions table
 *   VAPID_PUBLIC_KEY  - base64url VAPID public key
 *   VAPID_PRIVATE_KEY - base64url VAPID private key
 *   VAPID_SUBJECT     - mailto: or URL for VAPID
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

// web-push is bundled via esbuild at deploy time (see deploy.sh)
import webpush from 'web-push';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// -------------------------------------------------------------------------
// Condition fetching (minimal, server-side)
// -------------------------------------------------------------------------

const TIDE_STATION = '1615680';
const BUOY_STATION = '51213';
const LANAI_LAT = 20.83;
const LANAI_LON = -156.92;

async function fetchCurrentConditions() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  const [tideRes, weatherRes, buoyRes] = await Promise.allSettled([
    fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `date=today&station=${TIDE_STATION}&product=predictions&datum=MLLW` +
      `&units=english&time_zone=lst_ldt&interval=6&format=json`
    ).then(r => r.json()),

    fetch(`https://api.weather.gov/points/${LANAI_LAT},${LANAI_LON}`, {
      headers: { 'User-Agent': '(lanai-dive-push, jared.m.hamm@gmail.com)', Accept: 'application/geo+json' },
    })
      .then(r => r.json())
      .then(grid =>
        fetch(grid.properties.forecastHourly, {
          headers: { 'User-Agent': '(lanai-dive-push, jared.m.hamm@gmail.com)', Accept: 'application/geo+json' },
        })
      )
      .then(r => r.json()),

    fetch(`https://www.ndbc.noaa.gov/data/realtime2/${BUOY_STATION}.txt`)
      .then(r => r.text()),
  ]);

  // Parse swell from buoy
  let swellHeightFt = null;
  let swellPeriodSec = null;
  if (buoyRes.status === 'fulfilled') {
    const lines = buoyRes.value.split('\n').filter(l => !l.startsWith('#'));
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const wvht = parseFloat(parts[8]); // WVHT in meters
      const dpd = parseFloat(parts[9]);  // DPD in seconds
      if (!isNaN(wvht)) swellHeightFt = wvht * 3.28084;
      if (!isNaN(dpd)) swellPeriodSec = dpd;
    }
  }

  // Parse wind from weather forecast (current hour)
  let windSpeedMph = null;
  if (weatherRes.status === 'fulfilled') {
    const periods = weatherRes.value?.properties?.periods;
    if (periods?.length > 0) {
      windSpeedMph = periods[0].windSpeed
        ? parseInt(periods[0].windSpeed, 10)
        : null;
    }
  }

  // Parse tide
  let tideHeightFt = null;
  if (tideRes.status === 'fulfilled') {
    const predictions = tideRes.value?.predictions;
    if (predictions?.length > 0) {
      // Find nearest prediction to now
      const nowMs = now.getTime();
      let closest = predictions[0];
      let closestDiff = Infinity;
      for (const p of predictions) {
        const pTime = new Date(p.t).getTime();
        const diff = Math.abs(pTime - nowMs);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = p;
        }
      }
      tideHeightFt = parseFloat(closest.v);
    }
  }

  // Compute a simple overall score (lightweight version)
  let score = 50; // baseline
  if (windSpeedMph !== null) {
    if (windSpeedMph <= 5) score += 15;
    else if (windSpeedMph <= 10) score += 10;
    else if (windSpeedMph <= 15) score += 0;
    else if (windSpeedMph <= 20) score -= 10;
    else score -= 20;
  }
  if (swellHeightFt !== null) {
    if (swellHeightFt <= 2) score += 15;
    else if (swellHeightFt <= 4) score += 5;
    else if (swellHeightFt <= 6) score -= 5;
    else score -= 15;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    windSpeedMph,
    swellHeightFt,
    swellPeriodSec,
    tideHeightFt,
    fetchedAt: now.toISOString(),
  };
}

// -------------------------------------------------------------------------
// Push notification logic
// -------------------------------------------------------------------------

function shouldNotify(sub, conditions, prevConditions) {
  const prefs = sub.prefs || {};
  if (!prefs.enabled) return null;

  const reasons = [];

  // Score crosses threshold
  if (prefs.scoreThreshold && conditions.score !== null) {
    const prev = prevConditions?.score ?? 0;
    const curr = conditions.score;
    if (prev < prefs.scoreThreshold && curr >= prefs.scoreThreshold) {
      reasons.push(`Score rose to ${curr} (above your ${prefs.scoreThreshold} threshold)`);
    }
    if (prev >= prefs.scoreThreshold && curr < prefs.scoreThreshold) {
      reasons.push(`Score dropped to ${curr} (below your ${prefs.scoreThreshold} threshold)`);
    }
  }

  // Wind limit
  if (prefs.windLimitMph && conditions.windSpeedMph !== null) {
    const prev = prevConditions?.windSpeedMph ?? 0;
    if (prev <= prefs.windLimitMph && conditions.windSpeedMph > prefs.windLimitMph) {
      reasons.push(`Wind picked up to ${conditions.windSpeedMph} mph`);
    }
    if (prev > prefs.windLimitMph && conditions.windSpeedMph <= prefs.windLimitMph) {
      reasons.push(`Wind dropped to ${conditions.windSpeedMph} mph`);
    }
  }

  // Swell limit
  if (prefs.swellLimitFt && conditions.swellHeightFt !== null) {
    const prev = prevConditions?.swellHeightFt ?? 0;
    if (prev <= prefs.swellLimitFt && conditions.swellHeightFt > prefs.swellLimitFt) {
      reasons.push(`Swell rose to ${conditions.swellHeightFt.toFixed(1)} ft`);
    }
    if (prev > prefs.swellLimitFt && conditions.swellHeightFt <= prefs.swellLimitFt) {
      reasons.push(`Swell dropped to ${conditions.swellHeightFt.toFixed(1)} ft`);
    }
  }

  return reasons.length > 0 ? reasons : null;
}

export async function handler(_event) {
  console.log('Polling conditions...');

  const conditions = await fetchCurrentConditions();
  console.log('Conditions:', JSON.stringify(conditions));

  // Configure VAPID
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Scan all subscribers
  const { Items: subs = [] } = await ddb.send(
    new ScanCommand({ TableName: TABLE })
  );
  console.log(`Found ${subs.length} subscribers`);

  let sent = 0;
  let expired = 0;

  for (const sub of subs) {
    const prevConditions = sub.lastConditions || null;
    const reasons = shouldNotify(sub, conditions, prevConditions);

    if (!reasons) continue;

    const payload = JSON.stringify({
      title: 'Lanai Dive Conditions',
      body: reasons.join('. '),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/', score: conditions.score },
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      );
      sent++;

      // Update lastConditions
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { endpoint: sub.endpoint },
          UpdateExpression: 'SET lastConditions = :c, lastNotified = :t',
          ExpressionAttributeValues: {
            ':c': conditions,
            ':t': conditions.fetchedAt,
          },
        })
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or unsubscribed
        console.log(`Removing expired subscription: ${sub.endpoint.slice(0, 60)}...`);
        await ddb.send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { endpoint: sub.endpoint },
          })
        );
        expired++;
      } else {
        console.error(`Push failed for ${sub.endpoint.slice(0, 60)}:`, err.message);
      }
    }
  }

  // Always update conditions even if no notifications sent (for next comparison)
  // Store as a "global" record for reference
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { endpoint: '__global_last_conditions__' },
      UpdateExpression: 'SET lastConditions = :c, updatedAt = :t',
      ExpressionAttributeValues: {
        ':c': conditions,
        ':t': conditions.fetchedAt,
      },
    })
  );

  console.log(`Done. Sent: ${sent}, Expired: ${expired}`);
  return { sent, expired, totalSubs: subs.length };
}
