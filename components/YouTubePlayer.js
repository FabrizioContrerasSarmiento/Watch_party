"use client";

import { memo, useEffect, useRef, useState } from "react";

function YouTubePlayerComponent({
  videoId,
  onReady,
  onStateChange,
  onSeek,
  onPlaybackRateChange,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({
    onReady,
    onStateChange,
    onSeek,
    onPlaybackRateChange,
  });
  const seekWatcherRef = useRef(null);
  const currentVideoIdRef = useRef(videoId);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onStateChange,
      onSeek,
      onPlaybackRateChange,
    };
  });

  useEffect(() => {
    function initializePlayer() {
      if (playerRef.current || !containerRef.current || !window.YT?.Player) {
        return;
      }

      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : undefined;

      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          height: "100%",
          width: "100%",
          videoId,
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            enablejsapi: 1,
            origin,
            widget_referrer: origin,
          },
          events: {
            onReady: (event) => {
              setIsInitialized(true);
              callbacksRef.current.onReady?.(event);

              let lastTime = event.target.getCurrentTime?.() || 0;
              if (seekWatcherRef.current) {
                clearInterval(seekWatcherRef.current);
              }
              seekWatcherRef.current = window.setInterval(() => {
                const player = playerRef.current;
                if (!player) return;
                const currentTime = player.getCurrentTime?.() || 0;
                if (
                  Math.abs(currentTime - lastTime) > 1.2 &&
                  player.getPlayerState?.() !== 3
                ) {
                  callbacksRef.current.onSeek?.(currentTime);
                }
                lastTime = currentTime;
              }, 250);
            },
            onStateChange: (event) => {
              callbacksRef.current.onStateChange?.(event);
            },
            onPlaybackRateChange: (event) => {
              callbacksRef.current.onPlaybackRateChange?.(
                event?.data !== undefined ? event.data : event,
              );
            },
          },
        });
      } catch (err) {
        console.warn("Error initializing YouTube Player:", err);
      }
    }

    if (window.YT?.Player) {
      initializePlayer();
    } else {
      const scriptId = "youtube-iframe-api";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      const existingHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        existingHandler?.();
        initializePlayer();
      };
    }

    return () => {
      if (seekWatcherRef.current) {
        window.clearInterval(seekWatcherRef.current);
        seekWatcherRef.current = null;
      }
      try {
        playerRef.current?.destroy?.();
      } catch (e) {
        // Ignore unmount error if iframe is already detached
      }
      playerRef.current = null;
    };
  }, []);

  // Controlled video change: only load if videoId actually changes from previous ID
  useEffect(() => {
    if (!isInitialized || !playerRef.current?.loadVideoById) return;
    if (videoId && videoId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = videoId;
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId, isInitialized]);

  return (
    <div className="h-full w-full bg-black">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// Memoize to completely isolate YouTubePlayer lifecycle from camera/voice/cinema mode parent re-renders
const YouTubePlayer = memo(YouTubePlayerComponent, (prevProps, nextProps) => {
  return prevProps.videoId === nextProps.videoId;
});

export default YouTubePlayer;
