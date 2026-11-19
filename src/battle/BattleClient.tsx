'use client';

import { useEffect, useRef, useState } from 'react';
import { createBattle } from '@/src/battle';
import type { Look } from '@/src/content/look';
import './battle.css';

type OwnerInfo = {
  name: string;
  look: Look;
};

type BattleMode = 'rude' | 'kind';

type Move = {
  name: string;
  type: string;
  pp: number;
  maxPp: number;
  desc: string;
};

type Item = {
  name: string;
  qty: number;
  desc: string;
};

type BattleState = {
  phase: 'intro' | 'busy' | 'command' | 'moves' | 'bag' | 'result';
  message: string;
  player: {
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    moves: Move[];
  };
    enemy: {
      name: string;
      level: number;
      type: string;
      hp: number;
      maxHp: number;
    };
  items: Item[];
  guard?: boolean;
  itemGuard?: boolean;
  soften?: boolean;
  result: {
    kind: 'win' | 'lose' | 'flee';
    title: string;
    lines: string[];
    tag: string;
  } | null;
};

type BattleApi = {
  command: (index: number) => void;
  move: (index: number) => void;
  item: (index: number) => void;
  back: () => void;
  advance: () => void;
  destroy: () => void;
};

const startBattle = createBattle as unknown as (
  canvas: HTMLCanvasElement,
  options: {
    onState?: (state: BattleState) => void;
    onExit?: () => void;
    onResult?: (kind: 'win' | 'lose' | 'flee') => void;
    owner?: OwnerInfo;
    customer?: OwnerInfo;
    mode?: BattleMode;
    type?: string;
  }
) => BattleApi;

function gridCursor(current: number, key: string, length: number) {
  if (key === 'ArrowLeft') return current % 2 === 0 ? current : current - 1;
  if (key === 'ArrowRight') return current % 2 === 1 || current + 1 >= length ? current : current + 1;
  if (key === 'ArrowUp') return current >= 2 ? current - 2 : current;
  if (key === 'ArrowDown') return current + 2 < length ? current + 2 : current;
  return current;
}

function listCursor(current: number, key: string, length: number) {
  if (key === 'ArrowUp') return Math.max(0, current - 1);
  if (key === 'ArrowDown') return Math.min(length - 1, current + 1);
  return current;
}

