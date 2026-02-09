// src/utils/biometric.js - DEVICE-SPECIFIC BIOMETRIC (localStorage only)
// Each device has independent biometric settings - no Firestore sync

/**
 * Checks if biometric authentication is available on this device
 * @returns {boolean} - True if device supports biometric auth
 */
export const isBiometricAvailable = () => {
  // Check if PublicKeyCredential is available (WebAuthn support)
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  return true;
};

/**
 * Checks if biometric is enabled on THIS device for this user
 * @param {string} userId - The user's ID
 * @returns {boolean} - True if biometric is enabled on THIS device
 */
export const isBiometricEnabledOnDevice = (userId) => {
  const enabled = localStorage.getItem(`biometric_enabled_${userId}`);
  const hasCredential = localStorage.getItem(`biometric_credential_${userId}`);
  return enabled === 'true' && hasCredential !== null;
};

/**
 * Prompts for biometric authentication using device fingerprint/Face ID
 * @param {string} userId - The user's ID
 * @param {string} challenge - Optional challenge text
 * @returns {Promise<boolean>} - True if authentication successful
 */
export const authenticateWithBiometric = async (userId, challenge = 'Verify your identity') => {
  try {
    // Check if biometric is available on this device
    if (!isBiometricAvailable()) {
      console.log('Biometric not available on this device');
      alert('Biometric authentication is not available on this device.\n\nSupported browsers: Chrome, Safari, Edge\nRequired: Fingerprint reader or Face ID');
      return false;
    }

    // Check if user has registered credentials on THIS device
    const credentialId = localStorage.getItem(`biometric_credential_${userId}`);
    
    if (!credentialId) {
      console.log('No biometric credential found on this device');
      alert('Biometric authentication is not set up on this device.\n\nEnable it in Settings → Biometric Authentication');
      return false;
    }

    // Generate a random challenge for this authentication
    const randomChallenge = new Uint8Array(32);
    window.crypto.getRandomValues(randomChallenge);

    // Request authentication - THIS TRIGGERS ACTUAL FINGERPRINT/FACE ID PROMPT
    const publicKeyCredentialRequestOptions = {
      challenge: randomChallenge,
      allowCredentials: [{
        id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
        type: 'public-key',
        transports: ['internal'],
      }],
      timeout: 60000,
      userVerification: 'required',
    };

    console.log('🔐 Requesting biometric authentication...');
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    if (assertion) {
      console.log('✅ Biometric authentication successful!');
      return true;
    }

    console.log('❌ Biometric authentication failed');
    return false;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    
    // If user cancelled the biometric prompt
    if (error.name === 'NotAllowedError') {
      console.log('User cancelled biometric authentication');
      return false;
    }
    
    // If biometric not supported
    if (error.name === 'NotSupportedError') {
      alert('Biometric authentication is not supported on this device');
      return false;
    }
    
    // If invalid credential (might have been cleared)
    if (error.name === 'InvalidStateError') {
      console.log('Invalid biometric credential - clearing...');
      localStorage.removeItem(`biometric_credential_${userId}`);
      localStorage.removeItem(`biometric_enabled_${userId}`);
      alert('Biometric credential is invalid. Please enable biometric authentication again in Settings.');
      return false;
    }
    
    // Other errors
    console.error('Biometric authentication failed:', error.message);
    return false;
  }
};

/**
 * Registers biometric credentials for a user on THIS device
 * @param {string} userId - The user's ID
 * @param {string} userEmail - The user's email
 * @param {string} userName - The user's display name
 * @returns {Promise<boolean>} - True if registration successful
 */
export const registerBiometric = async (userId, userEmail, userName) => {
  try {
    // Check if biometric is available
    if (!isBiometricAvailable()) {
      alert('Biometric authentication is not available on this device.\n\nSupported browsers: Chrome, Safari, Edge\nRequired: Fingerprint reader or Face ID');
      return false;
    }

    // Generate a random challenge
    const randomChallenge = new Uint8Array(32);
    window.crypto.getRandomValues(randomChallenge);

    const publicKeyCredentialCreationOptions = {
      challenge: randomChallenge,
      rp: {
        name: 'Split-Sync',
        id: window.location.hostname,
      },
      user: {
        id: Uint8Array.from(userId, c => c.charCodeAt(0)),
        name: userEmail,
        displayName: userName || userEmail,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device's built-in authenticator (fingerprint/Face ID)
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none'
    };

    console.log('🔐 Requesting biometric registration...');
    
    // THIS WILL PROMPT FOR FINGERPRINT/FACE ID TO REGISTER
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    if (credential) {
      // Store credential ID for future authentications on THIS device
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(`biometric_credential_${userId}`, credentialId);
      localStorage.setItem(`biometric_enabled_${userId}`, 'true');
      
      console.log('✅ Biometric registration successful on this device!');
      return true;
    }

    console.log('❌ Biometric registration failed');
    return false;
  } catch (error) {
    console.error('Biometric registration error:', error);
    
    if (error.name === 'NotAllowedError') {
      console.log('User cancelled biometric registration');
      return false;
    }
    
    if (error.name === 'NotSupportedError') {
      alert('Biometric authentication is not supported on this device');
      return false;
    }
    
    if (error.name === 'InvalidStateError') {
      // Credential already exists - try to remove and retry
      console.log('Credential already exists, clearing and retrying...');
      localStorage.removeItem(`biometric_credential_${userId}`);
      alert('Please try enabling biometric authentication again.');
      return false;
    }
    
    console.error('Registration error:', error.message);
    alert('Failed to register biometric authentication. Please try again.');
    return false;
  }
};

/**
 * Enables biometric authentication on THIS device
 * @param {string} userId - The user's ID
 * @param {string} userEmail - The user's email
 * @param {string} userName - The user's display name
 * @returns {Promise<boolean>} - True if successfully enabled
 */
export const enableBiometric = async (userId, userEmail, userName) => {
  if (!isBiometricAvailable()) {
    alert('Biometric authentication is not available on this device');
    return false;
  }

  try {
    const success = await registerBiometric(userId, userEmail, userName);
    return success;
  } catch (error) {
    console.error('Error enabling biometric:', error);
    return false;
  }
};

/**
 * Disables biometric authentication on THIS device
 * @param {string} userId - The user's ID
 */
export const disableBiometric = (userId) => {
  localStorage.removeItem(`biometric_credential_${userId}`);
  localStorage.removeItem(`biometric_enabled_${userId}`);
  console.log('✅ Biometric authentication disabled on this device');
};

/**
 * Gets device info for display purposes
 * @returns {string} - Device description
 */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android device';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';
  
  return 'This device';
};