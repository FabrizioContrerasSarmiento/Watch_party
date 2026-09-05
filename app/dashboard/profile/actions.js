"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/firebase/session";
import { getCurrentUserProfile } from "@/lib/users/users";
import { getDb } from "@/lib/firebase/firestore";

export async function updateProfile(formData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const displayName = String(formData.get("displayName") || "").trim();

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (displayName.length > 50) {
    throw new Error("Display name must be 50 characters or less.");
  }

  const profile = await getCurrentUserProfile(user);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  await getDb().collection("users").doc(user.uid).update({
    displayName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}
