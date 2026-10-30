"use client";

import {
  get,
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  startAt,
  update,
} from "firebase/database";

import { getClientAuth, getRealtimeDatabase } from "@/lib/firebase/client";

const ALLOWED_REACTIONS = new Set(["😂", "❤️", "😱", "😡", "🔥", "👀"]);
const ROOT_PATH = "watchPartyRooms";

function createClientId() {
  const randomId = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `client-${randomId}`;
}

function cleanRoomId(roomId) {
  return String(roomId || "")
    .trim()
    .toUpperCase()
    .replace(/[.#$\[\]/]/g, "-")
    .slice(0, 80);
}

function serializable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function roomPath(roomId) {
  return `${ROOT_PATH}/${cleanRoomId(roomId)}`;
}

function defaultState() {
  return {
    contentType: null,
    videoId: null,
    title: "",
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1,
    playStartTime: null,
    lastUpdateTime: Date.now(),
    hostSocketId: null,
    screenSharerSocketId: null,
    chatLocked: false,
    status: "active",
  };
}

function valuesWithIds(value, idField = "socketId") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, item]) => ({
    ...(item || {}),
    [idField]: item?.[idField] || id,
  }));
}

function queueValues(value) {
  return valuesWithIds(value, "id").sort(
    (left, right) => (left.addedAt || 0) - (right.addedAt || 0),
  );
}

function pollValue(value) {
  if (!value) return null;
  const options = Array.isArray(value.options)
    ? value.options.filter(Boolean)
    : Object.values(value.options || {}).filter(Boolean);
  return { ...value, options };
}

class RealtimeSocket {
  constructor() {
    this.id = createClientId();
    this.connected = false;
    this.manualDisconnect = false;
    this.roomId = null;
    this.userId = "Guest";
    this.uid = null;
    this.serverOffset = 0;
    this.connectedAt = Date.now();
    this.handlers = new Map();
    this.roomUnsubscribers = [];
    this.disconnectRegistrations = [];
    this.screenDisconnectRegistration = null;
    this.cache = this.createCache();
    this.roomStateQueued = false;
    this.hasLoadedState = false;
    this.database = getRealtimeDatabase();

    this.offsetUnsubscribe = onValue(
      ref(this.database, ".info/serverTimeOffset"),
      (snapshot) => {
        this.serverOffset = Number(snapshot.val()) || 0;
      },
    );

    this.connectionUnsubscribe = onValue(
      ref(this.database, ".info/connected"),
      (snapshot) => {
        if (this.manualDisconnect) return;
        const nextConnected = snapshot.val() === true;
        if (nextConnected && !this.connected) {
          this.connected = true;
          this.dispatch("connect");
        } else if (!nextConnected && this.connected) {
          this.connected = false;
          this.dispatch("disconnect", "transport close");
        }
      },
      (error) => this.fail(error),
    );
  }

  createCache() {
    return {
      state: defaultState(),
      participants: {},
      voiceUsers: {},
      cameraUsers: {},
      queue: {},
      activePoll: null,
    };
  }

  now() {
    return Date.now() + this.serverOffset;
  }

