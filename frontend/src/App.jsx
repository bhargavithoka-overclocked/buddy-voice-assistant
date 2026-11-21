import { useState } from "react";
import Buddy from "./components/Buddy.jsx";
import ChatLog from "./components/ChatLog.jsx";
import { useBuddy } from "./hooks/useBuddy.js";

const STATUS = {
  asleep: "Tap Hi to start",
  idle: "I'm listening...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "",
};

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const buddy = useBuddy({
    conversationId,
    provider: "claude",
    mode: "fast",
    onConversation: setConversationId,
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">🦍 Buddy</div>
      </aside>

      <main className="stage">
        <Buddy />
        <p className="status">{STATUS[buddy.state]}</p>
        {buddy.state === "asleep" && (
          <button className="hi-button" onClick={buddy.wake}>Hi 👋</button>
        )}
        {buddy.error && <p className="error">{buddy.error}</p>}
        <ChatLog messages={buddy.messages} />
      </main>

      <aside className="side-panel" />
    </div>
  );
}
