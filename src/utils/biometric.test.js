// src/utils/biometric.test.js
// Test suite for biometric authentication utility
// Covers: isBiometricAvailable, isBiometricEnabledOnDevice, authenticateWithBiometric,
//         registerBiometric, enableBiometric, disableBiometric, getDeviceInfo

import {
  isBiometricAvailable,
  isBiometricEnabledOnDevice,
  authenticateWithBiometric,
  registerBiometric,
  enableBiometric,
  disableBiometric,
  getDeviceInfo,
} from './biometric';

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
    clear:      ()           => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── crypto mock ──────────────────────────────────────────────────────────────

window.crypto = {
  getRandomValues: (arr) => { arr.fill(1); return arr; },
};

// ─── alert mock ───────────────────────────────────────────────────────────────

window.alert = jest.fn();

// ─────────────────────────────────────────────────────────────────────────────

describe('isBiometricAvailable', () => {

  afterEach(() => {
    delete window.PublicKeyCredential;
  });

  test('Returns true when PublicKeyCredential is available', () => {
    window.PublicKeyCredential = class {};
    expect(isBiometricAvailable()).toBe(true);
  });

  test('Returns false when PublicKeyCredential is not available', () => {
    delete window.PublicKeyCredential;
    expect(isBiometricAvailable()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('isBiometricEnabledOnDevice', () => {

  beforeEach(() => localStorageMock.clear());

  test('Returns false when neither enabled flag nor credential exist', () => {
    expect(isBiometricEnabledOnDevice('user-1')).toBe(false);
  });

  test('Returns false when enabled flag is true but credential is missing', () => {
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    expect(isBiometricEnabledOnDevice('user-1')).toBe(false);
  });

  test('Returns false when credential exists but enabled flag is not true', () => {
    localStorageMock.setItem('biometric_credential_user-1', 'abc123');
    expect(isBiometricEnabledOnDevice('user-1')).toBe(false);
  });

  test('Returns true when both enabled flag and credential exist', () => {
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    localStorageMock.setItem('biometric_credential_user-1', 'abc123');
    expect(isBiometricEnabledOnDevice('user-1')).toBe(true);
  });

  test('Returns false for a different userId even when another user is enabled', () => {
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    localStorageMock.setItem('biometric_credential_user-1', 'abc123');
    expect(isBiometricEnabledOnDevice('user-2')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('authenticateWithBiometric', () => {

  beforeEach(() => {
    localStorageMock.clear();
    window.alert = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.PublicKeyCredential;
  });

  test('Returns false when biometric is not available', async () => {
    delete window.PublicKeyCredential;
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
  });

  test('Returns false when no credential stored on device', async () => {
    window.PublicKeyCredential = class {};
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
  });

  test('Returns true when navigator.credentials.get succeeds', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-credential-id'));
    navigator.credentials = { get: jest.fn().mockResolvedValue({ id: 'assertion-id' }) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(true);
  });

  test('Returns false when navigator.credentials.get returns null', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-id'));
    navigator.credentials = { get: jest.fn().mockResolvedValue(null) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
  });

  test('Returns false on NotAllowedError (user cancelled)', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-id'));
    const err = new Error('Not allowed');
    err.name = 'NotAllowedError';
    navigator.credentials = { get: jest.fn().mockRejectedValue(err) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
  });

  test('Returns false on NotSupportedError', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-id'));
    const err = new Error('Not supported');
    err.name = 'NotSupportedError';
    navigator.credentials = { get: jest.fn().mockRejectedValue(err) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalled();
  });

  test('Clears credential and returns false on InvalidStateError', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-id'));
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    const err = new Error('Invalid state');
    err.name = 'InvalidStateError';
    navigator.credentials = { get: jest.fn().mockRejectedValue(err) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
    expect(localStorageMock.getItem('biometric_credential_user-1')).toBeNull();
    expect(localStorageMock.getItem('biometric_enabled_user-1')).toBeNull();
  });

  test('Returns false on generic error', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', btoa('fake-id'));
    navigator.credentials = { get: jest.fn().mockRejectedValue(new Error('Unknown')) };
    const result = await authenticateWithBiometric('user-1');
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('registerBiometric', () => {

  beforeEach(() => {
    localStorageMock.clear();
    window.alert = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.PublicKeyCredential;
  });

  test('Returns false when biometric is not available', async () => {
    delete window.PublicKeyCredential;
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalled();
  });

  test('Returns true and stores credential on success', async () => {
    window.PublicKeyCredential = class {};
    const fakeRawId = new Uint8Array([1, 2, 3, 4]).buffer;
    navigator.credentials = {
      create: jest.fn().mockResolvedValue({ rawId: fakeRawId }),
    };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(true);
    expect(localStorageMock.getItem('biometric_enabled_user-1')).toBe('true');
    expect(localStorageMock.getItem('biometric_credential_user-1')).not.toBeNull();
  });

  test('Returns false when navigator.credentials.create returns null', async () => {
    window.PublicKeyCredential = class {};
    navigator.credentials = { create: jest.fn().mockResolvedValue(null) };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
  });

  test('Returns false on NotAllowedError (user cancelled)', async () => {
    window.PublicKeyCredential = class {};
    const err = new Error('Not allowed');
    err.name = 'NotAllowedError';
    navigator.credentials = { create: jest.fn().mockRejectedValue(err) };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
  });

  test('Returns false on NotSupportedError', async () => {
    window.PublicKeyCredential = class {};
    const err = new Error('Not supported');
    err.name = 'NotSupportedError';
    navigator.credentials = { create: jest.fn().mockRejectedValue(err) };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalled();
  });

  test('Clears credential and returns false on InvalidStateError', async () => {
    window.PublicKeyCredential = class {};
    localStorageMock.setItem('biometric_credential_user-1', 'old-credential');
    const err = new Error('Invalid state');
    err.name = 'InvalidStateError';
    navigator.credentials = { create: jest.fn().mockRejectedValue(err) };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
    expect(localStorageMock.getItem('biometric_credential_user-1')).toBeNull();
  });

  test('Returns false on generic error', async () => {
    window.PublicKeyCredential = class {};
    navigator.credentials = { create: jest.fn().mockRejectedValue(new Error('Generic')) };
    const result = await registerBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('enableBiometric', () => {

  beforeEach(() => {
    localStorageMock.clear();
    window.alert = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.PublicKeyCredential;
  });

  test('Returns false when biometric is not available', async () => {
    delete window.PublicKeyCredential;
    const result = await enableBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
  });

  test('Returns true when registration succeeds', async () => {
    window.PublicKeyCredential = class {};
    const fakeRawId = new Uint8Array([1, 2, 3]).buffer;
    navigator.credentials = { create: jest.fn().mockResolvedValue({ rawId: fakeRawId }) };
    const result = await enableBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(true);
  });

  test('Returns false when registration throws', async () => {
    window.PublicKeyCredential = class {};
    navigator.credentials = { create: jest.fn().mockRejectedValue(new Error('Fail')) };
    const result = await enableBiometric('user-1', 'test@test.com', 'Test User');
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('disableBiometric', () => {

  beforeEach(() => localStorageMock.clear());

  test('Removes credential and enabled flag from localStorage', () => {
    localStorageMock.setItem('biometric_credential_user-1', 'abc');
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    disableBiometric('user-1');
    expect(localStorageMock.getItem('biometric_credential_user-1')).toBeNull();
    expect(localStorageMock.getItem('biometric_enabled_user-1')).toBeNull();
  });

  test('Does not throw when no credential exists', () => {
    expect(() => disableBiometric('user-1')).not.toThrow();
  });

  test('Only removes keys for the specified user', () => {
    localStorageMock.setItem('biometric_credential_user-1', 'abc');
    localStorageMock.setItem('biometric_enabled_user-1', 'true');
    localStorageMock.setItem('biometric_credential_user-2', 'xyz');
    localStorageMock.setItem('biometric_enabled_user-2', 'true');
    disableBiometric('user-1');
    expect(localStorageMock.getItem('biometric_credential_user-2')).toBe('xyz');
    expect(localStorageMock.getItem('biometric_enabled_user-2')).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getDeviceInfo', () => {

  const setUA = (ua) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua, configurable: true, writable: true,
    });
  };

  test('Returns "iPhone" for iPhone user agent', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)');
    expect(getDeviceInfo()).toBe('iPhone');
  });

  test('Returns "iPad" for iPad user agent', () => {
    setUA('Mozilla/5.0 (iPad; CPU OS 15_0)');
    expect(getDeviceInfo()).toBe('iPad');
  });

  test('Returns "Android device" for Android user agent', () => {
    setUA('Mozilla/5.0 (Linux; Android 11; Pixel 5)');
    expect(getDeviceInfo()).toBe('Android device');
  });

  test('Returns "Mac" for Mac user agent', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(getDeviceInfo()).toBe('Mac');
  });

  test('Returns "Windows PC" for Windows user agent', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(getDeviceInfo()).toBe('Windows PC');
  });

  test('Returns "Linux PC" for Linux user agent', () => {
    setUA('Mozilla/5.0 (X11; Linux x86_64)');
    expect(getDeviceInfo()).toBe('Linux PC');
  });

  test('Returns "This device" for unknown user agent', () => {
    setUA('UnknownBrowser/1.0');
    expect(getDeviceInfo()).toBe('This device');
  });
});
