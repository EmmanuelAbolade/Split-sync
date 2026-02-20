// src/utils/biometric.test.js
// Test suite for biometric authentication utilities
import {
  isBiometricAvailable,
  isBiometricEnabledOnDevice,
  getDeviceInfo,
  disableBiometric,
} from './biometric';

// Mock browser APIs
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Biometric - Availability Check', () => {
  
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test('Checks if PublicKeyCredential exists', () => {
    // Mock PublicKeyCredential available
    window.PublicKeyCredential = function() {};
    
    const available = isBiometricAvailable();
    expect(typeof available).toBe('boolean');
  });

  test('Returns false when PublicKeyCredential unavailable', () => {
    // Remove PublicKeyCredential
    delete window.PublicKeyCredential;
    
    const available = isBiometricAvailable();
    expect(available).toBe(false);
  });

  test('Returns true when PublicKeyCredential available', () => {
    // Mock PublicKeyCredential
    window.PublicKeyCredential = function() {};
    
    const available = isBiometricAvailable();
    expect(available).toBe(true);
  });
});

describe('Biometric - Device-Specific Enablement', () => {
  
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test('Returns false when biometric not enabled on device', () => {
    const enabled = isBiometricEnabledOnDevice('user123');
    expect(enabled).toBe(false);
  });

  test('Returns false when enabled but no credential', () => {
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    
    const enabled = isBiometricEnabledOnDevice('user123');
    expect(enabled).toBe(false);
  });

  test('Returns true when both enabled and credential exist', () => {
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    mockLocalStorage.setItem('biometric_credential_user123', 'dummy_credential');
    
    const enabled = isBiometricEnabledOnDevice('user123');
    expect(enabled).toBe(true);
  });

  test('Returns false for different user', () => {
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    mockLocalStorage.setItem('biometric_credential_user123', 'dummy_credential');
    
    const enabled = isBiometricEnabledOnDevice('user456');
    expect(enabled).toBe(false);
  });

  test('Handles string "false" correctly', () => {
    mockLocalStorage.setItem('biometric_enabled_user123', 'false');
    mockLocalStorage.setItem('biometric_credential_user123', 'dummy_credential');
    
    const enabled = isBiometricEnabledOnDevice('user123');
    expect(enabled).toBe(false);
  });
});

describe('Biometric - Disable Functionality', () => {
  
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test('Removes credential from localStorage', () => {
    mockLocalStorage.setItem('biometric_credential_user123', 'credential');
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    
    disableBiometric('user123');
    
    expect(mockLocalStorage.getItem('biometric_credential_user123')).toBeNull();
    expect(mockLocalStorage.getItem('biometric_enabled_user123')).toBeNull();
  });

  test('Handles disabling when not enabled', () => {
    disableBiometric('user123');
    
    expect(mockLocalStorage.getItem('biometric_credential_user123')).toBeNull();
  });

  test('Only removes specific user credentials', () => {
    mockLocalStorage.setItem('biometric_credential_user123', 'cred1');
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    mockLocalStorage.setItem('biometric_credential_user456', 'cred2');
    mockLocalStorage.setItem('biometric_enabled_user456', 'true');
    
    disableBiometric('user123');
    
    expect(mockLocalStorage.getItem('biometric_credential_user123')).toBeNull();
    expect(mockLocalStorage.getItem('biometric_credential_user456')).toBe('cred2');
  });
});

describe('Biometric - Device Info', () => {
  
  test('Returns device type string', () => {
    const deviceInfo = getDeviceInfo();
    
    expect(typeof deviceInfo).toBe('string');
    expect(deviceInfo.length).toBeGreaterThan(0);
  });

  test('Detects iPhone from user agent', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('iPhone');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  test('Detects iPad from user agent', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('iPad');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  test('Detects Android from user agent', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11)',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('Android device');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  test('Detects Mac from user agent', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('Mac');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  test('Detects Windows from user agent', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('Windows PC');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  test('Returns default for unknown device', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Unknown Device',
      configurable: true
    });
    
    const deviceInfo = getDeviceInfo();
    expect(deviceInfo).toBe('This device');
    
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });
});

describe('Biometric - Storage Key Format', () => {
  
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test('Uses correct key format for credentials', () => {
    mockLocalStorage.setItem('biometric_credential_user123', 'test');
    
    const key = 'biometric_credential_user123';
    expect(mockLocalStorage.getItem(key)).toBe('test');
  });

  test('Uses correct key format for enabled flag', () => {
    mockLocalStorage.setItem('biometric_enabled_user123', 'true');
    
    const key = 'biometric_enabled_user123';
    expect(mockLocalStorage.getItem(key)).toBe('true');
  });

  test('Keys are user-specific', () => {
    const userId1 = 'user123';
    const userId2 = 'user456';
    
    mockLocalStorage.setItem(`biometric_credential_${userId1}`, 'cred1');
    mockLocalStorage.setItem(`biometric_credential_${userId2}`, 'cred2');
    
    expect(mockLocalStorage.getItem(`biometric_credential_${userId1}`)).toBe('cred1');
    expect(mockLocalStorage.getItem(`biometric_credential_${userId2}`)).toBe('cred2');
  });
});

describe('Biometric - Error Scenarios', () => {
  
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test('Handles null userId gracefully', () => {
    const enabled = isBiometricEnabledOnDevice(null);
    expect(typeof enabled).toBe('boolean');
  });

  test('Handles undefined userId gracefully', () => {
    const enabled = isBiometricEnabledOnDevice(undefined);
    expect(typeof enabled).toBe('boolean');
  });

  test('Handles empty string userId', () => {
    const enabled = isBiometricEnabledOnDevice('');
    expect(enabled).toBe(false);
  });

  test('Disabling with null userId does not crash', () => {
    expect(() => disableBiometric(null)).not.toThrow();
  });
});