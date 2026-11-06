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

      <div id="hint">拖曳旋轉 · 滾輪縮放 · 點人物看資料</div>
      {loading && <LoadingHands ready={ready} onDone={done} />}
    </div>
  );
}
