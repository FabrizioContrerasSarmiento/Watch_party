"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [generatedRoom, setGeneratedRoom] = useState("");

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

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎬 Watch Party</h1>
        <p style={styles.subtitle}>
          Mira videos de YouTube sincronizados con tus amigos
        </p>

        <div style={styles.section}>
          <h2>Crear Nueva Sala</h2>
          <button onClick={generateRoom} style={styles.button}>
            Generar Sala Aleatoria
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
          <h2>Unirse a una Sala Existente</h2>
          <input
            type="text"
            placeholder="Ingresa el ID de la sala"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={handleKeyPress}
            style={styles.input}
          />
          <button onClick={joinRoom} style={styles.button}>
            Unirse a la Sala
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    backgroundColor: "#1a1a1a",
    padding: "40px",
    borderRadius: "12px",
    maxWidth: "500px",
    width: "100%",
    border: "2px solid #ff0000",
  },
  title: {
    fontSize: "48px",
    marginBottom: "10px",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#aaa",
    marginBottom: "30px",
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
};
