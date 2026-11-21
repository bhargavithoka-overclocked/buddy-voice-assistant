import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { WakeWordListener, wakeWordSupported } from "./audio/wakeWord.js";
import Buddy from "./components/Buddy.jsx";
import ChatLog from "./components/ChatLog.jsx";
import Settings from "./components/Settings.jsx";
import SidePanel from "./components/SidePanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import TypeBox from "./components/TypeBox.jsx";
import { useBuddy } from "./hooks/useBuddy.js";

const STATUS = {
  asleep: wakeWordSupported ? 'Say "Hey Buddy" or tap Hi' : "Tap Hi to start",
  idle: "I'm listening...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "",
};

// remember the Fast/Smart and Claude/ChatGPT choice between visits
function useSavedChoice(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  });
  const save = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // private browsing etc, it just won't be remembered
    }
  };
  return [value, save];
}

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [provider, setProvider] = useSavedChoice("buddy.provider", "claude");
  const [mode, setMode] = useSavedChoice("buddy.mode", "fast");
  const [showSettings, setShowSettings] = useState(false);

  const refreshList = useCallback(() => {
    api.listConversations().then(setConversations).catch(() => {});
  }, []);

  const buddy = useBuddy({
    conversationId,
    provider,
    mode,
    onConversation: (id) => {
      setConversationId(id);
      refreshList();
    },
    onTitle: refreshList,
  });
  const { setMessages } = buddy;

  useEffect(refreshList, [refreshList]);

  // listen for "Hey Buddy" whenever he's asleep
  const wakeWord = useRef(null);
  const wakeRef = useRef(buddy.wake);
  wakeRef.current = buddy.wake;
  useEffect(() => {
    const listener = new WakeWordListener(() => wakeRef.current({ byVoice: true }));
    wakeWord.current = listener;
    return () => listener.stop();
  }, []);
  useEffect(() => {
    if (buddy.state === "asleep") wakeWord.current.start();
    else wakeWord.current.stop();
  }, [buddy.state]);

  // load the history whenever we switch to a chat
  useEffect(() => {
    if (!conversationId) return;
    api
      .getConversation(conversationId)
      .then((c) => setMessages(c.messages.map(({ role, content, interrupted }) => ({ role, content, interrupted }))))
      .catch(() => {});
  }, [conversationId, setMessages]);

  function newChat() {
    setMessages([]);
    setConversationId(null);
  }

  async function renameChat(id, title) {
    await api.renameConversation(id, title);
    refreshList();
  }

  async function deleteChat(id) {
    if (!confirm("Delete this chat?")) return;
    await api.deleteConversation(id);
    if (id === conversationId) newChat();
    refreshList();
  }

  return (
    // browsers only let a page play sound after it's been clicked at least once
    <div className="app" onPointerDown={buddy.unlockAudio}>
      <Sidebar
        // chats only get a real title once something's been said, so skip the empty ones
        conversations={conversations.filter((c) => c.title !== "New chat" || c.id === conversationId)}
        activeId={conversationId}
        onNew={newChat}
        onSelect={setConversationId}
        onRename={renameChat}
        onDelete={deleteChat}
      />

      <main className="stage">
        <TopBar
          provider={provider}
          mode={mode}
          onProvider={setProvider}
          onMode={setMode}
          onSettings={() => setShowSettings(true)}
          muted={buddy.muted}
          onMute={buddy.toggleMute}
          micOn={buddy.state !== "asleep"}
        />
        <Buddy state={buddy.state} waving={buddy.waving} getLevel={buddy.getLevel} />
        <p className="status">{STATUS[buddy.state]}</p>
        {buddy.state === "asleep" && (
          <button className="hi-button" onClick={() => buddy.wake()}>Hi 👋</button>
        )}
        {buddy.error && <p className="error">{buddy.error}</p>}
        <ChatLog messages={buddy.messages} />
        <TypeBox onSend={buddy.sendText} />
      </main>

      <SidePanel
        suggestions={buddy.suggestions}
        isNewChat={buddy.messages.length === 0}
        onPick={buddy.sendText}
        latency={buddy.latency}
        busy={buddy.state === "thinking" || buddy.state === "speaking"}
      />

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
