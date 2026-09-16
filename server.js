import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const rooms = new Map();

function createRoom() {
  return {
    videoId: "dQw4w9WgXcQ",
    title: "Welcome to the Watch Party",
    isPlaying: false,
    currentTime: 0,
    playStartTime: null,
    lastUpdateTime: Date.now(),
    users: [],
    voiceUsers: [],
    hostSocketId: null,
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
  return room.currentTime + (Date.now() - room.playStartTime) / 1000;
}

function roomState(room) {
  return {
    ...room,
    currentTime: getCurrentTime(room),
    users: room.users.map(({ socketId, userId }) => ({
      socketId,
      userId,
    })),
    voiceUsers: room.voiceUsers.map(({ socketId, userId }) => ({
      socketId,
      userId,
    })),
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
  room.videoId = video.videoId;
  room.title = video.title || "Untitled video";
  room.isPlaying = false;
  room.currentTime = 0;
  room.playStartTime = null;
  room.lastUpdateTime = Date.now();
  io.to(roomId).emit("video-changed", {
    videoId: room.videoId,
    title: room.title,
  });
  broadcastRoom(roomId);
}

app.get("/api/rooms", (req, res) => {
  res.json(
    Array.from(rooms.entries()).map(([roomId, room]) => ({
      roomId,
      title: room.title,
      videoId: room.videoId,
      users: room.users,
      userCount: room.users.length,
      isPlaying: room.isPlaying,
    })),
  );
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Sala no encontrada" });
  return res.json({ roomId: req.params.roomId, ...roomState(room) });
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

  socket.on("play", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room) return;
    room.isPlaying = true;
    room.playStartTime = Date.now();
    room.lastUpdateTime = Date.now();
    socket.to(roomId).emit("play-synced");
    broadcastRoom(roomId);
  });

  socket.on("pause", (roomId) => {
    const room = requireHost(socket, roomId);
    if (!room) return;
    room.currentTime = getCurrentTime(room);
    room.isPlaying = false;
    room.playStartTime = null;
    room.lastUpdateTime = Date.now();
    socket.to(roomId).emit("pause-synced");
    broadcastRoom(roomId);
  });

  socket.on("seek", (roomId, clientTime) => {
    const room = requireHost(socket, roomId);
    if (!room || !Number.isFinite(clientTime)) return;
    room.currentTime = Math.max(0, clientTime);
    room.playStartTime = room.isPlaying ? Date.now() : null;
    room.lastUpdateTime = Date.now();
    io.to(roomId).emit("seek-synced", { currentTime: room.currentTime });
  });

  socket.on("get-room-time", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room)
      callback?.({
        currentTime: getCurrentTime(room),
        isPlaying: room.isPlaying,
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

    // Le pasamos al usuario nuevo todos los que ya estaban usando voz
    const otherVoiceUsers = room.voiceUsers.filter(
      (participant) => participant.socketId !== socket.id,
    );

    socket.emit("voice-participants", otherVoiceUsers);

    // Avisamos a los demás que entró alguien al voice chat
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

  function leaveAllRooms() {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.users.some((user) => user.socketId === socket.id)) continue;

      const wasInVoice = room.voiceUsers.some(
        (participant) => participant.socketId === socket.id,
      );

      room.users = room.users.filter((user) => user.socketId !== socket.id);

      room.voiceUsers = room.voiceUsers.filter(
        (participant) => participant.socketId !== socket.id,
      );

      if (wasInVoice) {
        socket.to(roomId).emit("voice-user-left", {
          socketId: socket.id,
        });
      }

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Servidor escuchando en puerto ${PORT}`),
);
