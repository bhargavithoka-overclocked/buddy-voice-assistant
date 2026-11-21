import { useState } from "react";

function ConversationItem({ conversation, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);

  function save() {
    setEditing(false);
    if (title.trim() && title !== conversation.title) onRename(conversation.id, title.trim());
    else setTitle(conversation.title);
  }

  if (editing) {
    return (
      <li className="conversation editing">
        <input
          autoFocus
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setTitle(conversation.title);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className={`conversation ${active ? "active" : ""}`} onClick={() => onSelect(conversation.id)}>
      <span className="title" title={conversation.title}>{conversation.title}</span>
      <span className="actions">
        <button title="Rename" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>✎</button>
        <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}>✕</button>
      </span>
    </li>
  );
}

export default function Sidebar({ conversations, activeId, onNew, onSelect, onRename, onDelete }) {
  return (
    <aside className="sidebar">
      <div className="brand">🦍 Buddy</div>
      <button className="new-chat" onClick={onNew}>+ New chat</button>
      <ul className="conversations">
        {conversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>
      {conversations.length === 0 && <p className="hint">Your chats with Buddy will show up here.</p>}
    </aside>
  );
}
