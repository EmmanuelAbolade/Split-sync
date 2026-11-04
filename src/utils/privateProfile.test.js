const mockDocs = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockCallable = jest.fn();

jest.mock('../services/firebase', () => ({ __esModule: true, default: {}, db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...parts) => ({ path: parts.join('/') }),
  getDoc: async (ref) => ({ exists: () => ref.path in mockDocs, data: () => mockDocs[ref.path] }),
  setDoc: (...a) => mockSetDoc(...a),
  updateDoc: (...a) => mockUpdateDoc(...a),
  deleteField: () => '__delete__',
}));
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => (...a) => mockCallable(...a),
}));

import {
  loadMyPrivateDetails, saveMyPaymentMethods, saveMyPhoneNumber, fetchGroupPaymentMethods,
} from './privateProfile';

beforeEach(() => {
  Object.keys(mockDocs).forEach(k => delete mockDocs[k]);
  mockSetDoc.mockReset().mockResolvedValue();
  mockUpdateDoc.mockReset().mockResolvedValue();
  mockCallable.mockReset();
});

test('loads private details without touching an already-migrated profile', async () => {
  mockDocs['users/u1'] = { displayName: 'A' };
  mockDocs['users/u1/private/details'] = { paymentMethods: { paypalUsername: 'a' }, phoneNumber: '+1' };
  await expect(loadMyPrivateDetails('u1')).resolves.toEqual({ paymentMethods: { paypalUsername: 'a' }, phoneNumber: '+1' });
  expect(mockSetDoc).not.toHaveBeenCalled();
  expect(mockUpdateDoc).not.toHaveBeenCalled();
});

test('migrates legacy fields from the public profile into the private doc', async () => {
  mockDocs['users/u2'] = { displayName: 'B', phoneNumber: '+353', paymentMethods: { revolutUsername: 'b' } };
  const data = await loadMyPrivateDetails('u2');
  expect(data).toEqual({ paymentMethods: { revolutUsername: 'b' }, phoneNumber: '+353' });
  expect(mockSetDoc).toHaveBeenCalledWith({ path: 'users/u2/private/details' }, data, { merge: true });
  expect(mockUpdateDoc).toHaveBeenCalledWith({ path: 'users/u2' }, { paymentMethods: '__delete__', phoneNumber: '__delete__' });
});

test('returns empty defaults for a brand-new user', async () => {
  await expect(loadMyPrivateDetails('new')).resolves.toEqual({ paymentMethods: {}, phoneNumber: '' });
});

test('save functions replace only their own field in the private doc', async () => {
  await saveMyPaymentMethods('u1', { paypalUsername: 'x' });
  expect(mockSetDoc).toHaveBeenLastCalledWith(
    { path: 'users/u1/private/details' },
    expect.objectContaining({ paymentMethods: { paypalUsername: 'x' } }),
    { mergeFields: ['paymentMethods', 'updatedAt'] }
  );
  await saveMyPhoneNumber('u1', '+44');
  expect(mockSetDoc).toHaveBeenLastCalledWith(
    { path: 'users/u1/private/details' },
    expect.objectContaining({ phoneNumber: '+44' }),
    { mergeFields: ['phoneNumber', 'updatedAt'] }
  );
});

test('fetchGroupPaymentMethods returns the server map, or {} on failure', async () => {
  mockCallable.mockResolvedValueOnce({ data: { methods: { bob: { paypalUsername: 'bob', hasIban: true } } } });
  await expect(fetchGroupPaymentMethods('g1')).resolves.toEqual({ bob: { paypalUsername: 'bob', hasIban: true } });
  expect(mockCallable).toHaveBeenCalledWith({ groupId: 'g1' });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCallable.mockRejectedValueOnce(new Error('permission-denied'));
  await expect(fetchGroupPaymentMethods('g1')).resolves.toEqual({});
  spy.mockRestore();
});
