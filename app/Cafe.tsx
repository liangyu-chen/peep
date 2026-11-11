'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CafeContent } from '@/src/content/catalog';
import '@/src/cafe/cafe.css';
import LoadingHands from './LoadingHands';

// little pixel-art icons for the tiles: '#' is a lit pixel, drawn in the tile's text colour with hard edges
const CUP = ['...#..#.....', '..#..#......', '...#..#.....', '............', '.#########..', '.#.......###', '.#.......#.#',
  '.#.......#.#', '.#.......###', '..#.....#...', '...#####....', '############'];
// a speaker, sounding or crossed out (the phone's one switch for the music and sound effects)
const SPEAKER = ['....#.......', '...##...#...', '..###....#..', '####.#.#..#.', '####.#..#.#.', '####.#..#.#.', '####.#.#..#.',
  '..###....#..', '...##...#...', '....#.......', '............', '............'];
const SPEAKER_OFF = ['....#.......', '...##.......', '..###.......', '####.#.#...#', '####.#..#.#.', '####.#...#..', '####.#..#.#.',
  '..###..#...#', '...##.......', '....#.......', '............', '............'];
// a snowflake, for the AC remote's cooling mode
const SNOW = ['#....#....#', '.#...#...#.', '..#..#..#..', '...#.#.#...', '###########', '...#.#.#...', '..#..#..#..', '.#...#...#.',
  '#....#....#'];
// a sun, for its heating mode
const SUN = ['.....#.....', '..#..#..#..', '...#.#.#...', '....###....', '##.#####.##', '....###....', '...#.#.#...', '..#..#..#..',
  '.....#.....'];
// a water drop, for its drying mode
const DROP = ['.....#.....', '....###....', '....###....', '...#####...', '...#####...', '..#######..', '..#######..', '..#######..',
  '...#####...', '....###....'];
// a pinwheel, for its fan-only (送風) mode
const FAN = ['...##......', '...###.....', '....##..##.', '.....#.###.', '....###....', '.###.#.....', '.##..##....', '.....###...',
  '......##...'];
// the louvre icons on the LCD, drawn the way a real remote's LCD draws them: five solid wedge segments fanning out
// from the unit, the one the flap is held at lit and the rest ghosted. 上下風擺 is the unit seen from the side (a
// rounded outline at the right) with the wedges dropping from level-left to straight down; 左右風擺 is the unit seen
// from the front (a long rounded outline, its outlet a solid bar) with the wedges spread left to right beneath it,
// their tops and bottoms cut level. While a louvre swings (自動) the screen shows words instead of the icon
const wedge = (cx: number, cy: number, r0: number, r1: number, mid: number, span: number) => {
  const p = (r: number, d: number) => `${(cx + r * Math.cos((d * Math.PI) / 180)).toFixed(2)} ${(cy + r * Math.sin((d * Math.PI) / 180)).toFixed(2)}`;
  const a0 = mid - span / 2, a1 = mid + span / 2;
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
};
function LouvreIcon({ dir, id }: { dir: 'h' | 'v'; id: string }) {
  if (dir === 'v') return (
    <svg id={id} className="acLouvre v" viewBox="0 0 28 22" aria-hidden="true">
      <rect className="unitLine" x={19.6} y={0.8} width={7} height={12} rx={3.4} />
      {[172, 153, 134, 115, 96].map((m, i) => <path key={i} className="ray" d={wedge(19.6, 7, 3.8, 15, m, 14)} />)}
    </svg>
  );
  return (
    <svg id={id} className="acLouvre h" viewBox="0 0 34 22" aria-hidden="true">
      <defs><clipPath id={`${id}Clip`}><rect x={0} y={10.6} width={34} height={10.6} /></clipPath></defs>
      <rect className="unitLine" x={0.8} y={0.8} width={32.4} height={8.4} rx={2.6} />
      <rect className="unit" x={3.6} y={5} width={27} height={2.6} rx={0.8} />
      <g clipPath={`url(#${id}Clip)`}>
        {[127, 108.5, 90, 71.5, 53].map((m, i) => <path key={i} className="ray" d={wedge(17, -5, 10, 32, m, 12.5)} />)}
      </g>
    </svg>
  );
}
// the remote's screen, lit like an old digital watch: seven bars a digit, the bars it isn't using left ghosted.
// Which bars each digit lights is worked out in the CSS from the data-val on .acDigit, so hud.js only swaps digits
function SegDigits({ value }: { value: number }) {
  const digits = String(value).padStart(2, ' ');
  return (
    <span className="acSeg" id="acSeg">
      {[...digits].map((ch, i) => (
        <span className="acDigit" key={i} data-val={ch === ' ' ? '' : ch}>
          {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(s => <i key={s} className={`sg ${s}`} />)}
        </span>
      ))}
    </span>
  );
}
// the remote's outline, not a plain rounded rectangle: straight down the sides, then both sides tuck in evenly below
// the keys toward a rounded foot, mirror-symmetric about the middle (x 98). Drawn in a 200 × 460 box and stretched
// to the remote's size
const SHELL = 'M26 3C60 1 136 1 170 3C186 5 195 22 195 54L193 296C192 336 186 360 184 392C182 430 156 454 98 454' +
  'C40 454 14 430 12 392C10 360 4 336 3 296L1 54C1 22 10 5 26 3Z';
