// functions/stepUp/index.js
// Callables (exported as the group `stepUp`, so the deployed names are
// stepUp-begin, stepUp-complete, ...). Logic lives in ./service.js.

const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const webauthn = require('@simplewebauthn/server');
const { requireAuth } = require('../core/authz');
const { checkRateLimit } = require('../core/rateLimit');
const { toHttpsError } = require('../core/errors');
const service = require('./service');

function callable(limitKey, handler) {
  return onCall(async (request) => {
    try {
      const uid = requireAuth(request);
      const db = admin.firestore();
      await checkRateLimit(db, uid, limitKey);
      return await handler({
        db, webauthn, uid, data: request.data, request, rawRequest: request.rawRequest,
      });
    } catch (err) {
      throw toHttpsError(err, `stepUp (${limitKey})`);
    }
  });
}

module.exports = {
  begin: callable('stepUpBegin', service.begin),
  complete: callable('stepUpComplete', service.complete),
  registerBegin: callable('stepUpRegister', service.registerBegin),
  registerComplete: callable('stepUpRegister', service.registerComplete),
  listCredentials: callable('default', service.listCredentials),
  removeCredential: callable('stepUpRegister', service.removeCredential),
};
