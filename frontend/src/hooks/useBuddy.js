import { useCallback, useEffect, useRef, useState } from "react";
import { socketUrl } from "../api.js";
import { BrowserListener } from "../audio/browserListener.js";
import { Microphone } from "../audio/microphone.js";
import { SpeechPlayer } from "../audio/player.js";
import { toBase64 } from "../audio/wav.js";

const NAP_AFTER_MS = 60_000; // go back to sleep after a minute of nobody talking
const TAP_TO_HEAR = "Tap anywhere on the page so you can hear Buddy.";
const GIVE_UP_LISTENING_MS = 2500; // heard a noise but no words came through
const LONGEST_WAKE_CHECK_BYTES = 16000 * 2 * 4; // "Hey Buddy" fits easily in 4 seconds

/**
 * Everything about the live conversation: the WebSocket, the mic, Buddy's
 * voice and what state he's in. States:
 *   asleep -> idle -> listening -> thinking -> speaking -> idle ...
 */
export function useBuddy({ conversationId, provider, mode, onConversation, onTitle }) {
  const [state, setState] = useState("asleep");
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState(null);
  const [waving, setWaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listenWhere, setListenWhere] = useState("server");

  const ws = useRef(null);
  const mic = useRef(null);
  const player = useRef(null);
  // "browser": the browser turns speech into text (free setup). "server": we send the audio.
  const listenMode = useRef("server");
  const listener = useRef(null);
  const quietTimer = useRef(null);
  const stateRef = useRef(state);
  const napTimer = useRef(null);
  const wakeRef = useRef(null);
  const settingsRef = useRef({ conversationId, provider, mode });
  settingsRef.current = { conversationId, provider, mode };
  const callbacks = useRef({ onConversation, onTitle });
  callbacks.current = { onConversation, onTitle };

  const changeState = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    clearTimeout(napTimer.current);
    if (next === "idle") {
      napTimer.current = setTimeout(() => {
        mic.current?.setListening(false);
        listener.current?.stop();
        changeState("asleep");
      }, NAP_AFTER_MS);
    }
  }, []);

  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(message));
  }, []);

  const addToLastReply = (text) =>
    setMessages((list) => {
      const last = list[list.length - 1];
      if (last?.role === "assistant" && last.live) {
        return [...list.slice(0, -1), { ...last, content: `${last.content} ${text}`.trim() }];
      }
      return [...list, { role: "assistant", content: text, live: true }];
    });

  // live captions of what the user is saying (free setup only)
  const showUserText = (text, live) =>
    setMessages((list) => {
      const last = list[list.length - 1];
      if (last?.role === "user" && last.live) return [...list.slice(0, -1), { role: "user", content: text, live }];
      return [...list, { role: "user", content: text, live }];
    });

  const finishLastReply = (extra = {}) =>
    setMessages((list) =>
      list.map((m, i) => (i === list.length - 1 && m.live ? { ...m, live: false, ...extra } : m))
    );

  // cut Buddy off, e.g. because the user started talking
  const interrupt = useCallback(() => {
    player.current?.stop();
    mic.current && (mic.current.strict = false);
    send({ type: "interrupt" });
    finishLastReply({ interrupted: true });
    if (listenMode.current === "browser" && mic.current?.listening) listener.current?.start();
  }, [send]);

  // --- server messages ---
  const handleServerMessage = useCallback(
    (message) => {
      switch (message.type) {
        case "ready":
          listenMode.current = message.listen || "server";
          setListenWhere(listenMode.current);
          if (message.conversation_id !== settingsRef.current.conversationId) {
            callbacks.current.onConversation?.(message.conversation_id);
          }
          break;
        case "transcript":
          setMessages((list) => [...list, { role: "user", content: message.text }]);
          break;
        case "title":
          callbacks.current.onTitle?.(message.title);
          break;
        case "thinking":
          setSuggestions([]);
          changeState("thinking");
          break;
        case "speech":
          player.current.add(message.index, message.audio, message.text, message.format);
          break;
        case "done":
          setLatency(message.latency);
          player.current.finishReply();
          break;
        case "suggestions":
          setSuggestions(message.items);
          break;
        case "wake":
          if (stateRef.current === "asleep") wakeRef.current?.({ byVoice: true });
          break;
        case "nothing_heard":
          changeState("idle");
          break;
        case "error":
          setError(message.message);
          player.current.stop();
          finishLastReply();
          changeState(mic.current?.listening ? "idle" : "asleep");
          break;
        default:
          break;
      }
    },
    [changeState]
  );

  // --- the WebSocket, with automatic reconnecting ---
  useEffect(() => {
    let closed = false;
    let retry;

    function connect() {
      const socket = new WebSocket(socketUrl());
      ws.current = socket;
      socket.onopen = () => {
        const { conversationId, provider, mode } = settingsRef.current;
        socket.send(JSON.stringify({ type: "hello", conversation_id: conversationId, provider, mode }));
      };
      socket.onmessage = (event) => handleServerMessage(JSON.parse(event.data));
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1500);
      };
    }

    player.current = new SpeechPlayer({
      onSentence: (text) => {
        if (mic.current) mic.current.strict = true;
        // stop the browser from transcribing Buddy's own voice; the mic still catches interruptions
        listener.current?.stop();
        addToLastReply(text);
        changeState("speaking");
      },
      onFinished: () => {
        if (mic.current) mic.current.strict = false;
        finishLastReply();
        const awake = mic.current?.listening;
        if (awake && listenMode.current === "browser") listener.current?.start();
        changeState(awake ? "idle" : "asleep");
      },
    });

    listener.current = new BrowserListener({
      onInterim: (text) => {
        clearTimeout(quietTimer.current);
        showUserText(text, true);
        if (stateRef.current !== "thinking") changeState("listening");
      },
      onFinal: (text) => {
        clearTimeout(quietTimer.current);
        if (stateRef.current === "speaking" || stateRef.current === "thinking") interrupt();
        showUserText(text, false);
        send({ type: "text", text });
        changeState("thinking");
      },
      onError: setError,
    });

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(napTimer.current);
      ws.current?.close();
      player.current?.stop();
      mic.current?.stop();
      listener.current?.stop();
    };
  }, [handleServerMessage, changeState, interrupt, send]);

  // switching chats: tell the server which conversation we're in now
  useEffect(() => {
    if (stateRef.current === "speaking" || stateRef.current === "thinking") interrupt();
    send({ type: "hello", conversation_id: conversationId, provider, mode });
    setSuggestions([]);
    // provider and mode changes are sent separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    send({ type: "settings", provider, mode });
  }, [provider, mode, send]);

  // --- microphone ---
  const startMic = useCallback(async () => {
    if (mic.current) return true;
    const microphone = new Microphone({
      onSpeechStart: () => {
        if (stateRef.current === "asleep") return; // just checking for "Hey Buddy"
        if (stateRef.current === "speaking" || stateRef.current === "thinking") interrupt();
        changeState("listening");
      },
      onSpeechEnd: (wav) => {
        if (stateRef.current === "asleep") {
          // asleep: only ask the server whether this was "Hey Buddy"
          if (wav.byteLength <= LONGEST_WAKE_CHECK_BYTES) send({ type: "wake_check", data: toBase64(wav) });
          return;
        }
        if (listenMode.current === "browser") {
          // the browser sends the words itself; if none come, it was probably just noise
          clearTimeout(quietTimer.current);
          quietTimer.current = setTimeout(() => {
            if (stateRef.current === "listening") changeState("idle");
          }, GIVE_UP_LISTENING_MS);
          return;
        }
        send({ type: "audio", mime: "audio/wav", data: toBase64(wav) });
        changeState("thinking");
      },
    });
    try {
      await microphone.start();
      mic.current = microphone;
      return true;
    } catch {
      setError("I can't hear you. Allow microphone access in your browser, or type to me instead.");
      return false;
    }
  }, [changeState, interrupt, send]);

  const unlockAudio = useCallback(() => {
    player.current?.ensureContext();
    setError((current) => (current === TAP_TO_HEAR ? null : current));
  }, []);

  // "Hey Buddy" or the Hi button
  const wake = useCallback(async ({ byVoice = false } = {}) => {
    player.current?.ensureContext();
    setError(null);
    if (byVoice && player.current?.context?.state === "suspended") {
      // woken by voice before the page was ever clicked: he can hear you but can't talk yet
      setError(TAP_TO_HEAR);
    }
    setWaving(true);
    setTimeout(() => setWaving(false), 2500);
    if (await startMic()) mic.current.setListening(!muted);
    // give the "Hey Buddy" listener a moment to let go of the mic first
    if (listenMode.current === "browser" && !muted) setTimeout(() => listener.current?.start(), 400);
    setMessages((list) => [...list, { role: "user", content: "Hey Buddy!" }]);
    send({ type: "text", text: "Hey Buddy!" });
    changeState("thinking");
  }, [changeState, muted, send, startMic]);

  wakeRef.current = wake;

  // when the server does the listening (the desktop app), it also listens for "Hey Buddy"
  useEffect(() => {
    if (state !== "asleep" || listenWhere !== "server" || muted) return;
    startMic().then((ok) => ok && mic.current.setListening(true));
  }, [state, listenWhere, muted, startMic]);

  const sendText = useCallback(
    (text) => {
      if (!text.trim()) return;
      player.current?.ensureContext();
      setError(null);
      if (stateRef.current === "speaking" || stateRef.current === "thinking") interrupt();
      setMessages((list) => [...list, { role: "user", content: text }]);
      send({ type: "text", text });
      changeState("thinking");
    },
    [changeState, interrupt, send]
  );

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const listening = wasMuted && stateRef.current !== "asleep";
      mic.current?.setListening(listening);
      if (listening && listenMode.current === "browser") listener.current?.start();
      else listener.current?.stop();
      return !wasMuted;
    });
  }, []);

  // what Buddy's animation follows: his own voice when talking, yours otherwise
  const getLevel = useCallback(() => {
    if (stateRef.current === "speaking") return player.current?.level || 0;
    if (stateRef.current === "listening") return Math.min((mic.current?.level || 0) * 8, 1);
    return 0;
  }, []);

  return {
    state, listenWhere, messages, setMessages, suggestions, latency, error, setError,
    waving, muted, wake, sendText, interrupt, toggleMute, getLevel, unlockAudio,
  };
}
