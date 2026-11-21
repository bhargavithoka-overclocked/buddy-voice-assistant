const STARTERS = [
  "Tell me a joke",
  "What should I cook tonight?",
  "Teach me something cool",
  "Help me plan my weekend",
];

function Latency({ latency }) {
  if (!latency) return null;
  const rows = [
    ["Heard you", latency.transcribed_ms],
    ["First word written", latency.first_token_ms],
    ["Started talking", latency.first_audio_ms],
    ["Whole reply", latency.total_ms],
  ].filter(([, ms]) => ms !== undefined);

  return (
    <section className="latency">
      <h3>Last reply</h3>
      {rows.map(([label, ms]) => (
        <div key={label} className="row">
          <span>{label}</span>
          <span>{ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>
        </div>
      ))}
    </section>
  );
}

export default function SidePanel({ suggestions, isNewChat, onPick, latency, busy }) {
  const items = suggestions.length ? suggestions : isNewChat ? STARTERS : [];

  return (
    <aside className="side-panel">
      <section>
        <h3>{suggestions.length ? "You could say..." : "Ideas to start"}</h3>
        {items.length === 0 && <p className="hint">{busy ? "Thinking of ideas..." : "Suggestions will show up here."}</p>}
        <div className="suggestions">
          {items.map((text) => (
            <button key={text} className="suggestion" onClick={() => onPick(text)}>
              {text}
            </button>
          ))}
        </div>
      </section>
      <Latency latency={latency} />
    </aside>
  );
}
