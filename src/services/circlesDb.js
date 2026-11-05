// src/services/circlesDb.js
// The separate `circles` Firestore database (Circles, Loans and Aid money).
// Clients only READ it; all writes go through Cloud Functions.
// Created lazily so nothing connects to it until a Circles screen needs it.

import { getFirestore } from 'firebase/firestore';
import app from './firebase';

export const CIRCLES_DATABASE_ID = 'circles';

let instance = null;

export function getCirclesDb() {
  if (!instance) instance = getFirestore(app, CIRCLES_DATABASE_ID);
  return instance;
}
