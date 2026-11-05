// functions/settlements/index.js
// Callables exported as the group `settlements` (deployed as settlements-claim,
// settlements-confirm, ...). Logic lives in ./service.js.

const { onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { requireAuth } = require('../core/authz');
const { checkRateLimit } = require('../core/rateLimit');
const { toHttpsError } = require('../core/errors');
const service = require('./service');

function callable(handler, label) {
  return onCall(async (request) => {
    try {
      const uid = requireAuth(request);
      const db = admin.firestore();
      await checkRateLimit(db, uid, 'settlements');
      return await handler({ db, uid, data: request.data });
    } catch (err) {
      throw toHttpsError(err, `settlements.${label}`);
    }
  });
}

/** Drops started (not yet claimed) payment locks when a new ordinary expense is added. */
const onExpenseCreated = onDocumentCreated(
  { document: 'expenses/{expenseId}', region: 'europe-west1' },
  async (event) => {
    const e = event.data && event.data.data();
    if (!e || e.isSettlement || typeof e.groupId !== 'string' || !e.groupId) return;
    try {
      await service.clearStartedLocks(admin.firestore(), e.groupId);
    } catch (err) {
      console.error('settlements.onExpenseCreated failed:', err && err.message);
    }
  },
);

module.exports = {
  start: callable(service.start, 'start'),
  claim: callable(service.claim, 'claim'),
  confirm: callable(service.confirm, 'confirm'),
  decline: callable(service.decline, 'decline'),
  receive: callable(service.receive, 'receive'),
  cancel: callable(service.cancel, 'cancel'),
  onExpenseCreated,
};
