// src/__mocks__/firebaseFirestore.js
// Mock Firestore for testing

export const mockDoc = {
  id: 'test-doc-id',
  data: () => ({ name: 'Test Data' }),
  exists: () => true,
};

export const getDoc = jest.fn(() => Promise.resolve(mockDoc));

export const setDoc = jest.fn(() => Promise.resolve());

export const updateDoc = jest.fn(() => Promise.resolve());

export const deleteDoc = jest.fn(() => Promise.resolve());

export const collection = jest.fn(() => ({}));

export const doc = jest.fn(() => ({}));

export const query = jest.fn(() => ({}));

export const where = jest.fn(() => ({}));

export const getDocs = jest.fn(() => 
  Promise.resolve({
    docs: [mockDoc],
    forEach: (callback) => [mockDoc].forEach(callback),
  })
);

export const addDoc = jest.fn(() => 
  Promise.resolve({ id: 'new-doc-id' })
);

export const serverTimestamp = jest.fn(() => new Date());

export const arrayUnion = jest.fn((val) => val);

export const arrayRemove = jest.fn((val) => val);

export const onSnapshot = jest.fn((ref, callback) => {
  callback({ exists: () => false, data: () => ({}) });
  return jest.fn();
});

export const writeBatch = jest.fn(() => ({
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
}));