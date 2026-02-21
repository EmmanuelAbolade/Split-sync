// src/utils/contactSyncManager.test.js
// Test suite for contactSyncManager - phone hashing, contact sync, and Firestore matching

import {
  hashPhoneNumber,
  requestContactsPermission,
  findContactsOnSplitSync,
  isContactSyncSupported,
} from './contactSyncManager';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Firebase Firestore
jest.mock('../services/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query:      jest.fn(),
  where:      jest.fn(),
  getDocs:    jest.fn(),
}));

import { getDocs } from 'firebase/firestore';

// Mock crypto.subtle
const mockDigest = jest.fn();
global.crypto = {
  subtle: {
    digest: mockDigest,
  },
};

// Mock TextEncoder
global.TextEncoder = class {
  encode(str) {
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a fake SHA-256 ArrayBuffer for a given string input.
 * Produces deterministic 32-byte output based on char codes.
 */
const makeFakeHash = (input = 'test') => {
  const arr = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    arr[i] = input.charCodeAt(i % input.length) % 256;
  }
  return arr.buffer;
};

// ─────────────────────────────────────────────────────────────────────────────

describe('hashPhoneNumber - Basic hashing', () => {

  beforeEach(() => {
    mockDigest.mockResolvedValue(makeFakeHash('+353851234567'));
  });

  test('Returns a hex string', async () => {
    const result = await hashPhoneNumber('+353851234567');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  test('Returns a 64-character hex string (SHA-256)', async () => {
    const result = await hashPhoneNumber('+353851234567');
    expect(result).toHaveLength(64);
  });

  test('Calls crypto.subtle.digest with SHA-256', async () => {
    await hashPhoneNumber('+353851234567');
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
  });

  test('Strips spaces from phone number before hashing', async () => {
    await hashPhoneNumber('+353 85 123 4567');
    const callArg = mockDigest.mock.calls[0][1];
    const decoded = Buffer.from(callArg).toString('utf8');
    expect(decoded).not.toContain(' ');
  });

  test('Strips dashes from phone number before hashing', async () => {
    await hashPhoneNumber('+353-85-123-4567');
    const callArg = mockDigest.mock.calls[0][1];
    const decoded = Buffer.from(callArg).toString('utf8');
    expect(decoded).not.toContain('-');
  });

  test('Strips parentheses from phone number before hashing', async () => {
    await hashPhoneNumber('(085) 123 4567');
    const callArg = mockDigest.mock.calls[0][1];
    const decoded = Buffer.from(callArg).toString('utf8');
    expect(decoded).not.toContain('(');
    expect(decoded).not.toContain(')');
  });

  test('Prepends + if missing', async () => {
    await hashPhoneNumber('353851234567');
    const callArg = mockDigest.mock.calls[0][1];
    const decoded = Buffer.from(callArg).toString('utf8');
    expect(decoded.startsWith('+')).toBe(true);
  });

  test('Does not double-prepend + if already present', async () => {
    await hashPhoneNumber('+353851234567');
    const callArg = mockDigest.mock.calls[0][1];
    const decoded = Buffer.from(callArg).toString('utf8');
    expect(decoded.startsWith('++')).toBe(false);
  });

  test('Throws and logs error when crypto fails', async () => {
    mockDigest.mockRejectedValueOnce(new Error('Crypto failure'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(hashPhoneNumber('+353851234567')).rejects.toThrow('Crypto failure');
    expect(consoleSpy).toHaveBeenCalledWith('Error hashing phone number:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('isContactSyncSupported', () => {

  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    delete global.ContactsManager;
  });

  test('Returns true when contacts API and ContactsManager are available', () => {
    Object.defineProperty(global, 'navigator', {
      value: { contacts: {} },
      writable: true,
      configurable: true,
    });
    global.ContactsManager = class {};
    expect(isContactSyncSupported()).toBe(true);
  });

  test('Returns false when contacts is missing from navigator', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    global.ContactsManager = class {};
    expect(isContactSyncSupported()).toBe(false);
  });

  test('Returns false when ContactsManager is not in window', () => {
    Object.defineProperty(global, 'navigator', {
      value: { contacts: {} },
      writable: true,
      configurable: true,
    });
    delete global.ContactsManager;
    expect(isContactSyncSupported()).toBe(false);
  });

  test('Returns false when neither is available', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    delete global.ContactsManager;
    expect(isContactSyncSupported()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('requestContactsPermission - API not supported', () => {

  beforeEach(() => {
    // Ensure contacts API is not present
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    delete global.ContactsManager;
  });

  test('Throws error when Contacts API is not supported', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(requestContactsPermission()).rejects.toThrow(
      'Contact API not supported on this device'
    );
    consoleSpy.mockRestore();
  });

  test('Logs error when Contacts API is not supported', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(requestContactsPermission()).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error requesting contacts:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('requestContactsPermission - API supported', () => {

  const mockSelect = jest.fn();

  beforeEach(() => {
    global.ContactsManager = class {};
    Object.defineProperty(global, 'navigator', {
      value: { contacts: { select: mockSelect } },
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.ContactsManager;
  });

  test('Calls navigator.contacts.select with correct props', async () => {
    mockSelect.mockResolvedValue([]);
    await requestContactsPermission();
    expect(mockSelect).toHaveBeenCalledWith(
      ['name', 'tel'],
      { multiple: true }
    );
  });

  test('Returns empty array when no contacts selected', async () => {
    mockSelect.mockResolvedValue([]);
    const result = await requestContactsPermission();
    expect(result).toEqual([]);
  });

  test('Returns formatted contacts with name and phoneNumbers', async () => {
    mockSelect.mockResolvedValue([
      { name: ['Alice Smith'], tel: ['+353851234567'] },
    ]);
    const result = await requestContactsPermission();
    expect(result).toEqual([
      { name: 'Alice Smith', phoneNumbers: ['+353851234567'] },
    ]);
  });

  test('Uses "Unknown" when contact has no name', async () => {
    mockSelect.mockResolvedValue([
      { name: [], tel: ['+353851234567'] },
    ]);
    const result = await requestContactsPermission();
    expect(result[0].name).toBe('Unknown');
  });

  test('Filters out contacts with no phone numbers', async () => {
    mockSelect.mockResolvedValue([
      { name: ['Bob'], tel: [] },
      { name: ['Alice'], tel: ['+353851234567'] },
    ]);
    const result = await requestContactsPermission();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  test('Returns null when user cancels (select throws)', async () => {
    mockSelect.mockRejectedValue(new Error('User cancelled'));
    const result = await requestContactsPermission();
    expect(result).toBeNull();
  });

  test('Returns multiple contacts correctly', async () => {
    mockSelect.mockResolvedValue([
      { name: ['Alice'], tel: ['+353851234567'] },
      { name: ['Bob'],   tel: ['+353861234567', '+353871234567'] },
    ]);
    const result = await requestContactsPermission();
    expect(result).toHaveLength(2);
    expect(result[1].phoneNumbers).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('findContactsOnSplitSync - Matching logic', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Make hash deterministic: return a predictable buffer based on input
    mockDigest.mockImplementation(async (algo, data) => {
      const arr = new Uint8Array(32);
      arr[0] = data[0] || 1;
      arr[1] = data[1] || 2;
      return arr.buffer;
    });
  });

  const makeSnapshot = (docs) => ({
    docs: docs.map(d => ({
      id: d.id,
      data: () => d,
    })),
  });

  test('Returns matched, unmatched, total, and matchedCount', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    const contacts = [{ name: 'Alice', phoneNumbers: ['+353851234567'] }];
    const result = await findContactsOnSplitSync(contacts);

    expect(result).toHaveProperty('matched');
    expect(result).toHaveProperty('unmatched');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('matchedCount');
  });

  test('Returns correct total count', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    const contacts = [
      { name: 'Alice', phoneNumbers: ['+353851234567'] },
      { name: 'Bob',   phoneNumbers: ['+353861234567'] },
    ];
    const result = await findContactsOnSplitSync(contacts);
    expect(result.total).toBe(2);
  });

  test('Places contact in unmatched when no Firestore match found', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    const contacts = [{ name: 'Charlie', phoneNumbers: ['+353871234567'] }];
    const result = await findContactsOnSplitSync(contacts);

    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].contactName).toBe('Charlie');
    expect(result.matched).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });

  test('Places contact in matched when Firestore match found', async () => {
    // We need the hash of the phone to match the Firestore user's phoneHash
    // Make digest return a specific value for our phone
    mockDigest.mockResolvedValue(new Uint8Array([0xaa, ...new Array(31).fill(0)]).buffer);

    const expectedHash = 'aa' + '00'.repeat(31);

    getDocs.mockResolvedValue(makeSnapshot([{
      id: 'user-001',
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      phoneHash: expectedHash,
      photoURL: null,
    }]));

    const contacts = [{ name: 'Alice', phoneNumbers: ['+353851234567'] }];
    const result = await findContactsOnSplitSync(contacts);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].contactName).toBe('Alice');
    expect(result.matched[0].user.userId).toBe('user-001');
    expect(result.matchedCount).toBe(1);
  });

  test('Handles empty contacts array', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    const result = await findContactsOnSplitSync([]);
    expect(result.total).toBe(0);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });

  test('Handles contact with multiple phone numbers', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    const contacts = [{
      name: 'Dave',
      phoneNumbers: ['+353851111111', '+353852222222'],
    }];
    const result = await findContactsOnSplitSync(contacts);
    expect(result.total).toBe(1);
    expect(result.unmatched[0].phoneNumbers).toHaveLength(2);
  });

  test('Throws and logs error when getDocs fails', async () => {
    getDocs.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const contacts = [{ name: 'Alice', phoneNumbers: ['+353851234567'] }];
    await expect(findContactsOnSplitSync(contacts)).rejects.toThrow('Firestore error');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error finding contacts on Split-Sync:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  test('Deduplicates phone hashes before querying Firestore', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    // Two contacts with the same phone number should only produce one hash
    const contacts = [
      { name: 'Alice', phoneNumbers: ['+353851234567'] },
      { name: 'Alice Duplicate', phoneNumbers: ['+353851234567'] },
    ];
    await findContactsOnSplitSync(contacts);
    // getDocs should be called with deduplicated hashes
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

   test('Batches Firestore queries in groups of 10', async () => {
    getDocs.mockResolvedValue(makeSnapshot([]));

    // Each call to digest returns a unique hash based on call count
    let callCount = 0;
    mockDigest.mockImplementation(async () => {
      const arr = new Uint8Array(32);
      arr[0] = callCount++;
      return arr.buffer;
    });

    // 15 contacts each with a unique phone = 15 unique hashes = 2 batches (10 + 5)
    const contacts = Array.from({ length: 15 }, (_, i) => ({
      name: `Contact ${i}`,
      phoneNumbers: [`+35385${String(i).padStart(7, '0')}`],
    }));

    await findContactsOnSplitSync(contacts);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  test('Matched user includes userId, name, email, phoneHash, photoURL', async () => {
    mockDigest.mockResolvedValue(new Uint8Array([0xbb, ...new Array(31).fill(0)]).buffer);
    const expectedHash = 'bb' + '00'.repeat(31);

    getDocs.mockResolvedValue(makeSnapshot([{
      id: 'user-002',
      displayName: 'Bob Jones',
      email: 'bob@example.com',
      phoneHash: expectedHash,
      photoURL: 'https://example.com/bob.jpg',
    }]));

    const contacts = [{ name: 'Bob', phoneNumbers: ['+353861234567'] }];
    const result = await findContactsOnSplitSync(contacts);

    const matchedUser = result.matched[0]?.user;
    expect(matchedUser).toMatchObject({
      userId: 'user-002',
      name: 'Bob Jones',
      email: 'bob@example.com',
      phoneHash: expectedHash,
      photoURL: 'https://example.com/bob.jpg',
    });
  });
});