// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Almacenar estado de cada sala
const rooms = new Map();

app.get("/api/rooms", (req, res) => {
  const roomsList = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    title: room.title,
    videoId: room.videoId,
    users: room.users,
    userCount: room.users.length,
    isPlaying: room.isPlaying,
  }));

  res.json(roomsList);
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (!room) {
    return res.status(404).json({ error: "Sala no encontrada" });
  }

  res.json({
    roomId: req.params.roomId,
    title: room.title,
    videoId: room.videoId,
    users: room.users,
    userCount: room.users.length,
    isPlaying: room.isPlaying,
  });
});

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    console.log(`${userId} se unió a la sala ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        videoId: null,
        isPlaying: false,
        users: [],
        title: "Sin video",
        currentTime: 0,
        playStartTime: null, // Timestamp de cuándo se presionó play
        lastUpdateTime: Date.now(),
      });
    }

    const room = rooms.get(roomId);
    room.users.push(userId);

    socket.emit("room-state", room);
    socket.to(roomId).emit("user-joined", userId);
    socket.to(roomId).emit("users-updated", room.users);
  });

  socket.on("play-video", (roomId, videoId, title) => {
    const room = rooms.get(roomId);
    if (room) {
      room.videoId = videoId;
      room.title = title || "Video sin título";
      room.isPlaying = false;
      room.currentTime = 0;
      room.playStartTime = null;
      room.lastUpdateTime = Date.now();

      io.to(roomId).emit("video-changed", {
        videoId,
        title: room.title,
      });

      io.emit("rooms-updated");
      console.log(`Video en sala ${roomId}: ${videoId}`);
    }
  });

  socket.on("play", (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = true;
      // Guardar cuándo empezó la reproducción (ahora)
      room.playStartTime = Date.now();
      room.lastUpdateTime = Date.now();

      socket.to(roomId).emit("play-synced");
      io.emit("rooms-updated");
      console.log(`Play en sala ${roomId}, tiempo: ${room.currentTime}`);
    }
  });

  socket.on("pause", (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      // Actualizar currentTime antes de pausar
      if (room.isPlaying && room.playStartTime) {
        const elapsedMs = Date.now() - room.playStartTime;
        room.currentTime += elapsedMs / 1000;
      }
      room.isPlaying = false;
      room.playStartTime = null;
      room.lastUpdateTime = Date.now();

      socket.to(roomId).emit("pause-synced");
      io.emit("rooms-updated");
      console.log(
        `Pause en sala ${roomId}, tiempo: ${room.currentTime.toFixed(2)}`,
      );
    }
  });

  socket.on("seek", (roomId, clientTime) => {
    const room = rooms.get(roomId);
    if (room) {
      // Calcular el tiempo actual del servidor
      let serverTime = room.currentTime;
      if (room.isPlaying && room.playStartTime) {
        const elapsedMs = Date.now() - room.playStartTime;
        serverTime = room.currentTime + elapsedMs / 1000;
      }

      // Validar que el seek sea razonable
      const timeDiff = Math.abs(clientTime - serverTime);

      if (timeDiff <= 5) {
        // Seek válido - actualizar currentTime y resetear playStartTime
        room.currentTime = clientTime;
        if (room.isPlaying) {
          // Si está reproduciéndose, actualizar playStartTime a ahora
          room.playStartTime = Date.now();
        } else {
          room.playStartTime = null;
        }
        room.lastUpdateTime = Date.now();

        console.log(
          `Seek válido en sala ${roomId}: ${clientTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`,
        );

        io.to(roomId).emit("seek-synced", {
          currentTime: clientTime,
        });
      } else {
        // Seek inválido - rechazar y enviar el tiempo correcto
        console.log(
          `Seek rechazado en sala ${roomId}: cliente=${clientTime.toFixed(2)}, servidor=${serverTime.toFixed(2)}, diff=${timeDiff.toFixed(2)}s`,
        );

        socket.emit("seek-rejected", {
          correctTime: serverTime,
          reason: `Diferencia de ${timeDiff.toFixed(1)}s es mayor a 3s permitidos`,
        });
      }
    }
  });

  socket.on("get-room-time", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room) {
      // Calcular el tiempo actual
      let currentTime = room.currentTime;
      if (room.isPlaying && room.playStartTime) {
        const elapsedMs = Date.now() - room.playStartTime;
        currentTime = room.currentTime + elapsedMs / 1000;
      }

      callback({
        currentTime: currentTime,
        isPlaying: room.isPlaying,
        lastUpdateTime: room.lastUpdateTime,
      });
    }
  });

  socket.on("leave-room", (roomId, userId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.users = room.users.filter((u) => u !== userId);
      io.to(roomId).emit("users-updated", room.users);

      io.emit("rooms-updated");

      if (room.users.length === 0) {
        rooms.delete(roomId);
        console.log(`Sala ${roomId} eliminada (vacía)`);
      }
    }
    socket.leave(roomId);
    console.log(`${userId} salió de la sala ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
