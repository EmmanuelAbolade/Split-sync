// src/hooks/useStepUp.js
// Promise-style wrapper around StepUpSheet, so a handler can write:
//
//   const { requestStepUp, stepUpSheet } = useStepUp();
//   const token = await requestStepUp('settlements.confirm', params); // null if cancelled
//   ...
//   return <>{...}{stepUpSheet}</>;

import React, { useCallback, useRef, useState } from 'react';
import StepUpSheet from '../components/StepUpSheet';

export default function useStepUp() {
  const [request, setRequest] = useState(null); // { action, params }
  const resolver = useRef(null);

  const settle = useCallback((value) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    if (resolve) resolve(value);
  }, []);

  const requestStepUp = useCallback((action, params) => {
    if (resolver.current) resolver.current(null); // replace an open request
    return new Promise((resolve) => {
      resolver.current = resolve;
      setRequest({ action, params });
    });
  }, []);

  const stepUpSheet = request
    ? React.createElement(StepUpSheet, {
      open: true,
      action: request.action,
      params: request.params,
      onConfirmed: (token) => settle(token),
      onCancel: () => settle(null),
    })
    : null;

  return { requestStepUp, stepUpSheet };
}
