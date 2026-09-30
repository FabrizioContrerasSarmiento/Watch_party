import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

function createRoom() {
  return {
    contentType: null, // null | "youtube" | "screen"
    videoId: null,
    title: "",
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1,
    playStartTime: null,
    lastUpdateTime: Date.now(),
    users: [],
    voiceUsers: [],
    cameraUsers: [],
    screenShareUsers: [],
    hostSocketId: null,
    screenSharerSocketId: null,
    chatLocked: false,
    queue: [],
    activePoll: null,
  };
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom());
  return rooms.get(roomId);
}

function getCurrentTime(room) {
  if (!room.isPlaying || !room.playStartTime) return room.currentTime;
  const rate =
    typeof room.playbackRate === "number" && room.playbackRate > 0
      ? room.playbackRate
      : 1;
  return room.currentTime + ((Date.now() - room.playStartTime) / 1000) * rate;
}

function roomState(room) {
  return {
    ...room,
    currentTime: getCurrentTime(room),
    playbackRate: room.playbackRate || 1,
    users: room.users.map(({ socketId, userId }) => ({
      socketId,
      userId,
    })),
    voiceUsers: room.voiceUsers.map(({ socketId, userId }) => ({
      socketId,
      userId,
    })),
    cameraUsers: room.cameraUsers || [],
    screenShareUsers:
      room.screenShareUsers ||
      (room.screenSharerSocketId ? [room.screenSharerSocketId] : []),
  };
}

function broadcastRoom(roomId) {
  io.to(roomId).emit("room-state", roomState(rooms.get(roomId)));
  io.emit("rooms-updated");
}

function isHost(socket, room) {
  return room?.hostSocketId === socket.id;
}

function requireHost(socket, roomId) {
  const room = rooms.get(roomId);
  return room && isHost(socket, room) ? room : null;
}

function changeVideo(roomId, room, video) {
  room.contentType = "youtube";
  room.videoId = video.videoId;
  room.title = video.title || "Untitled video";
  room.isPlaying = false;
  room.currentTime = 0;
  room.playbackRate = 1;
  room.playStartTime = null;
  room.lastUpdateTime = Date.now();
  io.to(roomId).emit("video-changed", {
    videoId: room.videoId,
    title: room.title,
    contentType: room.contentType,
  });
  broadcastRoom(roomId);
}

// Ensure Next.js handles /api/rooms/verify directly without touching room params
app.get("/api/rooms/verify", (req, res) => {
  return nextHandler(req, res);
});

app.get("/api/rooms", cors(), (req, res) => {
  res.json(
    Array.from(rooms.entries()).map(([roomId, room]) => ({
      roomId,
      title: room.title,
      videoId: room.videoId,
      contentType: room.contentType,
      users: room.users,
      userCount: room.users.length,
      isPlaying: room.isPlaying,
    })),
  );
});

app.get("/api/rooms/:roomId", cors(), (req, res) => {
  const targetId = req.params.roomId;
  let room = rooms.get(targetId);
  if (!room) {
    const normTarget = targetId.toUpperCase().replace(/^ROOM[-_:]?/, "").replace(/[\s-]/g, "");
    for (const [key, val] of rooms.entries()) {
      const normKey = key.toUpperCase().replace(/^ROOM[-_:]?/, "").replace(/[\s-]/g, "");
      if (
        key.toLowerCase() === targetId.toLowerCase() ||
        (normTarget && normKey === normTarget)
      ) {
        return res.json({ roomId: key, ...roomState(val) });
      }
    }
    return res.status(404).json({ error: "Sala no encontrada" });
  }
  return res.json({ roomId: targetId, ...roomState(room) });
});

