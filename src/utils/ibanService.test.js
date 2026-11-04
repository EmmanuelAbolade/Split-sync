const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (...a) => mockHttpsCallable(...a),
}));
jest.mock('../services/firebase', () => ({ __esModule: true, default: {} }));

import { encryptIban, fetchIban } from './ibanService';

beforeEach(() => {
  mockCallable.mockReset();
  mockHttpsCallable.mockReset().mockImplementation(() => mockCallable);
});

test('encryptIban sends the plain IBAN to the encryptIban function and returns the ciphertext', async () => {
  mockCallable.mockResolvedValue({ data: { encryptedIBAN: 'v2:abc' } });
  await expect(encryptIban('IE29AIBK93115212345678')).resolves.toBe('v2:abc');
  expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'encryptIban');
  expect(mockCallable).toHaveBeenCalledWith({ iban: 'IE29AIBK93115212345678' });
});

test('encryptIban surfaces server validation errors', async () => {
  mockCallable.mockRejectedValue(new Error('Please enter a valid IBAN.'));
  await expect(encryptIban('bad')).rejects.toThrow('Please enter a valid IBAN.');
});

test('fetchIban sends groupId only when given', async () => {
  mockCallable.mockResolvedValue({ data: { iban: 'IE29' } });
  await fetchIban('me');
  expect(mockCallable).toHaveBeenLastCalledWith({ userId: 'me' });
  await fetchIban('bob', 'g1');
  expect(mockCallable).toHaveBeenLastCalledWith({ userId: 'bob', groupId: 'g1' });
  expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'getIban');
});

test('fetchIban returns null when there is no IBAN or the server refuses', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCallable.mockResolvedValueOnce({ data: { iban: null } });
  await expect(fetchIban('me')).resolves.toBeNull();
  mockCallable.mockRejectedValueOnce(new Error('permission-denied'));
  await expect(fetchIban('stranger', 'g1')).resolves.toBeNull();
  spy.mockRestore();
});
