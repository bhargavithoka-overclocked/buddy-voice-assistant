import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Buddy from "./components/Buddy.jsx";
import ChatLog from "./components/ChatLog.jsx";
import SidePanel from "./components/SidePanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TypeBox from "./components/TypeBox.jsx";
import { useBuddy } from "./hooks/useBuddy.js";

const STATUS = {
  asleep: "Tap Hi to start",
  idle: "I'm listening...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "",
};

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);

  const refreshList = useCallback(() => {
    api.listConversations().then(setConversations).catch(() => {});
  }, []);

  const buddy = useBuddy({
    conversationId,
    provider: "claude",
    mode: "fast",
    onConversation: (id) => {
      setConversationId(id);
      refreshList();
    },
    onTitle: refreshList,
  });
  const { setMessages } = buddy;

  useEffect(refreshList, [refreshList]);

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
    <div className="app">
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
        <Buddy state={buddy.state} waving={buddy.waving} getLevel={buddy.getLevel} />
        <p className="status">{STATUS[buddy.state]}</p>
        {buddy.state === "asleep" && (
          <button className="hi-button" onClick={buddy.wake}>Hi 👋</button>
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
    </div>
  );
}
