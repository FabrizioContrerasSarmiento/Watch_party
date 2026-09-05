"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [generatedRoom, setGeneratedRoom] = useState("");
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useState(null)[1];

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3001/api/rooms");
      const data = await response.json();
      setRooms(data);
      console.log("Salas cargadas:", data);
    } catch (error) {
      console.error("Error al cargar salas:", error);
    } finally {
      setLoading(false);
    }
  };
  // Cargar salas al montar
  useEffect(() => {
    loadRooms();

    // Conectar a Socket.io para actualizaciones en tiempo real
    const socket = io("http://localhost:3001");

    socket.on("rooms-updated", () => {
      console.log("Salas actualizadas");
      loadRooms();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const generateRoom = () => {
    const newRoom = `room-${Math.random().toString(36).substr(2, 9)}`;
    setGeneratedRoom(newRoom);
    setRoomId(newRoom);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/watch-party/${roomId}`);
    }
  };

  const joinExistingRoom = (existingRoomId) => {
    router.push(`/watch-party/${existingRoomId}`);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎬 Watch Party</h1>
          <p style={styles.subtitle}>
            Mira videos de YouTube sincronizados con tus amigos
          </p>
        </div>

        <div style={styles.grid}>
          {/* Crear/Unirse a sala */}
          <div style={styles.card}>
            <h2>Crear o Unirse a Sala</h2>

            <div style={styles.section}>
              <h3>Crear Nueva Sala</h3>
              <button onClick={generateRoom} style={styles.button}>
                ✨ Generar Sala Aleatoria
              </button>
              {generatedRoom && (
                <div style={styles.generatedRoom}>
                  <p>
                    Tu sala: <strong>{generatedRoom}</strong>
                  </p>
                  <button
                    onClick={() => router.push(`/watch-party/${generatedRoom}`)}
                    style={{ ...styles.button, marginTop: "10px" }}
                  >
                    Entrar a la Sala
                  </button>
                </div>
              )}
            </div>

            <div style={styles.divider}>o</div>

            <div style={styles.section}>
              <h3>Unirse a una Sala Existente</h3>
              <input
                type="text"
                placeholder="Ingresa el ID de la sala"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={handleKeyPress}
                style={styles.input}
              />
              <button onClick={joinRoom} style={styles.button}>
                🚪 Unirse a la Sala
              </button>
            </div>
          </div>

          {/* Salas activas */}
          <div style={styles.card}>
            <h2>Salas Activas ({rooms.length})</h2>

            {loading ? (
              <p style={styles.loadingText}>Cargando salas...</p>
            ) : rooms.length === 0 ? (
              <p style={styles.emptyText}>No hay salas activas. ¡Crea una!</p>
            ) : (
              <div style={styles.roomsList}>
                {rooms.map((room) => (
                  <div key={room.roomId} style={styles.roomCard}>
                    <div style={styles.roomHeader}>
                      <h4 style={styles.roomTitle}>{room.title}</h4>
                      <span style={styles.roomStatus}>
                        {room.isPlaying ? "▶️" : "⏸️"}
                      </span>
                    </div>

                    <div style={styles.roomInfo}>
                      <p style={styles.roomId}>
                        <strong>ID:</strong> {room.roomId}
                      </p>
                      <p style={styles.roomUsers}>
                        👥 {room.userCount} usuario
                        {room.userCount !== 1 ? "s" : ""}
                      </p>
                      {room.videoId && (
                        <p style={styles.roomVideo}>🎥 Video: {room.videoId}</p>
                      )}
                    </div>

                    <button
                      onClick={() => joinExistingRoom(room.roomId)}
                      style={styles.joinButton}
                    >
                      Unirse
                    </button>
                  </div>
                ))}
              </div>
            )}
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
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: "50px",
  },
  title: {
    fontSize: "48px",
    marginBottom: "10px",
  },
  subtitle: {
    color: "#aaa",
    fontSize: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "30px",
  },
  card: {
    backgroundColor: "#1a1a1a",
    padding: "30px",
    borderRadius: "12px",
    border: "2px solid #ff0000",
  },
  section: {
    marginBottom: "20px",
  },
  divider: {
    textAlign: "center",
    color: "#666",
    margin: "30px 0",
    fontSize: "14px",
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
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "10px",
    backgroundColor: "#2a2a2a",
    border: "1px solid #404040",
    color: "#fff",
    borderRadius: "4px",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  generatedRoom: {
    backgroundColor: "#2a2a2a",
    padding: "15px",
    borderRadius: "4px",
    marginTop: "10px",
    border: "1px solid #404040",
  },
  roomsList: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    maxHeight: "600px",
    overflowY: "auto",
  },
  roomCard: {
    backgroundColor: "#2a2a2a",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #404040",
    transition: "transform 0.2s, background-color 0.2s",
  },
  roomHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  roomTitle: {
    margin: "0",
    fontSize: "16px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "200px",
  },
  roomStatus: {
    fontSize: "18px",
  },
  roomInfo: {
    marginBottom: "10px",
  },
  roomId: {
    margin: "5px 0",
    fontSize: "12px",
    color: "#aaa",
    wordBreak: "break-all",
  },
  roomUsers: {
    margin: "5px 0",
    fontSize: "14px",
  },
  roomVideo: {
    margin: "5px 0",
    fontSize: "12px",
    color: "#aaa",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  joinButton: {
    width: "100%",
    padding: "8px",
    backgroundColor: "#ff0000",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
  loadingText: {
    textAlign: "center",
    color: "#aaa",
    padding: "20px",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    padding: "20px",
  },
  "@media (max-width: 768px)": {
    grid: {
      gridTemplateColumns: "1fr",
    },
  },
};
