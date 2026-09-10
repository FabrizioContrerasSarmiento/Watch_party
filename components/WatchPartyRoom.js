"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
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
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

function videoFromInput(value) {
  const input = value.trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    const hostname = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let videoId = null;

    if (hostname === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0];
    else if (hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com")) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      videoId = url.searchParams.get("v");
      if (!videoId && ["shorts", "embed", "live", "v"].includes(pathParts[0])) videoId = pathParts[1];
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId || "") ? videoId : null;
  } catch {
    return null;
  }
}

export default function WatchPartyRoom({ roomId, userId }) {
  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const localChangeRef = useRef(false);
  const syncingRef = useRef(null);
  const reactionTimerRef = useRef([]);
  const dismissedPollRef = useRef(null);
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
  const [pollOptions, setPollOptions] = useState(["🔥 Buenísima", "😐 Normal", "💀 Malísima"]);
  const [copied, setCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const applyRoom = (nextRoom) => {
    const isDismissedPoll = nextRoom.activePoll?.id === dismissedPollRef.current;
    setRoom({ ...nextRoom, activePoll: isDismissedPoll ? null : nextRoom.activePoll });
    setIsHost(nextRoom.hostSocketId === socketRef.current?.id);
    setCurrentTime(nextRoom.currentTime || 0);
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
    socket.on("chat-message", (message) => setMessages((previous) => [...previous, message]));
    socket.on("reaction", (reaction) => {
      setReactions((previous) => [...previous, reaction]);
      const timer = window.setTimeout(() => {
        setReactions((previous) => previous.filter((item) => item.id !== reaction.id));
      }, 3600);
      reactionTimerRef.current.push(timer);
    });
    socket.on("removed-from-room", () => {
      window.alert("The host removed you from this watch party.");
      window.location.assign("/watch-party");
    });

    return () => {
      socket.emit("leave-room", roomId);
      socket.disconnect();
      reactionTimerRef.current.forEach((timer) => window.clearTimeout(timer));
      if (syncingRef.current) window.clearInterval(syncingRef.current);
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
    if (event.data === 0 && isHost) socketRef.current?.emit("video-ended", roomId);
    if (!isHost) return;
    if (event.data === 1) socketRef.current?.emit("play", roomId);
    if (event.data === 2) socketRef.current?.emit("pause", roomId);
  };

  const handleSeek = (time) => {
    if (isHost && !localChangeRef.current) socketRef.current?.emit("seek", roomId, time);
  };

  const sendMessage = () => {
    if (!chatMessage.trim() || room?.chatLocked) return;
    socketRef.current?.emit("send-message", roomId, userId || "Guest", chatMessage);
    setChatMessage("");
  };

  const sendReaction = (reaction) => socketRef.current?.emit("send-reaction", roomId, reaction);

  const submitVideo = (event) => {
    event.preventDefault();
    const videoId = videoFromInput(videoInput);
    if (!videoId) return;
    socketRef.current?.emit("play-video", roomId, { videoId, title: videoTitleInput || "Untitled video" });
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
    socketRef.current?.emit("add-to-queue", roomId, {
      videoId,
      title: queueTitleInput || "Untitled video",
      addedBy: userId || "Guest",
    }, (result) => {
      if (!result?.success) {
        setQueueError(result?.error || "The video could not be added to the queue.");
        return;
      }
      setQueueInput("");
      setQueueTitleInput("");
    });
  };

  const createPoll = (event) => {
    event.preventDefault();
    dismissedPollRef.current = null;
    socketRef.current?.emit("create-poll", roomId, { question: pollQuestion, options: pollOptions });
    setPollQuestion("");
    setShowPollForm(false);
  };

  const closePoll = () => {
    dismissedPollRef.current = room?.activePoll?.id || null;
    setRoom((previous) => previous ? { ...previous, activePoll: null } : previous);
    socketRef.current?.emit("close-poll", roomId);
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareWhatsApp = () => {
    const text = `🎬 ${userId || "Someone"} invited you to a Watch Party: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const poll = room?.activePoll;
  const totalVotes = poll?.options.reduce((total, option) => total + option.votes, 0) || 0;

  return (
    <div className="min-h-screen bg-[#080b08] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.25em] text-lime-400">Watch Party</p>
              <h1 className="mt-1 font-body text-xl font-bold uppercase text-white">{room?.title || "Loading room..."}</h1>
            </div>
            <div className="rounded-lg border border-lime-400/20 bg-lime-400/5 px-3 py-2">
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Host</p>
              <p className="mt-0.5 font-body text-xs font-bold text-lime-400">{room?.users.find((user) => user.socketId === room?.hostSocketId)?.userId || "Connecting..."}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-zinc-800 bg-[#0c110b] px-3 py-2">
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">Room</p>
              <p className="font-mono text-xs font-bold tracking-wider text-lime-400">{roomId}</p>
            </div>
            <button type="button" onClick={copyInvite} className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c110b] px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-400">
              <IoCopyOutline /> {copied ? "Copied" : "Copy invite"}
            </button>
            <button type="button" onClick={shareWhatsApp} className="inline-flex h-11 items-center gap-2 rounded-lg bg-lime-400 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-[#080b08] transition hover:bg-lime-300">
              <IoShareSocialOutline /> Share
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              {!playerReady && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b08]/85"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" /></div>}
              <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                {reactions.map((item, index) => <span key={item.id} className="reaction-float absolute bottom-1/2 text-4xl sm:text-6xl" style={{ left: `calc(50% + ${(index % 3 - 1) * 58}px)`, animationDelay: `${index * 80}ms` }}>{item.reaction}</span>)}
              </div>
              <div className="aspect-video"><YouTubePlayer videoId={room?.videoId || "dQw4w9WgXcQ"} onReady={handlePlayerReady} onStateChange={handleStateChange} onSeek={handleSeek} /></div>
              {!isHost && <div className="absolute bottom-3 left-3 z-20 rounded-full border border-zinc-700 bg-black/75 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300">Only the host controls playback</div>}
            </section>

            <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] xl:hidden"><div className="flex items-center justify-between border-b border-zinc-800 p-5"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Live chat</p><h3 className="mt-1 font-body text-lg font-bold uppercase">Talk with the room</h3></div>{room?.chatLocked && <IoLockClosedOutline className="text-zinc-500" />}</div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length ? messages.map((message, index) => <div key={`${message.timestamp}-${index}`} className={message.userId === userId ? "text-right" : "text-left"}><div className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${message.userId === userId ? "bg-lime-400 text-[#080b08]" : "border border-zinc-800 bg-[#080b08] text-zinc-300"}`}><p className="font-body text-[10px] font-bold uppercase tracking-wider opacity-70">{message.userId}</p><p className="mt-1 font-body text-sm">{message.message}</p></div></div>) : <p className="pt-20 text-center font-body text-sm text-zinc-600">Start the conversation.</p>}</div><div className="border-t border-zinc-800 p-3"><div className="flex gap-2"><input disabled={room?.chatLocked} value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={room?.chatLocked ? "Chat locked by the host" : "Write a message..."} className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50" /><button type="button" disabled={room?.chatLocked} onClick={sendMessage} className="h-10 rounded-lg bg-lime-400 px-4 font-body text-xs font-bold text-[#080b08]">Send</button></div></div></section>

            <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Now Playing</p><h2 className="mt-2 font-body text-xl font-bold text-white">{room?.title}</h2></div>
                <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${room?.isPlaying ? "bg-lime-400" : "bg-zinc-600"}`} /><span className="font-body text-xs font-bold uppercase tracking-wider text-zinc-400">{room?.isPlaying ? "Playing" : "Paused"} · {Math.floor(currentTime)}s</span></div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
                {REACTIONS.map((reaction) => <button key={reaction} type="button" onClick={() => sendReaction(reaction)} className="h-11 w-11 rounded-lg border border-zinc-800 bg-[#080b08] text-xl transition hover:-translate-y-1 hover:border-lime-400/50 hover:bg-lime-400/10" aria-label={`Send ${reaction} reaction`}>{reaction}</button>)}
              </div>
            </section>

            {isHost && <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Host controls</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => socketRef.current?.emit("toggle-chat-lock", roomId)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300">{room?.chatLocked ? <IoLockOpenOutline /> : <IoLockClosedOutline />}{room?.chatLocked ? "Unlock chat" : "Lock chat"}</button>
                <button type="button" onClick={() => setShowPollForm((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300"><IoStatsChartOutline /> New poll</button>
              </div>
              <form onSubmit={submitVideo} className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 lg:grid-cols-[1fr_1fr_auto]">
                <input value={videoInput} onChange={(event) => setVideoInput(event.target.value)} placeholder="YouTube URL or video ID" className="h-11 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm text-white outline-none focus:border-lime-400/50" />
                <input value={videoTitleInput} onChange={(event) => setVideoTitleInput(event.target.value)} placeholder="Video title" className="h-11 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm text-white outline-none focus:border-lime-400/50" />
                <button className="h-11 rounded-lg border border-lime-400/30 bg-lime-400/10 px-5 font-body text-[10px] font-bold uppercase tracking-wider text-lime-400">Change video</button>
              </form>
            </section>}

            <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-4 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Up next</p><h3 className="mt-1 font-body text-lg font-bold uppercase">Room queue</h3></div><span className="rounded-full border border-zinc-800 px-3 py-1 font-body text-xs font-bold text-zinc-400">{room?.queue.length || 0}</span></div>
              <div className="mt-4 space-y-2">{room?.queue.length ? room.queue.map((video, index) => <div key={video.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#080b08] p-3"><span className="font-mono text-xs text-lime-400">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="truncate font-body text-sm font-bold text-white">{video.title}</p><p className="font-body text-[10px] text-zinc-600">Added by {video.addedBy}</p></div>{isHost && <button type="button" onClick={() => socketRef.current?.emit("remove-from-queue", roomId, video.id)} className="text-zinc-500 hover:text-red-400" aria-label="Remove from queue"><IoTrashOutline /></button>}</div>) : <p className="py-4 text-center font-body text-sm text-zinc-600">No videos queued yet.</p>}</div>
              <form onSubmit={addQueueVideo} className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-[1fr_1fr_auto_auto]"><input value={queueInput} onChange={(event) => { setQueueInput(event.target.value); setQueueError(""); }} placeholder="YouTube URL, Shorts or ID" className="h-10 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50" /><input value={queueTitleInput} onChange={(event) => setQueueTitleInput(event.target.value)} placeholder="Title" className="h-10 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50" /><button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:border-lime-400 hover:text-lime-400"><IoAdd /> Add video</button>{isHost && <button type="button" onClick={() => socketRef.current?.emit("play-next", roomId)} disabled={!room?.queue.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 font-body text-[10px] font-bold uppercase tracking-wider text-[#080b08] disabled:bg-zinc-700 disabled:text-zinc-500"><IoPlaySkipForward /> Next video</button>}</form>
              {queueError && <p className="mt-2 font-body text-xs font-medium text-red-400">{queueError}</p>}
              {!socketConnected && <p className="mt-2 font-body text-xs font-medium text-amber-400">Real-time server offline. Run <code>npm run dev:all</code> to enable the queue and reactions.</p>}
            </section>
          </main>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><IoPeopleOutline className="text-lg text-lime-400" /><div><p className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-lime-400">People</p><p className="font-body text-xs font-bold text-zinc-300">{room?.users.length || 0} in the room</p></div></div></div><div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">{room?.users.map((participant) => <div key={participant.socketId} className="flex items-center gap-2 rounded-md bg-[#080b08] px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-lime-400" /><p className="max-w-44 truncate font-body text-[10px] font-semibold text-zinc-400">{participant.userId}{participant.socketId === room.hostSocketId ? " · HOST" : ""}</p>{isHost && participant.socketId !== room.hostSocketId && <button type="button" onClick={() => socketRef.current?.emit("remove-participant", roomId, participant.socketId)} className="text-zinc-600 hover:text-red-400" aria-label={`Remove ${participant.userId}`}><IoClose /></button>}</div>)}</div></section>

            {showPollForm && isHost && <form onSubmit={createPoll} className="rounded-2xl border border-lime-400/30 bg-[#0c110b] p-5"><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Create poll</p><input required value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Ask the room..." className="mt-4 h-10 w-full rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50" />{pollOptions.map((option, index) => <input key={index} required value={option} onChange={(event) => setPollOptions((previous) => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-xs text-white outline-none focus:border-lime-400/50" />)}<button className="mt-4 h-10 w-full rounded-lg bg-lime-400 font-body text-[10px] font-bold uppercase tracking-wider text-[#080b08]">Launch poll</button></form>}

            {poll && <section className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Live poll</p><h3 className="mt-2 font-body text-base font-bold text-white">{poll.question}</h3></div>{isHost && <button type="button" onClick={closePoll} className="font-body text-[10px] font-bold uppercase text-zinc-500 hover:text-red-400">Close poll</button>}</div><div className="mt-4 space-y-2">{poll.options.map((option, index) => { const percent = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0; return <button key={option.label} type="button" onClick={() => socketRef.current?.emit("vote-poll", roomId, index)} className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-[#080b08] p-3 text-left"><span className="absolute inset-y-0 left-0 bg-lime-400/10" style={{ width: `${percent}%` }} /><span className="relative flex justify-between gap-3 font-body text-xs font-bold text-zinc-200"><span>{option.label}</span><span className="text-lime-400">{percent}%</span></span></button>; })}</div><p className="mt-3 font-body text-[10px] uppercase tracking-wider text-zinc-600">{totalVotes} votes · vote now</p></section>}

            <section className="hidden min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] xl:flex"><div className="flex items-center justify-between border-b border-zinc-800 p-5"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">Live chat</p><h3 className="mt-1 font-body text-lg font-bold uppercase">Talk with the room</h3></div>{room?.chatLocked && <IoLockClosedOutline className="text-zinc-500" />}</div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length ? messages.map((message, index) => <div key={`${message.timestamp}-${index}`} className={message.userId === userId ? "text-right" : "text-left"}><div className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${message.userId === userId ? "bg-lime-400 text-[#080b08]" : "border border-zinc-800 bg-[#080b08] text-zinc-300"}`}><p className="font-body text-[10px] font-bold uppercase tracking-wider opacity-70">{message.userId}</p><p className="mt-1 font-body text-sm">{message.message}</p></div></div>) : <p className="pt-20 text-center font-body text-sm text-zinc-600">Start the conversation.</p>}</div><div className="border-t border-zinc-800 p-3"><div className="flex gap-2"><input disabled={room?.chatLocked} value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={room?.chatLocked ? "Chat locked by the host" : "Write a message..."} className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#080b08] px-3 font-body text-sm text-white outline-none focus:border-lime-400/50" /><button type="button" disabled={room?.chatLocked} onClick={sendMessage} className="h-10 rounded-lg bg-lime-400 px-4 font-body text-xs font-bold text-[#080b08]">Send</button></div></div></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
