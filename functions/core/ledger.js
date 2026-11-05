// functions/core/ledger.js
// The append-only ledger (10-database-design.md §4). Entries are immutable:
// a status change is a new entry pointing at the earlier one (refEntryId),
// a correction is a reversing entry (reversesEntryId). Nothing is updated or
// deleted, and only Functions write here.
//
// Where entries live:
//   events                 -> default database, ledgerEntries/
//   circles, loans, aid    -> circles database, ledger/
//   expenses               -> stays in the existing expenses/ collection

const { z, uid, docId, currency, amountMinor, idempotencyKey } = require('./schemas');

const LEDGER_SPACES = ['events', 'circles', 'loans', 'aid'];

const CONTAINER_FOR_SPACE = { events: 'event', circles: 'circle', loans: 'loan', aid: 'aid' };

const KINDS = ['contribution', 'disbursement', 'repayment', 'pledgePayment', 'eventSpend', 'eventPledgePayment', 'reversal'];
const STATUSES = ['claimed', 'confirmed', 'declined', 'posted'];
const METHODS = ['paypal_me', 'revolut', 'sepa', 'manual'];

const SCHEMA_VERSION = 1;

const entrySchema = z.object({
  spaceId: z.enum(LEDGER_SPACES),
  containerType: z.enum(['event', 'circle', 'loan', 'aid']),
  containerId: docId,
  kind: z.enum(KINDS),
  status: z.enum(STATUSES),
  refEntryId: docId.nullable().default(null),
  reversesEntryId: docId.nullable().default(null),
  fromUid: uid.nullable().default(null),
  toUid: uid.nullable().default(null),
  amountMinor,
  currency,
  method: z.enum(METHODS).nullable().default(null),
  cycle: z.number().int().min(1).max(1000).nullable().default(null),
  instalment: z.number().int().min(1).max(1000).nullable().default(null),
  memberUids: z.array(uid).min(1).max(100),
  idempotencyKey,
  createdBy: uid,
}).strict()
  .refine((e) => CONTAINER_FOR_SPACE[e.spaceId] === e.containerType, { path: ['containerType'], message: 'space and container do not match' })
  .refine((e) => (e.kind === 'reversal') === (e.reversesEntryId !== null), { path: ['reversesEntryId'], message: 'reversals, and only reversals, name the entry they reverse' })
  .refine((e) => e.status === 'claimed' || e.status === 'posted' || e.refEntryId !== null, { path: ['refEntryId'], message: 'a confirmation or decline refers to its claim' })
  .refine((e) => e.fromUid === null || e.toUid === null || e.fromUid !== e.toUid, { path: ['toUid'], message: 'payer and payee differ' })
  .refine((e) => [e.fromUid, e.toUid, e.createdBy].every((u) => u === null || e.memberUids.includes(u)), { path: ['memberUids'], message: 'every party can read the entry' });

/** Validates an entry. Throws a plain Error (a programming error, not user input). */
function buildEntry(input) {
  const result = entrySchema.safeParse(input);
  if (!result.success) {
    const where = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid ledger entry (${where})`);
  }
  return { ...result.data, schemaVersion: SCHEMA_VERSION };
}

function collectionFor(spaceId) {
  if (spaceId === 'events') return 'ledgerEntries';
  if (LEDGER_SPACES.includes(spaceId)) return 'ledger';
  throw new Error(`no ledger for space ${spaceId}`);
}

/**
 * Adds a validated entry inside the caller's transaction and returns its id.
 * The container's currency must match the entry's (FR-CORE-03).
 */
function post(tx, db, input, { containerCurrency, createdAt }) {
  const entry = buildEntry(input);
  if (containerCurrency !== entry.currency) {
    throw new Error('entry currency differs from its container');
  }
  const ref = db.collection(collectionFor(entry.spaceId)).doc();
  tx.create(ref, { ...entry, createdAt });
  return ref.id;
}

/**
 * Sums confirmed or posted amounts of one kind for one container and currency,
 * minus reversals of those entries. Filtering by space, container and currency
 * first makes cross-space or cross-currency totals impossible.
 */
function sumConfirmed(entries, { spaceId, containerId, currency: cur, kind }) {
  const scoped = entries.filter((e) => e.spaceId === spaceId && e.containerId === containerId && e.currency === cur);
  const counted = new Map();
  for (const e of scoped) {
    if (e.kind === kind && (e.status === 'confirmed' || e.status === 'posted')) {
      counted.set(e.refEntryId || e.entryId, e.amountMinor);
    }
  }
  let total = 0;
  for (const v of counted.values()) total += v;
  for (const e of scoped) {
    if (e.kind === 'reversal' && counted.has(e.reversesEntryId)) total -= e.amountMinor;
  }
  return total;
}

module.exports = {
  LEDGER_SPACES, KINDS, STATUSES, METHODS, SCHEMA_VERSION,
  buildEntry, collectionFor, post, sumConfirmed,
};
