export default function TopBar({ provider, mode, onProvider, onMode, onSettings, muted, onMute, micOn }) {
  return (
    <div className="top-bar">
      <div className="segmented" role="group" aria-label="Speed">
        <button className={mode === "fast" ? "on" : ""} onClick={() => onMode("fast")} title="Quicker replies">
          ⚡ Fast
        </button>
        <button className={mode === "smart" ? "on" : ""} onClick={() => onMode("smart")} title="Better answers, a bit slower">
          🧠 Smart
        </button>
      </div>

      <select value={provider} onChange={(e) => onProvider(e.target.value)} aria-label="AI model">
        <option value="ollama">Local (free)</option>
        <option value="gemini">Gemini (free)</option>
        <option value="claude">Claude</option>
        <option value="openai">ChatGPT</option>
      </select>

      <div className="spacer" />

      {micOn && (
        <button className={`icon-button ${muted ? "muted" : ""}`} onClick={onMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🎙️"}
        </button>
      )}
      <button className="icon-button" onClick={onSettings} title="Settings">⚙️</button>
    </div>
  );
}
