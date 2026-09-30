"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import {
  createUserParty,
  isRoomCodeTaken,
  generateUniqueRoomCode,
} from "@/lib/parties/parties";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/parties/roomCodes";

export async function generatePartyRoomCode() {
  try {
    const code = await generateUniqueRoomCode();
    return { success: true, code };
  } catch (error) {
    console.error("Error generating unique room code:", error);
    return {
      success: false,
      error: "No se pudo generar un código único de sala.",
    };
  }
}

export async function createParty(formData) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "Debes iniciar sesión para crear una party.",
      };
    }

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const rawRoomCode = String(formData.get("roomCode") || "").trim();
    const videoUrl = String(formData.get("videoUrl") || "").trim();

    if (!title) {
      return {
        success: false,
        error: "El nombre de la party es obligatorio.",
      };
    }

    const roomCode = normalizeRoomCode(rawRoomCode);

    if (!roomCode) {
      return {
        success: false,
        error: "El código de sala es obligatorio.",
      };
    }

    if (!isValidRoomCode(roomCode)) {
      return {
        success: false,
        error:
          "El código de sala debe tener exactamente 6 caracteres alfanuméricos.",
      };
    }

    const taken = await isRoomCodeTaken(roomCode);
    if (taken) {
      return {
        success: false,
        error: "Este código de sala ya está en uso. Por favor generá o ingresá otro.",
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
      roomCode,
    };
  } catch (error) {
    console.error("Error creating party:", error);

    return {
      success: false,
      error: "No se pudo crear la watch party.",
    };
  }
}
