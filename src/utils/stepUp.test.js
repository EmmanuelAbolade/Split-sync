// src/utils/stepUp.test.js
// The browser's action hash must equal the server's for the same action, or
// every step-up would fail. Both are checked against the same fixtures.

import { webcrypto } from 'crypto';
import FIXTURES from '../../functions/core/canonical.fixtures.json';

const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_f, name) => (data) => mockCallable(name, data),
}));
const mockReauthCred = jest.fn(() => Promise.resolve());
const mockReauthPopup = jest.fn(() => Promise.resolve());
jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email, pw) => ({ email, pw }) },
  GoogleAuthProvider: function GoogleAuthProvider() {},
  reauthenticateWithCredential: (...a) => mockReauthCred(...a),
  reauthenticateWithPopup: (...a) => mockReauthPopup(...a),
}));
const mockStartAuth = jest.fn();
const mockStartReg = jest.fn();
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: (...a) => mockStartAuth(...a),
  startRegistration: (...a) => mockStartReg(...a),
  browserSupportsWebAuthn: () => true,
}));
jest.mock('../services/firebase', () => ({ __esModule: true, default: {}, auth: { currentUser: null } }));

// eslint-disable-next-line import/first
import * as stepUp from './stepUp';
// eslint-disable-next-line import/first
import { auth as mockAuth } from '../services/firebase';

beforeAll(() => {
  if (!window.crypto || !window.crypto.subtle) {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  }
});

beforeEach(() => {
  mockCallable.mockReset().mockImplementation((name) => Promise.resolve({ data: { name } }));
  mockAuth.currentUser = null;
});

test('canonicalJson sorts keys and drops undefined, like the server', () => {
  expect(stepUp.canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null }, u: undefined }))
    .toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  expect(() => stepUp.canonicalJson({ x: Infinity })).toThrow();
});

test('actionHash matches the server for every shared fixture', async () => {
  for (const f of FIXTURES) {
    // eslint-disable-next-line no-await-in-loop
    expect(await stepUp.actionHash(f.action, f.params)).toBe(f.hash);
  }
});

test('actionHash ignores only the step-up token', async () => {
  const p = { amountMinor: 1, idempotencyKey: 'k'.repeat(20) };
  expect(await stepUp.actionHash('a', { ...p, stepUpToken: 'x' })).toBe(await stepUp.actionHash('a', p));
  expect(await stepUp.actionHash('a', { ...p, amountMinor: 2 })).not.toBe(await stepUp.actionHash('a', p));
});

test('beginStepUp sends only the hash, never the parameters', async () => {
  await stepUp.beginStepUp(FIXTURES[0].action, FIXTURES[0].params);
  expect(mockCallable).toHaveBeenCalledWith('stepUp-begin', { actionHash: FIXTURES[0].hash });
});

test('completeWithPasskey runs the browser ceremony and sends the response', async () => {
  mockStartAuth.mockResolvedValue({ id: 'cred' });
  await stepUp.completeWithPasskey('ch1', { challenge: 'c' });
  expect(mockStartAuth).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } });
  expect(mockCallable).toHaveBeenCalledWith('stepUp-complete', { method: 'webauthn', challengeId: 'ch1', response: { id: 'cred' } });
});

test('completeWithRecentLogin', async () => {
  await stepUp.completeWithRecentLogin('ch2');
  expect(mockCallable).toHaveBeenCalledWith('stepUp-complete', { method: 'recentLogin', challengeId: 'ch2' });
});

test('reauthenticate uses the password, then refreshes the token', async () => {
  const getIdToken = jest.fn(() => Promise.resolve('t'));
  mockAuth.currentUser = { email: 'a@x.com', providerData: [{ providerId: 'password' }], getIdToken };
  expect(stepUp.reauthMethod()).toBe('password');
  await stepUp.reauthenticate('pw');
  expect(mockReauthCred).toHaveBeenCalledWith(mockAuth.currentUser, { email: 'a@x.com', pw: 'pw' });
  expect(getIdToken).toHaveBeenCalledWith(true);
});

test('reauthenticate uses Google for Google accounts, and fails without a method', async () => {
  mockAuth.currentUser = { providerData: [{ providerId: 'google.com' }], getIdToken: jest.fn() };
  await stepUp.reauthenticate();
  expect(mockReauthPopup).toHaveBeenCalled();
  mockAuth.currentUser = { providerData: [], getIdToken: jest.fn() };
  expect(stepUp.reauthMethod()).toBeNull();
  await expect(stepUp.reauthenticate()).rejects.toThrow();
  mockAuth.currentUser = null;
  await expect(stepUp.reauthenticate()).rejects.toThrow('not signed in');
});

test('passkey management calls', async () => {
  mockCallable.mockImplementation((name) => Promise.resolve({
    data: name === 'stepUp-registerBegin' ? { challengeId: 'r1', webauthn: { challenge: 'x' } }
      : name === 'stepUp-listCredentials' ? { credentials: [{ id: 'a' }] } : {},
  }));
  mockStartReg.mockResolvedValue({ id: 'new' });
  await stepUp.registerPasskey('Laptop');
  expect(mockCallable).toHaveBeenLastCalledWith('stepUp-registerComplete', { challengeId: 'r1', response: { id: 'new' }, label: 'Laptop' });
  expect(await stepUp.listPasskeys()).toEqual([{ id: 'a' }]);
  await stepUp.removePasskey('a');
  expect(mockCallable).toHaveBeenLastCalledWith('stepUp-removeCredential', { id: 'a' });
  expect(stepUp.passkeysSupported()).toBe(true);
});

test('stepUpHint and newIdempotencyKey', () => {
  expect(stepUp.stepUpHint({ details: { stepUp: 'reauth' } })).toBe('reauth');
  expect(stepUp.stepUpHint(new Error('x'))).toBeNull();
  if (!window.crypto.randomUUID) return;
  expect(stepUp.newIdempotencyKey()).toMatch(/^[0-9a-f-]{36}$/);
});
