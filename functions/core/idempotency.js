// functions/core/idempotency.js
// Makes a money action safe to retry. The first call with a key does the work
// and stores its result in the SAME transaction; a repeat with the same key and
// the same request returns the stored result; the same key with a different
// request is refused.
//
// idempotency/{uid}_{key} lives in the same database as the write it protects
// (10-database-design.md §1, principle 6), so check and write are atomic.

const { fail } = require('./errors');
const { canonicalJson, sha256Hex } = require('./canonical');

function requestHashFor(fn, data) {
  // eslint-disable-next-line no-unused-vars
  const { stepUpToken, ...rest } = data || {};
  return sha256Hex(canonicalJson({ fn, data: rest }));
}

/**
 * Looks up a stored result without doing any work (outside a transaction).
 * Returns { found: false } or { found: true, result }. Throws already-exists
 * when the key was used for a different request.
 */
async function peek(db, { uid, key, fn, data }) {
  const snap = await db.collection('idempotency').doc(`${uid}_${key}`).get();
  if (!snap.exists) return { found: false };
  const rec = snap.data();
  if (rec.fn !== fn || rec.requestHash !== requestHashFor(fn, data)) {
    throw fail('already-exists', 'This request reference was already used for something else.');
  }
  return { found: true, result: rec.result };
}

/**
 * Runs `work(tx)` once per (uid, key). `work` must do all its reads before its
 * writes (a Firestore transaction rule) and return a plain, JSON-safe result.
 * @returns {Promise<{result: any, replayed: boolean}>}
 */
async function runIdempotent(db, { uid, key, fn, data, now = () => new Date() }, work) {
  const ref = db.collection('idempotency').doc(`${uid}_${key}`);
  const requestHash = requestHashFor(fn, data);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const rec = snap.data();
      if (rec.fn !== fn || rec.requestHash !== requestHash) {
        throw fail('already-exists', 'This request reference was already used for something else.');
      }
      return { result: rec.result, replayed: true };
    }
    const result = await work(tx);
    const createdAt = now();
    tx.set(ref, {
      uid, fn, requestHash, result: result === undefined ? null : result, createdAt,
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000),
    });
    return { result, replayed: false };
  });
}

module.exports = { runIdempotent, peek, requestHashFor };
