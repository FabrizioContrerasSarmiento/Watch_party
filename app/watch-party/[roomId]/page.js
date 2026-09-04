"use client";

import { useState } from "react";
import { use } from "react";
import WatchPartyRoom from "@/components/WatchPartyRoom";

export default function WatchPartyPage({ params }) {
  const { roomId } = use(params);
  const [userId, setUserId] = useState("");
  const [joined, setJoined] = useState(false);
  const [inputName, setInputName] = useState("");

  const handleJoin = () => {
    if (inputName.trim()) {
      setUserId(inputName);
      setJoined(true);
    }
  };

  if (!joined) {
    return (
      <div style={styles.joinContainer}>
        <div style={styles.joinCard}>
          <h1>🎬 Bienvenido a Watch Party</h1>
          <p>
            Sala: <strong>{roomId}</strong>
          </p>

          <input
            type="text"
            placeholder="¿Cuál es tu nombre?"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleJoin()}
            style={styles.joinInput}
            autoFocus
          />

          <button onClick={handleJoin} style={styles.joinButton}>
            Entrar a la Sala
          </button>
        </div>
      </div>
    );
  }

  return <WatchPartyRoom roomId={roomId} userId={userId} />;
}

const styles = {
  joinContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#fff",
  },
  joinCard: {
    backgroundColor: "#1a1a1a",
    padding: "40px",
    borderRadius: "12px",
    textAlign: "center",
    border: "2px solid #ff0000",
    maxWidth: "400px",
  },
  joinInput: {
    width: "100%",
    padding: "12px",
    marginBottom: "20px",
    backgroundColor: "#2a2a2a",
    border: "1px solid #404040",
    color: "#fff",
    borderRadius: "4px",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  joinButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#ff0000",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
