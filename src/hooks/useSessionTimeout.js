// src/hooks/useSessionTimeout.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const TIMEOUT_OPTIONS = {
  '5min': 60 * 1000,      // 5 minutes
  '10min': 60 * 1000,    // 10 minutes
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

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  // Show warning modal
  const showWarningModal = useCallback(() => {
    console.log('⚠️ SHOWING WARNING MODAL NOW!');
    setShowWarning(true);
    setCountdown(30);
    
    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-logout after 30 seconds
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      logout();
    }, WARNING_TIME);
  }, [logout, clearTimers]);

  //  Reset activity timer
const resetTimer = useCallback(() => {
  lastActivityRef.current = Date.now();
  
  // Close warning if open
  if (showWarning) {
    console.log('🔄 Warning was open, closing and resetting');
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
  
  console.log(`⏱️ Setting timer: Warning in ${warningTime/1000}s, Logout in ${timeoutDuration/1000}s`);
  
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
    clearTimers();
    logout();
  }, [logout, clearTimers]);

  // Update timeout setting
  const updateTimeoutSetting = useCallback(async (newSetting) => {
    if (!user?.uid) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        sessionTimeout: newSetting
      });
      setTimeoutSetting(newSetting);
      clearTimers();
      resetTimer();
    } catch (error) {
      console.error('Error updating timeout setting:', error);
    }
  }, [user?.uid, clearTimers, resetTimer]);

  // Track user activity
  useEffect(() => {
    console.log('🔒 Session Timeout Status:', {
      user: user ? 'logged in' : 'not logged in',
      timeoutSetting: timeoutSetting,
      showWarning: showWarning,
      timeoutDuration: TIMEOUT_OPTIONS[timeoutSetting]
    });

    if (!user || timeoutSetting === 'never') {
      console.log('⏸️ Session timeout disabled (user not logged in or set to never)');
      clearTimers();
      return;
    }

    // ⭐ DON'T track activity while warning is shown!
    if (showWarning) {
      console.log('⚠️ Warning is showing - NOT tracking activity (waiting for user decision)');
      return;
    }

    console.log('✅ Session timeout ENABLED - starting timer...');

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
      clearTimers();
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