// src/utils/biometric.js

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
 * Checks if user has biometric auth preference enabled
 * @param {string} userId - The user's ID
 * @returns {boolean} - True if user wants biometric auth
 */
export const getBiometricPreference = (userId) => {
  const pref = localStorage.getItem(`biometric_enabled_${userId}`);
  return pref === 'true';
};

/**
 * Saves user's biometric preference
 * @param {string} userId - The user's ID
 * @param {boolean} enabled - Whether biometric is enabled
 */
export const setBiometricPreference = (userId, enabled) => {
  localStorage.setItem(`biometric_enabled_${userId}`, enabled.toString());
};

/**
 * Prompts for biometric authentication
 * @param {string} userId - The user's ID
 * @param {string} challenge - Optional challenge text (e.g., "Access Payment Settings")
 * @returns {Promise<boolean>} - True if authentication successful
 */
export const authenticateWithBiometric = async (userId, challenge = 'Verify your identity') => {
  try {
    // Check if biometric is available
    if (!isBiometricAvailable()) {
      console.log('Biometric not available on this device');
      return await fallbackPasswordAuth(challenge);
    }

    // Check if user has enabled biometric
    const biometricEnabled = getBiometricPreference(userId);
    if (!biometricEnabled) {
      console.log('User has not enabled biometric authentication');
      return await fallbackPasswordAuth(challenge);
    }

    // Generate a random challenge for this authentication
    const randomChallenge = new Uint8Array(32);
    window.crypto.getRandomValues(randomChallenge);

    // Check if user has registered credentials
    const credentialId = localStorage.getItem(`biometric_credential_${userId}`);
    
    if (!credentialId) {
      // First time - need to register
      console.log('No credential found, registering...');
      return await registerBiometric(userId, randomChallenge);
    }

    // Request authentication
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

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    if (assertion) {
      console.log('Biometric authentication successful');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    
    // If user cancelled, return false
    if (error.name === 'NotAllowedError') {
      return false;
    }
    
    // For other errors, fall back to password
    return await fallbackPasswordAuth(challenge);
  }
};

/**
 * Registers biometric credentials for a user
 * @param {string} userId - The user's ID
 * @param {Uint8Array} challenge - Random challenge
 * @returns {Promise<boolean>} - True if registration successful
 */
const registerBiometric = async (userId, challenge) => {
  try {
    const publicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: 'Split-Sync',
        id: window.location.hostname,
      },
      user: {
        id: Uint8Array.from(userId, c => c.charCodeAt(0)),
        name: `user_${userId}`,
        displayName: 'Split-Sync User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device's built-in authenticator
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    if (credential) {
      // Store credential ID for future authentications
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(`biometric_credential_${userId}`, credentialId);
      setBiometricPreference(userId, true);
      
      console.log('Biometric registration successful');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Biometric registration error:', error);
    return false;
  }
};

/**
 * Fallback password authentication when biometric fails or unavailable
 * @param {string} challenge - Challenge text to display
 * @returns {Promise<boolean>} - True if password correct
 */
const fallbackPasswordAuth = async (challenge) => {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
        ${challenge}
      </h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        Please enter your password to continue
      </p>
      <input 
        type="password" 
        id="biometric-fallback-password"
        placeholder="Enter your password"
        style="
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          box-sizing: border-box;
        "
      />
      <div style="display: flex; gap: 12px;">
        <button 
          id="biometric-fallback-cancel"
          style="
            flex: 1;
            padding: 12px;
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          "
        >
          Cancel
        </button>
        <button 
          id="biometric-fallback-verify"
          style="
            flex: 1;
            padding: 12px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          "
        >
          Verify
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const passwordInput = document.getElementById('biometric-fallback-password');
    const cancelBtn = document.getElementById('biometric-fallback-cancel');
    const verifyBtn = document.getElementById('biometric-fallback-verify');

    passwordInput.focus();

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    verifyBtn.onclick = async () => {
      const password = passwordInput.value;
      
      if (!password) {
        alert('Please enter your password');
        return;
      }

      // In a real app, you'd verify against Firebase Auth
      // For now, we'll just check if there's a password
      // You should integrate with Firebase auth reAuthentication
      cleanup();
      resolve(true);
    };

    // Allow Enter key to submit
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyBtn.click();
      }
    });
  });
};

/**
 * Enables biometric authentication for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<boolean>} - True if successfully enabled
 */
export const enableBiometric = async (userId) => {
  if (!isBiometricAvailable()) {
    alert('Biometric authentication is not available on this device');
    return false;
  }

  try {
    const randomChallenge = new Uint8Array(32);
    window.crypto.getRandomValues(randomChallenge);
    
    const success = await registerBiometric(userId, randomChallenge);
    
    if (success) {
      setBiometricPreference(userId, true);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error enabling biometric:', error);
    return false;
  }
};

/**
 * Disables biometric authentication for a user
 * @param {string} userId - The user's ID
 */
export const disableBiometric = (userId) => {
  localStorage.removeItem(`biometric_credential_${userId}`);
  setBiometricPreference(userId, false);
};