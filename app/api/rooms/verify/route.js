import { getDb } from "@/lib/firebase/firestore";
import { getAdminRealtimeDatabase } from "@/lib/firebase/realtimeAdmin";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/parties/roomCodes";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code");

  const normalizedCode = normalizeRoomCode(rawCode);
  const rawClean = String(rawCode || "").trim();

  if (!normalizedCode) {
    return Response.json(
      { valid: false, error: "Por favor, ingresá un código de sala válido." },
      { status: 400 },
    );
  }

  // Validación: exactamente 6 caracteres alfanuméricos después de normalizar
  if (!isValidRoomCode(normalizedCode)) {
    return Response.json(
      {
        valid: false,
        error:
          "El código de sala debe tener exactamente 6 caracteres (letras y números).",
      },
      { status: 400 },
    );
  }

  // 1. Verificar si la sala ya está activa en Realtime Database.
  try {
    const snapshot = await getAdminRealtimeDatabase()
      .ref(`watchPartyRooms/${normalizedCode}/state`)
      .get();
    if (snapshot.exists() && snapshot.val()?.status !== "deleted") {
      return Response.json({
        valid: true,
        roomId: normalizedCode,
      });
    }
  } catch (realtimeError) {
    console.warn(
      "Could not query Firebase Realtime Database:",
      realtimeError.message,
    );
  }

  // 2. Verificar si la sala existe en Firestore parties.
  try {
    const db = getDb();

    // 2a. Buscar por código normalizado (estándar nuevo: LNATJP)
    const exactSnap = await db
      .collection("parties")
      .where("roomCode", "==", normalizedCode)
      .limit(1)
      .get();

    if (!exactSnap.empty) {
      const docData = exactSnap.docs[0].data();
      return Response.json({
        valid: true,
        roomId: docData.roomCode || normalizedCode,
      });
    }

    // 2b. Buscar por formato legacy para compatibilidad (ROOM-LNATJP)
    const legacyCode = `ROOM-${normalizedCode}`;
    const legacySnap = await db
      .collection("parties")
      .where("roomCode", "==", legacyCode)
      .limit(1)
      .get();

    if (!legacySnap.empty) {
      const docData = legacySnap.docs[0].data();
      return Response.json({
        valid: true,
        roomId: docData.roomCode || legacyCode,
      });
    }

    // 2c. Si el código ingresado en crudo difería de ambos, buscarlo directamente
    if (rawClean && rawClean !== normalizedCode && rawClean !== legacyCode) {
      const rawSnap = await db
        .collection("parties")
        .where("roomCode", "==", rawClean)
        .limit(1)
        .get();

      if (!rawSnap.empty) {
        const docData = rawSnap.docs[0].data();
        return Response.json({
          valid: true,
          roomId: docData.roomCode || rawClean,
        });
      }
    }
  } catch (firestoreErr) {
    console.warn("Could not query Firestore parties:", firestoreErr.message);
  }

  return Response.json(
    {
      valid: false,
      error: "La sala no existe o no se encuentra activa.",
    },
    { status: 404 },
  );
}
