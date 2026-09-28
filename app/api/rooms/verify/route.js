import { getDb } from "@/lib/firebase/firestore";

function extractRoomCode(rawInput) {
  if (!rawInput) return "";
  let input = String(rawInput).trim();

  // If user pasted a full URL (e.g. from "Copy invite"), extract the roomId
  if (input.includes("://") || input.includes("/watch-party/")) {
    try {
      const url = new URL(input.includes("://") ? input : `https://${input}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const watchPartyIndex = parts.indexOf("watch-party");
      if (watchPartyIndex !== -1 && parts[watchPartyIndex + 1]) {
        input = parts[watchPartyIndex + 1];
      } else if (parts.length > 0) {
        input = parts[parts.length - 1];
      }
    } catch {
      // Fallback: extract substring after watch-party/
      const match = input.match(/watch-party\/([a-zA-Z0-9_-]+)/i);
      if (match) input = match[1];
    }
  }

  // Remove trailing slashes or query strings
  input = input.split("?")[0].split("#")[0].replace(/\/$/, "").trim();
  return input;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code");

  const cleanCode = extractRoomCode(rawCode);

  if (!cleanCode || cleanCode.length < 3) {
    return Response.json(
      { valid: false, error: "Por favor, ingresá un código de sala válido." },
      { status: 400 },
    );
  }

  // Validate character format
  if (!/^[a-zA-Z0-9_-]{3,60}$/.test(cleanCode)) {
    return Response.json(
      {
        valid: false,
        error:
          "El formato del código no es válido. Solo letras, números y guiones.",
      },
      { status: 400 },
    );
  }

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  // 1. Check if room is active in Socket.IO server
  try {
    const socketRes = await fetch(
      `${socketUrl}/api/rooms/${encodeURIComponent(cleanCode)}`,
      { cache: "no-store" },
    );

    if (socketRes.ok) {
      const data = await socketRes.json();
      return Response.json({
        valid: true,
        roomId: data.roomId || cleanCode,
      });
    }
  } catch (err) {
    console.warn("Could not reach socket server:", err.message);
  }

  // 2. Check if room exists in Firestore parties
  try {
    const db = getDb();
    const exactSnap = await db
      .collection("parties")
      .where("roomCode", "==", cleanCode)
      .limit(1)
      .get();

    if (!exactSnap.empty) {
      return Response.json({ valid: true, roomId: cleanCode });
    }

    // Try uppercase format (standard ROOM-XXXXXX)
    const upperCode = cleanCode.toUpperCase();
    if (upperCode !== cleanCode) {
      const upperSnap = await db
        .collection("parties")
        .where("roomCode", "==", upperCode)
        .limit(1)
        .get();

      if (!upperSnap.empty) {
        return Response.json({ valid: true, roomId: upperCode });
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
