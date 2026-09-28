import { NextResponse } from "next/server";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/firebase/session";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ensureUserProfile } from "@/lib/users/users";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { idToken } = body || {};

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Sync user profile to Firestore without blocking session creation if Firestore encounters an error
    try {
      await ensureUserProfile(decodedToken);
    } catch (profileError) {
      console.warn("[SESSION_LOGIN_WARN] Failed to sync user profile to Firestore:", profileError?.message || profileError);
    }

    const sessionCookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[SESSION_LOGIN_ERROR] Could not create server session:", error?.message || error);
    return NextResponse.json(
      { error: "Could not create a server session." },
      { status: 401 },
    );
  }
}
