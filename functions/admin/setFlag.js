// functions/admin/setFlag.js
// The only way to change config/features. Platform admins only (custom claim),
// validated, audit-logged. Exported as admin-setFlag.

const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { requireAdmin } = require('../core/authz');
const { checkRateLimit } = require('../core/rateLimit');
const { parse, z, uid: uidSchema } = require('../core/schemas');
const { FLAG_NAMES, MAX_ALLOW_UIDS, clearCache } = require('../core/flags');
const { toHttpsError } = require('../core/errors');
const audit = require('../core/audit');

const schema = z.object({
  flag: z.enum(FLAG_NAMES),
  enabled: z.boolean(),
  allowUids: z.array(uidSchema).max(MAX_ALLOW_UIDS).default([]),
}).strict();

/** Applies a flag change in one transaction with its audit record. */
async function setFlag({ db, actorUid, data, nowMs = Date.now() }) {
  const { flag, enabled, allowUids } = parse(schema, data);
  const unique = [...new Set(allowUids)];
  const ref = db.doc('config/features');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? snap.data()[flag] : undefined;
    tx.set(ref, {
      [flag]: { enabled, allowUids: unique },
      updatedAt: new Date(nowMs),
      updatedBy: actorUid,
    }, { merge: true });
    await audit.record(db, {
      actorUid, action: 'admin.setFlag', targetPath: 'config/features',
      meta: {
        flag, enabled, allowCount: unique.length,
        wasEnabled: Boolean(before && before.enabled), wasAllowCount: before && Array.isArray(before.allowUids) ? before.allowUids.length : 0,
      },
    }, { tx, at: new Date(nowMs) });
  });
  clearCache();
  return { flag, enabled, allowUids: unique };
}

const callable = onCall(async (request) => {
  try {
    const actorUid = requireAdmin(request);
    const db = admin.firestore();
    await checkRateLimit(db, actorUid, 'adminSetFlag');
    return await setFlag({ db, actorUid, data: request.data });
  } catch (err) {
    throw toHttpsError(err, 'admin-setFlag');
  }
});

module.exports = { setFlag, callable };
