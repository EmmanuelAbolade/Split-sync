// functions/core/rateLimit.js
// Fixed-window rate limit per user and action, stored in rateLimits/ (server
// only). One small transaction per call.

const { fail } = require('./errors');

/** Default limits per action family: { max calls, window seconds }. */
const LIMITS = {
  default:       { max: 30, windowSec: 60 },
  stepUpBegin:   { max: 10, windowSec: 60 },
  stepUpComplete:{ max: 10, windowSec: 60 },
  stepUpRegister:{ max: 5,  windowSec: 600 },
  adminSetFlag:  { max: 20, windowSec: 60 },
  settlements:   { max: 20, windowSec: 60 },
};

function windowStart(nowMs, windowSec) {
  const w = windowSec * 1000;
  return Math.floor(nowMs / w) * w;
}

function docIdFor(uid, action, startMs) {
  return `${uid}_${action}_${startMs}`;
}

/**
 * Counts this call and throws resource-exhausted once the limit is passed.
 * @param {FirebaseFirestore.Firestore} db  the database holding rateLimits/
 */
async function checkRateLimit(db, uid, action, nowMs = Date.now()) {
  const { max, windowSec } = LIMITS[action] || LIMITS.default;
  const start = windowStart(nowMs, windowSec);
  const ref = db.collection('rateLimits').doc(docIdFor(uid, action, start));
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= max) return false;
    tx.set(ref, {
      uid, action, count: count + 1, windowStart: start,
      // lets a TTL policy or the scheduler delete old windows
      expiresAt: new Date(start + windowSec * 1000 * 2),
    });
    return true;
  });
  if (!allowed) throw fail('resource-exhausted');
}

module.exports = { LIMITS, checkRateLimit, windowStart, docIdFor };
