"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { FiArrowLeft } from "react-icons/fi";
import {
  IoAdd,
  IoChatbubbleEllipsesOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoClose,
  IoContractOutline,
  IoCopyOutline,
  IoDesktopOutline,
  IoExitOutline,
  IoExpandOutline,
  IoHappyOutline,
  IoLockClosedOutline,
  IoLockOpenOutline,
  IoMicOffOutline,
  IoMicOutline,
  IoLogoYoutube,
  IoMoveOutline,
  IoPeopleOutline,
  IoPlay,
  IoPlaySkipForward,
  IoSettingsOutline,
  IoStatsChartOutline,
  IoTrashOutline,
  IoVideocamOutline,
} from "react-icons/io5";
import YouTubePlayer from "./YouTubePlayer";
import { deleteWatchPartyAction } from "@/app/watch-party/actions";

const REACTIONS = ["😂", "❤️", "😱", "😡", "🔥", "👀"];
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

function getClientSocketUrl() {
  if (SOCKET_URL) return SOCKET_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

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

function RemoteCameraFeed({ stream, userName, compact = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play?.().catch((err) => {
        console.warn("Error playing remote camera video:", err);
      });
    }
  }, [stream]);

  return (
    <div
      className={`relative aspect-video bg-black overflow-hidden ${
        compact ? "w-40 sm:w-48 rounded-lg" : "w-44 sm:w-56 md:w-64"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />
      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,255,0,0.8)]" />
        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-lime-400">
          en vivo
        </span>
      </div>
      <div className="absolute bottom-1.5 left-1.5 max-w-[85%] truncate rounded bg-black/70 px-1.5 py-0.5 font-body text-[10px] font-bold text-white backdrop-blur-sm">
        {userName || "Participante"}
      </div>
    </div>
  );
}

function RemoteScreenShare({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="h-full w-full object-contain"
    />
  );
}

export default function WatchPartyRoom({ roomId, userId, userUid }) {
  const router = useRouter();
  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const roomRef = useRef(null);

  // Audio / WebRTC Voice chat
  const localStreamRef = useRef(null);
  const voicePeersRef = useRef({});
  const remoteAudioRef = useRef({});
  const mutedUsersRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const [speakingUsers, setSpeakingUsers] = useState({});

  // Screen sharing WebRTC & State
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const screenPeersRef = useRef({});
  const pendingScreenIceRef = useRef({});
  const screenSharingRef = useRef(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({});
  const [isConnectingScreen, setIsConnectingScreen] = useState(false);

  // Camera WebRTC & State
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraCardRef = useRef(null);
  const cameraPeersRef = useRef({});
  const pendingCameraIceRef = useRef({});
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [remoteCameras, setRemoteCameras] = useState({});
  const [cameraCollapsed, setCameraCollapsed] = useState(false);
  const [cameraPos, setCameraPos] = useState({ x: null, y: null });
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef(null);

  // Layout & UI
  const playerContainerRef = useRef(null);
  const chatScrollBottomRef = useRef(null);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showHostControls, setShowHostControls] = useState(false);
  const [selectedContentSource, setSelectedContentSource] = useState(null); // null | "youtube"
  const [currentSocketId, setCurrentSocketId] = useState("");

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
  const [, setCurrentTime] = useState(0);
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
  const [, setVoiceParticipants] = useState({});
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [roomDeletedInfo, setRoomDeletedInfo] = useState(null);

  const isHostRef = useRef(false);
  const cameraEnabledRef = useRef(false);
  const voiceEnabledRef = useRef(false);

  const applyRoom = (nextRoom) => {
    roomRef.current = nextRoom;
    const isDismissedPoll =
      nextRoom.activePoll?.id === dismissedPollRef.current;
    setRoom({
      ...nextRoom,
      activePoll: isDismissedPoll ? null : nextRoom.activePoll,
    });
    const currentIsHost = nextRoom.hostSocketId === socketRef.current?.id;
    isHostRef.current = currentIsHost;
    setIsHost(currentIsHost);
    setCurrentTime(nextRoom.currentTime || 0);

    const userSocketIds = new Set(
      (nextRoom.users || []).map((u) => u.socketId),
    );
    Object.keys(cameraPeersRef.current).forEach((sid) => {
      if (!userSocketIds.has(sid)) {
        cleanupCameraPeer(sid);
      }
    });
    Object.keys(voicePeersRef.current).forEach((sid) => {
      if (!userSocketIds.has(sid)) {
        cleanupVoicePeer(sid);
      }
    });
    Object.keys(screenPeersRef.current).forEach((sid) => {
      if (!userSocketIds.has(sid)) {
        cleanupScreenPeer(sid);
      }
    });

    // If local user has camera on, connect camera to new users who joined
    if (cameraEnabledRef.current && cameraStreamRef.current) {
      (nextRoom.users || []).forEach((u) => {
        if (
          u.socketId !== socketRef.current?.id &&
          !cameraPeersRef.current[u.socketId]
        ) {
          createCameraPeer(u.socketId, true);
        }
      });
    }

    // If local user has voice on, connect voice to new users who joined
    if (voiceEnabledRef.current && localStreamRef.current) {
      (nextRoom.users || []).forEach((u) => {
        if (
          u.socketId !== socketRef.current?.id &&
          !voicePeersRef.current[u.socketId]
        ) {
          createVoicePeer(u.socketId, true);
        }
      });
    }

    // If local user has screen sharing on, connect screen to new users who joined
    if (screenSharingRef.current && screenStreamRef.current) {
      (nextRoom.users || []).forEach((u) => {
        if (
          u.socketId !== socketRef.current?.id &&
          !screenPeersRef.current[u.socketId]
        ) {
          console.log("[SCREEN] sending offer to", u.socketId);
          createScreenPeer(u.socketId, true);
        }
      });
    }
  };

  const cleanupScreenPeer = (socketId) => {
    console.log("[SCREEN] peer connection closed for", socketId);
    const peer = screenPeersRef.current[socketId];
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      delete screenPeersRef.current[socketId];
    }
    delete pendingScreenIceRef.current[socketId];
    setRemoteScreenStreams((prev) => {
      if (!prev[socketId]) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const cleanupAllScreenPeers = () => {
    console.log("[SCREEN] cleaning up all screen peers");
    Object.keys(screenPeersRef.current).forEach((socketId) => {
      cleanupScreenPeer(socketId);
    });
    screenPeersRef.current = {};
    pendingScreenIceRef.current = {};
    setRemoteScreenStreams({});
  };

  const cleanupCameraPeer = (socketId) => {
    const peer = cameraPeersRef.current[socketId];
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      delete cameraPeersRef.current[socketId];
    }
    delete pendingCameraIceRef.current[socketId];
    setRemoteCameras((prev) => {
      if (!prev[socketId]) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const cleanupAllCameraPeers = () => {
    Object.keys(cameraPeersRef.current).forEach((socketId) => {
      cleanupCameraPeer(socketId);
    });
    cameraPeersRef.current = {};
    pendingCameraIceRef.current = {};
    setRemoteCameras({});
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
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
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
    voiceEnabledRef.current = false;
    Object.keys(voicePeersRef.current).forEach((socketId) => {
      cleanupVoicePeer(socketId);
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;
    }

    if (speakingIntervalRef.current) {
      window.clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    Object.values(remoteAudioRef.current).forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
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

      console.log("[VOICE] local stream created");
      localStreamRef.current = stream;

      startSpeakingDetection(stream);

      const joinSound = new Audio("/magical-burst.mp3");
      joinSound.volume = 0.7;
      joinSound.play().catch((error) => {
        console.warn("No se pudo reproducir el sonido de entrada:", error);
      });

      setVoiceEnabled(true);
      voiceEnabledRef.current = true;
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
    voiceEnabledRef.current = false;
    if (socketRef.current?.connected) {
      socketRef.current.emit("voice-leave", roomId);
    }

    const leaveSound = new Audio("/incorrecto-tinki.mp3");
    leaveSound.volume = 0.7;

    leaveSound.play().catch((error) => {
      console.warn("No se pudo reproducir el sonido de salida:", error);
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (speakingIntervalRef.current) {
      window.clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    lastSpeakingStateRef.current = false;

    const myId = socketRef.current?.id;
    if (myId) {
      setSpeakingUsers((prev) => ({ ...prev, [myId]: false }));
      socketRef.current?.emit("voice-speaking", {
        roomId,
        isSpeaking: false,
      });
    }

    setVoiceEnabled(false);
    setVoiceMuted(false);

    // Keep peer connections alive in recvonly so user can still listen to others
    Object.values(voicePeersRef.current).forEach((peer) => {
      try {
        const senders = peer.getSenders ? peer.getSenders() : [];
        senders.forEach((s) => {
          if (s.track?.kind === "audio") {
            s.replaceTrack(null);
          }
        });
      } catch (err) {
        console.warn("Error updating voice peer tracks on leaveVoice:", err);
      }
    });
  };

  const toggleVoiceMute = () => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nextMuted = !voiceMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setVoiceMuted(nextMuted);

    if (nextMuted) {
      const myId = socketRef.current?.id;
      if (myId) {
        setSpeakingUsers((prev) => ({ ...prev, [myId]: false }));
        socketRef.current?.emit("voice-speaking", {
          roomId,
          isSpeaking: false,
        });
      }
    }
  };

  const startSpeakingDetection = (stream) => {
    if (!stream) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
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

        const myId = socketRef.current?.id;
        if (myId) {
          setSpeakingUsers((prev) => ({
            ...prev,
            [myId]: isSpeaking,
          }));
        }

        socketRef.current?.emit("voice-speaking", {
          roomId,
          isSpeaking,
        });
      }
    }, 100);
  };

  const createVoicePeer = async (targetSocketId, shouldCreateOffer = false) => {
    let peer = voicePeersRef.current[targetSocketId];

    if (!peer) {
      peer = new RTCPeerConnection(RTC_CONFIG);
      voicePeersRef.current[targetSocketId] = peer;

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit(
          "voice-ice-candidate",
          targetSocketId,
          event.candidate,
        );
      };

      peer.ontrack = (event) => {
        if (event.track.kind !== "audio") return;
        console.log("[VOICE] remote ontrack from", targetSocketId);

        const stream = event.streams[0] || new MediaStream([event.track]);
        if (!stream) return;

        let audio = remoteAudioRef.current[targetSocketId];

        if (!audio) {
          audio = document.createElement("audio");
          audio.autoplay = true;
          audio.playsInline = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          remoteAudioRef.current[targetSocketId] = audio;
        }

        audio.srcObject = stream;
        audio.volume = mutedUsersRef.current[targetSocketId] ? 0 : 1;
        console.log("[VOICE] remote audio attached to", targetSocketId);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("[VOICE] Autoplay blocked or error playing audio:", error);
            const unlockAudio = () => {
              audio.play().catch(() => {});
              window.removeEventListener("click", unlockAudio);
              window.removeEventListener("keydown", unlockAudio);
              window.removeEventListener("touchstart", unlockAudio);
            };
            window.addEventListener("click", unlockAudio, { once: true });
            window.addEventListener("keydown", unlockAudio, { once: true });
            window.addEventListener("touchstart", unlockAudio, { once: true });
          });
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          cleanupVoicePeer(targetSocketId);
        }
      };
    }

    const localStream = localStreamRef.current;
    if (localStream && localStream.getAudioTracks().length > 0) {
      localStream.getAudioTracks().forEach((track) => {
        const senders = peer.getSenders ? peer.getSenders() : [];
        const existingSender = senders.find((s) => s.track?.kind === "audio");
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          peer.addTrack(track, localStream);
        }
      });
    }

    if (shouldCreateOffer) {
      try {
        console.log("[VOICE] sending offer to", targetSocketId);
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

  const createCameraPeer = async (targetSocketId, shouldCreateOffer = false) => {
    let peer = cameraPeersRef.current[targetSocketId];

    if (!peer) {
      peer = new RTCPeerConnection(RTC_CONFIG);
      cameraPeersRef.current[targetSocketId] = peer;

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit(
          "camera-ice-candidate",
          targetSocketId,
          event.candidate,
        );
      };

      peer.ontrack = (event) => {
        if (event.track.kind !== "video") return;
        console.log("[CAMERA] remote ontrack from", targetSocketId);

        const stream = event.streams[0] || new MediaStream([event.track]);
        const user = roomRef.current?.users?.find(
          (u) => u.socketId === targetSocketId,
        );
        const userName = user?.userId || "Participante";

        event.track.onended = () => {
          setRemoteCameras((prev) => {
            if (!prev[targetSocketId]) return prev;
            const next = { ...prev };
            delete next[targetSocketId];
            return next;
          });
        };

        setRemoteCameras((prev) => ({
          ...prev,
          [targetSocketId]: { stream, userName },
        }));
        console.log("[CAMERA] remote stream attached for", targetSocketId);
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          cleanupCameraPeer(targetSocketId);
        }
      };
    }

    const localCameraStream = cameraStreamRef.current;
    if (localCameraStream && localCameraStream.getVideoTracks().length > 0) {
      localCameraStream.getVideoTracks().forEach((track) => {
        const senders = peer.getSenders ? peer.getSenders() : [];
        const existingSender = senders.find((s) => s.track?.kind === "video");
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          peer.addTrack(track, localCameraStream);
        }
      });
    }

    if (shouldCreateOffer) {
      try {
        console.log("[CAMERA] sending offer to", targetSocketId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketRef.current?.emit(
          "camera-offer",
          targetSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("Camera WebRTC offer error:", error);
        cleanupCameraPeer(targetSocketId);
      }
    }

    return peer;
  };

  // =========================================================
  // SCREEN SHARING
  // =========================================================

  const createScreenPeer = async (targetSocketId, shouldCreateOffer = false) => {
    let peer = screenPeersRef.current[targetSocketId];

    if (!peer) {
      peer = new RTCPeerConnection(RTC_CONFIG);
      screenPeersRef.current[targetSocketId] = peer;

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit(
          "screen-ice-candidate",
          targetSocketId,
          event.candidate,
        );
      };

      peer.ontrack = (event) => {
        if (event.track.kind !== "video") return;
        console.log("[SCREEN] remote ontrack from", targetSocketId);

        const stream = event.streams[0] || new MediaStream([event.track]);
        const user = roomRef.current?.users?.find(
          (u) => u.socketId === targetSocketId,
        );
        const userName = user?.userId || "Participante";

        event.track.onended = () => {
          console.log("[SCREEN] screen track ended");
          setRemoteScreenStreams((prev) => {
            if (!prev[targetSocketId]) return prev;
            const next = { ...prev };
            delete next[targetSocketId];
            return next;
          });
        };

        setRemoteScreenStreams((prev) => ({
          ...prev,
          [targetSocketId]: { stream, userName },
        }));
        console.log("[SCREEN] remote stream attached");
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          console.log("[SCREEN] peer connection closed");
          cleanupScreenPeer(targetSocketId);
        }
      };
    }

    const localScreenStream = screenStreamRef.current;
    if (localScreenStream && localScreenStream.getVideoTracks().length > 0) {
      localScreenStream.getVideoTracks().forEach((track) => {
        const senders = peer.getSenders ? peer.getSenders() : [];
        const existingSender = senders.find((s) => s.track?.kind === "video");
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          peer.addTrack(track, localScreenStream);
        }
      });
    }

    if (shouldCreateOffer) {
      try {
        console.log("[SCREEN] sending offer to", targetSocketId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketRef.current?.emit(
          "screen-offer",
          targetSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("Screen WebRTC offer error:", error);
        cleanupScreenPeer(targetSocketId);
      }
    }

    return peer;
  };

  const stopScreenSharing = () => {
    console.log("[SCREEN] screen sharing stopped");
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    cleanupAllScreenPeers();
    screenSharingRef.current = false;
    setScreenSharing(false);
    setIsConnectingScreen(false);
    socketRef.current?.emit("screen-share-changed", roomId, false);
    socketRef.current?.emit("user-screen-changed", roomId, false);
  };

  const startScreenSharing = async () => {
    if (screenSharingRef.current) {
      stopScreenSharing();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Tu navegador no soporta compartir pantalla.");
      return;
    }

    setIsConnectingScreen(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      console.log("[SCREEN] local stream created");
      screenStreamRef.current = stream;

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log("[SCREEN] screen track ended");
          stopScreenSharing();
        };
      }

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      screenSharingRef.current = true;
      setScreenSharing(true);
      setIsConnectingScreen(false);
      console.log("[SCREEN] screen sharing started");

      socketRef.current?.emit("screen-share-changed", roomId, true);
      socketRef.current?.emit("user-screen-changed", roomId, true);

      // Initiate WebRTC screen offers with all other participants in the room
      const otherUsers = (roomRef.current?.users || []).filter(
        (u) => u.socketId !== socketRef.current?.id,
      );
      otherUsers.forEach((u) => {
        createScreenPeer(u.socketId, true);
      });
    } catch (error) {
      console.warn("Error o cancelación al compartir pantalla:", error);
      setIsConnectingScreen(false);
    }
  };

  // =========================================================
  // CAMERA
  // =========================================================

  const stopCamera = () => {
    cameraEnabledRef.current = false;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraEnabled(false);

    Object.values(cameraPeersRef.current).forEach((peer) => {
      try {
        const senders = peer.getSenders ? peer.getSenders() : [];
        senders.forEach((s) => {
          if (s.track?.kind === "video") {
            s.replaceTrack(null);
          }
        });
      } catch (err) {
        console.warn("Error updating camera peer tracks on stop:", err);
      }
    });

    socketRef.current?.emit("camera-changed", roomId, false);
  };

  const toggleCamera = async () => {
    if (cameraEnabled) {
      stopCamera();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
        },
        audio: false, // Strict requirement: do NOT interfere with voice chat microphone!
      });

      console.log("[CAMERA] local stream created");
      cameraStreamRef.current = stream;

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          stopCamera();
        };
      }

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }

      setCameraEnabled(true);
      cameraEnabledRef.current = true;
      socketRef.current?.emit("camera-changed", roomId, true);

      // Connect or renegotiate with all participants in the room
      const currentUsers = roomRef.current?.users || [];
      currentUsers.forEach((participant) => {
        if (participant.socketId === socketRef.current?.id) return;
        const targetId = participant.socketId;
        createCameraPeer(targetId, true);
      });
    } catch (error) {
      console.error("No se pudo acceder a la cámara:", error);
      if (error?.name === "NotAllowedError") {
        alert("Permiso para la cámara denegado.");
      } else {
        alert("No se pudo iniciar la cámara.");
      }
    }
  };

  // Sync streams with video elements
  useEffect(() => {
    if (screenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [screenSharing]);

  useEffect(() => {
    if (cameraEnabled && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraEnabled, cameraCollapsed]);

  // Handle escape key to exit cinema mode
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isCinemaMode) {
        setIsCinemaMode(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCinemaMode]);

  // Keep camera position valid on window resize
  useEffect(() => {
    function handleResize() {
      if (cameraPos.x === null || cameraPos.y === null) return;
      const card = cameraCardRef.current;
      const container = playerContainerRef.current;
      if (!card || !container) return;

      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const maxX = Math.max(0, containerRect.width - cardRect.width);
      const maxY = Math.max(0, containerRect.height - cardRect.height);

      setCameraPos((prev) => ({
        x: Math.max(0, Math.min(prev.x ?? 0, maxX)),
        y: Math.max(0, Math.min(prev.y ?? 0, maxY)),
      }));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cameraPos]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatScrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Cinema Mode toggle: when activating Cinema mode, automatically close chat
  const toggleCinemaMode = () => {
    setIsCinemaMode((prev) => {
      const next = !prev;
      if (next) {
        setShowChat(false);
      }
      return next;
    });
  };

  // Draggable Camera handlers (Pointer events with movement threshold)
  const DRAG_THRESHOLD = 6; // px threshold: clicks (<6px) don't move camera

  const handleCameraPointerDown = (e) => {
    // Only primary button (left click) or touch/pen
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Do not initiate drag if clicking on interactive elements like buttons
    if (e.target.closest("button")) return;

    const card = cameraCardRef.current;
    const container = playerContainerRef.current;
    if (!card || !container) return;

    const cardRect = card.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    isDraggingRef.current = false;

    pointerStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      target: e.currentTarget,
      offsetX: e.clientX - cardRect.left,
      offsetY: e.clientY - cardRect.top,
      containerLeft: containerRect.left,
      containerTop: containerRect.top,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
    };
  };

  const handleCameraPointerMove = (e) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;

    // If drag hasn't started yet, check if distance traveled exceeds threshold
    if (!isDraggingRef.current) {
      const dx = e.clientX - start.startX;
      const dy = e.clientY - start.startY;
      const distance = Math.hypot(dx, dy);

      if (distance < DRAG_THRESHOLD) {
        // Less than threshold: treat as click/interaction, DO NOT move camera
        return;
      }

      // Exceeded threshold: now drag really begins!
      isDraggingRef.current = true;
      try {
        start.target.setPointerCapture(e.pointerId);
      } catch {
        // ignore if capture fails
      }
    }

    e.preventDefault();

    const {
      offsetX,
      offsetY,
      containerLeft,
      containerTop,
      containerWidth,
      containerHeight,
      cardWidth,
      cardHeight,
    } = start;

    const rawX = e.clientX - containerLeft - offsetX;
    const rawY = e.clientY - containerTop - offsetY;

    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, containerHeight - cardHeight);

    const clampedX = Math.max(0, Math.min(rawX, maxX));
    const clampedY = Math.max(0, Math.min(rawY, maxY));

    setCameraPos({ x: clampedX, y: clampedY });
  };

  const handleCameraPointerUp = (e) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;

    if (isDraggingRef.current) {
      try {
        start.target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      isDraggingRef.current = false;
    }

    pointerStartRef.current = null;
  };

  // Master Socket & cleanup effect
  useEffect(() => {
    const socket = io(getClientSocketUrl(), { reconnection: true });
    socketRef.current = socket;

    const joinRoom = () => {
      setSocketConnected(true);
      setCurrentSocketId(socket.id);
      socket.emit("join-room", roomId, userId || "Guest");
    };

    socket.on("connect", joinRoom);
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));
    socket.on("room-state", applyRoom);
    socket.on("user-screen-share-changed", ({ socketId, isSharing } = {}) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          contentType: isSharing ? "screen" : prev.videoId ? "youtube" : null,
          screenSharerSocketId: isSharing ? socketId : null,
        };
      });
    });
    socket.on("video-changed", () => {
      localChangeRef.current = true;
      setCurrentTime(0);
      setTimeout(() => {
        localChangeRef.current = false;
      }, 900);
    });
    socket.on("play-synced", ({ position, timestamp, playbackRate } = {}) => {
      localChangeRef.current = true;
      if (playbackRate && playerRef.current?.setPlaybackRate) {
        playerRef.current.setPlaybackRate(playbackRate);
      }
      if (typeof position === "number") {
        const latency = timestamp
          ? Math.max(0, (Date.now() - timestamp) / 1000)
          : 0;
        const rate = playbackRate || 1;
        const estimatedPosition = position + latency * rate;
        const currentPlayerTime = playerRef.current?.getCurrentTime?.() || 0;
        if (Math.abs(currentPlayerTime - estimatedPosition) > 0.5) {
          playerRef.current?.seekTo(estimatedPosition, true);
        }
      }
      playerRef.current?.playVideo();
      setTimeout(() => {
        localChangeRef.current = false;
      }, 400);
    });
    socket.on("pause-synced", ({ position, playbackRate } = {}) => {
      localChangeRef.current = true;
      if (playbackRate && playerRef.current?.setPlaybackRate) {
        playerRef.current.setPlaybackRate(playbackRate);
      }
      if (typeof position === "number") {
        playerRef.current?.seekTo(position, true);
        setCurrentTime(position);
      }
      playerRef.current?.pauseVideo();
      setTimeout(() => {
        localChangeRef.current = false;
      }, 400);
    });
    socket.on(
      "seek-synced",
      ({ currentTime: time, position, timestamp, playbackRate } = {}) => {
        localChangeRef.current = true;
        const targetPos =
          typeof position === "number"
            ? position
            : typeof time === "number"
              ? time
              : 0;
        const latency = timestamp
          ? Math.max(0, (Date.now() - timestamp) / 1000)
          : 0;
        const rate = playbackRate || 1;
        const estimatedPosition = targetPos + latency * rate;
        playerRef.current?.seekTo(estimatedPosition, true);
        setCurrentTime(estimatedPosition);
        setTimeout(() => {
          localChangeRef.current = false;
        }, 400);
      },
    );
    socket.on(
      "playback-rate-synced",
      ({ playbackRate, position, timestamp } = {}) => {
        localChangeRef.current = true;
        if (playbackRate && playerRef.current?.setPlaybackRate) {
          playerRef.current.setPlaybackRate(playbackRate);
        }
        if (typeof position === "number") {
          const latency = timestamp
            ? Math.max(0, (Date.now() - timestamp) / 1000)
            : 0;
          const estimatedPosition =
            position + latency * (playbackRate || 1);
          const currentPlayerTime =
            playerRef.current?.getCurrentTime?.() || 0;
          if (Math.abs(currentPlayerTime - estimatedPosition) > 0.5) {
            playerRef.current?.seekTo(estimatedPosition, true);
          }
        }
        setTimeout(() => {
          localChangeRef.current = false;
        }, 400);
      },
    );
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
    });

    socket.on("voice-user-left", ({ socketId }) => {
      cleanupVoicePeer(socketId);
    });

    socket.on("voice-speaking", ({ socketId, isSpeaking }) => {
      setSpeakingUsers((prev) => ({
        ...prev,
        [socketId]: isSpeaking,
      }));
    });

    socket.on("voice-offer", async ({ fromSocketId, offer }) => {
      try {
        console.log("[VOICE] received offer from", fromSocketId);
        const peer = await createVoicePeer(fromSocketId, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const pending = pendingIceCandidatesRef.current[fromSocketId] || [];
        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error("Error agregando ICE pendiente:", error);
          }
        }
        delete pendingIceCandidatesRef.current[fromSocketId];

        console.log("[VOICE] sending answer to", fromSocketId);
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
        console.log("[VOICE] received answer from", fromSocketId);
        const peer = voicePeersRef.current[fromSocketId];
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(answer));

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

    // Camera WebRTC signaling listeners
    socket.on("user-camera-changed", async ({ socketId, enabled, isCameraOn }) => {
      const isCameraActive = enabled !== undefined ? enabled : !!isCameraOn;
      if (isCameraActive) {
        if (!cameraPeersRef.current[socketId]) {
          createCameraPeer(socketId, false);
        }
      } else {
        cleanupCameraPeer(socketId);
      }
    });

    socket.on("camera-offer", async ({ fromSocketId, offer }) => {
      try {
        console.log("[CAMERA] received offer from", fromSocketId);
        const peer = await createCameraPeer(fromSocketId, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const pending = pendingCameraIceRef.current[fromSocketId] || [];
        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending camera ICE candidate:", err);
          }
        }
        delete pendingCameraIceRef.current[fromSocketId];

        console.log("[CAMERA] sending answer to", fromSocketId);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socketRef.current?.emit(
          "camera-answer",
          fromSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("Camera WebRTC offer error:", error);
      }
    });

    socket.on("camera-answer", async ({ fromSocketId, answer }) => {
      try {
        console.log("[CAMERA] received answer from", fromSocketId);
        const peer = cameraPeersRef.current[fromSocketId];
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(answer));

        const pending = pendingCameraIceRef.current[fromSocketId] || [];
        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending camera ICE candidate:", err);
          }
        }
        delete pendingCameraIceRef.current[fromSocketId];
      } catch (error) {
        console.error("Camera WebRTC answer error:", error);
      }
    });

    socket.on("camera-ice-candidate", async ({ fromSocketId, candidate }) => {
      try {
        console.log("[CAMERA] received ICE candidate");
        const peer = cameraPeersRef.current[fromSocketId];
        if (!peer || !peer.remoteDescription) {
          if (!pendingCameraIceRef.current[fromSocketId]) {
            pendingCameraIceRef.current[fromSocketId] = [];
          }
          pendingCameraIceRef.current[fromSocketId].push(candidate);
          return;
        }
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Camera WebRTC ICE candidate error:", error);
      }
    });

    // Screen WebRTC signaling listeners
    socket.on("user-screen-changed", async ({ socketId, enabled }) => {
      if (enabled) {
        console.log("[SCREEN] user-screen-changed: enabled by", socketId);
        if (socketId !== socketRef.current?.id && !screenPeersRef.current[socketId]) {
          createScreenPeer(socketId, false);
        }
      } else {
        console.log("[SCREEN] user-screen-changed: disabled by", socketId);
        cleanupScreenPeer(socketId);
      }
    });

    socket.on("screen-user-joined", async ({ socketId }) => {
      if (
        screenSharingRef.current &&
        screenStreamRef.current &&
        socketId !== socketRef.current?.id
      ) {
        console.log("[SCREEN] screen-user-joined: sending offer to", socketId);
        createScreenPeer(socketId, true);
      }
    });

    socket.on("screen-offer", async ({ fromSocketId, offer }) => {
      try {
        console.log("[SCREEN] received offer from", fromSocketId);
        const peer = await createScreenPeer(fromSocketId, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const pending = pendingScreenIceRef.current[fromSocketId] || [];
        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending screen ICE candidate:", err);
          }
        }
        delete pendingScreenIceRef.current[fromSocketId];

        console.log("[SCREEN] sending answer to", fromSocketId);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socketRef.current?.emit(
          "screen-answer",
          fromSocketId,
          peer.localDescription,
        );
      } catch (error) {
        console.error("Screen WebRTC offer error:", error);
      }
    });

    socket.on("screen-answer", async ({ fromSocketId, answer }) => {
      try {
        console.log("[SCREEN] received answer from", fromSocketId);
        const peer = screenPeersRef.current[fromSocketId];
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(answer));

        const pending = pendingScreenIceRef.current[fromSocketId] || [];
        for (const candidate of pending) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending screen ICE candidate:", err);
          }
        }
        delete pendingScreenIceRef.current[fromSocketId];
      } catch (error) {
        console.error("Screen WebRTC answer error:", error);
      }
    });

    socket.on("screen-ice-candidate", async ({ fromSocketId, candidate }) => {
      try {
        console.log("[SCREEN] received ICE candidate");
        const peer = screenPeersRef.current[fromSocketId];
        if (!peer || !peer.remoteDescription) {
          if (!pendingScreenIceRef.current[fromSocketId]) {
            pendingScreenIceRef.current[fromSocketId] = [];
          }
          pendingScreenIceRef.current[fromSocketId].push(candidate);
          return;
        }
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Screen WebRTC ICE candidate error:", error);
      }
    });

    socket.on("user-left", ({ socketId } = {}) => {
      if (socketId) {
        cleanupCameraPeer(socketId);
        cleanupVoicePeer(socketId);
        cleanupScreenPeer(socketId);
      }
    });

    socket.on("removed-from-room", () => {
      window.alert("The host removed you from this watch party.");
      router.push("/watch-party");
    });

    socket.on("room-deleted", ({ message } = {}) => {
      setRoomDeletedInfo(
        message || "Esta Watch Party fue eliminada por el host.",
      );
      stopCamera();
      cleanupAllCameraPeers();
      cleanupAllScreenPeers();
      stopScreenSharing();
      cleanupVoiceChat();
      if (socket.connected) {
        socket.emit("voice-leave", roomId);
        socket.emit("leave-room", roomId);
      }
      socket.disconnect();
    });

    const timers = reactionTimerRef.current;

    return () => {
      stopCamera();
      cleanupAllCameraPeers();
      cleanupAllScreenPeers();
      stopScreenSharing();

      if (socket.connected) {
        socket.emit("voice-leave", roomId);
        socket.emit("leave-room", roomId);
      }

      cleanupVoiceChat();
      socket.disconnect();

      timers.forEach((timer) => window.clearTimeout(timer));

      if (syncingRef.current) {
        window.clearInterval(syncingRef.current);
      }
    };
  }, [roomId, userId, router]);

  useEffect(() => {
    if (roomDeletedInfo) {
      const timer = setTimeout(() => {
        router.replace("/dashboard/parties");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [roomDeletedInfo, router]);

  const handleDeleteParty = async () => {
    if (!isHost || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      // 1. Eliminar de la base de datos en el servidor
      const res = await deleteWatchPartyAction(roomId);
      if (!res.success) {
        setDeleteError(res.error || "No se pudo eliminar la Watch Party.");
        setIsDeleting(false);
        return;
      }

      // 2. Emitir evento al servidor de sockets para notificar a los participantes
      if (socketRef.current?.connected) {
        socketRef.current.emit("delete-room", roomId);
      }

      // 3. Limpieza de streams y conexiones del host
      stopCamera();
      cleanupAllCameraPeers();
      stopScreenSharing();
      cleanupVoiceChat();

      if (socketRef.current?.connected) {
        socketRef.current.emit("voice-leave", roomId);
        socketRef.current.emit("leave-room", roomId);
        socketRef.current.disconnect();
      }

      // 4. Redirigir fuera de la sala
      router.replace("/dashboard/parties");
    } catch (err) {
      console.error("Error al eliminar la party:", err);
      setDeleteError(err.message || "Error al eliminar la Watch Party.");
      setIsDeleting(false);
    }
  };

  const handlePlayerReady = (event) => {
    playerRef.current = event.target;
    setPlayerReady(true);

    // Initial sync with server state after iframe handshake completes
    setTimeout(() => {
      if (!playerRef.current || !socketRef.current?.connected) return;
      socketRef.current.emit("get-room-time", roomId, (serverState) => {
        if (!serverState || !playerRef.current) return;
        localChangeRef.current = true;
        const latency = serverState.timestamp
          ? Math.max(0, (Date.now() - serverState.timestamp) / 1000)
          : 0;
        const rate = serverState.playbackRate || 1;
        const initialTime = serverState.isPlaying
          ? serverState.currentTime + latency * rate
          : serverState.currentTime;

        try {
          if (initialTime > 0.5) {
            playerRef.current.seekTo?.(initialTime, true);
          }
          if (serverState.playbackRate && playerRef.current.setPlaybackRate) {
            playerRef.current.setPlaybackRate(serverState.playbackRate);
          }
          if (serverState.isPlaying) {
            playerRef.current.playVideo?.();
          } else {
            playerRef.current.pauseVideo?.();
          }
        } catch (e) {
          console.warn("YouTube player initial sync safe catch:", e);
        }
        setCurrentTime(initialTime);
        setTimeout(() => {
          localChangeRef.current = false;
        }, 600);
      });
    }, 250);

    if (syncingRef.current) {
      clearInterval(syncingRef.current);
    }

    syncingRef.current = window.setInterval(() => {
      if (!playerRef.current || localChangeRef.current) return;
      const playerTime = playerRef.current.getCurrentTime?.() || 0;
      setCurrentTime(playerTime);

      // The HOST controls playback and should not be synced or interfered with
      if (isHostRef.current) return;

      socketRef.current?.emit("get-room-time", roomId, (serverState) => {
        if (
          !serverState ||
          !playerRef.current ||
          localChangeRef.current ||
          isHostRef.current
        )
          return;

        const latency = serverState.timestamp
          ? Math.max(0, (Date.now() - serverState.timestamp) / 1000)
          : 0;
        const rate = serverState.playbackRate || 1;
        const targetTime = serverState.isPlaying
          ? serverState.currentTime + latency * rate
          : serverState.currentTime;

        const playerState = playerRef.current.getPlayerState?.();

        // 1. Check if play/pause state diverged
        if (!serverState.isPlaying && playerState === 1) {
          localChangeRef.current = true;
          playerRef.current.pauseVideo();
          playerRef.current.seekTo(targetTime, true);
          setTimeout(() => {
            localChangeRef.current = false;
          }, 400);
          return;
        }

        if (serverState.isPlaying && playerState === 2) {
          localChangeRef.current = true;
          playerRef.current.seekTo(targetTime, true);
          playerRef.current.playVideo();
          setTimeout(() => {
            localChangeRef.current = false;
          }, 400);
          return;
        }

        if (!serverState.isPlaying) {
          if (Math.abs(playerTime - targetTime) > 0.5) {
            localChangeRef.current = true;
            playerRef.current.seekTo(targetTime, true);
            setTimeout(() => {
              localChangeRef.current = false;
            }, 400);
          }
          return;
        }

        // 2. Both playing: apply 3-tier drift compensation
        const drift = targetTime - playerTime;
        const absDrift = Math.abs(drift);

        if (absDrift < 0.25) {
          // Difference < 0.25s: no correction (smooth playback), restore normal rate if altered
          const currentRate = playerRef.current.getPlaybackRate?.() || 1;
          if (currentRate !== rate) {
            playerRef.current.setPlaybackRate?.(rate);
          }
        } else if (absDrift <= 1.2) {
          // Gentle drift correction (0.25s - 1.2s): adjust playback rate by 5%
          if (drift > 0) {
            playerRef.current.setPlaybackRate?.(rate * 1.05);
          } else {
            playerRef.current.setPlaybackRate?.(rate * 0.95);
          }
        } else {
          // Difference > 1.2s: direct seek to target time
          localChangeRef.current = true;
          playerRef.current.seekTo(targetTime, true);
          playerRef.current.setPlaybackRate?.(rate);
          setTimeout(() => {
            localChangeRef.current = false;
          }, 400);
        }
      });
    }, 1200);
  };

  const handleStateChange = (event) => {
    if (localChangeRef.current) return;
    if (event.data === 0 && isHost) {
      socketRef.current?.emit("video-ended", roomId);
    }
    const currentVideoTime = playerRef.current?.getCurrentTime?.() || 0;
    const currentRate = playerRef.current?.getPlaybackRate?.() || 1;
    const payload = {
      position: currentVideoTime,
      playbackRate: currentRate,
      timestamp: Date.now(),
    };

    if (event.data === 1) {
      socketRef.current?.emit("play", roomId, payload);
    } else if (event.data === 2) {
      socketRef.current?.emit("pause", roomId, payload);
    }
  };

  const handleSeek = (time) => {
    if (!localChangeRef.current) {
      const currentRate = playerRef.current?.getPlaybackRate?.() || 1;
      socketRef.current?.emit("seek", roomId, {
        position: time,
        playbackRate: currentRate,
        timestamp: Date.now(),
      });
    }
  };

  const handlePlaybackRateChange = (eventOrRate) => {
    if (localChangeRef.current) return;
    const rate =
      typeof eventOrRate === "object" && eventOrRate !== null
        ? eventOrRate.data
        : eventOrRate;
    if (typeof rate !== "number") return;
    const currentVideoTime = playerRef.current?.getCurrentTime?.() || 0;
    socketRef.current?.emit("playback-rate-change", roomId, {
      playbackRate: rate,
      position: currentVideoTime,
      timestamp: Date.now(),
    });
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
    event?.preventDefault();
    const videoId = videoFromInput(videoInput);
    if (!videoId) return;
    socketRef.current?.emit("play-video", roomId, {
      videoId,
      title: videoTitleInput || "YouTube Video",
    });
    setVideoInput("");
    setVideoTitleInput("");
    setSelectedContentSource(null);
  };

  const clearContent = () => {
    if (!isHost) return;
    socketRef.current?.emit("clear-content", roomId);
    setSelectedContentSource(null);
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

  const isScreenActive =
    Boolean(screenSharing) ||
    room?.contentType === "screen" ||
    Boolean(room?.screenSharerSocketId) ||
    (room?.screenShareUsers && room.screenShareUsers.length > 0) ||
    Object.keys(remoteScreenStreams).length > 0;

  const currentContentType = isScreenActive
    ? "screen"
    : room?.contentType || (room?.videoId ? "youtube" : null);

  const screenSharer = (room?.users || []).find(
    (u) =>
      u.socketId === room?.screenSharerSocketId ||
      (room?.screenShareUsers && room.screenShareUsers.includes(u.socketId)),
  );
  const sharerName =
    screenSharer?.userId || screenSharer?.name || "Un participante";

  const activeRemoteScreen =
    (room?.screenSharerSocketId &&
      remoteScreenStreams[room.screenSharerSocketId]) ||
    Object.values(remoteScreenStreams)[0] ||
    null;

  // Shared Bottom Bar Component
  const renderBottomControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* LEFT: Multimedia & Voice Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Voice Control */}
        {!voiceEnabled ? (
          <button
            type="button"
            onClick={joinVoice}
            disabled={!socketConnected}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-lime-400/50 bg-[#0c110b] px-3 font-body text-xs font-semibold text-lime-400 transition hover:border-lime-400 hover:bg-lime-400/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IoMicOutline className="text-base text-lime-400" />
            <span>Conectar Voz</span>
          </button>
        ) : (
          <div className="inline-flex items-center rounded-lg border border-lime-400 bg-lime-400/10 p-0.5">
            <button
              type="button"
              onClick={toggleVoiceMute}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-body text-xs font-semibold transition ${
                voiceMuted
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-lime-400 hover:bg-lime-400/20"
              }`}
              title={voiceMuted ? "Reactivar micrófono" : "Silenciar micrófono"}
            >
              {voiceMuted ? (
                <IoMicOffOutline className="text-sm text-red-400" />
              ) : (
                <IoMicOutline className="text-sm text-lime-400" />
              )}
              <span>{voiceMuted ? "Silenciado" : "Voz Conectada"}</span>
            </button>

            <span className="mx-1 h-3.5 w-px bg-lime-400/30" />

            <span
              title={
                speakingUsers[currentSocketId] ? "Hablando" : "En silencio"
              }
              className={`mr-1.5 h-2 w-2 rounded-full ${
                speakingUsers[currentSocketId]
                  ? "bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.9)] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />

            <button
              type="button"
              onClick={leaveVoice}
              className="inline-flex h-8 items-center rounded-md px-2 font-body text-xs font-semibold text-zinc-400 transition hover:text-red-400"
              title="Desconectar voz"
            >
              <IoExitOutline className="text-sm" />
            </button>
          </div>
        )}

        {/* Cámara Control */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-semibold transition-all duration-200 active:scale-95 ${
            cameraEnabled
              ? "border-lime-400 bg-lime-400/10 text-lime-400 shadow-[0_0_15px_rgba(163,255,0,0.15)]"
              : "border-zinc-800 bg-[#0c110b] text-zinc-300 hover:border-lime-400 hover:text-lime-400"
          }`}
        >
          <IoVideocamOutline
            className={`text-base ${cameraEnabled ? "text-lime-400" : ""}`}
          />
          <span>{cameraEnabled ? "Cámara Activa" : "Activar Cámara"}</span>
        </button>

        {/* Screen Sharing Control */}
        <button
          type="button"
          onClick={startScreenSharing}
          disabled={isConnectingScreen}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-semibold transition-all duration-200 active:scale-95 ${
            screenSharing
              ? "border-lime-400 bg-lime-400/10 text-lime-400 shadow-[0_0_15px_rgba(163,255,0,0.15)]"
              : "border-zinc-800 bg-[#0c110b] text-zinc-300 hover:border-lime-400 hover:text-lime-400"
          }`}
        >
          <IoDesktopOutline
            className={`text-base ${screenSharing ? "text-lime-400" : ""}`}
          />
          <span>
            {screenSharing
              ? "Pantalla Activa"
              : isConnectingScreen
                ? "Conectando..."
                : "Compartir Pantalla"}
          </span>
        </button>
      </div>

      {/* RIGHT: Actions, Host, Chat & Cine */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Reaccionar */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactions((value) => !value)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c110b] px-3 font-body text-xs font-semibold text-zinc-300 transition hover:border-lime-400 hover:text-lime-400"
          >
            <IoHappyOutline className="text-base text-lime-400" />
            <span>Reaccionar</span>
          </button>

          {showReactions && (
            <div className="absolute bottom-full right-0 z-40 mb-2 flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#0c110b] p-2 shadow-2xl">
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

        {/* Panel Host (shown for host) */}
        {isHost && (
          <button
            type="button"
            onClick={() => setShowHostControls((prev) => !prev)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-semibold transition ${
              showHostControls
                ? "border-lime-400 bg-lime-400/10 text-lime-400"
                : "border-zinc-800 bg-[#0c110b] text-zinc-300 hover:border-lime-400 hover:text-lime-400"
            }`}
          >
            <IoSettingsOutline className="text-sm" />
            <span>Panel Host</span>
          </button>
        )}

        {/* Chat Toggle */}
        <button
          type="button"
          onClick={() => setShowChat((prev) => !prev)}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-semibold transition ${
            showChat
              ? "border-lime-400 bg-lime-400/10 text-lime-400"
              : "border-zinc-800 bg-[#0c110b] text-zinc-300 hover:border-lime-400 hover:text-lime-400"
          }`}
        >
          <IoChatbubbleEllipsesOutline className="text-sm" />
          <span>Chat</span>
        </button>

        {/* Cine Toggle */}
        <button
          type="button"
          onClick={toggleCinemaMode}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-body text-xs font-semibold transition-all duration-200 active:scale-95 ${
            isCinemaMode
              ? "border-lime-400 bg-lime-400/10 text-lime-400 shadow-[0_0_15px_rgba(163,255,0,0.15)]"
              : "border-zinc-800 bg-[#0c110b] text-zinc-300 hover:border-lime-400 hover:text-lime-400"
          }`}
        >
          {isCinemaMode ? (
            <>
              <IoContractOutline className="text-sm text-lime-400" />
              <span>Salir</span>
            </>
          ) : (
            <>
              <IoExpandOutline className="text-sm" />
              <span>Cine</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen bg-[#080b08] text-white ${
        isCinemaMode ? "overflow-hidden" : ""
      }`}
    >
      <div
        className={
          isCinemaMode
            ? "fixed inset-0 z-50 flex flex-col bg-black overflow-hidden select-none"
            : "mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8"
        }
      >
        {/* NORMAL HEADER (hidden in Cinema mode) */}
        {!isCinemaMode && (
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
                  {room?.title || "Watch Party"}
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
        )}

        {/* CINEMA MODE TOP BAR */}
        {isCinemaMode && (
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-900 bg-[#080b08]/90 px-4 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400">
                Modo Cine
              </span>
              <span className="text-zinc-600">|</span>
              <span className="truncate max-w-xs sm:max-w-md font-body text-xs text-zinc-300">
                {room?.title || "Watch Party"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCinemaMode(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0c110b] px-3 py-1 font-body text-xs font-bold uppercase text-zinc-300 transition hover:border-lime-400 hover:text-lime-400"
            >
              <IoContractOutline className="text-sm text-lime-400" />
              <span>Salir (Esc)</span>
            </button>
          </div>
        )}

        {/* MAIN LAYOUT GRID (flex-1 in cinema mode, grid in normal mode) */}
        <div
          className={
            isCinemaMode
              ? "relative flex flex-1 min-h-0 flex-col overflow-hidden"
              : "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
          }
        >
          <main
            className={
              isCinemaMode
                ? "relative flex flex-1 min-h-0 flex-col overflow-hidden"
                : "min-w-0 space-y-5"
            }
          >
            {/* VIDEO / SCREEN SHARING PLAYER CONTAINER */}
            <section
              ref={playerContainerRef}
              className={
                isCinemaMode
                  ? "relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden"
                  : "relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-[0_0_40px_rgba(0,0,0,0.35)]"
              }
            >
              {currentContentType === "youtube" &&
                !playerReady &&
                !isScreenActive && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b08]/85">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
                  </div>
                )}

              {/* Floating Reactions Overlay */}
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
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

              {/* SCREEN SHARING VIEW */}
              {isScreenActive && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                  {screenSharing ? (
                    <>
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-contain"
                      />
                      {/* Badge & Native Stop indicator */}
                      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-lime-400/40 bg-black/85 px-3 py-1.5 backdrop-blur-md">
                        <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.9)] animate-pulse" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400">
                          Compartiendo Pantalla
                        </span>
                        <button
                          type="button"
                          onClick={stopScreenSharing}
                          className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-body text-[10px] font-bold text-zinc-300 transition hover:border-red-400 hover:text-red-400"
                        >
                          Detener
                        </button>
                      </div>
                    </>
                  ) : activeRemoteScreen ? (
                    <div className="relative h-full w-full flex items-center justify-center bg-black">
                      <RemoteScreenShare stream={activeRemoteScreen.stream} />
                      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-lime-400/40 bg-black/85 px-3 py-1.5 backdrop-blur-md">
                        <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.9)] animate-pulse" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400">
                          Pantalla en vivo — {activeRemoteScreen.userName || sharerName}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center justify-center p-6 text-center select-none">
                      <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-lime-400/[0.04] blur-3xl" />
                      <div className="relative flex flex-col items-center">
                        <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)] animate-pulse" />
                          <span>PANTALLA EN VIVO</span>
                        </div>
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-lime-400/30 bg-[#0c110b] shadow-[0_0_30px_rgba(163,255,0,0.15)]">
                          <IoDesktopOutline className="text-4xl text-lime-400 animate-pulse" />
                        </div>
                        <h2 className="font-body text-xl font-bold uppercase tracking-wider text-white sm:text-2xl">
                          {sharerName} está compartiendo pantalla
                        </h2>
                        <p className="mt-2 max-w-sm font-body text-xs font-medium text-zinc-400">
                          Conectando transmisión...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YOUTUBE PLAYER VIEW (Only mounted when room has a video) */}
              {room?.videoId && (
                <div
                  key="watch-party-youtube-wrapper"
                  className={`h-full w-full ${
                    isScreenActive ? "hidden" : "block"
                  } ${
                    isCinemaMode
                      ? "flex items-center justify-center aspect-video max-h-full max-w-full"
                      : ""
                  }`}
                >
                  <YouTubePlayer
                    key="watch-party-youtube-player"
                    videoId={room.videoId}
                    onReady={handlePlayerReady}
                    onStateChange={handleStateChange}
                    onSeek={handleSeek}
                    onPlaybackRateChange={handlePlaybackRateChange}
                  />
                </div>
              )}

              {/* EMPTY STATE: NO CONTENT YET (Choose YouTube or Screen Share) */}
              {!isScreenActive && !room?.videoId && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070a07] p-6 text-center select-none">
                  {/* Subtle ambient glow */}
                  <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-lime-400/[0.04] blur-3xl" />

                  {selectedContentSource !== "youtube" ? (
                    <div className="relative flex flex-col items-center">
                      {/* Badge */}
                      <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)]" />
                        <span>Watch Room Ready</span>
                      </div>

                      {/* Title */}
                      <h2 className="font-body text-xl font-bold uppercase tracking-wider text-white sm:text-2xl">
                        What do you want to watch?
                      </h2>

                      <p className="mt-2 max-w-sm font-body text-xs font-medium text-zinc-400">
                        Elegí qué tipo de contenido querés compartir con tus
                        amigos.
                      </p>

                      {/* Actions */}
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedContentSource("youtube")}
                          className="group inline-flex h-11 items-center gap-2.5 rounded-lg bg-lime-400 px-5 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#080b08] transition-all hover:bg-lime-300 hover:shadow-[0_0_25px_rgba(163,255,0,0.22)] active:scale-95"
                        >
                          <IoPlay className="text-base" />
                          <span>YouTube</span>
                        </button>

                        <button
                          type="button"
                          onClick={startScreenSharing}
                          disabled={isConnectingScreen}
                          className="group inline-flex h-11 items-center gap-2.5 rounded-lg border border-zinc-800 bg-[#0c110b] px-5 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-300 transition-all hover:border-lime-400 hover:text-lime-400 active:scale-95 disabled:opacity-50"
                        >
                          <IoDesktopOutline className="text-base text-lime-400" />
                          <span>Compartir pantalla</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full max-w-md">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IoLogoYoutube className="text-lg text-lime-400" />
                          <span className="font-body text-xs font-bold uppercase tracking-wider text-white">
                            YouTube Video
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedContentSource(null)}
                          className="font-body text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition"
                        >
                          ← Volver
                        </button>
                      </div>

                      <form onSubmit={submitVideo} className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={videoInput}
                            onChange={(e) => setVideoInput(e.target.value)}
                            placeholder="Pegá un link o ID de YouTube..."
                            autoFocus
                            className="h-11 flex-1 rounded-lg border border-zinc-800 bg-[#0c110b] px-4 font-body text-xs text-white placeholder-zinc-600 outline-none transition focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
                          />
                          <button
                            type="submit"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-lime-400 px-6 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#080b08] transition-all hover:bg-lime-300 hover:shadow-[0_0_25px_rgba(163,255,0,0.18)] active:scale-95"
                          >
                            <IoPlay className="text-sm" />
                            <span>Reproducir</span>
                          </button>
                        </div>
                        {!isHost && (
                          <p className="text-left font-body text-[11px] text-amber-400/90">
                            * Solo el host de la sala puede iniciar la
                            reproducción.
                          </p>
                        )}
                      </form>
                    </div>
                  )}
                </div>
              )}

              {currentContentType === "youtube" &&
                !isHost &&
                !isScreenActive && (
                  <div className="absolute bottom-3 left-3 z-20 rounded-full border border-zinc-700 bg-black/75 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                    Synced with room
                  </div>
                )}

              {/* FLOATING DRAGGABLE CAMERA WIDGET */}
              {(() => {
                const hasLocalCamera = cameraEnabled;
                const remoteCameraEntries = Object.entries(remoteCameras);
                const totalCameras =
                  (hasLocalCamera ? 1 : 0) + remoteCameraEntries.length;
                if (totalCameras === 0) return null;

                return (
                  <div
                    ref={cameraCardRef}
                    style={{
                      position: "absolute",
                      left:
                        cameraPos.x !== null ? `${cameraPos.x}px` : undefined,
                      top: cameraPos.y !== null ? `${cameraPos.y}px` : "16px",
                      right: cameraPos.x === null ? "16px" : undefined,
                    }}
                    className="z-30 select-none shadow-2xl transition-shadow duration-200"
                  >
                    <div
                      onPointerDown={handleCameraPointerDown}
                      onPointerMove={handleCameraPointerMove}
                      onPointerUp={handleCameraPointerUp}
                      onPointerCancel={handleCameraPointerUp}
                      className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0c110b]/95 backdrop-blur-md"
                      style={{ touchAction: "none" }}
                    >
                      {/* Header / Drag handle */}
                      <div className="flex cursor-move items-center justify-between border-b border-zinc-800/80 px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <IoMoveOutline className="text-xs text-lime-400" />
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                            {totalCameras === 1
                              ? "Cámara (1)"
                              : `Cámaras (${totalCameras})`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCameraCollapsed((prev) => !prev);
                          }}
                          className="text-xs text-zinc-400 hover:text-white"
                          title={cameraCollapsed ? "Expandir" : "Minimizar"}
                        >
                          {cameraCollapsed ? (
                            <IoChevronDownOutline />
                          ) : (
                            <IoChevronUpOutline />
                          )}
                        </button>
                      </div>

                      {/* Camera Video Feeds */}
                      {!cameraCollapsed && (
                        <div
                          className={
                            totalCameras === 1
                              ? "relative aspect-video w-44 sm:w-56 md:w-64 bg-black overflow-hidden"
                              : "grid grid-cols-2 gap-1.5 p-1.5 max-w-[420px] sm:max-w-[480px] bg-black/40"
                          }
                        >
                          {/* Local Camera (if active) */}
                          {hasLocalCamera && (
                            <div
                              className={`relative aspect-video bg-black overflow-hidden ${
                                totalCameras > 1
                                  ? "w-40 sm:w-48 rounded-lg"
                                  : "w-full h-full"
                              }`}
                            >
                              <video
                                ref={cameraVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="h-full w-full object-cover scale-x-[-1]"
                              />
                              <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,255,0,0.8)]" />
                                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-lime-400">
                                  en vivo
                                </span>
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 max-w-[85%] truncate rounded bg-black/70 px-1.5 py-0.5 font-body text-[10px] font-bold text-white backdrop-blur-sm">
                                {userId || "Usuario"}{" "}
                                <span className="text-lime-400">(Tú)</span>
                              </div>
                            </div>
                          )}

                          {/* Remote Cameras */}
                          {remoteCameraEntries.map(([socketId, remote]) => (
                            <RemoteCameraFeed
                              key={`remote-cam-${socketId}`}
                              stream={remote.stream}
                              userName={remote.userName}
                              compact={totalCameras > 1}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* CINEMA MODE: FLOATING COMPACT CHAT OVERLAY */}
              {isCinemaMode && showChat && (
                <div className="absolute right-4 bottom-4 z-30 w-72 sm:w-80 h-[360px] max-h-[calc(100vh-140px)] flex flex-col rounded-xl border border-zinc-800 bg-[#0c110b]/95 backdrop-blur-md shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,255,0,0.8)]" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400">
                        Chat en vivo
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowChat(false)}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                      title="Ocultar chat"
                    >
                      <IoClose className="text-base" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {messages.length ? (
                      messages.map((message, index) => (
                        <div
                          key={`cinema-msg-${message.timestamp || 0}-${message.userId || ""}-${index}`}
                          className={
                            message.userId === userId
                              ? "text-right"
                              : "text-left"
                          }
                        >
                          <div
                            className={`inline-block max-w-[90%] rounded-lg px-2.5 py-1.5 ${
                              message.userId === userId
                                ? "bg-lime-400 text-[#080b08]"
                                : "border border-zinc-800 bg-[#080b08] text-zinc-200"
                            }`}
                          >
                            <p className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">
                              {message.userId}
                            </p>
                            <p className="font-body text-xs mt-0.5 leading-snug">
                              {message.message}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="pt-14 text-center font-body text-xs text-zinc-600">
                        Sin mensajes aún.
                      </p>
                    )}
                    <div ref={chatScrollBottomRef} />
                  </div>

                  <div className="border-t border-zinc-800 p-2">
                    <div className="flex gap-1.5">
                      <input
                        disabled={room?.chatLocked}
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder={
                          room?.chatLocked
                            ? "Chat bloqueado"
                            : "Escribí un mensaje..."
                        }
                        className="h-8 min-w-0 flex-1 rounded-md border border-zinc-800 bg-[#080b08] px-2.5 font-body text-xs text-white outline-none focus:border-lime-400/60"
                      />
                      <button
                        type="button"
                        disabled={room?.chatLocked || !chatMessage.trim()}
                        onClick={sendMessage}
                        className="h-8 rounded-md bg-lime-400 px-3 font-body text-xs font-bold text-[#080b08] disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* UNIFIED CONTROLS BAR (Cinema mode docks it at bottom) */}
            <div
              className={
                isCinemaMode
                  ? "border-t border-zinc-900 bg-[#080b08]/95 px-4 py-2.5 shrink-0"
                  : "rounded-xl border border-zinc-800/80 bg-[#0c110b] p-2.5"
              }
            >
              {renderBottomControls()}
            </div>

            {/* CINEMA MODE: HOST CONTROLS POPOVER (if toggled) */}
            {isCinemaMode && showHostControls && isHost && (
              <div className="absolute left-4 bottom-16 z-40 w-80 rounded-xl border border-zinc-800 bg-[#0c110b] p-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400">
                    Host Controls
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHostControls(false)}
                    className="text-zinc-500 hover:text-white"
                  >
                    <IoClose />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      socketRef.current?.emit("toggle-chat-lock", roomId)
                    }
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-300 hover:border-zinc-500"
                  >
                    {room?.chatLocked ? (
                      <IoLockOpenOutline />
                    ) : (
                      <IoLockClosedOutline />
                    )}
                    <span>{room?.chatLocked ? "Desbloquear" : "Bloquear"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPollForm((v) => !v)}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-300 hover:border-zinc-500"
                  >
                    <IoStatsChartOutline />
                    <span>Encuesta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white transition"
                    title="Eliminar esta Watch Party"
                  >
                    <IoTrashOutline />
                    <span>Eliminar</span>
                  </button>
                </div>
                <form onSubmit={submitVideo} className="mt-3 space-y-2">
                  <input
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    placeholder="URL de YouTube"
                    className="h-8 w-full rounded-md border border-zinc-800 bg-[#080b08] px-2.5 text-xs text-white outline-none"
                  />
                  <div className="flex gap-2">
                    <button className="flex-1 h-8 rounded-md bg-lime-400 text-xs font-bold text-[#080b08] hover:bg-lime-300">
                      Cambiar video
                    </button>
                    {room?.videoId && (
                      <button
                        type="button"
                        onClick={clearContent}
                        className="h-8 px-2.5 rounded-md border border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                        title="Quitar video"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* NORMAL MODE: HOST CONTROLS PANEL */}
            {!isCinemaMode && isHost && showHostControls && (
              <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                    Host controls
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 font-body text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500 hover:text-white transition"
                  >
                    <IoTrashOutline className="text-sm" />
                    <span>Eliminar Party</span>
                  </button>
                </div>
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
                  <div className="flex gap-2">
                    <button className="h-11 flex-1 rounded-lg border border-lime-400/30 bg-lime-400/10 px-5 font-body text-[10px] font-bold uppercase tracking-wider text-lime-400 transition hover:bg-lime-400 hover:text-[#080b08]">
                      Change video
                    </button>
                    {room?.videoId && (
                      <button
                        type="button"
                        onClick={clearContent}
                        className="h-11 rounded-lg border border-red-500/30 bg-red-500/10 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/20"
                        title="Quitar video actual"
                      >
                        Quitar video
                      </button>
                    )}
                  </div>
                </form>
              </section>
            )}

            {/* NORMAL MODE: MOBILE CHAT (xl:hidden) */}
            {!isCinemaMode && showChat && (
              <section className="flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] xl:hidden">
                <div className="flex items-center justify-between border-b border-zinc-800 p-4">
                  <div>
                    <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                      Live chat
                    </p>
                    <h3 className="mt-1 font-body text-base font-bold uppercase">
                      Talk with the room
                    </h3>
                  </div>
                  {room?.chatLocked && (
                    <IoLockClosedOutline className="text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[300px]">
                  {messages.length ? (
                    messages.map((message, index) => (
                      <div
                        key={`mobile-msg-${message.timestamp || 0}-${message.userId || ""}-${index}`}
                        className={
                          message.userId === userId ? "text-right" : "text-left"
                        }
                      >
                        <div
                          className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${
                            message.userId === userId
                              ? "bg-lime-400 text-[#080b08]"
                              : "border border-zinc-800 bg-[#080b08] text-zinc-300"
                          }`}
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
                    <p className="pt-16 text-center font-body text-sm text-zinc-600">
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
            )}

            {/* NORMAL MODE: ROOM QUEUE */}
            {!isCinemaMode && (
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
                      onClick={() =>
                        socketRef.current?.emit("play-next", roomId)
                      }
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
                    Real-time server offline. Run <code>npm run dev:all</code>{" "}
                    to enable the queue and reactions.
                  </p>
                )}
              </section>
            )}
          </main>

          {/* NORMAL MODE: SIDEBAR (hidden in Cinema mode) */}
          {!isCinemaMode && (
            <aside className="space-y-5 xl:self-start">
              {/* People List */}
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
                  {room?.users.map((participant) => {
                    const isParticipantHost =
                      participant.socketId === room.hostSocketId;
                    const isCurrentUser = Boolean(
                      currentSocketId &&
                        participant.socketId === currentSocketId,
                    );

                    return (
                      <div
                        key={participant.socketId}
                        className="group flex items-center gap-2 px-1 py-1.5"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span
                            className={`truncate font-body text-[10px] font-semibold ${
                              isCurrentUser ? "text-zinc-200" : "text-zinc-400"
                            }`}
                          >
                            {participant.userId}
                          </span>

                          {isParticipantHost && (
                            <span className="shrink-0 font-mono text-[9px] font-bold text-lime-400/80">
                              HOST
                            </span>
                          )}

                          {isParticipantHost && isCurrentUser && (
                            <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                              ·
                            </span>
                          )}

                          {isCurrentUser && (
                            <span className="shrink-0 font-mono text-[9px] font-bold text-lime-400">
                              YOU
                            </span>
                          )}
                        </div>

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
                    );
                  })}
                </div>
              </section>

              {/* Poll Creation Form */}
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
                      key={`poll-opt-${index}`}
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

              {/* Live Poll */}
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
                          key={`poll-choice-${option.label}-${index}`}
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

              {/* DESKTOP CHAT (xl:flex) */}
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
                <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[400px]">
                  {messages.length ? (
                    messages.map((message, index) => (
                      <div
                        key={`desktop-msg-${message.timestamp || 0}-${message.userId || ""}-${index}`}
                        className={
                          message.userId === userId ? "text-right" : "text-left"
                        }
                      >
                        <div
                          className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${
                            message.userId === userId
                              ? "bg-lime-400 text-[#080b08]"
                              : "border border-zinc-800 bg-[#080b08] text-zinc-300"
                          }`}
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
          )}
        </div>
      </div>

      {/* CONFIRM DELETE MODAL (FOR HOST) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                <IoTrashOutline className="text-xl" />
              </div>
              <div>
                <h3 className="font-body text-base font-bold uppercase text-white">
                  ¿Eliminar esta Watch Party?
                </h3>
                <p className="mt-1 font-body text-xs text-zinc-400 leading-relaxed">
                  Esta acción cerrará la sala para todos los participantes.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError("");
                }}
                className="rounded-lg border border-zinc-700 bg-transparent px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteParty}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Eliminar Party</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROOM DELETED MODAL (FOR PARTICIPANTS) */}
      {roomDeletedInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
              <IoTrashOutline className="text-2xl" />
            </div>
            <h3 className="font-body text-base font-bold uppercase text-white">
              Watch Party Finalizada
            </h3>
            <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
              {roomDeletedInfo}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Serás redirigido en breve...
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => router.replace("/dashboard/parties")}
                className="inline-flex items-center justify-center rounded-lg border border-lime-400 bg-lime-400 px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-[#080b08] transition hover:bg-lime-300"
              >
                Volver a My Parties
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
