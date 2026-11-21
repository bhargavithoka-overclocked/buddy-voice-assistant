import { useState } from "react";

export default function TypeBox({ onSend }) {
  const [text, setText] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form className="type-box" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Or type to Buddy..."
        maxLength={2000}
      />
      <button type="submit" disabled={!text.trim()}>Send</button>
    </form>
  );
}
