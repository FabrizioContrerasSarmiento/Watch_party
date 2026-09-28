"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { deletePartyByRoomCode } from "@/lib/parties/parties";

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

    // Notificar al servidor Socket.IO para eliminar la sala de memoria y avisar a participantes
    try {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
      await fetch(`${socketUrl}/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
      });
    } catch {
      // Ignorar si el servidor de socket no está disponible
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
