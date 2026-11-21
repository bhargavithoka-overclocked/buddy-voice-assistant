import { useEffect, useRef } from "react";

export default function ChatLog({ messages }) {
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="chat-log">
      {messages.map((message, i) => (
        <div key={i} className={`bubble ${message.role}`}>
          {message.content}
          {message.interrupted && <span className="cut-off"> (cut off)</span>}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
