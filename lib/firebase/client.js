import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("Faltan variables NEXT_PUBLIC_FIREBASE_* en .env.local.");
  }

  return config;
}

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(getFirebaseConfig());
}

export function getClientAuth() {
  return getAuth(getFirebaseApp());
}

export function getClientStorage() {
  const config = getFirebaseConfig();

  if (!config.storageBucket) {
    throw new Error("Falta NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET en .env.");
  }

  return getStorage(getFirebaseApp());
}

export function getRealtimeDatabase() {
  const config = getFirebaseConfig();

  if (!config.databaseURL) {
    throw new Error("Falta NEXT_PUBLIC_FIREBASE_DATABASE_URL en el entorno.");
  }

  return getDatabase(getFirebaseApp(), config.databaseURL);
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}
