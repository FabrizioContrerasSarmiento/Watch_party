"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { createUserParty } from "@/lib/parties/parties";

export async function createParty(formData) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "You must be logged in.",
      };
    }

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const roomCode = String(formData.get("roomCode") || "").trim();
    const videoUrl = String(formData.get("videoUrl") || "").trim();

    if (!title) {
      return {
        success: false,
        error: "Party name is required.",
      };
    }

    if (!roomCode) {
      return {
        success: false,
        error: "Room code is required.",
      };
    }

    await createUserParty(user.uid, {
      title,
      description,
      roomCode,
      videoUrl,
      status: "active",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/parties");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error creating party:", error);

    return {
      success: false,
      error: "Unable to create the party.",
    };
  }
}
