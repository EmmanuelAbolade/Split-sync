// src/__mocks__/firebaseAuth.js
// Mock Firebase Authentication for testing

export const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
};

export const signInWithEmailAndPassword = jest.fn(() => 
  Promise.resolve({ user: mockUser })
);

export const createUserWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: mockUser })
);

export const signOut = jest.fn(() => Promise.resolve());

export const onAuthStateChanged = jest.fn((auth, callback) => {
  callback(mockUser);
  return jest.fn(); // Unsubscribe function
});

export const GoogleAuthProvider = jest.fn();

export const signInWithPopup = jest.fn(() =>
  Promise.resolve({ user: mockUser })
);

export const sendPasswordResetEmail = jest.fn(() => Promise.resolve());

export const updateProfile = jest.fn(() => Promise.resolve());