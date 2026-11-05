// functions/core/audit.js
// Audit trail for money and admin actions (C-09): who did what, to which
// document, when. Platform admins can read it; nothing can change it.
// Personal data stays out: uids only, and `meta` keeps only short scalar
// values under keys that are not on the deny-list.

const MAX_META_KEYS = 12;
const MAX_STRING = 120;
const DENIED_KEY = /name|email|phone|iban|bic|note|purpose|address|token|secret|password/i;

function sanitiseMeta(meta) {
  const out = {};
  if (!meta || typeof meta !== 'object') return out;
  for (const [k, v] of Object.entries(meta)) {
    if (Object.keys(out).length >= MAX_META_KEYS) break;
    if (DENIED_KEY.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, MAX_STRING);
  }
  return out;
}

function auditRecord({ actorUid, action, spaceId = null, targetPath = null, requestId = null, meta }, at) {
  if (!actorUid || !action) throw new Error('audit record needs actorUid and action');
  return { actorUid, action, spaceId, targetPath, requestId, meta: sanitiseMeta(meta), at };
}

/**
 * Writes an audit record and resolves to its id. Pass a transaction to make it
 * part of the same atomic write as the action it records.
 */
async function record(db, entry, { tx, at } = {}) {
  const ref = db.collection('auditLog').doc();
  const data = auditRecord(entry, at || new Date());
  if (tx) tx.create(ref, data);
  else await ref.create(data);
  return ref.id;
}

module.exports = { record, auditRecord, sanitiseMeta };