function HpBar({ hp, max, showNum }: { hp: number; max: number; showNum?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const tone = pct > 50 ? 'ok' : pct > 25 ? 'warn' : 'low';
  return (
    <div className={`hpWrap ${tone}`}>
      <div className="hpTrack">
        <i className="hpGhost" style={{ width: `${pct}%` }} />
        <i className="hpFill" style={{ width: `${pct}%` }} />
      </div>
      {showNum && <span className="hpNum">{Math.max(0, Math.round(hp))} / {max}</span>}
    </div>
  );
}

const COMMANDS = ['攻擊', '道具', '防禦', '逃跑'];

// onExit: what happens when the fight is over. Laid over the café it closes the layer and the café carries on;
// on its own page (/battle) it goes back to the café.
export default function BattleClient({
  owner,
  onExit,
  onResult,
  onReady,
  mode,
  type,
  customer,
}: {
  owner: OwnerInfo;
  onExit?: () => void;
  onResult?: (kind: 'win' | 'lose' | 'flee') => void;
  onReady?: () => void;
  mode?: BattleMode;
  type?: string;
  customer?: OwnerInfo;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const apiRef = useRef<BattleApi | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<BattleState | null>(null);
  const [cursor, setCursor] = useState(0);
  const [armed, setArmed] = useState<number | null>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    const api = startBattle(canvas, {
      owner,
      mode,
      type,
      customer,
      onState: (next) => {
        if (active) setSnap(next);
      },
      onResult: (kind) => {
        if (active) resultRef.current?.(kind);
      },
      onExit: () => {
        if (exitRef.current) exitRef.current();
        else window.location.assign('/');
      },
    });
    apiRef.current = api;
    rootRef.current?.focus();
    requestAnimationFrame(() => readyRef.current?.());   // hold the entry wipe until the first battle frame is drawn
    return () => {
      active = false;
      api.destroy();
      apiRef.current = null;
    };
  }, [owner, mode, type, customer]);

  const phase = snap?.phase || 'intro';

  useEffect(() => {
    setCursor(-1);   // nothing highlighted until the player actually moves or taps
    setArmed(null);
  }, [phase]);

  useEffect(() => {
    const text = snap?.message || '';
    if (!text) {
      setTyped('');
      return;
    }
    setTyped('');
    let index = 0;
    const id = window.setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [snap?.message]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // laid over the café, the keys are the fight's alone: caught first, they never reach the café's camera or menu
      if (exitRef.current) event.stopPropagation();
      const api = apiRef.current;
      if (!api || !snap) return;
      const key = event.key;
      const lower = key.toLowerCase();

      if (snap.result) {
        if (key === 'Enter' || key === ' ' || lower === 'z') {
          event.preventDefault();
          api.advance();
          return;
        }
      }

      if (snap.phase === 'busy' || snap.phase === 'intro') {
        if (key === 'Enter' || key === ' ' || lower === 'z') {
          event.preventDefault();
          api.advance();
          return;
        }
      }

      if (snap.phase === 'command' || snap.phase === 'moves') {
        const length = snap.phase === 'command' ? COMMANDS.length : snap.player.moves.length;
        if (key.startsWith('Arrow')) {
          event.preventDefault();
          setCursor((current) => (current < 0 ? 0 : gridCursor(current, key, length)));
          setArmed(null);
          return;
        }
        if (key === 'Enter' || key === ' ' || lower === 'z') {
          event.preventDefault();
          if (snap.phase === 'command') {
            const index = cursor < 0 ? 0 : cursor;
            setCursor(-1);
            api.command(index);
          } else {
            const index = cursor < 0 ? 0 : cursor;
            if (armed === index) {
              api.move(index);
              setArmed(null);
            } else {
              setCursor(index);
              setArmed(index);
            }
          }
          return;
        }
        if (key === 'Escape' || lower === 'x') {
          event.preventDefault();
          if (snap.phase === 'moves') {
            setArmed(null);
            api.back();
          }
          return;
        }
      }

      if (snap.phase === 'bag') {
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          event.preventDefault();
          setCursor((current) => (current < 0 ? 0 : listCursor(current, key, snap.items.length)));
          setArmed(null);
          return;
        }
        if (key === 'Enter' || key === ' ' || lower === 'z') {
          event.preventDefault();
          const index = cursor < 0 ? 0 : cursor;
          if (armed === index) {
            api.item(index);
            setArmed(null);
          } else {
            setCursor(index);
            setArmed(index);
          }
          return;
        }
        if (key === 'Escape' || lower === 'x') {
          event.preventDefault();
          setArmed(null);
          api.back();
        }
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [snap, cursor, armed]);

  const player = snap?.player;
  const enemy = snap?.enemy;
  const done = !snap?.message || typed.length >= snap.message.length;
  const armedMove = phase === 'moves' && armed !== null ? snap?.player.moves[armed] : null;
  const armedItem = phase === 'bag' && armed !== null ? snap?.items[armed] : null;
  const armedText = armedMove
    ? `${armedMove.name}：${armedMove.desc}`
    : armedItem
      ? `${armedItem.name}：${armedItem.desc}`
      : '';

  return (
    <div
      className="battle-root"
      ref={rootRef}
      tabIndex={-1}
      onClick={() => {
        if (snap?.result) apiRef.current?.advance();
        else if (!done) setTyped(snap?.message || '');
        else apiRef.current?.advance();
      }}
    >
      <canvas ref={canvasRef} className="battleCanvas" aria-hidden="true" />

      <div className="battleHud">
        <div className="battleTop">
          <section className="battleCard battleEnemy" aria-label="對手">
            <div className="battleCardHead">
              <span className="battleNameRow">
                <span className="battleName">{enemy?.name || '蜘蛛'}</span>
                {enemy?.type && <span className="battleType" data-type={enemy.type}>{enemy.type}</span>}
              </span>
              <span className="battleLv">Lv.{enemy?.level ?? 5}</span>
            </div>
            <HpBar hp={enemy?.hp ?? 22} max={enemy?.maxHp ?? 22} />
          </section>

          <div className="battleSpacer" />
        </div>

        <div className="battleMiddle">
          {player && (
            <section className="battleCard battlePlayer" aria-label="老闆">
              <div className="battleCardHead">
                <span className="battleName">{player.name}</span>
                <span className="battleLv">Lv.{player.level}</span>
              </div>
              <HpBar hp={player.hp} max={player.maxHp} showNum />
            </section>
          )}
        </div>

        <div className="battleDock">
          <section className="battleDialogue battleBox" aria-live="polite">
            <p>
              {armedText || typed || ' '}
              {done && <span className="more">▼</span>}
            </p>
          </section>

          {(phase === 'command' || phase === 'moves' || phase === 'bag') && (
            <aside className="battleMenu battleBox" aria-label="戰鬥指令">
            {phase === 'command' && (
              <div className="commandGrid">
                {(mode === 'kind' ? ['關心', ...COMMANDS.slice(1)] : COMMANDS).map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={`battleBtn ${cursor === index ? 'sel' : ''}`}
                    onClick={() => {
                      if (index === 0 || index === 1) setCursor(-1);
                      setArmed(null);
                      apiRef.current?.command(index);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {phase === 'moves' && snap && (
              <>
                <div className="moveGrid">
                  {snap.player.moves.map((move, index) => (
                    <button
                      key={move.name}
                      type="button"
                      className={`battleBtn moveBtn ${cursor === index ? 'sel' : ''} ${armed === index ? 'armed' : ''}`}
                      disabled={move.pp <= 0}
                      onClick={() => {
                        if (armed === index) {
                          apiRef.current?.move(index);
                          setArmed(null);
                        } else {
                          setCursor(index);
                          setArmed(index);
                        }
                      }}
                    >
                      <span className="moveName">{move.name}</span>
                      <span className="moveMeta">
                        <b>{move.pp}/{move.maxPp}</b>
                      </span>
                    </button>
                  ))}
                </div>
                <button type="button" className="backBtn" onClick={() => {
                  setArmed(null);
                  setCursor(-1);
                  apiRef.current?.back();
                }}>
                  ◀ 返回
                </button>
              </>
            )}

            {phase === 'bag' && snap && (
              <>
                <div className="bagList">
                  {snap.items.map((item, index) => (
                    <button
                      key={item.name}
                      type="button"
                      className={`battleBtn bagBtn ${cursor === index ? 'sel' : ''} ${armed === index ? 'armed' : ''}`}
                      disabled={item.qty <= 0}
                      onClick={() => {
                        if (armed === index) {
                          apiRef.current?.item(index);
                          setArmed(null);
                        } else {
                          setCursor(index);
                          setArmed(index);
                        }
                      }}
                    >
                      <span className="bagName">
                        {item.name}
                        <small>{item.desc}</small>
                      </span>
                      <span className="bagQty">×{item.qty}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="backBtn" onClick={() => {
                  setArmed(null);
                  setCursor(-1);
                  apiRef.current?.back();
                }}>
                  ◀ 返回
                </button>
              </>
            )}

          </aside>
          )}
        </div>
      </div>

      {snap?.result && (
        <div className="battleResult" role="status" aria-live="assertive">
          <div className={`resultCard ${snap.result.kind}`}>
            <span className="resultTag">{snap.result.tag}</span>
            <h2>{snap.result.title}</h2>
            {snap.result.lines.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
            <p className="resultBack">▼</p>
          </div>
        </div>
      )}
    </div>
  );
}