app.delete("/api/rooms/:roomId", cors(), (req, res) => {
  const targetId = req.params.roomId;
  const normTarget = targetId.toUpperCase().replace(/^ROOM[-_:]?/, "").replace(/[\s-]/g, "");
  let deleted = false;
  let actualKey = targetId;

  if (rooms.has(targetId)) {
    rooms.delete(targetId);
    deleted = true;
  }
  for (const [key] of rooms.entries()) {
    const normKey = key.toUpperCase().replace(/^ROOM[-_:]?/, "").replace(/[\s-]/g, "");
    if (
      key.toLowerCase() === targetId.toLowerCase() ||
      (normTarget && normKey === normTarget)
    ) {
      rooms.delete(key);
      actualKey = key;
      deleted = true;
    }
  }
  if (deleted) {
    io.to(targetId).emit("room-deleted", {
      roomId: targetId,
      message: "Esta Watch Party fue eliminada por el host.",
    });
    if (actualKey !== targetId) {
      io.to(actualKey).emit("room-deleted", {
        roomId: actualKey,
        message: "Esta Watch Party fue eliminada por el host.",
      });
      io.in(actualKey).socketsLeave(actualKey);
    }
    io.in(targetId).socketsLeave(targetId);
    io.emit("rooms-updated");
    return res.json({ success: true });
  }
  return res.status(404).json({ error: "Sala no encontrada" });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, rawUserId) => {
    const userId = String(rawUserId || "Guest").slice(0, 50);
    const room = getRoom(roomId);
    socket.join(roomId);

    room.users = room.users.filter((user) => user.socketId !== socket.id);
    room.users.push({ socketId: socket.id, userId });
    if (!room.hostSocketId) room.hostSocketId = socket.id;
    broadcastRoom(roomId);

    // If screen sharing is already active in the room, notify participants for immediate WebRTC negotiation
    if (room.screenSharerSocketId && room.screenSharerSocketId !== socket.id) {
      socket.emit("user-screen-changed", {
        socketId: room.screenSharerSocketId,
        enabled: true,
      });
      io.to(room.screenSharerSocketId).emit("screen-user-joined", {
        socketId: socket.id,
      });
    }
  });

  socket.on("send-message", (roomId, userId, message) => {
    const room = rooms.get(roomId);
    if (!room || room.chatLocked || !message?.trim()) return;
    io.to(roomId).emit("chat-message", {
      userId: String(userId || "Guest").slice(0, 50),
      message: String(message).trim().slice(0, 500),
      timestamp: Date.now(),
    });
  });

  socket.on("send-reaction", (roomId, reaction) => {
    if (
      !rooms.has(roomId) ||
      !["😂", "❤️", "😱", "😡", "🔥", "👀"].includes(reaction)
    )
      return;
    io.to(roomId).emit("reaction", {
      id: `${socket.id}-${Date.now()}`,
      reaction,
    });
  });

  socket.on("add-to-queue", (roomId, video, callback) => {
    const room = rooms.get(roomId);
    if (!room || !video?.videoId) {
      callback?.({
        success: false,
        error: "This room is no longer available.",
      });
      return;
    }
    room.queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      videoId: String(video.videoId).slice(0, 30),
      title: String(video.title || "Untitled video").slice(0, 100),
      addedBy: String(video.addedBy || "Guest").slice(0, 50),
    });
    broadcastRoom(roomId);
    callback?.({ success: true });
  });

  socket.on("remove-from-queue", (roomId, queueId) => {
    const room = requireHost(socket, roomId);
    if (!room) return;
    room.queue = room.queue.filter((video) => video.id !== queueId);
    broadcastRoom(roomId);
  });

  socket.on("play-video", (roomId, video) => {
    const room = requireHost(socket, roomId);
    if (!room || !video?.videoId) return;
    changeVideo(roomId, room, video);
  });

  socket.on("play-next", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room || !room.queue.length) return;
    const [nextVideo] = room.queue.splice(0, 1);
    changeVideo(roomId, room, nextVideo);
  });

  socket.on("video-ended", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room || !room.queue.length) return;
    const [nextVideo] = room.queue.splice(0, 1);
    changeVideo(roomId, room, nextVideo);
  });

  socket.on("play", (roomId, data) => {
    const room = requireHost(socket, roomId);
    if (!room || !room.videoId) return;

    const position =
      typeof data?.position === "number" && Number.isFinite(data.position)
        ? Math.max(0, data.position)
        : getCurrentTime(room);
    const playbackRate =
      typeof data?.playbackRate === "number" && data.playbackRate > 0
        ? data.playbackRate
        : room.playbackRate || 1;
    const timestamp = Date.now();

    room.isPlaying = true;
    room.currentTime = position;
    room.playbackRate = playbackRate;
    room.playStartTime = timestamp;
    room.lastUpdateTime = timestamp;

    const payload = {
      action: "play",
      position,
      timestamp,
      playbackRate,
    };

    socket.to(roomId).emit("play-synced", payload);
    broadcastRoom(roomId);
  });

  socket.on("clear-content", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room) return;
    room.contentType = null;
    room.videoId = null;
    room.title = "";
    room.isPlaying = false;
    room.currentTime = 0;
    room.playbackRate = 1;
    room.playStartTime = null;
    room.lastUpdateTime = Date.now();
    io.to(roomId).emit("video-changed", {
      videoId: null,
      title: "",
      contentType: null,
    });
    broadcastRoom(roomId);
  });

  socket.on("pause", (roomId, data) => {
    const room = requireHost(socket, roomId);
    if (!room) return;

    const position =
      typeof data?.position === "number" && Number.isFinite(data.position)
        ? Math.max(0, data.position)
        : getCurrentTime(room);
    const playbackRate =
      typeof data?.playbackRate === "number" && data.playbackRate > 0
        ? data.playbackRate
        : room.playbackRate || 1;
    const timestamp = Date.now();

    room.currentTime = position;
    room.isPlaying = false;
    room.playbackRate = playbackRate;
    room.playStartTime = null;
    room.lastUpdateTime = timestamp;

    const payload = {
      action: "pause",
      position,
      timestamp,
      playbackRate,
    };

    socket.to(roomId).emit("pause-synced", payload);
    broadcastRoom(roomId);
  });

  socket.on("seek", (roomId, clientTime, data) => {
    const room = requireHost(socket, roomId);
    if (!room) return;

    const rawPos =
      typeof clientTime === "number"
        ? clientTime
        : typeof data?.position === "number"
          ? data.position
          : 0;
    if (!Number.isFinite(rawPos)) return;

    const position = Math.max(0, rawPos);
    const playbackRate =
      typeof data?.playbackRate === "number" && data.playbackRate > 0
        ? data.playbackRate
        : room.playbackRate || 1;
    const timestamp = Date.now();

    room.currentTime = position;
    room.playbackRate = playbackRate;
    room.playStartTime = room.isPlaying ? timestamp : null;
    room.lastUpdateTime = timestamp;

    const payload = {
      action: "seek",
      position,
      timestamp,
      playbackRate,
    };

    io.to(roomId).emit("seek-synced", payload);
    broadcastRoom(roomId);
  });

  socket.on("playback-rate-change", (roomId, rate) => {
    const room = requireHost(socket, roomId);
    if (!room || typeof rate !== "number" || rate <= 0) return;

    room.currentTime = getCurrentTime(room);
    room.playbackRate = rate;
    room.playStartTime = room.isPlaying ? Date.now() : null;
    room.lastUpdateTime = Date.now();

    io.to(roomId).emit("playback-rate-synced", {
      playbackRate: rate,
      position: room.currentTime,
      timestamp: room.lastUpdateTime,
    });
    broadcastRoom(roomId);
  });

  socket.on("get-room-time", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room)
      callback?.({
        currentTime: getCurrentTime(room),
        isPlaying: room.isPlaying,
        playbackRate: room.playbackRate || 1,
        timestamp: Date.now(),
      });
  });

  socket.on("create-poll", (roomId, poll) => {
    const room = requireHost(socket, roomId);
    if (!room || !poll?.question || !Array.isArray(poll.options)) return;
    const options = poll.options
      .map((option) => String(option).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 4);
    if (options.length < 2) return;
    room.activePoll = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      question: String(poll.question).trim().slice(0, 140),
      options: options.map((label) => ({ label, votes: 0 })),
      voters: [],
      closed: false,
    };
    broadcastRoom(roomId);
  });

  socket.on("vote-poll", (roomId, optionIndex) => {
    const room = rooms.get(roomId);
    const poll = room?.activePoll;
    if (
      !poll ||
      poll.closed ||
      poll.voters.includes(socket.id) ||
      !poll.options[optionIndex]
    )
      return;
    poll.options[optionIndex].votes += 1;
    poll.voters.push(socket.id);
    broadcastRoom(roomId);
  });

  socket.on("close-poll", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room?.activePoll) return;
    room.activePoll = null;
    broadcastRoom(roomId);
  });

  socket.on("toggle-chat-lock", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room) return;
    room.chatLocked = !room.chatLocked;
    broadcastRoom(roomId);
  });

  socket.on("remove-participant", (roomId, participantSocketId) => {
    const room = requireHost(socket, roomId);

    if (!room || participantSocketId === socket.id) return;

    const participant = io.sockets.sockets.get(participantSocketId);

    participant?.emit("removed-from-room");
    participant?.leave(roomId);

    room.users = room.users.filter(
      (user) => user.socketId !== participantSocketId,
    );

    // Sacarlo también del voice chat
    const wasInVoice = room.voiceUsers.some(
      (user) => user.socketId === participantSocketId,
    );

    room.voiceUsers = room.voiceUsers.filter(
      (user) => user.socketId !== participantSocketId,
    );

    // Avisar a los demás usuarios de voz
    if (wasInVoice) {
      io.to(roomId).emit("voice-user-left", {
        socketId: participantSocketId,
      });
    }

    broadcastRoom(roomId);
  });

  socket.on("delete-room", (roomId, callback) => {
    const room = requireHost(socket, roomId);

    if (!room) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Solo el anfitrión tiene permisos para eliminar esta sala.",
        });
      }
      return;
    }

    // 1. Notificar a todos los participantes en la sala
    io.to(roomId).emit("room-deleted", {
      roomId,
      message: "Esta Watch Party fue eliminada por el host.",
    });

    // 2. Desconectar a los clientes del room
    io.in(roomId).socketsLeave(roomId);

    // 3. Eliminar del mapa de rooms
    rooms.delete(roomId);
    for (const [key] of rooms.entries()) {
      if (key.toLowerCase() === String(roomId).toLowerCase()) {
        rooms.delete(key);
      }
    }

    // 4. Notificar a todos que la lista de salas cambió
    io.emit("rooms-updated");

    if (typeof callback === "function") {
      callback({ success: true });
    }
  });

  // =========================
  // WEBRTC VOICE CHAT
  // =========================

  socket.on("voice-join", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const user = room.users.find(
      (participant) => participant.socketId === socket.id,
    );

    if (!user) return;

    // Evitar duplicados
    if (
      !room.voiceUsers.some((participant) => participant.socketId === socket.id)
    ) {
      room.voiceUsers.push({
        socketId: socket.id,
        userId: user.userId,
      });
    }

    // Le pasamos al usuario que activa voz todos los demás participantes de la sala para negociar audio
    const otherRoomUsers = room.users.filter(
      (participant) => participant.socketId !== socket.id,
    );

    socket.emit("voice-participants", otherRoomUsers);

    // Avisamos a todos los participantes de la sala que entró alguien a voz
    socket.to(roomId).emit("voice-user-joined", {
      socketId: socket.id,
      userId: user.userId,
    });

    broadcastRoom(roomId);
  });

  socket.on("voice-leave", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const wasInVoice = room.voiceUsers.some(
      (participant) => participant.socketId === socket.id,
    );

    if (!wasInVoice) return;

    room.voiceUsers = room.voiceUsers.filter(
      (participant) => participant.socketId !== socket.id,
    );

    socket.to(roomId).emit("voice-user-left", {
      socketId: socket.id,
    });

    broadcastRoom(roomId);
  });

  socket.on("voice-offer", (targetSocketId, offer) => {
    io.to(targetSocketId).emit("voice-offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("voice-answer", (targetSocketId, answer) => {
    io.to(targetSocketId).emit("voice-answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("voice-ice-candidate", (targetSocketId, candidate) => {
    io.to(targetSocketId).emit("voice-ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // =========================
  // WEBRTC CAMERA
  // =========================

  socket.on("camera-offer", (targetSocketId, offer) => {
    io.to(targetSocketId).emit("camera-offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("camera-answer", (targetSocketId, answer) => {
    io.to(targetSocketId).emit("camera-answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("camera-ice-candidate", (targetSocketId, candidate) => {
    io.to(targetSocketId).emit("camera-ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // =========================
  // WEBRTC SCREEN SHARING
  // =========================

  socket.on("screen-offer", (targetSocketId, offer) => {
    io.to(targetSocketId).emit("screen-offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("screen-answer", (targetSocketId, answer) => {
    io.to(targetSocketId).emit("screen-answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("screen-ice-candidate", (targetSocketId, candidate) => {
    io.to(targetSocketId).emit("screen-ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  socket.on("screen-share-changed", (roomId, isSharing) => {
    const room = rooms.get(roomId);
    if (room) {
      if (isSharing) {
        room.contentType = "screen";
        room.screenSharerSocketId = socket.id;
        room.screenShareUsers = [socket.id];
        // Pause YouTube playback while screen sharing to preserve the exact position
        if (room.isPlaying) {
          const now = Date.now();
          const position = getCurrentTime(room);
          room.currentTime = position;
          room.isPlaying = false;
          room.playStartTime = null;
          room.lastUpdateTime = now;
          io.to(roomId).emit("pause-synced", {
            action: "pause",
            position,
            timestamp: now,
            playbackRate: room.playbackRate || 1,
          });
        }
      } else if (room.screenSharerSocketId === socket.id || !isSharing) {
        room.contentType = room.videoId ? "youtube" : null;
        room.screenSharerSocketId = null;
        room.screenShareUsers = [];
      }
      broadcastRoom(roomId);
    }
    socket.to(roomId).emit("user-screen-changed", {
      socketId: socket.id,
      enabled: !!isSharing,
    });
    socket.to(roomId).emit("user-screen-share-changed", {
      socketId: socket.id,
      isSharing: !!isSharing,
    });
  });

  socket.on("user-screen-changed", (roomId, enabled) => {
    const room = rooms.get(roomId);
    if (room) {
      if (enabled) {
        room.contentType = "screen";
        room.screenSharerSocketId = socket.id;
        room.screenShareUsers = [socket.id];
        if (room.isPlaying) {
          const now = Date.now();
          const position = getCurrentTime(room);
          room.currentTime = position;
          room.isPlaying = false;
          room.playStartTime = null;
          room.lastUpdateTime = now;
          io.to(roomId).emit("pause-synced", {
            action: "pause",
            position,
            timestamp: now,
            playbackRate: room.playbackRate || 1,
          });
        }
      } else if (room.screenSharerSocketId === socket.id || !enabled) {
        room.contentType = room.videoId ? "youtube" : null;
        room.screenSharerSocketId = null;
        room.screenShareUsers = [];
      }
      broadcastRoom(roomId);
    }
    socket.to(roomId).emit("user-screen-changed", {
      socketId: socket.id,
      enabled: !!enabled,
    });
    socket.to(roomId).emit("user-screen-share-changed", {
      socketId: socket.id,
      isSharing: !!enabled,
    });
  });

  socket.on("camera-changed", (roomId, isCameraOn) => {
    const room = rooms.get(roomId);
    if (room) {
      if (!room.cameraUsers) room.cameraUsers = [];
      if (isCameraOn) {
        if (!room.cameraUsers.includes(socket.id)) {
          room.cameraUsers.push(socket.id);
        }
      } else {
        room.cameraUsers = room.cameraUsers.filter((id) => id !== socket.id);
      }
    }
    socket.to(roomId).emit("user-camera-changed", {
      socketId: socket.id,
      enabled: !!isCameraOn,
      isCameraOn: !!isCameraOn,
    });
  });

  function leaveAllRooms() {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.some((user) => user.socketId === socket.id)) continue;

      if (room.screenSharerSocketId === socket.id) {
        room.screenSharerSocketId = null;
        room.screenShareUsers = [];
        room.contentType = room.videoId ? "youtube" : null;
        socket.to(roomId).emit("user-screen-changed", {
          socketId: socket.id,
          enabled: false,
        });
        socket.to(roomId).emit("user-screen-share-changed", {
          socketId: socket.id,
          isSharing: false,
        });
      }

      const wasInVoice = room.voiceUsers.some(
        (participant) => participant.socketId === socket.id,
      );

      room.users = room.users.filter((user) => user.socketId !== socket.id);

      room.voiceUsers = room.voiceUsers.filter(
        (participant) => participant.socketId !== socket.id,
      );

      if (room.cameraUsers) {
        room.cameraUsers = room.cameraUsers.filter((id) => id !== socket.id);
      }

      if (wasInVoice) {
        socket.to(roomId).emit("voice-user-left", {
          socketId: socket.id,
        });
      }

      socket.to(roomId).emit("user-camera-changed", {
        socketId: socket.id,
        enabled: false,
        isCameraOn: false,
      });

      if (room.hostSocketId === socket.id) {
        room.hostSocketId = room.users[0]?.socketId || null;
      }

      if (!room.users.length) {
        rooms.delete(roomId);
      } else {
        broadcastRoom(roomId);
      }
    }
  }

  socket.on("leave-room", leaveAllRooms);
  socket.on("disconnect", leaveAllRooms);
});

// Express 5 wildcard to delegate all remaining routes to Next.js (App Router, API routes, SSR, assets)
app.all("/{*path}", (req, res) => {
  return nextHandler(req, res);
});

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startServer() {
  await nextApp.prepare();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`> Servidor listo en http://0.0.0.0:${PORT} (dev: ${dev})`);
  });
}

startServer().catch((err) => {
  console.error("Error fatal al iniciar el servidor:", err);
  process.exit(1);
});
