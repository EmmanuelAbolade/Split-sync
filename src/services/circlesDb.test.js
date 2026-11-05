// src/services/circlesDb.test.js
// (CRA's resetMocks wipes jest.fn implementations, so the mock is a plain function)
const mockCalls = [];
jest.mock('firebase/firestore', () => ({
  getFirestore: (...a) => { mockCalls.push(a); return { id: 'circles-db' }; },
}));
jest.mock('./firebase', () => ({ __esModule: true, default: { name: 'app' } }));

// eslint-disable-next-line import/first
import { getCirclesDb, CIRCLES_DATABASE_ID } from './circlesDb';

test('connects to the named circles database once, only when first used', () => {
  expect(mockCalls).toHaveLength(0);
  const a = getCirclesDb();
  const b = getCirclesDb();
  expect(a).toBe(b);
  expect(mockCalls).toEqual([[{ name: 'app' }, 'circles']]);
  expect(CIRCLES_DATABASE_ID).toBe('circles');
});
