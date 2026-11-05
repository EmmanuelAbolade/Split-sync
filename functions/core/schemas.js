// functions/core/schemas.js
// Zod building blocks shared by every money Function (C-04: validate every
// Function input against an allow-list). Unknown keys are rejected.

const { z } = require('zod');
const { fail } = require('./errors');

/** Currencies the app offers today (CreateGroupModal). */
const CURRENCIES = ['EUR', 'USD', 'GBP'];

const SPACES = ['expenses', 'events', 'circles', 'loans', 'aid'];

const uid = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const docId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

/** Client-generated, e.g. crypto.randomUUID(). */
const idempotencyKey = z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** Opaque base64url step-up token issued by stepUp.complete. */
const stepUpToken = z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);

const currency = z.enum(CURRENCIES);

/** Integer minor units (EUR 12.34 is 1234). Upper bound keeps sums far below 2^53. */
const amountMinor = z.number().int().positive().max(100000000);

const spaceId = z.enum(SPACES);

/** 64 lowercase hex characters (SHA-256). */
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Validates `data` against `schema`. On failure, throws invalid-argument with
 * only the failing field paths (never the submitted values).
 */
function parse(schema, data) {
  const result = schema.safeParse(data === undefined ? {} : data);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || '(root)'))];
  throw fail('invalid-argument', undefined, { fields });
}

module.exports = {
  z, parse, CURRENCIES, SPACES,
  uid, docId, idempotencyKey, stepUpToken, currency, amountMinor, spaceId, sha256Hex,
};
