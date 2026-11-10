/* Oil Management — звуки. Всё синтезируется через Web Audio API: никаких аудиофайлов, работает офлайн.
   На iPhone звук включается только после первого касания экрана (требование Safari). */
(function (root) {
  'use strict';
  const KEY = 'om2_sound';
  let ctx = null, master = null, ambBus = null, noiseBuf = null, ambNodes = null, creakTimer = null;
  const st = load();
  function load() { try { return Object.assign({ on: true, vol: 0.7, amb: true, touch: true }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { on: true, vol: 0.7, amb: true }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); return true; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = st.on ? st.vol : 0; master.connect(ctx.destination);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iOS: «разблокировать» звук пустым буфером
    const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
    return true;
  }
  const ready = () => ctx && st.on && ctx.state !== 'closed';

  /* ---------- примитивы ---------- */
  function tone(f, dur, o = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    const g = ctx.createGain(); const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  /* ---------- звуки игры ---------- */
  let last = {};
  const throttle = (k, ms) => { const n = Date.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };
  const S = {
    click() { if (!throttle('click', 40)) return; tone(1900, 0.03, { type: 'triangle', vol: 0.05 }); },
    // галетный переключатель: сухой механический щелчок
    tab() { noise(0.025, { f: 3200, q: 2, vol: 0.12 }); tone(1150, 0.03, { type: 'square', vol: 0.025, at: 0.004 }); noise(0.03, { f: 1400, q: 3, vol: 0.06, at: 0.03 }); },
    day() { if (!throttle('day', 50)) return; tone(260, 0.05, { type: 'triangle', vol: 0.09 }); noise(0.03, { f: 3000, vol: 0.03 }); },
    whoosh() { noise(0.55, { f: 300, fto: 2500, q: 0.8, vol: 0.12, att: 0.15 }); },
    month() { [523, 659, 784].forEach((f, i) => tone(f, 0.5, { at: i * 0.11, vol: 0.13, type: 'sine' })); tone(1046, 0.7, { at: 0.33, vol: 0.06 }); },
    cash() { tone(1320, 0.12, { type: 'square', vol: 0.05 }); tone(1760, 0.35, { at: 0.08, type: 'sine', vol: 0.12 }); noise(0.08, { f: 6000, at: 0.02, vol: 0.05 }); },
    coin() { tone(988, 0.09, { vol: 0.1 }); tone(1319, 0.25, { at: 0.07, vol: 0.1 }); },
    spend() { tone(700, 0.1, { type: 'triangle', vol: 0.08, to: 450 }); },
    good() { [659, 784, 988].forEach((f, i) => tone(f, 0.22, { at: i * 0.08, vol: 0.1, type: 'triangle' })); },
    warn() { if (!throttle('warn', 600)) return; tone(440, 0.14, { type: 'square', vol: 0.05 }); tone(349, 0.2, { at: 0.16, type: 'square', vol: 0.05 }); },
    alarm() { if (!throttle('alarm', 1500)) return; for (let i = 0; i < 3; i++) { tone(620, 0.22, { at: i * 0.32, type: 'sawtooth', vol: 0.06, to: 930 }); } },
    fail() { if (!throttle('fail', 800)) return; tone(330, 0.12, { type: 'square', vol: 0.06 }); tone(220, 0.25, { at: 0.12, type: 'square', vol: 0.06 }); },
    error() { tone(150, 0.16, { type: 'square', vol: 0.07 }); },
    build() { noise(0.06, { f: 2500, vol: 0.18 }); tone(310, 0.25, { type: 'triangle', vol: 0.12 }); noise(0.06, { f: 2500, at: 0.22, vol: 0.18 }); tone(330, 0.3, { at: 0.22, type: 'triangle', vol: 0.1 }); },
    stamp() { noise(0.09, { f: 600, ftype: 'lowpass', vol: 0.3 }); tone(90, 0.12, { vol: 0.2 }); },
    pop() { tone(400, 0.09, { vol: 0.12, to: 900 }); },
    leave() { tone(500, 0.35, { type: 'triangle', vol: 0.1, to: 200 }); },
    event() { tone(880, 0.18, { vol: 0.1 }); tone(660, 0.3, { at: 0.18, vol: 0.1 }); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.16, { at: i * 0.12, type: 'triangle', vol: 0.12 })); tone(784, 0.8, { at: 0.36, vol: 0.06 }); },
    delivery() { noise(0.12, { f: 200, ftype: 'lowpass', vol: 0.25 }); tone(140, 0.15, { vol: 0.1 }); },
    hiss() { noise(0.4, { f: 4000, vol: 0.05, att: 0.05 }); },
    /* ---------- оборудование ---------- */
    // скрип станка-качалки
    creak() { if (!throttle('creak', 500)) return; noise(0.45, { f: 950, fto: 620, q: 9, vol: 0.09, att: 0.08 }); noise(0.35, { f: 640, fto: 1050, q: 9, vol: 0.07, at: 0.5, att: 0.08 }); tone(55, 0.6, { type: 'sine', vol: 0.06 }); },
    // маховик задвижки: трещотка, удар клина, шипение среды
    valve() { for (let i = 0; i < 7; i++) noise(0.02, { f: 2600 - i * 120, q: 4, vol: 0.09, at: i * 0.09 }); noise(0.12, { f: 260, ftype: 'lowpass', vol: 0.32, at: 0.68 }); tone(95, 0.22, { vol: 0.18, at: 0.68 }); noise(0.6, { f: 3500, vol: 0.035, at: 0.75, att: 0.1 }); },
    // постукивание по стеклу манометра
    glass() { if (!throttle('glass', 120)) return; tone(2650, 0.06, { vol: 0.08 }); tone(3970, 0.05, { vol: 0.04, at: 0.004 }); noise(0.015, { f: 5000, vol: 0.05 }); },
    // тумблер
    toggle() { noise(0.018, { f: 2200, q: 1.5, vol: 0.22 }); tone(170, 0.05, { type: 'square', vol: 0.05 }); noise(0.02, { f: 900, q: 2, vol: 0.12, at: 0.025 }); },
    // трещотка регулятора (ползунок)
    ratchet() { if (!throttle('ratchet', 45)) return; noise(0.012, { f: 3800, q: 3, vol: 0.07 }); },
    // колонка АЗС: два писка
    beep() { if (!throttle('beep', 300)) return; tone(1250, 0.08, { type: 'square', vol: 0.05 }); tone(1250, 0.08, { type: 'square', vol: 0.05, at: 0.13 }); },
    // глухой удар по корпусу резервуара
    knock() { if (!throttle('knock', 150)) return; tone(118, 0.4, { vol: 0.22 }); tone(236, 0.25, { vol: 0.07 }); noise(0.05, { f: 400, ftype: 'lowpass', vol: 0.18 }); },
    // металлический лязг по оборудованию
    clank() { if (!throttle('clank', 120)) return; tone(420, 0.18, { type: 'triangle', vol: 0.08 }); tone(1290, 0.12, { vol: 0.04 }); noise(0.03, { f: 2500, q: 2, vol: 0.12 }); },
    // гул горелки печи
    fire() { if (!throttle('fire', 600)) return; noise(0.9, { f: 180, fto: 420, ftype: 'lowpass', vol: 0.28, att: 0.12 }); noise(0.4, { f: 1200, q: 0.6, vol: 0.04, at: 0.1 }); },
    // электродвигатель насоса
    motor() { if (!throttle('motor', 600)) return; tone(70, 0.8, { type: 'sawtooth', vol: 0.05, to: 140, att: 0.15 }); tone(140, 0.8, { type: 'sine', vol: 0.04, to: 280, att: 0.15 }); },
    // касание экрана — мягкий щелчок
    touch() { if (!throttle('touch', 60)) return; tone(2400, 0.012, { type: 'sine', vol: 0.025 }); }
  };

  /* ---------- фоновый шум промысла: гул насосов + скрип СК в такт анимации (2,4 с) ---------- */
  function ambient(on, intensity = 1) {
    if (!ctx) return;
    const want = on && st.on && st.amb;
    if (want && !ambNodes) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
      const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 50;
      const hg = ctx.createGain(); hg.gain.value = 0.25;
      const g = ctx.createGain(); g.gain.value = 0.6;
      src.connect(lp); lp.connect(g); hum.connect(hg); hg.connect(g); g.connect(ambBus);
      src.start(); hum.start(); ambNodes = { src, hum };
      creakTimer = setInterval(() => { if (ready() && ambNodes) { noise(0.35, { f: 900, fto: 600, q: 6, vol: 0.035, att: 0.1, bus: ambBus }); noise(0.25, { f: 700, fto: 1000, q: 6, vol: 0.03, at: 1.2, att: 0.08, bus: ambBus }); } }, 2400);
    }
    if (ambNodes) {
      const v = want ? 0.06 * Math.max(0.3, Math.min(1, intensity)) : 0;
      ambBus.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
      if (!want) { const n = ambNodes; ambNodes = null; clearInterval(creakTimer); setTimeout(() => { try { n.src.stop(); n.hum.stop(); } catch (e) { } }, 1500); }
    }
  }

  function setOn(v) { st.on = !!v; save(); if (master) master.gain.setTargetAtTime(st.on ? st.vol : 0, ctx.currentTime, 0.05); if (!st.on) ambient(false); }
  function setVol(v) { st.vol = Math.max(0, Math.min(1, Number(v))); save(); if (master && st.on) master.gain.setTargetAtTime(st.vol, ctx.currentTime, 0.05); }
  function setAmb(v) { st.amb = !!v; save(); }
  function setTouch(v) { st.touch = !!v; save(); }
  function play(name) { if (!ctx || !st.on) return; try { (S[name] || S.click)(); } catch (e) { } }

  root.OMSound = { init, play, ambient, setOn, setVol, setAmb, setTouch, get settings() { return st; }, get ready() { return !!ctx; } };
})(typeof window !== 'undefined' ? window : globalThis);
