"use client";

import { useEffect, useRef, useState } from "react";
import YouTubePlayer from "./YouTubePlayer";
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

  const isLocalChange = useRef(false);
  const timeUpdateInterval = useRef(null);
  const isSeeking = useRef(false);
  const syncCheckInterval = useRef(null);
  const lastSyncTime = useRef(0);
  const isPageVisible = useRef(true);

  useEffect(() => {
    socketRef.current = io("http://localhost:3001", {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current.emit("join-room", roomId, userId);

    socketRef.current.on("room-state", (room) => {
      console.log("Estado de sala recibido:", room);

      if (room.videoId) {
        setVideoId(room.videoId);
        setVideoTitle(room.title);
        setIsPlaying(room.isPlaying);
      } else {
        setVideoId("dQw4w9WgXcQ");
        setVideoTitle("Sin video");
        setIsPlaying(false);
      }

      setUsers(room.users);
    });

    socketRef.current.on("play-synced", () => {
      console.log("Play sincronizado recibido");

      if (playerRef.current) {
        try {
          isLocalChange.current = true;
          playerRef.current.playVideo();
          setIsPlaying(true);

          setTimeout(() => {
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al reproducir:", error);
          isLocalChange.current = false;
        }
      }
    });

    socketRef.current.on("pause-synced", () => {
      console.log("Pause sincronizado recibido");

      if (playerRef.current) {
        try {
          isLocalChange.current = true;
          playerRef.current.pauseVideo();
          setIsPlaying(false);

          setTimeout(() => {
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al pausar:", error);
          isLocalChange.current = false;
        }
      }
    });

    socketRef.current.on("seek-synced", (data) => {
      console.log("Seek sincronizado recibido:", data);

      if (playerRef.current && !isSeeking.current && !isLocalChange.current) {
        try {
          isLocalChange.current = true;
          playerRef.current.seekTo(data.currentTime, true);
          setCurrentTime(data.currentTime);
          lastSyncTime.current = Date.now();

          setTimeout(() => {
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al aplicar seek:", error);
          isLocalChange.current = false;
        }
      }
    });

    socketRef.current.on("seek-rejected", (data) => {
      console.log("Seek rechazado:", data.reason);

      if (playerRef.current) {
        try {
          isLocalChange.current = true;
          console.log("Corrigiendo tiempo a:", data.correctTime);
          playerRef.current.seekTo(data.correctTime, true);
          setCurrentTime(data.correctTime);
          lastSyncTime.current = Date.now();

          setTimeout(() => {
            isLocalChange.current = false;
          }, 300);
        } catch (error) {
          console.error("Error al corregir tiempo:", error);
          isLocalChange.current = false;
        }
      }
    });

    socketRef.current.on("video-changed", (data) => {
      console.log("Video cambiado recibido:", data);
      isLocalChange.current = true;
      setIsPlaying(false);
      setCurrentTime(0);

      setVideoId(data.videoId);
      setVideoTitle(data.title);
      lastSyncTime.current = Date.now();

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

    // Detectar cuando la página vuelve a estar visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Página oculta");
        isPageVisible.current = false;
      } else {
        console.log("Página visible - resincronizando");
        isPageVisible.current = true;
        lastSyncTime.current = 0; // Forzar sincronización inmediata
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socketRef.current?.emit("leave-room", roomId, userId);
      socketRef.current?.disconnect();
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
      if (syncCheckInterval.current) {
        clearInterval(syncCheckInterval.current);
      }
    };
  }, [roomId, userId]);

  const handlePlayerReady = (event) => {
    console.log("Player ready");
    playerRef.current = event.target;
    setPlayerReady(true);
    lastSyncTime.current = Date.now();

    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
    }
    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
        } catch (e) {
          // Silenciar
        }
      }
    }, 500);

    // Sincronizar más agresivamente cuando la página está visible
    if (syncCheckInterval.current) {
      clearInterval(syncCheckInterval.current);
    }
    syncCheckInterval.current = setInterval(() => {
      if (playerRef.current && !isSeeking.current && !isLocalChange.current) {
        // Determinar intervalo de sincronización basado en visibilidad
        const syncInterval = isPageVisible.current ? 5000 : 2000; // 5s si visible, 2s si oculta
        const timeSinceLastSync = Date.now() - lastSyncTime.current;

        if (timeSinceLastSync > syncInterval) {
          socketRef.current.emit("get-room-time", roomId, (roomData) => {
            if (roomData) {
              const clientTime = playerRef.current.getCurrentTime();
              const timeDiff = Math.abs(clientTime - roomData.currentTime);

              console.log(
                `Verificación de sync: cliente=${clientTime.toFixed(1)}, servidor=${roomData.currentTime.toFixed(1)}, diff=${timeDiff.toFixed(1)}, visible=${isPageVisible.current}`,
              );

              // Si hay diferencia > 1 segundo, sincronizar
              if (timeDiff > 1) {
                console.log(`Sincronizando tiempo`);
                isLocalChange.current = true;
                playerRef.current.seekTo(roomData.currentTime, true);
                setCurrentTime(roomData.currentTime);
                lastSyncTime.current = Date.now();

                setTimeout(() => {
                  isLocalChange.current = false;
                }, 500);
              } else {
                // Aunque no haya diferencia grande, actualizar el último sync
                lastSyncTime.current = Date.now();
              }
            }
          });
        }
      }
    }, 1000); // Verificar cada 1 segundo
  };

  const handleStateChange = (event) => {
    const state = event.data;

    if (isLocalChange.current || isSeeking.current) {
      return;
    }

    if (state === 1) {
      // PLAYING
      console.log("Usuario presionó play");
      isLocalChange.current = true;
      socketRef.current.emit("play", roomId);
      setIsPlaying(true);

      setTimeout(() => {
        isLocalChange.current = false;
      }, 300);
    } else if (state === 2) {
      // PAUSED
      console.log("Usuario presionó pause");
      isLocalChange.current = true;
      socketRef.current.emit("pause", roomId);
      setIsPlaying(false);

      setTimeout(() => {
        isLocalChange.current = false;
      }, 300);
    }
  };

  const handleSeek = (time) => {
    console.log("Usuario hizo seek a:", time);
    isSeeking.current = true;
    isLocalChange.current = true;
    lastSyncTime.current = Date.now();

    socketRef.current.emit("seek", roomId, time);
    setCurrentTime(time);

    setTimeout(() => {
      isSeeking.current = false;
      isLocalChange.current = false;
    }, 500);
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
    setIsPlaying(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      playVideo();
    }
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
            <YouTubePlayer
              videoId={videoId}
              onReady={handlePlayerReady}
              onStateChange={handleStateChange}
              onSeek={handleSeek}
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
              <li>Todos ven el mismo video</li>
              <li>Play y pause se sincronizan automáticamente</li>
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
