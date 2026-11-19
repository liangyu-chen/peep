import { cloneBattleData, resultFor, typeEffect } from './data.js';
import { createScene } from './art.js';
import { play, startMusic, stopMusic } from './audio.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FX_TIMING = {
  slipper: [900, 560],
  spray: [1150, 760],
  coffee: [1200, 700],
  latte: [1300, 900],
  broom: [1080, 620], // the straw reaches them at art.js's BROOM_IMPACT
  broomWhiff: [1080, 640],
  chant: [1500, 960],
  cake: [1400, 860],
  listen: [1500, 940],
  rage: [1500, 960],
  slam: [820, 480],
  shout: [1150, 715],
  boss: [1400, 900],
  review: [1250, 830],
  sigh: [1300, 840],
  grumble: [1400, 920],
  cry: [1400, 900],
  remember: [1500, 1000],
};
const DEFAULT_TIMING = [750, 460];
// multi-hit moves: the wind-up before the first line flies, the time between lines, each line's flight, and the
// closing flourish after the last one lands (art.js reads the same numbers off the fx)
const MULTI_TIMING = { intro: 820, gap: 340, fly: 280, outro: 760 };

function damage(attacker, defender, move, crit) {
  const eff = typeEffect(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const base =
    (((2 * attacker.level) / 5 + 2) * move.power * attacker.atk) / defender.def / 30 + 2;
  const roll = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * eff * stab * roll * (crit ? 1.5 : 1)));
}

const rollRange = (move) => (move.min ?? 0) + Math.floor(Math.random() * ((move.max ?? move.min ?? 1) - (move.min ?? 0) + 1));

