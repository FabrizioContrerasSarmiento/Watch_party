"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { FiArrowLeft } from "react-icons/fi";
import {
  IoAdd,
  IoClose,
  IoCopyOutline,
  IoLockClosedOutline,
  IoLockOpenOutline,
  IoPeopleOutline,
  IoPlaySkipForward,
  IoStatsChartOutline,
  IoShareSocialOutline,
  IoTrashOutline,
} from "react-icons/io5";
import YouTubePlayer from "./YouTubePlayer";

const REACTIONS = ["😂", "❤️", "😱", "😡", "🔥", "👀"];
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

const RTC_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

function videoFromInput(value) {
  const input = value.trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    const hostname = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let videoId = null;

    if (hostname === "youtu.be")
      videoId = url.pathname.split("/").filter(Boolean)[0];
    else if (
      hostname.endsWith("youtube.com") ||
      hostname.endsWith("youtube-nocookie.com")
    ) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      videoId = url.searchParams.get("v");
      if (!videoId && ["shorts", "embed", "live", "v"].includes(pathParts[0]))
        videoId = pathParts[1];
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId || "") ? videoId : null;
  } catch {
    return null;
  }
}

export default function WatchPartyRoom({ roomId, userId }) {
  const playerRef = useRef(null);
  const socketRef = useRef(null);

  const localStreamRef = useRef(null);
  const voicePeersRef = useRef({});
  const remoteAudioRef = useRef({});
  const mutedUsersRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const [speakingUsers, setSpeakingUsers] = useState({});

  const localChangeRef = useRef(false);
  const syncingRef = useRef(null);
  const reactionTimerRef = useRef([]);
  const dismissedPollRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingIntervalRef = useRef(null);
  const lastSpeakingStateRef = useRef(false);
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [reactions, setReactions] = useState([]);
  const [videoInput, setVideoInput] = useState("");
  const [videoTitleInput, setVideoTitleInput] = useState("");
  const [queueInput, setQueueInput] = useState("");
  const [queueTitleInput, setQueueTitleInput] = useState("");
  const [queueError, setQueueError] = useState("");
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState([
    "🔥 Buenísima",
    "😐 Normal",
    "💀 Malísima",
  ]);
  const [copied, setCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState({});
  const [showReactions, setShowReactions] = useState(false);

  const applyRoom = (nextRoom) => {
    const isDismissedPoll =
      nextRoom.activePoll?.id === dismissedPollRef.current;
    setRoom({
      ...nextRoom,
      activePoll: isDismissedPoll ? null : nextRoom.activePoll,
    });
    setIsHost(nextRoom.hostSocketId === socketRef.current?.id);
    setCurrentTime(nextRoom.currentTime || 0);
  };

  const cleanupVoicePeer = (socketId) => {
    const peer = voicePeersRef.current[socketId];

    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();

      delete voicePeersRef.current[socketId];
    }

    const audio = remoteAudioRef.current[socketId];

    if (audio) {
      audio.pause();
      audio.srcObject = null;
      delete remoteAudioRef.current[socketId];
    }

    delete pendingIceCandidatesRef.current[socketId];

    setVoiceParticipants((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const cleanupVoiceChat = () => {
    Object.keys(voicePeersRef.current).forEach((socketId) => {
      cleanupVoicePeer(socketId);
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;
    }

    Object.values(remoteAudioRef.current).forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });

    remoteAudioRef.current = {};
    voicePeersRef.current = {};
    pendingIceCandidatesRef.current = {};
    mutedUsersRef.current = {};

    lastSpeakingStateRef.current = false;
    setSpeakingUsers({});

    setVoiceParticipants({});
    setVoiceEnabled(false);
    setVoiceMuted(false);
  };

  const joinVoice = async () => {
    if (!socketRef.current?.connected) {
      console.warn("Socket no conectado");
      return;
    }

    if (voiceEnabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStreamRef.current = stream;

      startSpeakingDetection(stream);

      const joinSound = new Audio("/magical-burst.mp3");
      joinSound.volume = 0.7;
      joinSound.play().catch((error) => {
        console.warn("No se pudo reproducir el sonido de entrada:", error);
      });

      setVoiceEnabled(true);
      setVoiceMuted(false);

      socketRef.current.emit("voice-join", roomId);
    } catch (error) {
      console.error("No se pudo acceder al micrófono:", error);

      if (error?.name === "NotAllowedError") {
        alert("Necesitás permitir el acceso al micrófono.");
      } else {
        alert("No se pudo acceder al micrófono.");
      }
    }
  };

  const leaveVoice = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("voice-leave", roomId);
    }

    const leaveSound = new Audio("/incorrecto-tinki.mp3");
    leaveSound.volume = 0.7;

    leaveSound.play().catch((error) => {
      console.warn("No se pudo reproducir el sonido de salida:", error);
    });

    cleanupVoiceChat();
  };

  const toggleVoiceMute = () => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nextMuted = !voiceMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setVoiceMuted(nextMuted);
  };

  const toggleRemoteMute = (socketId) => {
    const audio = remoteAudioRef.current[socketId];

    if (!audio) return;

    const nextMuted = !mutedUsersRef.current[socketId];

    mutedUsersRef.current[socketId] = nextMuted;

    audio.volume = nextMuted ? 0 : 1;

    setVoiceParticipants((prev) => ({
      ...prev,
      [socketId]: {
        ...prev[socketId],
        muted: nextMuted,
      },
    }));
  };

  const startSpeakingDetection = (stream) => {
    if (!stream) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);

    speakingIntervalRef.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data);

      let sum = 0;

      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }

      const average = sum / data.length;

      const isSpeaking = average > 18;

      if (isSpeaking !== lastSpeakingStateRef.current) {
        lastSpeakingStateRef.current = isSpeaking;

        setSpeakingUsers((prev) => ({
          ...prev,
          [socketRef.current?.id]: isSpeaking,
        }));

        socketRef.current?.emit("voice-speaking", {
          roomId,
          isSpeaking,
        });
      }
    }, 100);
  };

  const createVoicePeer = async (targetSocketId, shouldCreateOffer = false) => {
    // Si ya existe una conexión con esta persona, la reutilizamos
    if (voicePeersRef.current[targetSocketId]) {
      return voicePeersRef.current[targetSocketId];
    }

    const peer = new RTCPeerConnection(RTC_CONFIG);

    voicePeersRef.current[targetSocketId] = peer;

    // =========================================================
    // 1. AGREGAR NUESTRO MICRÓFONO A LA CONEXIÓN
    // =========================================================

    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }

    // =========================================================
    // 2. ICE CANDIDATES
    // =========================================================

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      socketRef.current?.emit(
        "voice-ice-candidate",
        targetSocketId,
        event.candidate,
      );
    };

    // =========================================================
    // 3. AUDIO QUE RECIBIMOS DEL OTRO USUARIO
    // =========================================================

    peer.ontrack = (event) => {
      const stream = event.streams[0];

      if (!stream) return;

      let audio = remoteAudioRef.current[targetSocketId];

      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;

        remoteAudioRef.current[targetSocketId] = audio;
      }

      audio.srcObject = stream;

      audio.volume = mutedUsersRef.current[targetSocketId] ? 0 : 1;

      audio.play().catch((error) => {
        console.warn("No se pudo reproducir el audio remoto:", error);
      });
    };

    // =========================================================
    // 4. ESTADO DE LA CONEXIÓN
    // =========================================================

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      console.log(`Voice connection ${targetSocketId}:`, state);

      if (
        state === "failed" ||
        state === "closed" ||
        state === "disconnected"
      ) {
        cleanupVoicePeer(targetSocketId);
      }
    };

    // =========================================================
    // 5. CREAR OFFER
    // =========================================================

    if (shouldCreateOffer) {
      try {
        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socketRef.current?.emit(
          "voice-offer",
          targetSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("WebRTC offer error:", error);
        cleanupVoicePeer(targetSocketId);
      }
    }

    return peer;
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnection: true });
    socketRef.current = socket;

    const joinRoom = () => {
      setSocketConnected(true);
      socket.emit("join-room", roomId, userId || "Guest");
    };
    socket.on("connect", joinRoom);
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));
    socket.on("room-state", applyRoom);
    socket.on("video-changed", (video) => {
      localChangeRef.current = true;
      setCurrentTime(0);
      setTimeout(() => {
        localChangeRef.current = false;
      }, 900);
    });
    socket.on("play-synced", () => {
      localChangeRef.current = true;
      playerRef.current?.playVideo();
      setTimeout(() => {
        localChangeRef.current = false;
      }, 350);
    });
    socket.on("pause-synced", () => {
      localChangeRef.current = true;
      playerRef.current?.pauseVideo();
      setTimeout(() => {
        localChangeRef.current = false;
      }, 350);
    });
    socket.on("seek-synced", ({ currentTime: time }) => {
      localChangeRef.current = true;
      playerRef.current?.seekTo(time, true);
      setCurrentTime(time);
      setTimeout(() => {
        localChangeRef.current = false;
      }, 350);
    });
    socket.on("chat-message", (message) =>
      setMessages((previous) => [...previous, message]),
    );
    socket.on("reaction", (reaction) => {
      setReactions((previous) => [...previous, reaction]);
      const timer = window.setTimeout(() => {
        setReactions((previous) =>
          previous.filter((item) => item.id !== reaction.id),
        );
      }, 3600);
      reactionTimerRef.current.push(timer);
    });

    socket.on("voice-participants", (participants) => {
      const participantsMap = {};

      participants.forEach((participant) => {
        participantsMap[participant.socketId] = {
          userId: participant.userId,
          muted: false,
        };
      });

      setVoiceParticipants(participantsMap);

      // El usuario nuevo crea las conexiones con
      // todos los que ya estaban en voz.
      participants.forEach((participant) => {
        createVoicePeer(participant.socketId, true);
      });
    });

    socket.on("voice-user-joined", (participant) => {
      setVoiceParticipants((prev) => ({
        ...prev,
        [participant.socketId]: {
          userId: participant.userId,
          muted: mutedUsersRef.current[participant.socketId] || false,
        },
      }));

      // IMPORTANTE:
      // No creamos el offer acá.
      // El usuario que acaba de entrar es quien inicia la conexión.
    });

    socket.on("voice-user-left", ({ socketId }) => {
      cleanupVoicePeer(socketId);
    });

    socket.on("voice-offer", async ({ fromSocketId, offer }) => {
      try {
        const peer = await createVoicePeer(fromSocketId, false);

        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        // Procesar ICE que haya llegado antes
        const pending = pendingIceCandidatesRef.current[fromSocketId] || [];

        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error("Error agregando ICE pendiente:", error);
          }
        }

        delete pendingIceCandidatesRef.current[fromSocketId];

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socketRef.current?.emit(
          "voice-answer",
          fromSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("WebRTC offer error:", error);
      }
    });

    socket.on("voice-answer", async ({ fromSocketId, answer }) => {
      try {
        const peer = voicePeersRef.current[fromSocketId];

        if (!peer) {
          console.warn("No existe peer para:", fromSocketId);
          return;
        }

        await peer.setRemoteDescription(new RTCSessionDescription(answer));

        // Procesar ICE pendiente
        const pending = pendingIceCandidatesRef.current[fromSocketId] || [];

        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error("Error agregando ICE pendiente:", error);
          }
        }

        delete pendingIceCandidatesRef.current[fromSocketId];
      } catch (error) {
        console.error("WebRTC answer error:", error);
      }
    });

    socket.on("voice-ice-candidate", async ({ fromSocketId, candidate }) => {
      try {
        const peer = voicePeersRef.current[fromSocketId];

        if (!peer) {
          if (!pendingIceCandidatesRef.current[fromSocketId]) {
            pendingIceCandidatesRef.current[fromSocketId] = [];
          }

          pendingIceCandidatesRef.current[fromSocketId].push(candidate);

          return;
        }

        if (peer.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!pendingIceCandidatesRef.current[fromSocketId]) {
            pendingIceCandidatesRef.current[fromSocketId] = [];
          }

          pendingIceCandidatesRef.current[fromSocketId].push(candidate);
        }
      } catch (error) {
        console.error("WebRTC ICE candidate error:", error);
      }
    });

    socket.on("removed-from-room", () => {
      window.alert("The host removed you from this watch party.");
      window.location.assign("/watch-party");
    });

    return () => {
      if (socket.connected) {
        socket.emit("voice-leave", roomId);
        socket.emit("leave-room", roomId);
      }

      cleanupVoiceChat();

      socket.disconnect();

      reactionTimerRef.current.forEach((timer) => window.clearTimeout(timer));

      if (syncingRef.current) {
        window.clearInterval(syncingRef.current);
      }
    };
  }, [roomId, userId]);

  const handlePlayerReady = (event) => {
    playerRef.current = event.target;
    setPlayerReady(true);
    syncingRef.current = window.setInterval(() => {
      if (!playerRef.current || localChangeRef.current) return;
      const playerTime = playerRef.current.getCurrentTime?.() || 0;
      setCurrentTime(playerTime);
      socketRef.current?.emit("get-room-time", roomId, (serverState) => {
        if (!serverState || isHost) return;
        if (Math.abs(playerTime - serverState.currentTime) > 1.5) {
          localChangeRef.current = true;
          playerRef.current?.seekTo(serverState.currentTime, true);
          setTimeout(() => {
            localChangeRef.current = false;
          }, 400);
        }
      });
    }, 1500);
  };

  const handleStateChange = (event) => {
    if (localChangeRef.current) return;
    if (event.data === 0 && isHost)
      socketRef.current?.emit("video-ended", roomId);
    if (!isHost) return;
    if (event.data === 1) socketRef.current?.emit("play", roomId);
    if (event.data === 2) socketRef.current?.emit("pause", roomId);
  };

  const handleSeek = (time) => {
    if (isHost && !localChangeRef.current)
      socketRef.current?.emit("seek", roomId, time);
  };

  const sendMessage = () => {
    if (!chatMessage.trim() || room?.chatLocked) return;
    socketRef.current?.emit(
      "send-message",
      roomId,
      userId || "Guest",
      chatMessage,
    );
    setChatMessage("");
  };

  const sendReaction = (reaction) =>
    socketRef.current?.emit("send-reaction", roomId, reaction);

  const submitVideo = (event) => {
    event.preventDefault();
    const videoId = videoFromInput(videoInput);
    if (!videoId) return;
    socketRef.current?.emit("play-video", roomId, {
      videoId,
      title: videoTitleInput || "Untitled video",
    });
    setVideoInput("");
    setVideoTitleInput("");
  };

  const addQueueVideo = (event) => {
    event.preventDefault();
    const videoId = videoFromInput(queueInput);
    if (!videoId) {
      setQueueError("Paste a valid YouTube link or an 11-character video ID.");
      return;
    }
    setQueueError("");
    socketRef.current?.emit(
      "add-to-queue",
      roomId,
      {
        videoId,
        title: queueTitleInput || "Untitled video",
        addedBy: userId || "Guest",
      },
      (result) => {
        if (!result?.success) {
          setQueueError(
            result?.error || "The video could not be added to the queue.",
          );
          return;
        }
        setQueueInput("");
        setQueueTitleInput("");
      },
    );
  };

  const createPoll = (event) => {
    event.preventDefault();
    dismissedPollRef.current = null;
    socketRef.current?.emit("create-poll", roomId, {
      question: pollQuestion,
      options: pollOptions,
    });
    setPollQuestion("");
    setShowPollForm(false);
  };

  const closePoll = () => {
    dismissedPollRef.current = room?.activePoll?.id || null;
    setRoom((previous) =>
      previous ? { ...previous, activePoll: null } : previous,
    );
    socketRef.current?.emit("close-poll", roomId);
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const poll = room?.activePoll;
  const totalVotes =
    poll?.options.reduce((total, option) => total + option.votes, 0) || 0;

  return (
    <div className="min-h-screen bg-[#080b08] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-[#0c110b] text-zinc-400 transition-all duration-200 hover:border-lime-400/40 hover:bg-lime-400/10 hover:text-lime-400"
              aria-label="Go back"
            >
              <FiArrowLeft className="text-lg" />
            </button>

            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.25em] text-lime-400">
                Watch Party
              </p>
              <h1 className="mt-1 font-body text-xl font-bold uppercase text-white">
                {room?.title || "Loading room..."}
              </h1>
            </div>

            <div className="rounded-lg border border-lime-400/20 bg-lime-400/5 px-3 py-2">
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Host
              </p>
              <p className="mt-0.5 font-body text-xs font-bold text-lime-400">
                {room?.users.find(
                  (user) => user.socketId === room?.hostSocketId,
                )?.userId || "Connecting..."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-zinc-800 bg-[#0c110b] px-3 py-2">
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                Room
              </p>
              <p className="font-mono text-xs font-bold tracking-wider text-lime-400">
                {roomId}
              </p>
            </div>
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c110b] px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-400"
            >
              <IoCopyOutline /> {copied ? "Copied" : "Copy invite"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              {!playerReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b08]/85">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                {reactions.map((item, index) => (
                  <span
                    key={item.id}
                    className="reaction-float absolute bottom-1/2 text-4xl sm:text-6xl"
                    style={{
                      left: `calc(50% + ${((index % 3) - 1) * 58}px)`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  >
                    {item.reaction}
                  </span>
                ))}
              </div>
              <div className="aspect-video">
                <YouTubePlayer
                  videoId={room?.videoId || "dQw4w9WgXcQ"}
                  onReady={handlePlayerReady}
                  onStateChange={handleStateChange}
                  onSeek={handleSeek}
                />
              </div>
              {!isHost && (
                <div className="absolute bottom-3 left-3 z-20 rounded-full border border-zinc-700 bg-black/75 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  Only the host controls playback
                </div>
              )}
            </section>

            <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] xl:hidden">
              <div className="flex items-center justify-between border-b border-zinc-800 p-5">
                <div>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                    Live chat
                  </p>
                  <h3 className="mt-1 font-body text-lg font-bold uppercase">
                    Talk with the room
                  </h3>
                </div>
                {room?.chatLocked && (
                  <IoLockClosedOutline className="text-zinc-500" />
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length ? (
                  messages.map((message, index) => (
                    <div
                      key={`${message.timestamp}-${index}`}
                      className={
                        message.userId === userId ? "text-right" : "text-left"
                      }
                    >
                      <div
                        className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${message.userId === userId ? "bg-lime-400 text-[#080b08]" : "border border-zinc-800 bg-[#080b08] text-zinc-300"}`}
                      >
                        <p className="font-body text-[10px] font-bold uppercase tracking-wider opacity-70">
                          {message.userId}
                        </p>
                        <p className="mt-1 font-body text-sm">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="pt-20 text-center font-body text-sm text-zinc-600">
                    Start the conversation.
                  </p>
                )}
              </div>
              <div className="border-t border-zinc-800 p-3">
                <div className="flex gap-2">
                  <input
                    disabled={room?.chatLocked}
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && sendMessage()
                    }
                    placeholder={
                      room?.chatLocked
                        ? "Chat locked by the host"
                        : "Write a message..."
                    }
                    className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50"
                  />
                  <button
                    type="button"
                    disabled={room?.chatLocked}
                    onClick={sendMessage}
                    className="h-10 rounded-lg bg-lime-400 px-4 font-body text-xs font-bold text-[#080b08]"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* Reacciones */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReactions((value) => !value)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c110b] px-3 font-body text-xs font-bold text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-400"
                >
                  <span className="text-base">☺</span>
                  Reaccionar
                </button>

                {showReactions && (
                  <div className="absolute bottom-full right-0 z-30 mb-2 flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#0c110b] p-2 shadow-xl">
                    {REACTIONS.map((reaction) => (
                      <button
                        key={reaction}
                        type="button"
                        onClick={() => {
                          sendReaction(reaction);
                          setShowReactions(false);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:scale-110 hover:bg-lime-400/10"
                        aria-label={`Send ${reaction} reaction`}
                      >
                        {reaction}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Voice */}
              {!voiceEnabled ? (
                <button
                  type="button"
                  onClick={joinVoice}
                  disabled={!socketConnected}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c110b] px-3 font-body text-xs font-bold text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🎙️ Join Voice
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleVoiceMute}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-bold transition ${
                      voiceMuted
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : "border-zinc-800 bg-[#0c110b] text-zinc-400 hover:border-lime-400/50 hover:text-lime-400"
                    }`}
                  >
                    {voiceMuted ? "🔇 Unmute" : "🎙️ Mute"}
                  </button>
                  <button
                    type="button"
                    disabled
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-bold ${
                      speakingUsers[socketRef.current?.id]
                        ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                        : "border-zinc-800 bg-[#0c110b] text-zinc-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        speakingUsers[socketRef.current?.id]
                          ? "bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)]"
                          : "bg-zinc-600"
                      }`}
                    />

                    {speakingUsers[socketRef.current?.id]
                      ? "Speaking"
                      : "Not Speaking"}
                  </button>

                  <button
                    type="button"
                    onClick={leaveVoice}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/30 px-3 font-body text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                  >
                    Leave Voice
                  </button>
                </>
              )}
            </div>

            {isHost && (
              <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                  Host controls
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      socketRef.current?.emit("toggle-chat-lock", roomId)
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300"
                  >
                    {room?.chatLocked ? (
                      <IoLockOpenOutline />
                    ) : (
                      <IoLockClosedOutline />
                    )}
                    {room?.chatLocked ? "Unlock chat" : "Lock chat"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPollForm((value) => !value)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300"
                  >
                    <IoStatsChartOutline /> New poll
                  </button>
                </div>
                <form
                  onSubmit={submitVideo}
                  className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 lg:grid-cols-[1fr_1fr_auto]"
                >
                  <input
                    value={videoInput}
                    onChange={(event) => setVideoInput(event.target.value)}
                    placeholder="YouTube URL or video ID"
                    className="h-11 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm text-white outline-none focus:border-lime-400/50"
                  />
                  <input
                    value={videoTitleInput}
                    onChange={(event) => setVideoTitleInput(event.target.value)}
                    placeholder="Video title"
                    className="h-11 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm text-white outline-none focus:border-lime-400/50"
                  />
                  <button className="h-11 rounded-lg border border-lime-400/30 bg-lime-400/10 px-5 font-body text-[10px] font-bold uppercase tracking-wider text-lime-400">
                    Change video
                  </button>
                </form>
              </section>
            )}

            <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                    Up next
                  </p>
                  <h3 className="mt-1 font-body text-lg font-bold uppercase">
                    Room queue
                  </h3>
                </div>
                <span className="rounded-full border border-zinc-800 px-3 py-1 font-body text-xs font-bold text-zinc-400">
                  {room?.queue.length || 0}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {room?.queue.length ? (
                  room.queue.map((video, index) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#080b08] p-3"
                    >
                      <span className="font-mono text-xs text-lime-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm font-bold text-white">
                          {video.title}
                        </p>
                        <p className="font-body text-[10px] text-zinc-600">
                          Added by {video.addedBy}
                        </p>
                      </div>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() =>
                            socketRef.current?.emit(
                              "remove-from-queue",
                              roomId,
                              video.id,
                            )
                          }
                          className="text-zinc-500 hover:text-red-400"
                          aria-label="Remove from queue"
                        >
                          <IoTrashOutline />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center font-body text-sm text-zinc-600">
                    No videos queued yet.
                  </p>
                )}
              </div>
              <form
                onSubmit={addQueueVideo}
                className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <input
                  value={queueInput}
                  onChange={(event) => {
                    setQueueInput(event.target.value);
                    setQueueError("");
                  }}
                  placeholder="YouTube URL, Shorts or ID"
                  className="h-10 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50"
                />
                <input
                  value={queueTitleInput}
                  onChange={(event) => setQueueTitleInput(event.target.value)}
                  placeholder="Title"
                  className="h-10 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50"
                />
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:border-lime-400 hover:text-lime-400">
                  <IoAdd /> Add video
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => socketRef.current?.emit("play-next", roomId)}
                    disabled={!room?.queue.length}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-[#080b08] disabled:bg-zinc-700 disabled:text-zinc-500"
                  >
                    <IoPlaySkipForward /> Next video
                  </button>
                )}
              </form>
              {queueError && (
                <p className="mt-2 font-body text-xs font-medium text-red-400">
                  {queueError}
                </p>
              )}
              {!socketConnected && (
                <p className="mt-2 font-body text-xs font-medium text-amber-400">
                  Real-time server offline. Run <code>npm run dev:all</code> to
                  enable the queue and reactions.
                </p>
              )}
            </section>
          </main>

          <aside className="space-y-5 xl:self-start">
            <section className="px-1">
              <div className="flex items-center gap-3">
                <IoPeopleOutline className="text-lg text-lime-400" />

                <div>
                  <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-lime-400">
                    People
                  </p>

                  <p className="font-body text-xs font-bold text-zinc-300">
                    {room?.users.length || 0} in the room
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-zinc-800/70 pt-3">
                {room?.users.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="group flex items-center gap-2 px-1 py-1.5"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />

                    <p className="min-w-0 flex-1 truncate font-body text-[10px] font-semibold text-zinc-400">
                      {participant.userId}

                      {participant.socketId === room.hostSocketId && (
                        <span className="ml-1.5 text-[9px] text-lime-400/70">
                          HOST
                        </span>
                      )}
                    </p>

                    {isHost && participant.socketId !== room.hostSocketId && (
                      <button
                        type="button"
                        onClick={() =>
                          socketRef.current?.emit(
                            "remove-participant",
                            roomId,
                            participant.socketId,
                          )
                        }
                        className="opacity-0 transition group-hover:opacity-100 text-zinc-600 hover:text-red-400"
                        aria-label={`Remove ${participant.userId}`}
                      >
                        <IoClose />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {showPollForm && isHost && (
              <form
                onSubmit={createPoll}
                className="rounded-2xl border border-lime-400/30 bg-[#0c110b] p-5"
              >
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                  Create poll
                </p>
                <input
                  required
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  placeholder="Ask the room..."
                  className="mt-4 h-10 w-full rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50"
                />
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    required
                    value={option}
                    onChange={(event) =>
                      setPollOptions((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-xs text-white outline-none focus:border-lime-400/50"
                  />
                ))}
                <button className="mt-4 h-10 w-full rounded-lg bg-lime-400 font-body text-[10px] font-bold uppercase tracking-wider text-[#080b08]">
                  Launch poll
                </button>
              </form>
            )}

            {poll && (
              <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                      Live poll
                    </p>
                    <h3 className="mt-2 font-body text-base font-bold text-white">
                      {poll.question}
                    </h3>
                  </div>
                  {isHost && (
                    <button
                      type="button"
                      onClick={closePoll}
                      className="font-body text-[10px] font-bold uppercase text-zinc-500 hover:text-red-400"
                    >
                      Close poll
                    </button>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {poll.options.map((option, index) => {
                    const percent = totalVotes
                      ? Math.round((option.votes / totalVotes) * 100)
                      : 0;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() =>
                          socketRef.current?.emit("vote-poll", roomId, index)
                        }
                        className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-[#080b08] p-3 text-left"
                      >
                        <span
                          className="absolute inset-y-0 left-0 bg-lime-400/10"
                          style={{ width: `${percent}%` }}
                        />
                        <span className="relative flex justify-between gap-3 font-body text-xs font-bold text-zinc-200">
                          <span>{option.label}</span>
                          <span className="text-lime-400">{percent}%</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 font-body text-[10px] uppercase tracking-wider text-zinc-600">
                  {totalVotes} votes · vote now
                </p>
              </section>
            )}

            <section className="hidden min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] xl:flex xl:sticky xl:top-5">
              <div className="flex items-center justify-between border-b border-zinc-800 p-5">
                <div>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                    Live chat
                  </p>
                  <h3 className="mt-1 font-body text-lg font-bold uppercase">
                    Talk with the room
                  </h3>
                </div>
                {room?.chatLocked && (
                  <IoLockClosedOutline className="text-zinc-500" />
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length ? (
                  messages.map((message, index) => (
                    <div
                      key={`${message.timestamp}-${index}`}
                      className={
                        message.userId === userId ? "text-right" : "text-left"
                      }
                    >
                      <div
                        className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${message.userId === userId ? "bg-lime-400 text-[#080b08]" : "border border-zinc-800 bg-[#080b08] text-zinc-300"}`}
                      >
                        <p className="font-body text-[10px] font-bold uppercase tracking-wider opacity-70">
                          {message.userId}
                        </p>
                        <p className="mt-1 font-body text-sm">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="pt-20 text-center font-body text-sm text-zinc-600">
                    Start the conversation.
                  </p>
                )}
              </div>
              <div className="border-t border-zinc-800 p-3">
                <div className="flex gap-2">
                  <input
                    disabled={room?.chatLocked}
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && sendMessage()
                    }
                    placeholder={
                      room?.chatLocked
                        ? "Chat locked by the host"
                        : "Write a message..."
                    }
                    className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50"
                  />
                  <button
                    type="button"
                    disabled={room?.chatLocked}
                    onClick={sendMessage}
                    className="h-10 rounded-lg bg-lime-400 px-4 font-body text-xs font-bold text-[#080b08]"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
