import { cloneBattleData, RESULT, typeEffect } from './data.js';
import { createScene } from './art.js';
import { play, startMusic, stopMusic } from './audio.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long each move's animation runs, and when in it the hit lands (ms).
const FX_TIMING = {
  slipper: [900, 560],
  spray: [1150, 760],
  coffee: [1000, 660],
  latte: [1050, 700],
};
const DEFAULT_TIMING = [750, 460];

function damage(attacker, defender, move, crit) {
  const eff = typeEffect(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const base =
    (((2 * attacker.level) / 5 + 2) * move.power * attacker.atk) / defender.def / 30 + 2;
  const roll = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * eff * stab * roll * (crit ? 1.5 : 1)));
}

export function createBattle(canvas, { onState, onExit, owner } = {}) {
  const { player, enemy } = cloneBattleData();
  player.name = typeof owner?.name === 'string' && owner.name.trim() ? owner.name.trim() : player.name;
  player.hp = player.maxHp;
  enemy.hp = enemy.maxHp;
  player.moves.forEach((move) => {
    move.pp = move.maxPp;
  });

  const st = {
    t: 0,
    phase: 'intro',
    message: '',
    player,
    enemy,
    guard: false,
    fx: [],
    fainted: { enemy: 0, player: 0 },
    reveal: { enemy: 0, player: 0 },
    result: null,
    dead: false,
  };

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { command() {}, move() {}, item() {}, back() {}, destroy() {} };
  }

  const scene = createScene({ owner });
  let w = 1;
  let h = 1;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let exitTimer = 0;
  let ro = null;

  const snapshot = () => ({
    phase: st.phase,
    message: st.message,
    player: {
      name: player.name,
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      moves: player.moves.map((move) => ({
        name: move.name,
        type: move.type,
        pp: move.pp,
        maxPp: move.maxPp,
        desc: move.desc,
      })),
    },
    enemy: {
      name: enemy.name,
      level: enemy.level,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
    },
    items: player.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      desc: item.desc,
    })),
    result: st.result,
  });

  const notify = () => {
    if (!st.dead) onState?.(snapshot());
  };

  const push = (kind, extra = {}) => {
    st.fx.push({ kind, t0: performance.now(), dur: 600, ...extra });
  };

  const say = async (text, hold = 650) => {
    if (st.dead) return;
    st.message = text;
    notify();
    const wait = Math.min(2400, 300 + text.length * 28) + hold;
    await sleep(wait);
  };

  const finish = (kind) => {
    if (st.result || st.dead) return;
    const result = RESULT[kind];
    st.phase = 'result';
    st.result = { kind, ...result };
    st.message = result.title;
    notify();
    stopMusic();
    play(kind === 'win' ? 'win' : kind === 'lose' ? 'lose' : 'flee');
    clearTimeout(exitTimer);
    exitTimer = window.setTimeout(() => {
      if (!st.dead) onExit?.();
    }, 4000);
  };

  const faint = async (who) => {
    if (st.dead || st.result) return;
    st.phase = 'busy';
    st.fainted[who] = performance.now();
    notify();
    stopMusic(0.3);
    play('faint');
    await sleep(900);
    if (st.dead) return;
    if (who === 'enemy') {
      await say('野生的蜘蛛昏倒了！', 650);
      if (st.dead) return;
      await say(`${player.name}獲得了 蛛絲 ×1、經驗值 35！`, 700);
      finish('win');
    } else {
      await say(`${player.name}眼前一黑……`, 800);
      finish('lose');
    }
  };

  const pickEnemyMove = () => {
    const moves = enemy.moves;
    const roll = Math.random();
    if (player.hp < 9 && roll < 0.45) return moves[0];
    if (roll < 0.3) return moves[1];
    if (roll < 0.6) return moves[2];
    return moves[3];
  };

  const useMove = async (attacker, defender, move, isPlayer) => {
    if (st.dead || st.result) return;
    if (isPlayer) move.pp = Math.max(0, move.pp - 1);
    play('select');
    await say(`${attacker.name}使用了${move.name}！`, 280);
    if (st.dead) return;

    if (Math.random() * 100 > move.acc) {
      play('miss');
      push('miss', { target: isPlayer ? 'enemy' : 'player', dur: 900 });
      await say('但是沒有命中！', 420);
      return;
    }

    const [fxDur, fxHit] = FX_TIMING[move.fx] || DEFAULT_TIMING;
    push('move', {
      fx: move.fx,
      from: isPlayer ? 'player' : 'enemy',
      target: isPlayer ? 'enemy' : 'player',
      dur: fxDur,
    });
    play(move.fx);
    await sleep(fxHit);
    if (st.dead) return;

    const crit = Math.random() < 1 / 16;
    let dmg = damage(attacker, defender, move, crit);
    if (!isPlayer && st.guard) dmg = Math.max(1, Math.floor(dmg / 2));
    defender.hp = Math.max(0, defender.hp - dmg);
    push('hit', {
      target: isPlayer ? 'enemy' : 'player',
      amount: dmg,
      crit,
      eff: typeEffect(move.type, defender.types),
      dur: 700,
    });
    play(crit ? 'crit' : 'hit');
    notify();
    await sleep(430);
    if (st.dead) return;

    const eff = typeEffect(move.type, defender.types);
    if (!isPlayer && st.guard) await say('防禦姿勢擋下了部分傷害！', 240);
    if (crit) await say('擊中了要害！', 220);
    if (eff > 1) await say('效果拔群！', 260);
    else if (eff < 1) await say('效果不太好……', 260);
    if (move.effect === 'slow' && defender.hp > 0 && defender.spd > 5) {
      defender.spd = Math.max(5, defender.spd - 1);
      await say(`${defender.name}的速度下降了！`, 300);
    }
  };

  const tryRun = async () => {
    play('select');
    await say(`${player.name}試著逃跑……`, 420);
    if (st.dead) return;
    const chance = Math.max(0.35, Math.min(0.9, 0.45 + (player.spd - enemy.spd) * 0.04));
    if (Math.random() < chance) {
      play('flee');
      push('run', { dur: 900 });
      await say('成功逃走了！', 600);
      finish('flee');
      return;
    }

    play('miss');
    await say('但是被蜘蛛擋住了！', 420);
    if (st.dead) return;
    await sleep(150);
    await useMove(enemy, player, pickEnemyMove(), false);
    if (st.dead || st.result) return;
    if (player.hp <= 0) {
      await faint('player');
      return;
    }
    st.guard = false;
    st.phase = 'command';
    st.message = `蜘蛛還在盯著${player.name}。要做什麼？`;
    notify();
  };

  const startTurn = async (action) => {
    if (st.dead || st.result || st.phase === 'busy') return;
    st.phase = 'busy';
    st.guard = false;
    notify();

    if (action.kind === 'move') {
      await useMove(player, enemy, action.move, true);
      if (st.dead || st.result) return;
      if (enemy.hp <= 0) {
        await faint('enemy');
        return;
      }
    } else if (action.kind === 'defend') {
      st.guard = true;
      play('guard');
      push('guard', { dur: 650 });
      await say(`${player.name}擺出了防禦姿勢！`, 480);
    } else if (action.kind === 'item') {
      const item = player.items[action.index];
      if (!item || item.qty <= 0) {
        st.phase = 'bag';
        notify();
        return;
      }
      if (item.id === 'coffee' && player.hp >= player.maxHp) {
        st.phase = 'command';
        st.message = 'HP 已經全滿了。要做什麼？';
        notify();
        return;
      }
      item.qty -= 1;

      if (item.id === 'coffee') {
        const heal = Math.min(10, player.maxHp - player.hp);
        player.hp += heal;
        play('heal');
        push('heal', { dur: 900 });
        await say(`${player.name}喝了一口咖啡，回復了 ${heal} HP！`, 600);
      }
      notify();
    } else if (action.kind === 'run') {
      await tryRun();
      return;
    }

    if (st.dead || st.result) return;
    if (st.phase === 'command') return;

    await sleep(180);
    await useMove(enemy, player, pickEnemyMove(), false);
    if (st.dead || st.result) return;
    if (player.hp <= 0) {
      await faint('player');
      return;
    }

    st.guard = false;
    st.phase = 'command';
    st.message = `蜘蛛還在盯著${player.name}。要做什麼？`;
    notify();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width || canvas.clientWidth || window.innerWidth);
    h = Math.max(1, rect.height || canvas.clientHeight || window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const nextW = Math.round(w * dpr);
    const nextH = Math.round(h * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };

  const frame = (time) => {
    if (st.dead) return;
    const dt = Math.min(0.05, Math.max(0, (time - last) / 1000));
    last = time;
    st.t += dt;
    st.reveal.enemy = Math.min(1, st.reveal.enemy + dt * 2.4);
    st.reveal.player = Math.min(1, st.reveal.player + dt * 2.4);
    const now = performance.now();
    st.fx = st.fx.filter((fx) => now - fx.t0 < fx.dur);
    ctx.clearRect(0, 0, w, h);
    scene.draw(ctx, w, h, st);
    raf = requestAnimationFrame(frame);
  };

  const api = {
    command(index) {
      if (st.dead || st.phase !== 'command') return;
      if (index === 0) {
        play('select');
        st.phase = 'moves';
        st.message = '要使用哪一個招式？';
        notify();
      } else if (index === 1) {
        play('select');
        st.phase = 'bag';
        st.message = '要用哪個道具？';
        notify();
      } else if (index === 2) {
        startTurn({ kind: 'defend' });
      } else if (index === 3) {
        startTurn({ kind: 'run' });
      }
    },
    move(index) {
      if (st.dead || st.phase !== 'moves') return;
      const move = player.moves[index];
      if (!move || move.pp <= 0) {
        play('back');
        return;
      }
      startTurn({ kind: 'move', move });
    },
    item(index) {
      if (st.dead || st.phase !== 'bag') return;
      const item = player.items[index];
      if (!item || item.qty <= 0) {
        play('back');
        return;
      }
      startTurn({ kind: 'item', index });
    },
    back() {
      if (st.dead) return;
      if (st.phase !== 'moves' && st.phase !== 'bag') return;
      play('back');
      st.phase = 'command';
      st.message = `蜘蛛還在盯著${player.name}。要做什麼？`;
      notify();
    },
    destroy() {
      if (st.dead) return;
      st.dead = true;
      stopMusic(0.2);
      cancelAnimationFrame(raf);
      clearTimeout(exitTimer);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      scene.dispose();
    },
  };

  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  }
  resize();
  notify();
  raf = requestAnimationFrame(frame);

  startMusic();

  (async () => {
    await sleep(300);
    if (st.dead) return;
    await say('野生的蜘蛛從角落爬了出來！', 620);
    if (st.dead) return;
    await say(`${player.name}站了出來！`, 500);
    if (st.dead) return;
    st.phase = 'command';
    st.message = `蜘蛛擋在${player.name}面前。要做什麼？`;
    notify();
  })();

  return api;
}
