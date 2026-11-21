import { useEffect, useRef } from "react";

const FUR = "#3d3a44";
const FUR_LIGHT = "#4c4855";
const CHEST = "#5a5463";
const SKIN = "#6f625d";
const SKIN_DARK = "#4a403d";
const MUZZLE = "#9a877c";
const SCARF = "#f08a3c";

// where each part wants to be in each state; the loop eases towards these
const POSES = {
  asleep:    { tilt: 5,  headY: 8, lean: 1,    lid: 0.8, brow: 2,  armL: 4,   armR: 4,  lookX: 0, lookY: 3,  thought: 0, zzz: 1 },
  idle:      { tilt: 0,  headY: 0, lean: 1,    lid: 0,   brow: 0,  armL: 0,   armR: 0,  lookX: 0, lookY: 0,  thought: 0, zzz: 0 },
  listening: { tilt: 7,  headY: 4, lean: 1.04, lid: 0,   brow: -4, armL: -4,  armR: -4, lookX: 0, lookY: 1,  thought: 0, zzz: 0 },
  thinking:  { tilt: -6, headY: 0, lean: 1,    lid: 0.1, brow: 3,  armL: 155, armR: 0,  lookX: 4, lookY: -5, thought: 1, zzz: 0 },
  speaking:  { tilt: 0,  headY: 0, lean: 1.02, lid: 0,   brow: -2, armL: 6,   armR: 6,  lookX: 0, lookY: 0,  thought: 0, zzz: 0 },
};

const ease = (current, target, dt, speed) => current + (target - current) * (1 - Math.exp(-dt * speed));

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

export default function Buddy({ state = "idle", waving = false, getLevel = () => 0 }) {
  const svg = useRef(null);
  const props = useRef({ state, waving, getLevel });
  props.current = { state, waving, getLevel };

  useEffect(() => {
    const root = svg.current;
    const $ = (selector) => root.querySelector(selector);
    const $$ = (selector) => [...root.querySelectorAll(selector)];
    const parts = {
      body: $(".body"),
      head: $(".head"),
      armL: $(".arm-left"),
      armR: $(".arm-right"),
      pupils: $$(".pupil"),
      lids: $$(".eyelid"),
      brows: $(".brows"),
      mouthOpen: $(".mouth-open"),
      smile: $(".smile"),
      thought: $(".thought"),
      zzz: $(".zzz"),
    };

    const now = { ...POSES.idle, mouth: 0, blink: 0, wave: 0 };
    let last = performance.now();
    let nextBlink = last + 2000;
    let nextGlance = last + 3000;
    let glance = { x: 0, y: 0 };
    let previousState = props.current.state;
    let surprisedUntil = 0;
    let frame;

    function tick(time) {
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;
      const t = time / 1000;
      const { state, waving, getLevel } = props.current;
      const level = getLevel();
      const pose = POSES[state] || POSES.idle;

      // cut off mid-sentence: a quick surprised look
      if (previousState === "speaking" && state === "listening") surprisedUntil = time + 700;
      previousState = state;
      const surprised = time < surprisedUntil;

      // glance around now and then when there's nothing going on
      if (time > nextGlance) {
        glance = state === "idle" ? { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 4 } : { x: 0, y: 0 };
        nextGlance = time + 1500 + Math.random() * 3000;
      }

      // blink every few seconds
      if (time > nextBlink) {
        now.blink = 1;
        nextBlink = time + 2000 + Math.random() * 4000;
      }
      now.blink = ease(now.blink, 0, dt, 18);

      for (const key of ["tilt", "headY", "lean", "lid", "brow", "armL", "armR", "thought", "zzz"]) {
        now[key] = ease(now[key], pose[key], dt, key.startsWith("arm") ? 6 : 8);
      }
      now.lookX = ease(now.lookX, pose.lookX + glance.x, dt, 6);
      now.lookY = ease(now.lookY, pose.lookY + glance.y, dt, 6);
      now.wave = ease(now.wave, waving ? 1 : 0, dt, 5);

      const talking = state === "speaking" ? level : 0;
      now.mouth = ease(now.mouth, surprised ? 0.45 : talking, dt, 25);

      // breathing, nodding along while the user talks, bobbing while he talks
      const breathe = Math.sin(t * (state === "asleep" ? 1.2 : 2)) * (state === "asleep" ? 0.02 : 0.008);
      const nod = state === "listening" ? level * 5 : 0;
      const bob = state === "speaking" ? Math.sin(t * 9) * talking * 3 : 0;
      const scratch = state === "thinking" ? Math.sin(t * 10) * 6 : 0;
      const gesture = state === "speaking" ? Math.sin(t * 2.5) * 8 * (0.4 + talking) : 0;
      const waveArm = now.wave * (150 + Math.sin(t * 12) * 18);

      parts.body.setAttribute("transform", `translate(200 404) scale(1 ${1 + breathe}) translate(-200 -404)`);
      parts.head.setAttribute(
        "transform",
        `translate(0 ${now.headY + nod + bob}) rotate(${now.tilt} 200 230) translate(200 230) scale(${now.lean}) translate(-200 -230)`
      );
      parts.armL.setAttribute("transform", `rotate(${now.armL + scratch + gesture} 135 255)`);
      parts.armR.setAttribute("transform", `rotate(${Math.max(now.armR - gesture, waveArm)} 135 255)`);

      for (const pupil of parts.pupils) pupil.setAttribute("transform", `translate(${now.lookX} ${now.lookY})`);
      const lid = Math.max(now.lid, now.blink);
      for (const eyelid of parts.lids) eyelid.setAttribute("transform", `translate(0 ${lid * 34})`);
      parts.brows.setAttribute("transform", `translate(0 ${surprised ? -9 : now.brow})`);

      parts.mouthOpen.setAttribute("transform", `scale(1 ${Math.max(now.mouth, 0.001)})`);
      parts.smile.setAttribute("opacity", String(1 - Math.min(now.mouth * 4, 1)));
      parts.thought.setAttribute("opacity", now.thought.toFixed(3));
      parts.zzz.setAttribute("opacity", now.zzz.toFixed(3));

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg ref={svg} className={`buddy ${state}`} viewBox="0 0 400 420" role="img" aria-label={`Buddy the gorilla, ${state}`}>
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
            <g className="mouth-open">
              <ellipse rx="16" ry="13" fill="#3b1e1e" />
              <ellipse cy="6" rx="9" ry="5" fill="#d9706f" />
            </g>
          </g>
        </g>
      </g>

      <g className="thought" opacity="0">
        <circle cx="282" cy="96" r="5" fill="#fff" opacity="0.85" />
        <circle cx="296" cy="76" r="8" fill="#fff" opacity="0.9" />
        <ellipse cx="330" cy="44" rx="40" ry="26" fill="#fff" />
        <circle className="dot" cx="314" cy="44" r="4.5" fill="#6b6375" />
        <circle className="dot" cx="330" cy="44" r="4.5" fill="#6b6375" />
        <circle className="dot" cx="346" cy="44" r="4.5" fill="#6b6375" />
      </g>

      <g className="zzz" opacity="0" fill="#b9b2c6" fontWeight="700" fontFamily="sans-serif">
        <text x="276" y="100" fontSize="16">z</text>
        <text x="292" y="78" fontSize="22">z</text>
        <text x="312" y="52" fontSize="30">Z</text>
      </g>
    </svg>
  );
}
