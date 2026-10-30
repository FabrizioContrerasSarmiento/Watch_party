"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { getAdminRealtimeDatabase } from "@/lib/firebase/realtimeAdmin";
import { deletePartyByRoomCode } from "@/lib/parties/parties";
import { normalizeRoomCode } from "@/lib/parties/roomCodes";

export async function deleteWatchPartyAction(roomId) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      };
    }

    if (!roomId) {
      return {
        success: false,
        error: "Identificador de sala inválido.",
      };
    }

    const result = await deletePartyByRoomCode(user.uid, roomId);
    if (!result.success) {
      return result;
    }

    // Marcar la sala como eliminada para notificar a todos los clientes conectados.
    try {
      const normalizedRoomId = normalizeRoomCode(roomId);
      await getAdminRealtimeDatabase()
        .ref(`watchPartyRooms/${normalizedRoomId}/state`)
        .update({
          status: "deleted",
          deletedAt: Date.now(),
          deletedMessage: "Esta Watch Party fue eliminada por el host.",
        });
    } catch (realtimeError) {
      console.warn("No se pudo notificar la eliminación en tiempo real:", {
        message: realtimeError?.message,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/parties");

    return { success: true };
  } catch (error) {
    console.error("Error al eliminar watch party:", error);
    return {
      success: false,
      error: error.message || "Error al eliminar la watch party.",
    };
  }
}
