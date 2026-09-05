"use client";

import { useEffect, useRef, useState } from "react";

export default function YouTubePlayer({
  videoId,
  onReady,
  onStateChange,
  onSeek,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.body.appendChild(tag);

      window.onYouTubeIframeAPIReady = initializePlayer;
    } else if (window.YT && window.YT.Player && !isInitialized) {
      initializePlayer();
    }

    return () => {
      // No destruir
    };
  }, [isInitialized]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.loadVideoById && isInitialized) {
      console.log("Cargando nuevo video:", videoId);
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId, isInitialized]);

  const initializePlayer = () => {
    if (playerRef.current || !containerRef.current) return;

    console.log("Inicializando YouTube player");

    try {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "600",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
        },
        events: {
          onReady: (event) => {
            console.log("Player ready");
            setIsInitialized(true);
            onReady(event);

            // Detectar cuando el usuario hace seek
            const checkSeek = setInterval(() => {
              if (playerRef.current) {
                try {
                  const currentTime = playerRef.current.getCurrentTime();
                  const timeDiff = Math.abs(currentTime - lastTimeRef.current);

                  // Si hay un salto > 1 segundo, es un seek
                  if (
                    timeDiff > 1 &&
                    playerRef.current.getPlayerState() !== 3
                  ) {
                    // 3 es BUFFERING
                    console.log(
                      "Seek detectado:",
                      lastTimeRef.current,
                      "->",
                      currentTime,
                    );
                    onSeek(currentTime);
                    lastTimeRef.current = currentTime;
                  } else {
                    lastTimeRef.current = currentTime;
                  }
                } catch (e) {
                  // Silenciar
                }
              }
            }, 100);

            return () => clearInterval(checkSeek);
          },
          onStateChange: (event) => {
            console.log("State change:", event.data);
            onStateChange(event);
          },
          onError: (event) => {
            console.error("Player error:", event.data);
          },
        },
      });
    } catch (error) {
      console.error("Error al crear player:", error);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "600px",
        backgroundColor: "#000",
      }}
    />
  );
}
