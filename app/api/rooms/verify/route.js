import { getDb } from "@/lib/firebase/firestore";
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

  const internalPort = process.env.PORT || 3000;
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || `http://127.0.0.1:${internalPort}`;
  const origin = new URL(request.url).origin;

  // Helper para consultar la API de salas de Socket.IO
  async function checkSocketRoom(codeToCheck) {
    if (!codeToCheck) return null;
    const urls = [
      `${socketUrl}/api/rooms/${encodeURIComponent(codeToCheck)}`,
      `${origin}/api/rooms/${encodeURIComponent(codeToCheck)}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch {
        // Intentar siguiente URL
      }
    }
    return null;
  }

  // 1. Verificar si la sala está activa en Socket.IO (nuevo código o código legacy)
  try {
    let socketData = await checkSocketRoom(normalizedCode);
    if (!socketData && rawClean && rawClean !== normalizedCode) {
      socketData = await checkSocketRoom(rawClean);
    }
    if (!socketData) {
      socketData = await checkSocketRoom(`ROOM-${normalizedCode}`);
    }

    if (socketData && socketData.roomId) {
      return Response.json({
        valid: true,
        roomId: socketData.roomId,
      });
    }
  } catch (err) {
    console.warn("Could not reach socket server:", err.message);
  }

  // 2. Verificar si la sala existe en Firestore parties
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
