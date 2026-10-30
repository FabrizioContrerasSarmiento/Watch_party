import { getDatabase } from "firebase-admin/database";

import { getAdminApp } from "@/lib/firebase/admin";

export function getAdminRealtimeDatabase() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_DATABASE_URL.");
  }

  return getDatabase(getAdminApp());
}
