/**
 * Push Subscription Management Lambda
 *
 * POST /api/push/subscribe   - Register a new push subscription
 * DELETE /api/push/subscribe - Unregister a push subscription
 *
 * Request body (POST):
 *   { subscription: PushSubscription, prefs: NotifPrefs }
 *
 * Request body (DELETE):
 *   { endpoint: string }
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
const MAX_BODY_SIZE = 8192; // 8KB max request body
const MAX_ENDPOINT_LENGTH = 2048;

/**
 * Validate that an endpoint URL is a legitimate push service URL.
 * Push endpoints should be HTTPS URLs from known push services.
 */
function isValidPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    // Known push service domains (Chrome, Firefox, Apple, Edge)
    const allowedHosts = [
      'fcm.googleapis.com',
      'updates.push.services.mozilla.com',
      'push.apple.com',
      'wns.windows.com',
      'web.push.apple.com',
    ];
    return allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * Sanitize and clamp notification preference values to safe ranges.
 */
function sanitizePrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') {
    return { enabled: true, scoreThreshold: 70, windLimitMph: 20, swellLimitFt: 6 };
  }
  return {
    enabled: Boolean(prefs.enabled),
    scoreThreshold: Math.max(0, Math.min(100, Number(prefs.scoreThreshold) || 70)),
    windLimitMph: Math.max(1, Math.min(100, Number(prefs.windLimitMph) || 20)),
    swellLimitFt: Math.max(1, Math.min(30, Number(prefs.swellLimitFt) || 6)),
    bestZoneChange: prefs.bestZoneChange !== false,
    seasonChange: prefs.seasonChange !== false,
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Origin validation (when ALLOWED_ORIGIN is not wildcard)
  if (ALLOWED_ORIGIN !== '*') {
    const origin = event.headers?.origin || event.headers?.Origin || '';
    if (origin && origin !== ALLOWED_ORIGIN) {
      return respond(403, { error: 'Origin not allowed' });
    }
  }

  // Body size check
  const rawBody = event.body || '{}';
  if (rawBody.length > MAX_BODY_SIZE) {
    return respond(413, { error: 'Request body too large' });
  }

  try {
    const body = JSON.parse(rawBody);

    if (method === 'POST') {
      return await handleSubscribe(body);
    } else if (method === 'DELETE') {
      return await handleUnsubscribe(body);
    }

    return respond(405, { error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return respond(400, { error: 'Invalid JSON' });
    }
    console.error('Handler error:', err);
    return respond(500, { error: 'Internal server error' });
  }
}

async function handleSubscribe(body) {
  const { subscription, prefs } = body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return respond(400, { error: 'Invalid subscription: endpoint and keys required' });
  }

  // Validate endpoint is a legitimate push service URL
  if (!isValidPushEndpoint(subscription.endpoint)) {
    return respond(400, { error: 'Invalid push endpoint URL' });
  }

  // Validate keys are non-empty strings of reasonable length
  if (typeof subscription.keys.p256dh !== 'string' || typeof subscription.keys.auth !== 'string') {
    return respond(400, { error: 'Invalid subscription keys' });
  }
  if (subscription.keys.p256dh.length > 256 || subscription.keys.auth.length > 256) {
    return respond(400, { error: 'Subscription keys too large' });
  }

  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + THIRTY_DAYS_SEC;

  // Check if already exists (to preserve lastConditions)
  const existing = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { endpoint: subscription.endpoint },
    })
  );

  const item = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    prefs: sanitizePrefs(prefs),
    subscribedAt: now.toISOString(),
    ttl,
    // Preserve lastConditions if updating an existing subscription
    ...(existing?.Item?.lastConditions && {
      lastConditions: existing.Item.lastConditions,
    }),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

  return respond(200, {
    ok: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    message: 'Subscription registered',
  });
}

async function handleUnsubscribe(body) {
  const { endpoint } = body;

  if (!endpoint || typeof endpoint !== 'string') {
    return respond(400, { error: 'endpoint required' });
  }

  if (!isValidPushEndpoint(endpoint)) {
    return respond(400, { error: 'Invalid push endpoint URL' });
  }

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { endpoint },
    })
  );

  return respond(200, { ok: true, message: 'Subscription removed' });
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
