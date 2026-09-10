"use client";

import { useEffect, useRef, useState } from "react";

export default function YouTubePlayer({ videoId, onReady, onStateChange, onSeek }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({ onReady, onStateChange, onSeek });
  const seekWatcherRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  callbacksRef.current = { onReady, onStateChange, onSeek };

  useEffect(() => {
    function initializePlayer() {
      if (playerRef.current || !containerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, fs: 1 },
        events: {
          onReady: (event) => {
            setIsInitialized(true);
            callbacksRef.current.onReady(event);
            let lastTime = event.target.getCurrentTime?.() || 0;
            seekWatcherRef.current = window.setInterval(() => {
              const player = playerRef.current;
              if (!player) return;
              const currentTime = player.getCurrentTime?.() || 0;
              if (Math.abs(currentTime - lastTime) > 1 && player.getPlayerState?.() !== 3) {
                callbacksRef.current.onSeek(currentTime);
              }
              lastTime = currentTime;
            }, 250);
          },
          onStateChange: (event) => callbacksRef.current.onStateChange(event),
        },
      });
    }

    if (window.YT?.Player) initializePlayer();
    else {
      const scriptId = "youtube-iframe-api";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = initializePlayer;
    }

    return () => {
      if (seekWatcherRef.current) window.clearInterval(seekWatcherRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isInitialized && playerRef.current?.loadVideoById) playerRef.current.loadVideoById(videoId);
  }, [videoId, isInitialized]);

  return <div ref={containerRef} className="h-full w-full bg-black" />;
}
