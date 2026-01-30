// src/hooks/useKeyboardAware.js

import { useEffect } from 'react';

export function useKeyboardAware(inputRef) {
  useEffect(() => {
    if (!inputRef?.current) return;

    const handleFocus = () => {
      // Wait for keyboard to appear
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    };

    const element = inputRef.current;
    element.addEventListener('focus', handleFocus);

    return () => {
      element.removeEventListener('focus', handleFocus);
    };
  }, [inputRef]);
}