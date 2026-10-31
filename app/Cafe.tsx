'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CafeContent } from '@/src/content/catalog';
import '@/src/cafe/cafe.css';
import LoadingHands from './LoadingHands';

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
      stop = startCafe(root.current, content);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setReady(true); }));
    });
    return () => { cancelled = true; stop?.(); };
  }, [content]);

  return (
    <div className="cafe-root" ref={root}>
      <div id="stage" />
      <div id="labels" />

      <section id="brand" className="win" aria-label="店況">
        <h1>窺視咖啡</h1>
        <div id="clockRow"><span id="day">週五</span><b id="clock">16:00</b><span id="openPill">營業中</span></div>
        <div className="stats">
          <div><b id="sRev">0</b><span>營收(模擬)</span></div>
          <div><b id="sCups">0</b><span>出杯</span></div>
          <div><b id="sPeople">0</b><span>店內客人</span></div>
        </div>
        {/* the menu and the shop's Instagram, side by side under the name, as pills unlike the panel's other buttons */}
        <nav className="quick" aria-label="捷徑">
          <button data-cam="menu" className="pill pillMenu">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3c0 1.5 1.2 1.5 1.2 3M12 3c0 1.5 1.2 1.5 1.2 3" /></svg>
            菜單
          </button>
          <a className="pill pillIg" href="https://www.instagram.com/peep20190401" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" /></svg>
            Instagram
          </a>
        </nav>
      </section>

      <section id="controls" className="win" aria-label="控制">
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
        <div className="row"><span></span><a href="/admin" className="adminLink">後台登入</a></div>
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
        <div className="head"><div><h3 id="cName">-</h3><span id="cKind" className="kind">-</span></div><button id="closeCard" aria-label="關閉">✕</button></div>
        <dl id="cInfo"></dl>
        <div className="status" id="cStatus">-</div>
        <button id="cInvite" className="primary" hidden>▶ 邀去打電動</button>
      </aside>

      <div id="hint">拖曳旋轉 · 滾輪縮放 · 點人物看資料 · 點電視看比賽</div>
      {loading && <LoadingHands ready={ready} onDone={done} />}
    </div>
  );
}
