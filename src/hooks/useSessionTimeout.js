// src/hooks/useSessionTimeout.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const TIMEOUT_OPTIONS = {
  '5min': 5 *60 * 1000,      // 5 minutes
  '10min': 10 * 60 * 1000,    // 10 minutes
  '20min': 20 * 60 * 1000,    // 20 minutes
  '30min': 30 * 60 * 1000,    // 30 minutes
  'never': null,              // Never timeout
};

const WARNING_TIME = 30 * 1000; // 30 seconds warning

export const useSessionTimeout = () => {
  const { user, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [timeoutSetting, setTimeoutSetting] = useState('never');
  const [countdown, setCountdown] = useState(30);
  
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Load user's timeout preference
  useEffect(() => {
    const loadTimeoutSetting = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setTimeoutSetting(data.sessionTimeout || 'never');
        }
      } catch (error) {
        console.error('Error loading timeout setting:', error);
      }
    };

    loadTimeoutSetting();
  }, [user?.uid]);

  // Clear all timers (but preserve countdown if warning is showing)
const clearTimers = useCallback((preserveCountdown = false) => {
  
  // If preserving countdown, also preserve logout timer!
  if (!preserveCountdown && timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  } else if (timeoutRef.current) {
  }
  
  // Always clear warning timeout (only used before modal opens)
  if (warningTimeoutRef.current) {
    clearTimeout(warningTimeoutRef.current);
    warningTimeoutRef.current = null;
  }
  
  // Preserve countdown interval if needed
  if (!preserveCountdown && countdownIntervalRef.current) {
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
  } else if (countdownIntervalRef.current) {
  
  }
}, []);
  // Show warning modal
  const showWarningModal = useCallback(() => {
   
    setShowWarning(true);
    setCountdown(30);
    
    // Start countdown
    const intervalId = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev <= 1 ? 0 : prev - 1;
        
        if (newValue === 0) {
          console.log('⏱️ [COUNTDOWN] Reached 0 - clearing interval');
          clearInterval(intervalId);
        }
        
        return newValue;
      });
    }, 1000);
    
    countdownIntervalRef.current = intervalId;
    
    // Auto-logout after 30 seconds
    const logoutTimerId = setTimeout(() => {
      
      // Clear countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Close modal
      setShowWarning(false);
      
      // Logout
      logout();
    }, WARNING_TIME);
    
    timeoutRef.current = logoutTimerId;
    
  }, [logout]);

  //  Reset activity timer
const resetTimer = useCallback(() => {
  lastActivityRef.current = Date.now();
  
  // Close warning if open
  if (showWarning) {
    console.log('⚠️ [RESET] Warning was open, closing it');
    setShowWarning(false);
    clearTimers();
  }
  
  // Don't set timer if timeout is disabled
  if (timeoutSetting === 'never' || !TIMEOUT_OPTIONS[timeoutSetting]) {
    
    return;
  }
  // Clear existing timers
  clearTimers();

  const timeoutDuration = TIMEOUT_OPTIONS[timeoutSetting];
  const warningTime = timeoutDuration - WARNING_TIME;

  // Set warning timer (timeout - 30 seconds)
  warningTimeoutRef.current = setTimeout(() => {
    showWarningModal();
  }, warningTime);
    
  
  }, [timeoutSetting, showWarning, clearTimers, showWarningModal]);

  // Stay logged in - dismiss warning
  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    clearTimers();
    resetTimer();
  }, [clearTimers, resetTimer]);

  // Logout now
const logoutNow = useCallback(() => {
  setShowWarning(false); // Close modal first
  clearTimers();
  logout();
}, [logout, clearTimers]);

  // Update timeout setting
const updateTimeoutSetting = useCallback(async (newSetting) => {
  
  if (!user?.uid) {
    console.error('❌ [HOOK] No user ID - cannot update setting');
    return;
  }
  
  try {
    
    await updateDoc(doc(db, 'users', user.uid), {
      sessionTimeout: newSetting
    });
    setTimeoutSetting(newSetting);

    clearTimers();
    
    // The useEffect depends on timeoutSetting and will re-run automatically
    
    
  } catch (error) {
    console.error('❌ [HOOK] Error updating timeout setting:', error);
  }
}, [user?.uid, clearTimers]);

  // Track user activity
  useEffect(() => {
    if (!user || timeoutSetting === 'never') {
      clearTimers();
      return;
    }

    // DON'T track activity while warning is shown!
    if (showWarning) {
      return;
    }
    
    // Activity events to track
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    const handleActivity = () => {
      const now = Date.now();
      // Throttle - only reset if more than 1 second since last activity
      if (now - lastActivityRef.current > 1000) {
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
return () => {
  
  events.forEach(event => {
    window.removeEventListener(event, handleActivity);
  });
  
  // Preserve countdown if it exists (modal is open)
  const hasCountdown = !!countdownIntervalRef.current;
  clearTimers(hasCountdown);
};
}, [user, timeoutSetting, showWarning, resetTimer, clearTimers]);

  return {
    showWarning,
    countdown,
    timeoutSetting,
    stayLoggedIn,
    logoutNow,
    updateTimeoutSetting,
  };
};