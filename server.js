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

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    console.log(`${userId} se unió a la sala ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        videoId: null,
        isPlaying: false,
        currentTime: 0,
        users: [],
        title: "Sin video",
        lastUpdateTime: Date.now(),
      });
    }

    const room = rooms.get(roomId);
    room.users.push(userId);

    // Enviar estado actual al nuevo usuario
    socket.emit("room-state", room);

    // Notificar a otros usuarios
    socket.to(roomId).emit("user-joined", userId);
    socket.to(roomId).emit("users-updated", room.users);
  });

  socket.on("play-video", (roomId, videoId, title) => {
    const room = rooms.get(roomId);
    if (room) {
      room.videoId = videoId;
      room.title = title || "Video sin título";
      room.isPlaying = false; // No reproducir automáticamente
      room.currentTime = 0;
      room.lastUpdateTime = Date.now();

      // Broadcast a TODOS incluyendo al que envió el evento
      io.to(roomId).emit("video-changed", {
        videoId,
        title: room.title,
        currentTime: 0,
      });
      console.log(`Video reproduciendo en sala ${roomId}: ${videoId}`);
    }
  });

  socket.on("play", (roomId, currentTime) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime || 0;
      room.lastUpdateTime = Date.now();

      console.log(`Play en sala ${roomId} a tiempo ${currentTime}`);

      // Broadcast a TODOS EXCEPTO al que envió el evento
      socket.to(roomId).emit("play-synced", {
        currentTime: currentTime,
        timestamp: room.lastUpdateTime,
      });
    }
  });

  socket.on("pause", (roomId, currentTime) => {
    const room = rooms.get(roomId);
    if (room) {
      console.log(room);
      room.isPlaying = false;
      room.currentTime = currentTime || 0;
      room.lastUpdateTime = Date.now();

      console.log(`Pause en sala ${roomId} a tiempo ${currentTime}`);

      // Broadcast a TODOS EXCEPTO al que envió el evento
      socket.to(roomId).emit("pause-synced", {
        currentTime: currentTime,
      });
    }
  });

  socket.on("seek", (roomId, time) => {
    const room = rooms.get(roomId);
    if (room) {
      room.currentTime = time;
      room.lastUpdateTime = Date.now();

      console.log(`Seek en sala ${roomId} a tiempo ${time}`);

      // Broadcast a TODOS EXCEPTO al que envió el evento
      socket.to(roomId).emit("seek-synced", {
        currentTime: time,
        timestamp: room.lastUpdateTime,
      });
    }
  });

  socket.on("leave-room", (roomId, userId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.users = room.users.filter((u) => u !== userId);
      io.to(roomId).emit("users-updated", room.users);

      // Eliminar sala si está vacía
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
