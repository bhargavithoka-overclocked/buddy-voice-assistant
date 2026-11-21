import { useEffect, useRef, useState } from "react";
import ChatLog from "./components/ChatLog.jsx";
import { useBuddy } from "./hooks/useBuddy.js";

const STATUS = {
  asleep: "Tap Hi to start",
  idle: "I'm listening...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "",
};

// placeholder until Buddy himself is drawn
function Orb({ getLevel }) {
  const ref = useRef(null);
  useEffect(() => {
    let frame;
    const tick = () => {
      ref.current.style.transform = `scale(${1 + getLevel() * 0.4})`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [getLevel]);
  return <div ref={ref} className="orb" />;
}

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
        <Orb getLevel={buddy.getLevel} />
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
