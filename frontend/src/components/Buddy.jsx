const FUR = "#3d3a44";
const FUR_LIGHT = "#4c4855";
const CHEST = "#5a5463";
const SKIN = "#6f625d";
const SKIN_DARK = "#4a403d";
const MUZZLE = "#9a877c";
const SCARF = "#f08a3c";

function Arm({ side }) {
  // drawn for the left side, mirrored for the right
  const flip = side === "right" ? "translate(400 0) scale(-1 1)" : undefined;
  return (
    <g transform={flip}>
      <g className={`arm arm-${side}`}>
        <path d="M128 248 C88 262 70 330 78 384 C81 402 116 403 119 388 C122 342 136 302 152 272 Z" fill={FUR} />
        <ellipse cx="98" cy="392" rx="27" ry="16" fill={SKIN} />
        <path d="M84 392 q4 7 8 0 M96 394 q4 7 8 0" stroke={SKIN_DARK} strokeWidth="2" fill="none" />
      </g>
    </g>
  );
}

function Eye({ x }) {
  return (
    <g>
      <clipPath id={`eye-${x}`}>
        <ellipse cx={x} cy="140" rx="13" ry="14" />
      </clipPath>
      <ellipse cx={x} cy="140" rx="13" ry="14" fill="#fff" />
      <g clipPath={`url(#eye-${x})`}>
        <g className="pupil">
          <circle cx={x} cy="141" r="7.5" fill="#2a1f1a" />
          <circle cx={x + 2.5} cy="138" r="2.5" fill="#fff" />
        </g>
        {/* sits just above the eye; sliding it down is a blink */}
        <rect className="eyelid" x={x - 15} y="92" width="30" height="32" fill={SKIN} />
      </g>
    </g>
  );
}

export default function Buddy() {
  return (
    <svg className="buddy" viewBox="0 0 400 420" role="img" aria-label="Buddy the gorilla">
      <ellipse cx="200" cy="405" rx="125" ry="12" fill="rgba(0,0,0,0.35)" />

      <g className="body">
        <path d="M92 404 C78 300 112 222 200 216 C288 222 322 300 308 404 Z" fill={FUR} />
        <path d="M142 400 C136 322 162 272 200 270 C238 272 264 322 258 400 Z" fill={CHEST} />
        <path d="M160 300 q40 18 80 0" stroke={FUR} strokeWidth="3" fill="none" opacity="0.5" />

        <Arm side="left" />
        <Arm side="right" />

        <g className="scarf">
          <path d="M138 232 C170 254 230 254 262 232 L264 252 C230 274 170 274 136 252 Z" fill={SCARF} />
          <path d="M232 258 L252 304 L236 308 L220 262 Z" fill={SCARF} />
        </g>

        <g className="head">
          <circle cx="116" cy="150" r="19" fill={FUR} />
          <circle cx="116" cy="150" r="9" fill={SKIN} />
          <circle cx="284" cy="150" r="19" fill={FUR} />
          <circle cx="284" cy="150" r="9" fill={SKIN} />

          <path d="M120 172 C108 92 158 46 200 46 C242 46 292 92 280 172 C274 214 240 236 200 236 C160 236 126 214 120 172 Z" fill={FUR} />
          <path d="M184 50 q10 -16 16 -4 q8 -14 14 4" fill={FUR_LIGHT} />

          <path d="M200 96 C168 84 140 100 140 136 C140 172 152 206 200 216 C248 206 260 172 260 136 C260 100 232 84 200 96 Z" fill={SKIN} />

          <Eye x={175} />
          <Eye x={225} />

          <g className="brows">
            <path d="M142 120 C158 102 188 106 199 115 C210 106 242 102 258 120 C250 128 214 123 200 128 C186 123 150 128 142 120 Z" fill={SKIN_DARK} />
          </g>

          <ellipse cx="160" cy="182" rx="9" ry="6" fill={SCARF} opacity="0.25" />
          <ellipse cx="240" cy="182" rx="9" ry="6" fill={SCARF} opacity="0.25" />

          <ellipse cx="200" cy="184" rx="46" ry="32" fill={MUZZLE} />
          <ellipse cx="191" cy="170" rx="5" ry="3.5" fill={SKIN_DARK} />
          <ellipse cx="209" cy="170" rx="5" ry="3.5" fill={SKIN_DARK} />

          <g className="mouth" transform="translate(200 197)">
            <path className="smile" d="M-17 0 Q0 10 17 0" stroke={SKIN_DARK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </g>
        </g>
      </g>
    </svg>
  );
}