  on(eventName, handler) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName).add(handler);
    if (eventName === "connect" && this.connected) {
      queueMicrotask(() => handler());
    }
    return this;
  }

  off(eventName, handler) {
    if (!handler) this.handlers.delete(eventName);
    else this.handlers.get(eventName)?.delete(handler);
    return this;
  }

  dispatch(eventName, payload) {
    for (const handler of this.handlers.get(eventName) || []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[REALTIME] ${eventName} handler failed:`, error);
      }
    }
  }

  fail(error) {
    console.error("[REALTIME] Firebase connection error:", error);
    this.dispatch("connect_error", error);
  }

  emit(eventName, ...args) {
    this.handleOutgoingEvent(eventName, args).catch((error) => {
      console.error(`[REALTIME] ${eventName} failed:`, error);
      const callback = args.findLast?.((value) => typeof value === "function");
      callback?.({ success: false, error: error.message });
      this.fail(error);
    });
    return this;
  }

  async handleOutgoingEvent(eventName, args) {
    switch (eventName) {
      case "join-room":
        return this.joinRoom(args[0], args[1]);
      case "leave-room":
        return this.leaveRoom();
      case "send-message":
        return this.sendMessage(args[0], args[1], args[2]);
      case "send-reaction":
        return this.sendReaction(args[0], args[1]);
      case "add-to-queue":
        return this.addToQueue(args[0], args[1], args[2]);
      case "remove-from-queue":
        return this.removeFromQueue(args[0], args[1]);
      case "play-video":
        return this.changeVideo(args[0], args[1]);
      case "play-next":
      case "video-ended":
        return this.playNext(args[0]);
      case "play":
      case "pause":
      case "seek":
      case "playback-rate-change":
        return this.updatePlayback(eventName, args[0], args[1], args[2]);
      case "clear-content":
        return this.clearContent(args[0]);
      case "get-room-time":
        return this.getRoomTime(args[0], args[1]);
      case "create-poll":
        return this.createPoll(args[0], args[1]);
      case "vote-poll":
        return this.votePoll(args[0], args[1]);
      case "close-poll":
        return this.closePoll(args[0]);
      case "toggle-chat-lock":
        return this.toggleChatLock(args[0]);
      case "remove-participant":
        return this.removeParticipant(args[0], args[1]);
      case "delete-room":
        return this.deleteRoom(args[0], args[1]);
      case "voice-join":
        return this.joinVoice(args[0]);
      case "voice-leave":
        return this.leaveVoice(args[0]);
      case "voice-speaking":
        return this.broadcastSpeaking(args[0]);
      case "voice-offer":
      case "voice-answer":
      case "voice-ice-candidate":
      case "camera-offer":
      case "camera-answer":
      case "camera-ice-candidate":
      case "screen-offer":
      case "screen-answer":
      case "screen-ice-candidate":
        return this.sendSignal(eventName, args[0], args[1]);
      case "screen-share-changed":
      case "user-screen-changed":
        return this.updateScreenShare(args[0], args[1]);
      case "camera-changed":
        return this.updateCamera(args[0], args[1]);
      default:
        console.warn(`[REALTIME] Unsupported event: ${eventName}`);
    }
  }

  async ensureAuthenticated() {
    const auth = getClientAuth();
    await auth.authStateReady();
    if (!auth.currentUser) {
      throw new Error("Debes iniciar sesión para usar la sala en tiempo real.");
    }
    this.uid = auth.currentUser.uid;
  }

  roomRef(roomId = this.roomId, childPath = "") {
    const basePath = roomPath(roomId);
    return ref(this.database, childPath ? `${basePath}/${childPath}` : basePath);
  }

  async joinRoom(rawRoomId, rawUserId) {
    await this.ensureAuthenticated();
    const nextRoomId = cleanRoomId(rawRoomId);
    if (!nextRoomId) throw new Error("Identificador de sala inválido.");

    this.userId = String(rawUserId || "Guest").trim().slice(0, 50) || "Guest";
    if (this.roomId && this.roomId !== nextRoomId) await this.leaveRoom();
    this.roomId = nextRoomId;
    this.connectedAt = this.now();

    const participantRef = this.roomRef(nextRoomId, `participants/${this.id}`);
    const voiceRef = this.roomRef(nextRoomId, `voiceUsers/${this.id}`);
    const cameraRef = this.roomRef(nextRoomId, `cameraUsers/${this.id}`);
    const signalRef = this.roomRef(nextRoomId, `signals/${this.id}`);

    await this.cancelDisconnectRegistrations();
    this.disconnectRegistrations = [
      onDisconnect(participantRef),
      onDisconnect(voiceRef),
      onDisconnect(cameraRef),
      onDisconnect(signalRef),
    ];
    await Promise.all(this.disconnectRegistrations.map((entry) => entry.remove()));

    await runTransaction(this.roomRef(nextRoomId, "state"), (state) => ({
      ...defaultState(),
      ...(state || {}),
      status: state?.status === "deleted" ? "deleted" : "active",
    }));
    await set(participantRef, {
      socketId: this.id,
      userId: this.userId,
      uid: this.uid,
      joinedAt: serverTimestamp(),
    });
    await runTransaction(
      this.roomRef(nextRoomId, "state/hostSocketId"),
      (hostSocketId) => hostSocketId || this.id,
    );

    if (!this.roomUnsubscribers.length) this.attachRoomListeners();
  }

  attachRoomListeners() {
    const watch = (path, cacheKey, transform = (value) => value || {}) => {
      const unsubscribe = onValue(
        this.roomRef(this.roomId, path),
        (snapshot) => {
          const previous = this.cache[cacheKey];
          this.cache[cacheKey] = transform(snapshot.val());
          if (cacheKey === "participants") {
            this.handleParticipantChanges(previous || {}, this.cache[cacheKey]);
          }
          if (
            cacheKey === "state" &&
            this.cache.state?.status === "deleted"
          ) {
            this.dispatch("room-deleted", {
              roomId: this.roomId,
              message:
                this.cache.state.deletedMessage ||
                "Esta Watch Party fue eliminada por el host.",
            });
          }
          if (cacheKey === "state" && !this.hasLoadedState) {
            const screenSharerSocketId =
              this.cache.state?.screenSharerSocketId;
            if (
              screenSharerSocketId &&
              screenSharerSocketId !== this.id
            ) {
              this.sendSignal("screen-user-joined", screenSharerSocketId, {
                socketId: this.id,
              }).catch((error) => this.fail(error));
            }
            this.hasLoadedState = true;
          }
          this.queueRoomState();
        },
        (error) => this.fail(error),
      );
      this.roomUnsubscribers.push(unsubscribe);
    };

    watch("state", "state", (value) => ({ ...defaultState(), ...(value || {}) }));
    watch("participants", "participants");
    watch("voiceUsers", "voiceUsers");
    watch("cameraUsers", "cameraUsers");
    watch("queue", "queue");
    watch("activePoll", "activePoll", (value) => value || null);

    const messagesQuery = query(
      this.roomRef(this.roomId, "messages"),
      limitToLast(100),
    );
    this.roomUnsubscribers.push(
      onChildAdded(messagesQuery, (snapshot) => {
        this.dispatch("chat-message", snapshot.val());
      }, (error) => this.fail(error)),
    );

    const reactionsQuery = query(
      this.roomRef(this.roomId, "reactions"),
      orderByChild("timestamp"),
      startAt(this.connectedAt - 2000),
    );
    this.roomUnsubscribers.push(
      onChildAdded(reactionsQuery, (snapshot) => {
        this.dispatch("reaction", { id: snapshot.key, ...snapshot.val() });
      }, (error) => this.fail(error)),
    );

    const eventsQuery = query(
      this.roomRef(this.roomId, "events"),
      orderByChild("timestamp"),
      startAt(this.connectedAt - 2000),
    );
    this.roomUnsubscribers.push(
      onChildAdded(eventsQuery, (snapshot) => {
        const event = snapshot.val();
        if (!event?.type) return;
        if (event.excludeSender && event.originId === this.id) return;
        this.dispatch(event.type, event.payload);
      }, (error) => this.fail(error)),
    );

    this.roomUnsubscribers.push(
      onChildAdded(this.roomRef(this.roomId, `signals/${this.id}`), (snapshot) => {
        const signal = snapshot.val();
        remove(snapshot.ref).catch(() => {});
        if (signal?.type) this.dispatch(signal.type, signal.payload);
      }, (error) => this.fail(error)),
    );
  }

  handleParticipantChanges(previous, next) {
    const previousIds = new Set(Object.keys(previous || {}));
    const nextIds = new Set(Object.keys(next || {}));
    for (const socketId of previousIds) {
      if (!nextIds.has(socketId)) {
        this.dispatch("user-left", { socketId });
        this.dispatch("voice-user-left", { socketId });
        this.dispatch("user-camera-changed", {
          socketId,
          enabled: false,
          isCameraOn: false,
        });
      }
    }

    const hostSocketId = this.cache.state?.hostSocketId;
    if (nextIds.size && (!hostSocketId || !nextIds.has(hostSocketId))) {
      const nextHost = [...nextIds].sort()[0];
      runTransaction(
        this.roomRef(this.roomId, "state/hostSocketId"),
        (currentHost) =>
          currentHost && nextIds.has(currentHost) ? currentHost : nextHost,
      ).catch((error) => this.fail(error));
    }
  }

  queueRoomState() {
    if (this.roomStateQueued) return;
    this.roomStateQueued = true;
    queueMicrotask(() => {
      this.roomStateQueued = false;
      const state = this.cache.state || defaultState();
      const currentTime =
        state.isPlaying && state.playStartTime
          ? (state.currentTime || 0) +
            ((this.now() - state.playStartTime) / 1000) *
              (state.playbackRate || 1)
          : state.currentTime || 0;
      this.dispatch("room-state", {
        ...state,
        currentTime,
        users: valuesWithIds(this.cache.participants),
        voiceUsers: valuesWithIds(this.cache.voiceUsers),
        cameraUsers: Object.keys(this.cache.cameraUsers || {}).filter(
          (id) => this.cache.cameraUsers[id],
        ),
        screenShareUsers: state.screenSharerSocketId
          ? [state.screenSharerSocketId]
          : [],
        queue: queueValues(this.cache.queue),
        activePoll: pollValue(this.cache.activePoll),
      });
    });
  }

  async isHost(roomId) {
    const snapshot = await get(this.roomRef(roomId, "state/hostSocketId"));
    return snapshot.val() === this.id;
  }

  async pushEvent(roomId, type, payload, excludeSender = false) {
    const eventRef = push(this.roomRef(roomId, "events"));
    await set(eventRef, {
      type,
      payload: serializable(payload),
      originId: this.id,
      excludeSender,
      timestamp: this.now(),
    });
  }

  async sendMessage(roomId, rawUserId, rawMessage) {
    const message = String(rawMessage || "").trim().slice(0, 500);
    if (!message) return;
    const chatLocked = await get(this.roomRef(roomId, "state/chatLocked"));
    if (chatLocked.val()) return;
    await set(push(this.roomRef(roomId, "messages")), {
      userId: String(rawUserId || "Guest").slice(0, 50),
      message,
      timestamp: this.now(),
    });
  }

  async sendReaction(roomId, reaction) {
    if (!ALLOWED_REACTIONS.has(reaction)) return;
    await set(push(this.roomRef(roomId, "reactions")), {
      reaction,
      timestamp: this.now(),
    });
  }

  async addToQueue(roomId, video, callback) {
    if (!video?.videoId) {
      callback?.({ success: false, error: "Video inválido." });
      return;
    }
    const itemRef = push(this.roomRef(roomId, "queue"));
    await set(itemRef, {
      id: itemRef.key,
      videoId: String(video.videoId).slice(0, 30),
      title: String(video.title || "Untitled video").slice(0, 100),
      addedBy: String(video.addedBy || "Guest").slice(0, 50),
      addedAt: this.now(),
    });
    callback?.({ success: true });
  }

  async removeFromQueue(roomId, queueId) {
    if (!(await this.isHost(roomId))) return;
    await remove(this.roomRef(roomId, `queue/${queueId}`));
  }

  async changeVideo(roomId, video) {
    if (!(await this.isHost(roomId)) || !video?.videoId) return;
    const timestamp = this.now();
    const eventRef = push(this.roomRef(roomId, "events"));
    await update(this.roomRef(roomId), {
      "state/contentType": "youtube",
      "state/videoId": String(video.videoId).slice(0, 30),
      "state/title": String(video.title || "Untitled video").slice(0, 100),
      "state/isPlaying": false,
      "state/currentTime": 0,
      "state/playbackRate": 1,
      "state/playStartTime": null,
      "state/lastUpdateTime": timestamp,
      [`events/${eventRef.key}`]: {
        type: "video-changed",
        payload: {
          videoId: String(video.videoId).slice(0, 30),
          title: String(video.title || "Untitled video").slice(0, 100),
          contentType: "youtube",
        },
        originId: this.id,
        excludeSender: false,
        timestamp,
      },
    });
  }

  async playNext(roomId) {
    if (!(await this.isHost(roomId))) return;
    const snapshot = await get(this.roomRef(roomId, "queue"));
    const [nextVideo] = queueValues(snapshot.val());
    if (!nextVideo) return;
    await remove(this.roomRef(roomId, `queue/${nextVideo.id}`));
    await this.changeVideo(roomId, nextVideo);
  }

  async updatePlayback(type, roomId, rawData, fallbackData) {
    if (!(await this.isHost(roomId))) return;
    const stateSnapshot = await get(this.roomRef(roomId, "state"));
    const state = { ...defaultState(), ...(stateSnapshot.val() || {}) };
    if (!state.videoId && type === "play") return;
    const data =
      rawData && typeof rawData === "object" ? rawData : fallbackData || {};
    const rawPosition =
      typeof rawData === "number" ? rawData : data.position ?? data.currentTime;
    const currentPosition =
      state.isPlaying && state.playStartTime
        ? (state.currentTime || 0) +
          ((this.now() - state.playStartTime) / 1000) *
            (state.playbackRate || 1)
        : state.currentTime || 0;
    const position = Number.isFinite(rawPosition)
      ? Math.max(0, rawPosition)
      : currentPosition;
    const rateCandidate =
      type === "playback-rate-change"
        ? data.playbackRate ?? rawData
        : data.playbackRate;
    const playbackRate =
      typeof rateCandidate === "number" && rateCandidate > 0
        ? rateCandidate
        : state.playbackRate || 1;
    const timestamp = this.now();
    const isPlaying = type === "play" ? true : type === "pause" ? false : state.isPlaying;
    const eventType =
      type === "play"
        ? "play-synced"
        : type === "pause"
          ? "pause-synced"
          : type === "seek"
            ? "seek-synced"
            : "playback-rate-synced";
    const eventRef = push(this.roomRef(roomId, "events"));
    await update(this.roomRef(roomId), {
      "state/isPlaying": isPlaying,
      "state/currentTime": position,
      "state/playbackRate": playbackRate,
      "state/playStartTime": isPlaying ? timestamp : null,
      "state/lastUpdateTime": timestamp,
      [`events/${eventRef.key}`]: {
        type: eventType,
        payload: { position, timestamp, playbackRate },
        originId: this.id,
        excludeSender: type === "play" || type === "pause",
        timestamp,
      },
    });
  }

  async clearContent(roomId) {
    if (!(await this.isHost(roomId))) return;
    const timestamp = this.now();
    await update(this.roomRef(roomId, "state"), {
      contentType: null,
      videoId: null,
      title: "",
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      playStartTime: null,
      lastUpdateTime: timestamp,
      screenSharerSocketId: null,
    });
    await this.pushEvent(
      roomId,
      "video-changed",
      { videoId: null, title: "", contentType: null },
      false,
    );
  }

  async getRoomTime(roomId, callback) {
    const snapshot = await get(this.roomRef(roomId, "state"));
    const state = { ...defaultState(), ...(snapshot.val() || {}) };
    const currentTime =
      state.isPlaying && state.playStartTime
        ? (state.currentTime || 0) +
          ((this.now() - state.playStartTime) / 1000) *
            (state.playbackRate || 1)
        : state.currentTime || 0;
    callback?.({
      currentTime,
      isPlaying: state.isPlaying,
      playbackRate: state.playbackRate || 1,
      timestamp: this.now(),
    });
  }

  async createPoll(roomId, poll) {
    if (!(await this.isHost(roomId)) || !poll?.question) return;
    const options = (poll.options || [])
      .map((option) => String(option).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 4);
    if (options.length < 2) return;
    await set(this.roomRef(roomId, "activePoll"), {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      question: String(poll.question).trim().slice(0, 140),
      options: options.map((label) => ({ label, votes: 0 })),
      voters: {},
      closed: false,
    });
  }

  async votePoll(roomId, optionIndex) {
    await runTransaction(this.roomRef(roomId, "activePoll"), (poll) => {
      if (!poll || poll.closed || poll.voters?.[this.id]) return poll;
      const options = Array.isArray(poll.options)
        ? poll.options
        : Object.values(poll.options || {});
      if (!options[optionIndex]) return poll;
      options[optionIndex] = {
        ...options[optionIndex],
        votes: (options[optionIndex].votes || 0) + 1,
      };
      return {
        ...poll,
        options,
        voters: { ...(poll.voters || {}), [this.id]: true },
      };
    });
  }

  async closePoll(roomId) {
    if (!(await this.isHost(roomId))) return;
    await remove(this.roomRef(roomId, "activePoll"));
  }

  async toggleChatLock(roomId) {
    if (!(await this.isHost(roomId))) return;
    await runTransaction(
      this.roomRef(roomId, "state/chatLocked"),
      (locked) => !locked,
    );
  }

  async removeParticipant(roomId, participantSocketId) {
    if (!(await this.isHost(roomId)) || participantSocketId === this.id) return;
    await this.sendSignal("removed-from-room", participantSocketId, {
      roomId: cleanRoomId(roomId),
    });
    await update(this.roomRef(roomId), {
      [`participants/${participantSocketId}`]: null,
      [`voiceUsers/${participantSocketId}`]: null,
      [`cameraUsers/${participantSocketId}`]: null,
    });
  }

  async deleteRoom(roomId, callback) {
    if (!(await this.isHost(roomId))) {
      callback?.({ success: false, error: "Solo el anfitrión puede eliminar la sala." });
      return;
    }
    await update(this.roomRef(roomId, "state"), {
      status: "deleted",
      deletedAt: serverTimestamp(),
      deletedMessage: "Esta Watch Party fue eliminada por el host.",
    });
    callback?.({ success: true });
  }

  async joinVoice(roomId) {
    const participantsSnapshot = await get(this.roomRef(roomId, "participants"));
    const participants = valuesWithIds(participantsSnapshot.val()).filter(
      (participant) => participant.socketId !== this.id,
    );
    await set(this.roomRef(roomId, `voiceUsers/${this.id}`), {
      socketId: this.id,
      userId: this.userId,
      uid: this.uid,
    });
    this.dispatch("voice-participants", participants);
    await this.pushEvent(
      roomId,
      "voice-user-joined",
      { socketId: this.id, userId: this.userId },
      true,
    );
  }

  async leaveVoice(roomId) {
    await remove(this.roomRef(roomId, `voiceUsers/${this.id}`));
    await this.pushEvent(roomId, "voice-user-left", { socketId: this.id }, true);
  }

  async broadcastSpeaking(data) {
    const roomId = data?.roomId || this.roomId;
    await this.pushEvent(
      roomId,
      "voice-speaking",
      { socketId: this.id, isSpeaking: Boolean(data?.isSpeaking) },
      true,
    );
  }

  async sendSignal(type, targetSocketId, payload) {
    if (!this.roomId || !targetSocketId) return;
    const signalRef = push(
      this.roomRef(this.roomId, `signals/${targetSocketId}`),
    );
    const field = type.endsWith("ice-candidate")
      ? "candidate"
      : type.endsWith("offer")
        ? "offer"
        : type.endsWith("answer")
          ? "answer"
          : null;
    const signalPayload = field
      ? { fromSocketId: this.id, [field]: serializable(payload) }
      : serializable(payload);
    await set(signalRef, {
      type,
      payload: signalPayload,
      timestamp: this.now(),
    });
  }

  async updateScreenShare(roomId, enabled) {
    const stateSnapshot = await get(this.roomRef(roomId, "state"));
    const state = { ...defaultState(), ...(stateSnapshot.val() || {}) };
    const isEnabled = Boolean(enabled);
    if (
      isEnabled &&
      state.screenSharerSocketId === this.id &&
      state.contentType === "screen"
    ) return;
    if (!isEnabled && state.screenSharerSocketId && state.screenSharerSocketId !== this.id) return;

    await this.screenDisconnectRegistration?.cancel().catch(() => {});
    this.screenDisconnectRegistration = null;
    if (isEnabled) {
      this.screenDisconnectRegistration = onDisconnect(this.roomRef(roomId));
      await this.screenDisconnectRegistration.update({
        "state/contentType": state.videoId ? "youtube" : null,
        "state/screenSharerSocketId": null,
      });
    }

    const timestamp = this.now();
    const updates = {
      "state/contentType": isEnabled ? "screen" : state.videoId ? "youtube" : null,
      "state/screenSharerSocketId": isEnabled ? this.id : null,
      "state/lastUpdateTime": timestamp,
    };
    if (isEnabled && state.isPlaying) {
      const position =
        (state.currentTime || 0) +
        ((timestamp - (state.playStartTime || timestamp)) / 1000) *
          (state.playbackRate || 1);
      updates["state/isPlaying"] = false;
      updates["state/currentTime"] = position;
      updates["state/playStartTime"] = null;
      const pauseRef = push(this.roomRef(roomId, "events"));
      updates[`events/${pauseRef.key}`] = {
        type: "pause-synced",
        payload: {
          action: "pause",
          position,
          timestamp,
          playbackRate: state.playbackRate || 1,
        },
        originId: this.id,
        excludeSender: true,
        timestamp,
      };
    }
    const screenRef = push(this.roomRef(roomId, "events"));
    const shareRef = push(this.roomRef(roomId, "events"));
    updates[`events/${screenRef.key}`] = {
      type: "user-screen-changed",
      payload: { socketId: this.id, enabled: isEnabled },
      originId: this.id,
      excludeSender: true,
      timestamp,
    };
    updates[`events/${shareRef.key}`] = {
      type: "user-screen-share-changed",
      payload: { socketId: this.id, isSharing: isEnabled },
      originId: this.id,
      excludeSender: true,
      timestamp,
    };
    await update(this.roomRef(roomId), updates);

  }

  async updateCamera(roomId, isCameraOn) {
    if (isCameraOn) {
      await set(this.roomRef(roomId, `cameraUsers/${this.id}`), true);
    } else {
      await remove(this.roomRef(roomId, `cameraUsers/${this.id}`));
    }
    await this.pushEvent(
      roomId,
      "user-camera-changed",
      {
        socketId: this.id,
        enabled: Boolean(isCameraOn),
        isCameraOn: Boolean(isCameraOn),
      },
      true,
    );
  }

  async cancelDisconnectRegistrations() {
    await Promise.all(
      this.disconnectRegistrations.map((entry) => entry.cancel().catch(() => {})),
    );
    this.disconnectRegistrations = [];
    await this.screenDisconnectRegistration?.cancel().catch(() => {});
    this.screenDisconnectRegistration = null;
  }

  async leaveRoom() {
    if (!this.roomId) return;
    const roomId = this.roomId;
    await this.cancelDisconnectRegistrations();
    await update(this.roomRef(roomId), {
      [`participants/${this.id}`]: null,
      [`voiceUsers/${this.id}`]: null,
      [`cameraUsers/${this.id}`]: null,
      [`signals/${this.id}`]: null,
    });
    if (this.cache.state?.screenSharerSocketId === this.id) {
      await update(this.roomRef(roomId, "state"), {
        contentType: this.cache.state.videoId ? "youtube" : null,
        screenSharerSocketId: null,
      });
    }
    this.roomUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.roomUnsubscribers = [];
    this.cache = this.createCache();
    this.hasLoadedState = false;
    this.roomId = null;
  }

  disconnect() {
    if (this.manualDisconnect) return this;
    this.manualDisconnect = true;
    this.leaveRoom().catch((error) => console.error("[REALTIME] cleanup failed:", error));
    this.roomUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.roomUnsubscribers = [];
    this.connectionUnsubscribe?.();
    this.offsetUnsubscribe?.();
    if (this.connected) {
      this.connected = false;
      this.dispatch("disconnect", "io client disconnect");
    }
    return this;
  }
}

export function createRealtimeSocket() {
  return new RealtimeSocket();
}

export function subscribeToRealtimeRooms(onRooms, onError = console.error) {
  const database = getRealtimeDatabase();
  const auth = getClientAuth();
  let unsubscribe = null;
  let cancelled = false;

  auth
    .authStateReady()
    .then(() => {
      if (cancelled) return;
      if (!auth.currentUser) throw new Error("Debes iniciar sesión.");
      unsubscribe = onValue(
        ref(database, ROOT_PATH),
        (snapshot) => {
          const rooms = Object.entries(snapshot.val() || {})
            .map(([roomId, room]) => {
              const state = room?.state || {};
              const users = valuesWithIds(room?.participants);
              return {
                roomId,
                title: state.title || "",
                videoId: state.videoId || null,
                contentType: state.contentType || null,
                users,
                userCount: users.length,
                isPlaying: Boolean(state.isPlaying),
                status: state.status || "active",
              };
            })
            .filter((room) => room.status !== "deleted" && room.userCount > 0);
          onRooms(rooms);
        },
        onError,
      );
    })
    .catch(onError);

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
