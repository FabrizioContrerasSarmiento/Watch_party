"use client";

import { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import { io } from "socket.io-client";

export default function WatchPartyRoom({ roomId, userId }) {
  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [users, setUsers] = useState([]);
  const [videoTitle, setVideoTitle] = useState("Sin video");
  const [inputVideoId, setInputVideoId] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [debug, setDebug] = useState("");

  const isSeeking = useRef(false);
  const isLocalChange = useRef(false);
  const timeUpdateInterval = useRef(null);

  // Conectar a Socket.io
  useEffect(() => {
    socketRef.current = io("http://localhost:3001", {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current.emit("join-room", roomId, userId);

    // Recibir estado de la sala
    socketRef.current.on("room-state", (room) => {
      console.log("Estado de sala recibido:", room);
      setDebug("Estado recibido");
      if (room.videoId) {
        setVideoId(room.videoId);
        setVideoTitle(room.title);
      }
      setCurrentTime(room.currentTime);
      setUsers(room.users);
    });

    // Sincronizar reproducción desde otros usuarios
    socketRef.current.on("play-synced", (data) => {
      console.log("Play sincronizado recibido:", data);
      console.log("Player ref:", playerRef.current);
      console.log("Player ready:", playerReady);
      setDebug(`Play recibido - Player: ${playerRef.current ? "OK" : "NULL"}`);

      if (playerRef.current && playerReady) {
        try {
          isLocalChange.current = true;
          console.log("Ejecutando play...");

          // Obtener tiempo actual de forma segura
          let currentPlayerTime = 0;
          try {
            currentPlayerTime = playerRef.current.getCurrentTime();
          } catch (e) {
            console.warn("No se pudo obtener tiempo actual:", e);
            currentPlayerTime = 0;
          }

          // Sincronizar tiempo primero
          if (Math.abs(currentPlayerTime - data.currentTime) > 1) {
            console.log("Buscando a tiempo:", data.currentTime);
            playerRef.current.seekTo(data.currentTime, true);
          }

          // Reproducir después de un delay
          setTimeout(() => {
            if (playerRef.current) {
              try {
                console.log("Reproduciendo video...");
                playerRef.current.playVideo();
                setIsPlaying(true);
              } catch (e) {
                console.error("Error al reproducir:", e);
              }
            }
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al reproducir:", error);
          isLocalChange.current = false;
        }
      } else {
        console.warn("No se puede reproducir - Player no está listo");
        setDebug("Player no listo para play");
      }
    });

    socketRef.current.on("pause-synced", (data) => {
      console.log("Pause sincronizado recibido:", data);
      console.log("Player ref:", playerRef.current);
      console.log("Player ready:", playerReady);
      setDebug(`Pause recibido - Player: ${playerRef.current ? "OK" : "NULL"}`);

      if (playerRef.current && playerReady) {
        try {
          isLocalChange.current = true;
          console.log("Ejecutando pause...");

          // Obtener tiempo actual de forma segura
          let currentPlayerTime = 0;
          try {
            currentPlayerTime = playerRef.current.getCurrentTime();
          } catch (e) {
            console.warn("No se pudo obtener tiempo actual:", e);
            currentPlayerTime = 0;
          }

          // Sincronizar tiempo primero
          if (Math.abs(currentPlayerTime - data.currentTime) > 1) {
            console.log("Buscando a tiempo:", data.currentTime);
            playerRef.current.seekTo(data.currentTime, true);
          }

          // Pausar después de un delay
          setTimeout(() => {
            if (playerRef.current) {
              try {
                console.log("Pausando video...");
                playerRef.current.pauseVideo();
                setIsPlaying(false);
              } catch (e) {
                console.error("Error al pausar:", e);
              }
            }
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al pausar:", error);
          isLocalChange.current = false;
        }
      } else {
        console.warn("No se puede pausar - Player no está listo");
        setDebug("Player no listo para pause");
      }
    });

    socketRef.current.on("seek-synced", (data) => {
      console.log("Seek sincronizado recibido:", data);
      if (playerRef.current && playerReady && !isSeeking.current) {
        try {
          isLocalChange.current = true;
          console.log("Buscando a:", data.currentTime);
          playerRef.current.seekTo(data.currentTime, true);
          setCurrentTime(data.currentTime);
          setTimeout(() => {
            isLocalChange.current = false;
          }, 500);
        } catch (error) {
          console.error("Error al buscar:", error);
          isLocalChange.current = false;
        }
      }
    });

    socketRef.current.on("video-changed", (data) => {
      console.log("Video cambiado recibido:", data);
      setDebug("Video cambiado");
      isLocalChange.current = true;
      setVideoId(data.videoId);
      setVideoTitle(data.title);
      setCurrentTime(0);
      setIsPlaying(false);
      setPlayerReady(false);

      setTimeout(() => {
        isLocalChange.current = false;
      }, 1000);
    });

    socketRef.current.on("users-updated", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socketRef.current.on("user-joined", (newUserId) => {
      console.log(`${newUserId} se unió a la sala`);
    });

    return () => {
      socketRef.current?.emit("leave-room", roomId, userId);
      socketRef.current?.disconnect();
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [roomId, userId, playerReady]);

  const handlePlayerReady = (event) => {
    console.log("Player ready event recibido:", event);
    playerRef.current = event.target;
    setPlayerReady(true);
    setDebug("Player listo");
    console.log("Player asignado:", playerRef.current);

    // Actualizar tiempo cada 500ms
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
    }
    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current && !isSeeking.current) {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
        } catch (e) {
          // Silenciar errores de lectura de tiempo
        }
      }
    }, 500);
  };

  const handleStateChange = (event) => {
    const state = event.data;
    const stateNames = {
      "-1": "UNSTARTED",
      0: "ENDED",
      1: "PLAYING",
      2: "PAUSED",
      3: "BUFFERING",
      5: "CUED",
    };

    console.log("Estado del player cambió a:", stateNames[state]);

    // Evitar loops infinitos
    if (isLocalChange.current) {
      console.log("Cambio local detectado, ignorando");
      return;
    }

    if (state === 1) {
      // Reproduciendo
      console.log("Usuario presionó play localmente");
      isLocalChange.current = true;

      let time = 0;
      try {
        time = playerRef.current?.getCurrentTime() || 0;
      } catch (e) {
        console.warn("No se pudo obtener tiempo:", e);
      }

      socketRef.current.emit("play", roomId, time);
      setIsPlaying(true);
      setDebug("Play local enviado");

      setTimeout(() => {
        isLocalChange.current = false;
      }, 500);
    } else if (state === 2) {
      // Pausado
      console.log("Usuario presionó pause localmente");
      isLocalChange.current = true;

      let time = 0;
      try {
        time = playerRef.current?.getCurrentTime() || 0;
      } catch (e) {
        console.warn("No se pudo obtener tiempo:", e);
      }

      socketRef.current.emit("pause", roomId, time);
      setIsPlaying(false);
      setDebug("Pause local enviado");

      setTimeout(() => {
        isLocalChange.current = false;
      }, 500);
    }
  };

  const handleSeek = () => {
    if (playerRef.current && !isLocalChange.current) {
      isSeeking.current = true;

      let time = 0;
      try {
        time = playerRef.current.getCurrentTime();
      } catch (e) {
        console.warn("No se pudo obtener tiempo:", e);
      }

      console.log("Usuario hizo seek a:", time);
      socketRef.current.emit("seek", roomId, time);
      setCurrentTime(time);
      setDebug(`Seek a ${Math.floor(time)}s`);

      setTimeout(() => {
        isSeeking.current = false;
      }, 500);
    }
  };

  const playVideo = () => {
    if (!inputVideoId.trim()) {
      alert("Por favor ingresa un ID de video de YouTube");
      return;
    }

    console.log("Reproduciendo nuevo video:", inputVideoId);
    isLocalChange.current = true;
    socketRef.current.emit(
      "play-video",
      roomId,
      inputVideoId,
      inputTitle || "Video sin título",
    );
    setVideoId(inputVideoId);
    setVideoTitle(inputTitle || "Video sin título");
    setInputVideoId("");
    setInputTitle("");
    setCurrentTime(0);
    setPlayerReady(false);
    setIsPlaying(false);
    setDebug("Nuevo video cargando");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      playVideo();
    }
  };

  const opts = {
    height: "600",
    width: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      fs: 1,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🎬 Watch Party - Sala {roomId}</h1>
        <p style={styles.subtitle}>
          Mira videos de YouTube sincronizados con tus amigos
        </p>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.videoSection}>
          <div style={styles.playerWrapper}>
            {!playerReady && (
              <div style={styles.loadingOverlay}>
                <p>Cargando video...</p>
              </div>
            )}
            <YouTube
              key={videoId}
              videoId={videoId}
              opts={opts}
              onStateChange={handleStateChange}
              onReady={handlePlayerReady}
              onSeek={handleSeek}
              onError={(error) => {
                console.error("Error de YouTube:", error);
                setPlayerReady(false);
                setDebug("Error en video");
              }}
            />
          </div>

          <div style={styles.videoInfo}>
            <h2>{videoTitle}</h2>
            <p>
              Tiempo: {Math.floor(currentTime)}s | Estado:{" "}
              {isPlaying ? "▶️ Reproduciendo" : "⏸️ Pausado"}
            </p>
            <p style={styles.statusText}>
              {playerReady ? "✅ Listo" : "⏳ Cargando..."}
            </p>
            <p style={styles.debugText}>Debug: {debug}</p>
          </div>

          <div style={styles.controlsSection}>
            <h3>Reproducir nuevo video</h3>
            <input
              type="text"
              placeholder="ID de video de YouTube (ej: dQw4w9WgXcQ)"
              value={inputVideoId}
              onChange={(e) => setInputVideoId(e.target.value)}
              onKeyPress={handleKeyPress}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Título del video (opcional)"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              style={styles.input}
            />
            <button onClick={playVideo} style={styles.button}>
              ▶️ Reproducir
            </button>
          </div>
        </div>

        <div style={styles.sidebar}>
          <div style={styles.usersCard}>
            <h3>👥 Usuarios Conectados ({users.length})</h3>
            <ul style={styles.usersList}>
              {users.map((user, idx) => (
                <li key={idx} style={styles.userItem}>
                  {user === userId ? `✨ ${user} (tú)` : `👤 ${user}`}
                </li>
              ))}
            </ul>
          </div>

          <div style={styles.tipsCard}>
            <h3>💡 Consejos</h3>
            <ul style={styles.tipsList}>
              <li>Copia el ID del video de la URL de YouTube</li>
              <li>La reproducción se sincroniza automáticamente</li>
              <li>Todos ven el mismo video al mismo tiempo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
    borderBottom: "2px solid #ff0000",
    paddingBottom: "20px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#aaa",
    marginTop: "8px",
  },
  mainContent: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: "20px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  videoSection: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  playerWrapper: {
    position: "relative",
    backgroundColor: "#000",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  videoInfo: {
    backgroundColor: "#1a1a1a",
    padding: "15px",
    borderRadius: "8px",
    borderLeft: "4px solid #ff0000",
  },
  statusText: {
    fontSize: "12px",
    color: "#aaa",
    marginTop: "8px",
  },
  debugText: {
    fontSize: "11px",
    color: "#666",
    marginTop: "5px",
    fontFamily: "monospace",
  },
  controlsSection: {
    backgroundColor: "#1a1a1a",
    padding: "20px",
    borderRadius: "8px",
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "10px",
    backgroundColor: "#2a2a2a",
    border: "1px solid #404040",
    color: "#fff",
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#ff0000",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  usersCard: {
    backgroundColor: "#1a1a1a",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #404040",
  },
  usersList: {
    listStyle: "none",
    padding: "0",
    margin: "10px 0 0 0",
  },
  userItem: {
    padding: "8px",
    backgroundColor: "#2a2a2a",
    marginBottom: "8px",
    borderRadius: "4px",
    fontSize: "14px",
  },
  tipsCard: {
    backgroundColor: "#1a1a1a",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #404040",
    fontSize: "13px",
  },
  tipsList: {
    listStyle: "none",
    padding: "0",
    margin: "10px 0 0 0",
  },
};