function PixelIcon({ rows, className }: { rows: string[]; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}

// The HUD markup the 3D scene drives by id; the scene itself is loaded in the browser only.
export default function Cafe({ content }: { content: CafeContent }) {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);     // the scene is built and has drawn its first frames
  const [loading, setLoading] = useState(true);  // the loading screen is still up
  const done = useCallback(() => setLoading(false), []);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    import('@/src/cafe/index.js').then(({ startCafe }) => {
      if (cancelled || !root.current) return;
      stop = startCafe(root.current, content, () => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setReady(true); })));
    });
    return () => { cancelled = true; stop?.(); };
  }, [content]);

  return (
    <div className="cafe-root" ref={root}>
      <div id="stage" />
      <div id="labels" />

      <div id="topLeft">
      <section id="brand" className="win" aria-label="店況">
        <h1>窺視咖啡</h1>
        {/* the music and the sound effects on one switch: a speaker in the panel's corner */}
        <button id="soundToggle" className="soundIcon on" aria-label="聲音開關" title="聲音">
          <PixelIcon rows={SPEAKER} className="icoOn" />
          <PixelIcon rows={SPEAKER_OFF} className="icoOff" />
        </button>
        <div id="clockRow"><span id="day">週五</span><b id="clock">16:00</b><span id="openPill">營業中</span></div>
        <div className="stats">
          <div><b id="sRev">0</b><span>營收(模擬)</span></div>
          <div><b id="sCups">0</b><span>出杯</span></div>
          <div><b id="sPeople">0</b><span>店內客人</span></div>
        </div>
      </section>
      {/* the menu: a square tile under the name panel (the games are played by clicking the TV, the dartboard or the stadium) */}
      <nav className="quick" aria-label="捷徑">
        <button data-cam="menu" className="tile tileMenu" aria-label="菜單">
          <PixelIcon rows={CUP} />
          <span>MENU</span>
        </button>
      </nav>
      </div>

      <section id="controls" className="win" aria-label="控制">
        {/* phones only: fold the panel away to a small tab, and back */}
        <button id="ctrlFold" type="button" aria-label="收起控制" aria-expanded="true"><i aria-hidden="true" /></button>
        <div className="row"><span>視角</span>
          <button data-cam="overview" className="on">全景</button>
          <button data-cam="counter">吧台</button>
          <button data-cam="menu">菜單</button>
          <button data-cam="tv">電視</button>
          <button data-cam="porch">戶外區</button>
          <button data-cam="back">後場</button>
        </div>
        <div className="row"><span>時間</span>
          <button data-speed="1" className="on">1x</button>
          <button data-speed="2">2x</button>
          <button data-speed="4">4x</button>
          <button id="tagToggle" className="on">名牌</button>
        </div>
        <div className="row"><span>效能</span>
          <button data-quality="high" title="每秒 60 張、完整解析度，影子每張重算">高</button>
          <button data-quality="normal" title="每秒 30 張、解析度較低，影子只算一次：省電">低</button>
          <a href="/admin" className="adminLink">後台登入</a>
        </div>
        <div className="row soundRow"><span>聲音</span><button id="sfxToggle" className="on">音效</button><button id="musicToggle" className="on">音樂</button></div>
      </section>

      <section id="log" className="win" aria-label="店內動態">
        <h2>EVENT LOG</h2>
        <ul id="logList"></ul>
      </section>

      <section id="tvCard" className="win" aria-label="電視" title="點一下切到電視視角">
        <h2 id="tvTitle">TV</h2>
        <div id="tvLive" hidden>
          <div className="score">
            <div className="side"><span className="who" id="hName">-</span><span className="team" id="hTeam">-</span></div>
            <div className="mid"><div className="pts"><span id="hPts">0</span>:<span id="aPts">0</span></div><span id="tvClock">Q1 5:00</span></div>
            <div className="side r"><span className="who" id="aName">-</span><span className="team" id="aTeam">-</span></div>
          </div>
        </div>
        <div id="tvIdle">電視前沒人，搖桿放著。</div>
        <ul id="results"></ul>
      </section>

      <aside id="card" className="win" hidden aria-live="polite">
        <div className="head">{/* eslint-disable-next-line @next/next/no-img-element */}<img id="cAvatar" className="avatar" alt="" /><div className="who"><h3 id="cName">-</h3><span id="cKind" className="kind">-</span></div><button id="closeCard" aria-label="關閉">✕</button></div>
        <dl id="cInfo"></dl>
        <div className="status" id="cStatus">-</div>
        <button id="cInvite" className="primary" hidden>▶ 邀去打陀螺</button>
        <button id="cSmoke" hidden>來根小菸</button>
      </aside>

      <div id="hint">拖曳旋轉 · 滾輪縮放 · 點人物看資料 · 拉出冷氣遙控器</div>

      {/* the AC remote: a white handheld remote leaning out of the right edge at an angle, just the corner of its
          head showing; click it to have it fly in square-on, click the head again to let it lean back out. Off, the
          doors stand open for air and the outdoor unit's fan slows to a stop (index.js); mode, temp and fan are the
          remote's own settings, shown on its screen as a digital watch would show them */}
      <section id="acRemote" aria-label="冷氣遙控器" data-mode="cool">
        {/* the moulded body: the back shell's side wall showing below-right, the front shell with its seam, a shade
            toward the foot, a gloss from the top left, and the face panel's faint line a few px in */}
        <svg className="acShell" viewBox="0 0 200 460" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="acShellFill" x1="0" y1="0" x2="1" y2="0.55">
              <stop offset="0" stopColor="#fdfcf8" /><stop offset="0.34" stopColor="#f6f4ee" />
              <stop offset="0.68" stopColor="#ece8df" /><stop offset="1" stopColor="#ddd8cb" />
            </linearGradient>
            <linearGradient id="acShellShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.62" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="acShellGloss" x1="0" y1="0" x2="0.8" y2="0.35">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.3" stopColor="#fff" stopOpacity="0.12" />
              <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={SHELL} transform="translate(2.5 4)" fill="#b4ac9b" stroke="rgba(60,52,40,.5)" vectorEffect="non-scaling-stroke" />
          <path d={SHELL} fill="url(#acShellFill)" stroke="rgba(78,70,56,.6)" vectorEffect="non-scaling-stroke" />
          <path d={SHELL} fill="url(#acShellShade)" />
          <path d={SHELL} fill="url(#acShellGloss)" />
          <path d={SHELL} transform="translate(98 228) scale(.94 .974) translate(-98 -228)" fill="none" stroke="rgba(0,0,0,.06)"
            vectorEffect="non-scaling-stroke" />
          <path d={SHELL} transform="translate(98 229) scale(.94 .974) translate(-98 -228)" fill="none" stroke="rgba(255,255,255,.75)"
            vectorEffect="non-scaling-stroke" />
        </svg>
        <button id="acHead" type="button" aria-label="冷氣遙控器" aria-expanded="false">
          <i className="acLed" aria-hidden="true" />
          <span className="acFold" aria-hidden="true"><b>›</b>收起遙控器</span>
        </button>
        <div className="acBody">
          <div id="acScreen">
            <div className="acLcdTop">
              <span className="acMode" aria-hidden="true">
                <PixelIcon rows={SNOW} className="mCool" />
                <PixelIcon rows={SUN} className="mHeat" />
                <PixelIcon rows={DROP} className="mDry" />
                <PixelIcon rows={FAN} className="mFan" />
                <span className="acModeName" id="acModeName">冷氣</span>
              </span>
              <span className="acBatt" aria-hidden="true" />
            </div>
            <div className="acLcdMain"><SegDigits value={26} /><span className="acUnit">°C</span></div>
            <div className="acLcdFoot" aria-hidden="true">
              <span>風量<em id="acFanVal" /><span id="acFanBars" className="acFanBars"><i /><i /><i /></span></span>
              <span><LouvreIcon dir="h" id="acPosH" /><em id="acSwingH" /></span>
              <span><LouvreIcon dir="v" id="acPosV" /><em id="acSwingV" /></span>
            </div>
          </div>
          {/* the keys, laid out like a real remote's rather than in a tidy grid: the names printed on the face beside
              them, oval keys tipped round the temperature rocker in an arc (positions and tilts in cafe.css) */}
          <div className="acPad">
            <span className="acLbl" style={{ left: '23%', top: 0 }}>運轉/停止</span>
            <button id="acPower" className="acKey k1" aria-label="運轉/停止" />
            <span className="acLbl" style={{ left: '77%', top: 0 }}>風量</span>
            <button id="acWind" className="acKey k2" aria-label="風量" />
            <div className="acRocker">
              <button id="acUp" aria-label="溫度調高">▲</button>
              <button id="acDown" aria-label="溫度調低">▼</button>
            </div>
            <span className="acLbl" style={{ left: '50%', top: 108 }}>溫度設定</span>
            <span className="acLbl" style={{ left: '21%', top: 80 }}>左右風擺</span>
            <button id="acSwingHBtn" className="acKey k3" aria-label="左右風擺" />
            <span className="acLbl" style={{ left: '79%', top: 80 }}>功能</span>
            <button id="acMode" className="acKey k4" aria-label="功能" />
            <button id="acSwingVBtn" className="acKey k5" aria-label="上下風擺" />
            <span className="acLbl" style={{ left: '50%', top: 178 }}>上下風擺</span>
          </div>
          <span className="acModel" aria-hidden="true">MODEL AC-5487</span>
          <div className="acGrip" aria-hidden="true" />
        </div>
      </section>
      {loading && <LoadingHands ready={ready} onDone={done} />}
    </div>
  );
}
