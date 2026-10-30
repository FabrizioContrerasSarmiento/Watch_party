import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function formatPrivateKey(key) {
  if (!key) return undefined;

  let formatted = key.trim();

  // If user pasted the entire service account JSON
  if (formatted.startsWith("{") && formatted.endsWith("}")) {
    try {
      const parsed = JSON.parse(formatted);
      if (parsed.private_key) {
        formatted = parsed.private_key.trim();
      }
    } catch {
      // not valid JSON, proceed with string
    }
  }

  // Strip wrapping double or single quotes (handles nested wrapping)
  while (
    (formatted.startsWith('"') && formatted.endsWith('"')) ||
    (formatted.startsWith("'") && formatted.endsWith("'"))
  ) {
    formatted = formatted.slice(1, -1).trim();
  }

  // Strip escaped quotes
  if (formatted.startsWith('\\"') && formatted.endsWith('\\"')) {
    formatted = formatted.slice(2, -2).trim();
  }

  // Normalize escaped newlines and line breaks
  return formatted
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function getAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId)
      missing.push("FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
    throw new Error(
      `Missing Firebase Admin environment variables: ${missing.join(", ")}`,
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
