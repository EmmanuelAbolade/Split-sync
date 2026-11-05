// src/utils/settlements.js
// Client side of settle-up on the server (Phase 1B). Every settlement write
// goes through these Functions; the rules no longer let the app write
// settlement entries or payment locks itself. See functions/settlements/.

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase';

function call(name, data) {
  const fn = httpsCallable(getFunctions(app, 'us-central1'), `settlements-${name}`);
  return fn(data).then((r) => r.data);
}

/** 12.34 -> 1234. Amounts travel to the server as integer cents. */
export function toMinor(amount) {
  return Math.round(Number(amount) * 100);
}

/** Payer opened a payment link: remember it so we can ask "did you pay?" later. */
export function startSettlement({ groupId, toUid, amount, method }) {
  return call('start', { groupId, toUid, amountMinor: toMinor(amount), method });
}

/** Payer says they paid. The payee is asked to confirm; balances change only then. */
export function claimSettlement({ groupId, toUid, amount, method, idempotencyKey, paypalOrderId }) {
  return call('claim', {
    groupId, toUid, amountMinor: toMinor(amount), method, idempotencyKey,
    ...(paypalOrderId ? { paypalOrderId } : {}),
  });
}

/** The exact parameters the payee's step-up is bound to for a confirmation. */
export const confirmParams = (notificationId) => ({ notificationId });

/** Payee confirms a claim (needs a step-up token for confirmParams(notificationId)). */
export function confirmSettlement(notificationId, stepUpToken) {
  return call('confirm', { ...confirmParams(notificationId), stepUpToken });
}

/** Payee did not receive the money. */
export function declineSettlement(notificationId) {
  return call('decline', { notificationId });
}

/** The exact parameters the payee's step-up is bound to when recording a payment. */
export function receiveParams({ groupId, fromUid, amount, idempotencyKey }) {
  return { groupId, fromUid, amountMinor: toMinor(amount), idempotencyKey };
}

/** Payee records a payment they received (needs a step-up token for receiveParams). */
export function receiveSettlement(params, stepUpToken) {
  return call('receive', { ...receiveParams(params), stepUpToken });
}

/** Payer drops a started payment (or withdraws an unanswered claim). */
export function cancelSettlement({ groupId, toUid }) {
  return call('cancel', { groupId, toUid });
}

/** A short, safe message for a failed settlement call. */
export function settlementErrorMessage(err, fallback = 'That did not work. Please try again.') {
  const code = (err && err.code) || '';
  if (code.endsWith('failed-precondition') || code.endsWith('invalid-argument') || code.endsWith('resource-exhausted')) {
    return (err && err.message) || fallback;
  }
  if (code.endsWith('permission-denied')) return 'You are not allowed to do this.';
  return fallback;
}