export function createBattle(canvas, { onState, onExit, onResult, owner, customer, mode, type } = {}) {
  const { player, enemy } = cloneBattleData({ mode, type, customer });
  const battleMode = mode === 'rude' || mode === 'kind' ? mode : 'spider';
  player.name = typeof owner?.name === 'string' && owner.name.trim() ? owner.name.trim() : player.name;
  player.hp = player.maxHp;
  enemy.hp = enemy.startHp ?? enemy.maxHp;
  player.moves.forEach((move) => {
    move.pp = move.maxPp;
  });

  const st = {
    t: 0,
    phase: 'intro',
    message: '',
    mode: battleMode,
    player,
    enemy,
    guard: false,
    itemGuard: false,
    soften: false,
    accDown: false,
    cheer: 0,
    fx: [],
    fainted: { enemy: 0, player: 0 },
    reveal: { enemy: 0, player: 0 },
    result: null,
    dead: false,
  };

  let messageWaiter = null;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { command() {}, move() {}, item() {}, back() {}, advance() {}, destroy() {} };
  }

  const scene = createScene({ owner, customer, mode: battleMode });
  let w = 1;
  let h = 1;
  let dockPx = 0;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let exited = false;
  let ro = null;

  const snapshot = () => ({
    phase: st.phase,
    message: st.message,
    mode: st.mode,
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
      type: enemy.types[0],
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      startHp: enemy.startHp ?? enemy.maxHp,
    },
    items: player.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      desc: item.desc,
    })),
    guard: st.guard,
    itemGuard: st.itemGuard,
    soften: st.soften,
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
    await new Promise((resolve) => { messageWaiter = resolve; });
  };

  const finish = (kind) => {
    if (st.result || st.dead) return;
    const result = resultFor(st.mode, kind, enemy.name);
    st.phase = 'result';
    st.result = { kind, ...result };
    st.message = result.title;
    notify();
    stopMusic();
    play(kind === 'win' ? 'win' : kind === 'lose' ? 'lose' : 'flee');
    onResult?.(kind);
  };

  const cheer = async () => {
    if (st.dead || st.result) return;
    st.phase = 'busy';
    st.cheer = performance.now();
    push('cheer', { target: 'enemy', dur: 1500 });
    play('heal');
    await say(`${enemy.name}的心情好起來了！`, 500);
    if (st.dead) return;
    finish('win');
  };

  const faint = async (who) => {
    if (st.dead || st.result) return;
    st.phase = 'busy';
    if (who === 'enemy' && st.mode === 'kind') {
      await cheer();
      return;
    }
    st.fainted[who] = performance.now();
    notify();
    stopMusic(0.3);
    play('faint');
    await sleep(900);
    if (st.dead) return;
    if (who === 'enemy') {
      await say(st.mode === 'rude' ? `${enemy.name}被請出了店！` : '野生的蜘蛛昏倒了！', 650);
      if (st.dead) return;
      if (st.mode === 'rude') await say(`${player.name}鬆了一口氣。`, 700);
      else await say(`${player.name}獲得了 蛛絲 ×1、經驗值 35！`, 700);
      finish('win');
    } else {
      await say(`${player.name}眼前一黑……`, 800);
      finish('lose');
    }
  };

  const pickEnemyMove = () => {
    const moves = enemy.moves;
    if (st.mode === 'spider') {
      const roll = Math.random();
      if (player.hp < 9 && roll < 0.45) return moves[0];
      if (roll < 0.3) return moves[1];
      if (roll < 0.6) return moves[2];
      return moves[3];
    }
    const roll = Math.random();
    if (roll < 0.3) return moves[0];
    if (roll < 0.55) return moves[1];
    if (roll < 0.8) return moves[2];
    return moves[3];
  };

  const useMove = async (attacker, defender, move, isPlayer) => {
    if (st.dead || st.result) return;
    if (isPlayer) move.pp = Math.max(0, move.pp - 1);
    play('select');
    await say(`${attacker.name}使用了${move.name}！`, 280);
    if (st.dead) return;

    let acc = move.acc;
    const blurred = isPlayer && st.accDown;
    if (blurred) {
      acc = Math.round(acc * 0.6);
      st.accDown = false;
    }
    if (Math.random() * 100 > acc) {
      // a move with a whiff (the broom) still swings, over their head, and kicks up dust that lands a little damage
      if (move.whiff) {
        const [whiffDur, whiffAt] = FX_TIMING[`${move.fx}Whiff`] || DEFAULT_TIMING;
        push('move', { fx: move.fx, whiff: true, from: isPlayer ? 'player' : 'enemy', target: isPlayer ? 'enemy' : 'player', dur: whiffDur });
        play(`${move.fx}Whiff`);
        await sleep(whiffAt);
        if (st.dead) return;
      }
      play('miss');
      push('miss', { target: isPlayer ? 'enemy' : 'player', dur: 900 });
      await say('但是沒有命中！', 420);
      if (move.whiff && !st.dead) {
        const dust = Math.max(1, rollRange(move.whiff));
        defender.hp = Math.max(0, defender.hp - dust);
        push('hit', { target: isPlayer ? 'enemy' : 'player', amount: dust, dust: true, dur: 800 });
        play('dust');
        notify();
        await sleep(430);
        await say(`揚起的灰塵嗆得${defender.name}直咳嗽！`, 320);
      }
      return;
    }
    if (blurred) await say('被吵得有點恍神，差點揮空……', 260);
    if (st.dead) return;

    // a multi-hit move (the calculator) lands one hit per line it rings up, all inside one longer animation
    const hits = move.hits ? move.hits[0] + Math.floor(Math.random() * (move.hits[1] - move.hits[0] + 1)) : 1;
    const multi = move.hits ? MULTI_TIMING : null;
    const [fxDur, fxHit] = multi
      ? [multi.intro + (hits - 1) * multi.gap + multi.fly + multi.outro, multi.intro + multi.fly]
      : FX_TIMING[move.fx] || DEFAULT_TIMING;
    push('move', {
      fx: move.fx,
      from: isPlayer ? 'player' : 'enemy',
      target: isPlayer ? 'enemy' : 'player',
      dur: fxDur,
      heal: st.mode === 'kind' && isPlayer && !!move.heal,
      hits,
      ...(multi || {}),
    });
    play(move.fx);
    await sleep(fxHit);
    if (st.dead) return;

    const crit = st.mode === 'spider' && Math.random() < 1 / 16;
    const eff = typeEffect(move.type, defender.types);
    const healing = st.mode === 'kind' && isPlayer && !!move.heal;
    const reflected = move.effect === 'reflect' && Math.random() < 0.3;
    const victim = reflected ? attacker : defender;
    const victimEff = typeEffect(move.type, victim.types);
    // the spider fight's moves carry a power for the stat formula; the customer fights' carry a min..max range
    const roll = () =>
      move.min == null ? damage(attacker, victim, move, crit) : Math.max(1, Math.round(rollRange(move) * victimEff));
    let amount = roll();
    const guarded = !isPlayer && st.guard && !reflected && !st.itemGuard;
    if (guarded) amount = Math.max(1, Math.floor(amount / 2));

    if (!isPlayer && st.itemGuard && !reflected) {
      amount = 0;
      st.itemGuard = false;
      push('signBlock', { dur: 900 });
      await say('店規立牌擋下了這一擊！', 320);
    } else if (!isPlayer && st.soften && !reflected) {
      amount = Math.max(1, Math.floor(amount / 2));
      st.soften = false;
      await say('面紙讓他的火氣小了一點，傷害減半！', 320);
    }
    if (st.dead) return;

    if (healing) {
      const before = defender.hp;
      defender.hp = Math.min(defender.maxHp, defender.hp + amount);
      const gained = defender.hp - before;
      push('hit', {
        target: 'enemy',
        amount: gained,
        heal: true,
        eff,
        dur: 700,
      });
      play('heal');
      notify();
      await sleep(430);
      if (st.dead) return;
      if (eff > 1) await say('效果拔群！心情好了很多。', 260);
      else if (eff < 1) await say('效果不太好……', 260);
    } else {
      const floor = st.mode === 'kind' && victim === enemy ? 1 : 0;
      let landed = 0;
      let total = 0;
      for (let i = 0; i < hits; i++) {
        const dealt = i === 0 ? amount : roll();
        victim.hp = Math.max(floor, victim.hp - dealt);
        landed += 1;
        total += dealt;
        push('hit', {
          target: victim === player ? 'player' : 'enemy',
          amount: dealt,
          crit,
          eff: victimEff,
          dur: 700,
        });
        play(crit ? 'crit' : multi ? 'ring' : 'hit');
        // the blow lands on the raised guard
        if (guarded && i === 0) {
          push('guardHit', { dur: 800 });
          play('guardHit');
        }
        notify();
        if (i === hits - 1 || victim.hp <= floor) break;
        await sleep(multi.gap);
        if (st.dead) return;
      }
      await sleep(430);
      if (st.dead) return;
      if (landed > 1) await say(`一共算了 ${landed} 筆，總共 ${total} 點！`, 320);

      if (guarded) await say('防禦姿勢擋下了一半的傷害！', 240);
      if (crit) await say('擊中了要害！', 220);
      if (reflected) {
        push('reflect', { target: victim === player ? 'player' : 'enemy', quote: '我就是老闆！', dur: 1400 });
        await say('「我就是老闆！」——攻擊被反彈回去！', 320);
      }
      if (!isPlayer && victimEff > 1) await say('效果拔群！', 260);
      else if (!isPlayer && victimEff < 1) await say('效果不太好……', 260);

      if (move.effect === 'blur' && !reflected) {
        st.accDown = true;
        await say(`${attacker.name}吵得${player.name}頭昏眼花！`, 300);
      }
      if (move.effect === 'hurtSelf' && !reflected) {
        const self = Math.max(5, Math.min(10, rollRange({ min: 5, max: 10 })));
        enemy.hp = Math.max(1, enemy.hp - self);
        push('hit', { target: 'enemy', amount: self, dur: 700 });
        notify();
        await say(`${enemy.name}又想起了那件事，心情更差了（HP −${self}）。`, 360);
      }
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
    await say(st.mode === 'spider' ? '但是被蜘蛛擋住了！' : '但是對方還沒答應！', 420);
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
    st.message = st.mode === 'kind' ? `要怎麼關心${enemy.name}？` : `${enemy.name}還在${player.name}面前。要做什麼？`;
    notify();
  };

  const winReached = () => (st.mode === 'kind' ? enemy.hp >= enemy.maxHp : enemy.hp <= 0);

  const startTurn = async (action) => {
    if (st.dead || st.result || st.phase === 'busy') return;
    st.phase = 'busy';
    st.guard = false;
    notify();

    if (action.kind === 'move') {
      await useMove(player, enemy, action.move, true);
      if (st.dead || st.result) return;
      if (winReached()) {
        await faint('enemy');
        return;
      }
    } else if (action.kind === 'defend') {
      st.guard = true;
      play('guard');
      push('guard', { dur: 1100 });
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
        const heal = Math.min(rollRange({ min: 20, max: 30 }), player.maxHp - player.hp);
        // the mug comes up and they drink; the HP goes in as the warmth spreads (art.js fxDrink, halfway through)
        play('drink');
        push('heal', { dur: 1500 });
        await sleep(760);
        if (st.dead) return;
        player.hp += heal;
        push('hit', { target: 'player', amount: heal, heal: true, dur: 800 });
        play('heal');
        notify();
        await sleep(300);
        await say(`${player.name}喝了一口咖啡，回復了 ${heal} HP！`, 600);
      } else if (item.id === 'sign') {
        st.itemGuard = true;
        play('select');
        push('sign', { target: 'player', dur: 1400 });
        // the thud of its stake going into the floor, as it lands (art.js fxSign: 28% of the way through)
        setTimeout(() => { if (!st.dead) play('slam'); }, 392);
        await say(`${player.name}立起了店規立牌！`, 500);
      } else if (item.id === 'tissue') {
        st.soften = true;
        play('tissue');
        push('tissue', { from: 'player', target: 'enemy', dur: 1700 });
        await sleep(1100);
        if (st.dead) return;
        await say(`${player.name}遞過一盒面紙，對方的火氣小了一點。`, 560);
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
    // a sign that was never hit is taken down again with the turn
    if (st.itemGuard) push('signBlock', { dur: 900 });
    st.itemGuard = false;
    st.soften = false;
    st.phase = 'command';
    st.message = st.mode === 'kind' ? `要怎麼關心${enemy.name}？` : `${enemy.name}還在${player.name}面前。要做什麼？`;
    notify();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width || canvas.clientWidth || window.innerWidth);
    h = Math.max(1, rect.height || canvas.clientHeight || window.innerHeight);
    const dock = canvas.parentElement?.querySelector?.('.battleDock');
    dockPx = dock ? Math.max(0, rect.bottom - dock.getBoundingClientRect().top) : 0;
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
    scene.draw(ctx, w, h, st, dockPx);
    raf = requestAnimationFrame(frame);
  };

  const api = {
    command(index) {
      if (st.dead || st.phase !== 'command') return;
      if (index === 0) {
        play('select');
        st.phase = 'moves';
        st.message = st.mode === 'kind' ? '要做什麼來安慰他？' : '要使用哪一個招式？';
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
      st.message = st.mode === 'kind' ? `要怎麼關心${enemy.name}？` : `${enemy.name}還在${player.name}面前。要做什麼？`;
      notify();
    },
    advance() {
      if (st.dead || exited) return;
      if (st.result) {
        exited = true;
        onExit?.();
        return;
      }
      if (!messageWaiter) return;
      const resolve = messageWaiter;
      messageWaiter = null;
      resolve();
    },
    destroy() {
      if (st.dead) return;
      if (messageWaiter) { const resolve = messageWaiter; messageWaiter = null; resolve(); }
      st.dead = true;
      stopMusic(0.2);
      cancelAnimationFrame(raf);
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

  startMusic(st.mode === 'kind' ? 'kind' : 'rude');

  (async () => {
    await sleep(300);
    if (st.dead) return;
    if (st.mode === 'rude') {
      await say(`${enemy.name}開始大聲嚷嚷！`, 620);
      if (st.dead) return;
      await say(`${player.name}站了出來！`, 500);
      if (st.dead) return;
      st.phase = 'command';
      st.message = `${enemy.name}擋在${player.name}面前。要做什麼？`;
    } else if (st.mode === 'kind') {
      await say(`${enemy.name}看起來心情不太好……`, 620);
      if (st.dead) return;
      await say(`${player.name}拉了張椅子坐下來。`, 500);
      if (st.dead) return;
      st.phase = 'command';
      st.message = `要怎麼關心${enemy.name}？`;
    } else {
      await say('野生的蜘蛛從角落爬了出來！', 620);
      if (st.dead) return;
      await say(`${player.name}站了出來！`, 500);
      if (st.dead) return;
      st.phase = 'command';
      st.message = `蜘蛛擋在${player.name}面前。要做什麼？`;
    }
    notify();
  })();

  return api;
}
