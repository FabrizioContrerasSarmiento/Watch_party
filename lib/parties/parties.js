import { FieldValue } from "firebase-admin/firestore";

import { getDb } from "@/lib/firebase/firestore";

const COLLECTION = "parties";

function serializeParty(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    title: data.title || "",
    description: data.description || "",
    roomCode: data.roomCode || "",
    videoUrl: data.videoUrl || "",
    status: data.status || "active",
    userId: data.userId,
    createdAt: data.createdAt?.toDate?.().toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
  };
}

export async function listUserParties(userId) {
  const snapshot = await getDb()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map(serializeParty)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function getUserParty(userId, partyId) {
  const doc = await getDb().collection(COLLECTION).doc(partyId).get();

  if (!doc.exists) {
    return null;
  }

  const party = serializeParty(doc);

  if (party.userId !== userId) {
    return null;
  }

  return party;
}

export async function createUserParty(userId, data) {
  const now = FieldValue.serverTimestamp();

  await getDb()
    .collection(COLLECTION)
    .add({
      userId,
      title: data.title,
      description: data.description || "",
      roomCode: data.roomCode,
      videoUrl: data.videoUrl || "",
      status: data.status || "active",
      createdAt: now,
      updatedAt: now,
    });
}

export async function updateUserParty(userId, partyId, data) {
  const docRef = getDb().collection(COLLECTION).doc(partyId);

  const doc = await docRef.get();

  if (!doc.exists || doc.data().userId !== userId) {
    throw new Error("Party not found.");
  }

  await docRef.update({
    title: data.title,
    description: data.description || "",
    roomCode: data.roomCode,
    videoUrl: data.videoUrl || "",
    status: data.status,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteUserParty(userId, partyId) {
  const docRef = getDb().collection(COLLECTION).doc(partyId);

  const doc = await docRef.get();

  if (!doc.exists || doc.data().userId !== userId) {
    throw new Error("Party not found.");
  }

  await docRef.delete();
}

export async function deletePartyByRoomCode(userId, roomCode) {
  if (!roomCode) {
    return { success: false, error: "Código de sala no provisto." };
  }

  const db = getDb();
  const cleanCode = String(roomCode).trim();

  // Buscar por roomCode exacto
  let snapshot = await db
    .collection(COLLECTION)
    .where("roomCode", "==", cleanCode)
    .get();

  if (snapshot.empty && cleanCode.toUpperCase() !== cleanCode) {
    snapshot = await db
      .collection(COLLECTION)
      .where("roomCode", "==", cleanCode.toUpperCase())
      .get();
  }

  // Si no está en Firestore, puede tratarse de una sala en memoria / efímera
  if (snapshot.empty) {
    return { success: true, notInDb: true };
  }

  // Verificar que el usuario sea el dueño de la sala
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.userId && data.userId !== userId) {
      return {
        success: false,
        error: "No tienes permisos de anfitrión para eliminar esta sala.",
      };
    }
  }

  // Eliminar los documentos asociados
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  return { success: true };
}
