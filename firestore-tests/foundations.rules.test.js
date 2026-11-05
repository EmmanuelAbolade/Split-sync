// Rules tests for the Phase 1 additions to the default database
// (firestore.rules): feature flags and server-only collections.

const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-splitsync',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

const SERVER_ONLY = ['stepUpCredentials/c1', 'stepUpChallenges/h1', 'stepUpTokens/t1', 'idempotency/alice_k', 'rateLimits/r1'];

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/features'), { circlesEnabled: { enabled: false, allowUids: [] } });
    for (const p of SERVER_ONLY) await setDoc(doc(db, p), { uid: 'alice' });
    await setDoc(doc(db, 'auditLog/a1'), { actorUid: 'alice', action: 'x' });
  });
});

const as = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();
const admin = () => as('admin', { admin: true });

test('feature flags: readable when signed in, never writable from the client', async () => {
  await assertSucceeds(getDoc(doc(as('alice'), 'config/features')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/features')));
  await assertFails(updateDoc(doc(as('alice'), 'config/features'), { circlesEnabled: { enabled: true, allowUids: [] } }));
  await assertFails(setDoc(doc(admin(), 'config/features'), { circlesEnabled: { enabled: true } }));
  await assertFails(getDoc(doc(as('alice'), 'config/other')));
});

test('step-up, idempotency and rate-limit records are server only, even for their owner and admins', async () => {
  for (const p of SERVER_ONLY) {
    await assertFails(getDoc(doc(as('alice'), p)));
    await assertFails(getDoc(doc(admin(), p)));
    await assertFails(setDoc(doc(as('alice'), p), { uid: 'alice', used: false }));
  }
});

test('audit log: admins read, nobody writes', async () => {
  await assertSucceeds(getDoc(doc(admin(), 'auditLog/a1')));
  await assertFails(getDoc(doc(as('alice'), 'auditLog/a1')));
  await assertFails(setDoc(doc(admin(), 'auditLog/a2'), { actorUid: 'admin' }));
  await assertFails(updateDoc(doc(admin(), 'auditLog/a1'), { action: 'changed' }));
});
