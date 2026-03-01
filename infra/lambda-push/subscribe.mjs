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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    if (method === 'POST') {
      return await handleSubscribe(body);
    } else if (method === 'DELETE') {
      return await handleUnsubscribe(body);
    }

    return respond(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Handler error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
}

async function handleSubscribe(body) {
  const { subscription, prefs } = body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return respond(400, { error: 'Invalid subscription: endpoint and keys required' });
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
    keys: subscription.keys,
    prefs: prefs || {
      enabled: true,
      scoreThreshold: 70,
      windLimitMph: 20,
      swellLimitFt: 6,
    },
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

  if (!endpoint) {
    return respond(400, { error: 'endpoint required' });
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
