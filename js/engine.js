/* Oil Management 2.0 — движок симуляции.
   Чистая модель: не трогает DOM, детерминирована (собственный ГСЧ в состоянии), работает в браузере и в Node. */
(function (root) {
  'use strict';
  const D = root.OMData;
  const VERSION = 2;
  const SAVE_KEY = 'oil_management_2_save';
  const START = Date.UTC(2000, 0, 1);
  const DAY_MS = 86400000;
  const BBL = 7.33; // баррелей в тонне

  /* ===================== утилиты ===================== */
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r2 = n => Math.round(n * 100) / 100;
  const sum = (a, f) => a.reduce((t, x) => t + (f ? f(x) : x), 0);
  function rnd(s) { // mulberry32
    let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (s, a, b) => a + (b - a) * rnd(s);
  const ri = (s, a, b) => Math.floor(rr(s, a, b + 1));
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  function gauss(s) { let u = 0, v = 0; while (u === 0) u = rnd(s); v = rnd(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const dateOf = day => new Date(START + day * DAY_MS);
  const iso = day => dateOf(day).toISOString().slice(0, 10);
  function parts(day) { const d = dateOf(day); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() }; }
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysInYear = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
  const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
  const uid = s => s.nextId++;
  const has = (s, k) => !!s.tech[k];

  /* ===================== рынок ===================== */
  function interp(anchors, y, m, d) {
    const t = y * 12 + (m - 1) + (d - 1) / 31;
    const first = anchors[0], last = anchors[anchors.length - 1];
    const tf = first[0] * 12 + first[1] - 1, tl = last[0] * 12 + last[1] - 1;
    if (t <= tf) return first[2];
    if (t >= tl) return null;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1], b = anchors[i];
      const ta = a[0] * 12 + a[1] - 1, tb = b[0] * 12 + b[1] - 1;
      if (t <= tb) return a[2] + (b[2] - a[2]) * (t - ta) / (tb - ta);
    }
    return null;
  }
  function updateMarket(s) {
    const p = parts(s.day), M = s.market;
    M.noiseB = M.noiseB * 0.93 + gauss(s) * 0.011;
    M.noiseF = M.noiseF * 0.9 + gauss(s) * 0.002;
    const hb = M.mode === 'history' ? interp(D.BRENT, p.y, p.m, p.d) : null;
    if (hb != null) M.base = hb;
    else M.base = clamp(M.base * Math.exp(0.0012 * Math.log(70 / M.base) + gauss(s) * 0.013), 15, 180);
    const shock = effVal(s, 'priceShock', 1);
    M.brent = r2(clamp(M.base * (1 + M.noiseB) * shock, 10, 200));
    const hf = M.mode === 'history' ? interp(D.FX, p.y, p.m, p.d) : null;
    if (hf != null) M.fxBase = hf; else M.fxBase = M.fxBase * (1 + 0.00018 + gauss(s) * 0.002);
    M.fx = r2(M.fxBase * (1 + M.noiseF));
    s.priceIndex *= 1 + 0.072 / 365;
  }
  const oilPriceT = (s, discountUsd) => Math.max(0, s.market.brent - discountUsd) * BBL * s.market.fx; // ₸ за тонну
  const idx = s => s.priceIndex;

  /* ===================== эффекты (временные модификаторы) ===================== */
  function effVal(s, key, def) { const e = s.effects.find(x => x.key === key && x.until >= s.day); return e ? e.val : def; }
  function addEffect(s, key, days, val, label) {
    s.effects = s.effects.filter(x => x.key !== key);
    s.effects.push({ key, until: s.day + days, val, label });
  }

  /* ===================== финансы ===================== */
  const PNL = {
    revenue: ['Продажа нефти', 'Спотовая продажа', 'Продажа газа', 'Проценты по депозитам', 'Прочие доходы'],
    opex: ['ФОТ', 'Соц. налог', 'Электроэнергия', 'Топливо и газ', 'Закупка МТР', 'Транспорт нефти', 'Ремонт и ТО',
      'Подрядные работы', 'Обслуживание фонда', 'Утилизация воды', 'Найм персонала', 'Штрафы и неустойки', 'Прочие расходы', 'Промывка нефти',
      'Охрана труда и ПБ', 'Возмещение вреда', 'Плата за эмиссии'],
    taxes: ['НДПИ', 'Рентный налог', 'КПН', 'Налог на имущество'],
    interest: ['Проценты по кредитам'],
    capex: ['Капвложения', 'Технологии'],
    finance: ['Кредит получен', 'Погашение кредита', 'Депозит открыт', 'Депозит закрыт']
  };
  function transact(s, amount, cat, note, merge) {
    amount = Math.round(amount);
    if (!amount) return;
    s.cash += amount;
    s.mAcc[cat] = (s.mAcc[cat] || 0) + amount;
    s.yAcc[cat] = (s.yAcc[cat] || 0) + amount;
    const date = iso(s.day);
    if (merge) {
      const key = date.slice(0, 7) + '|' + cat + '|' + merge;
      const e = s.ledger.slice(0, 60).find(x => x.k === key);
      if (e) { e.a += amount; e.date = date; return; }
      s.ledger.unshift({ date, a: amount, cat, note, k: key });
    } else s.ledger.unshift({ date, a: amount, cat, note });
    if (s.ledger.length > 500) s.ledger.length = 500;
  }
  function pay(s, amount, cat, note) {
    if (amount > s.cash) throw new Error(`Недостаточно средств: нужно ${fmtMoney(amount)}`);
    transact(s, -amount, cat, note);
  }
  const fmtMoney = n => Math.round(n).toLocaleString('ru-RU') + ' ₸';
  function log(s, text, type = 'info') {
    s.log.unshift({ date: iso(s.day), text, type });
    if (s.log.length > 250) s.log.length = 250;
    s.flash.push({ text, type });
  }

  /* ===================== сводки по активам ===================== */
  const facs = (s, type) => s.fac.filter(f => f.type === type);
  const hF = h => 0.6 + 0.4 * h / 100;
  function capOf(s, type) { return sum(facs(s, type).filter(f => f.status === 'ok'), f => f.cap * hF(f.health)); }
  function tanks(s, purpose) { return s.fac.filter(f => D.BUILD[f.type].tank && f.purpose === purpose); }
  function tankCap(s, purpose) { return sum(tanks(s, purpose).filter(t => t.status === 'ok'), t => t.cap * (t.clean || 1)); }
  function tankVol(s, purpose) { return sum(tanks(s, purpose), t => t.volume); }
  function fillTanks(s, purpose, delta) {
    const list = tanks(s, purpose).filter(t => t.status === 'ok');
    if (delta > 0) {
      let rest = delta;
      for (let pass = 0; pass < 3 && rest > 1e-6; pass++) {
        const free = sum(list, t => t.cap * (t.clean || 1) - t.volume);
        if (free <= 1e-6) break;
        const add = Math.min(rest, free);
        for (const t of list) { const f = t.cap * (t.clean || 1) - t.volume; t.volume += add * f / free; }
        rest -= add;
      }
      return delta - rest;
    } else {
      let need = -delta; const tot = sum(list, t => t.volume);
      if (tot <= 1e-6) return 0;
      const take = Math.min(need, tot);
      for (const t of list) t.volume = Math.max(0, t.volume - take * t.volume / tot);
      return -take;
    }
  }
  function assetSummary(s) {
    const prod = s.wells.filter(w => w.type !== 'inj' && w.type !== 'water');
    const staff = sum(Object.values(s.staff), x => x.n);
    return {
      wells: s.wells.length, prodWells: prod.length, injWells: s.wells.filter(w => w.type === 'inj').length,
      cdng: s.cdngs.length, ckppnBlocks: facs(s, 'ckppn').length, upsv: facs(s, 'upsv').length,
      tanks: s.fac.filter(f => D.BUILD[f.type].tank).length, bkns: facs(s, 'bkns').length,
      uppg: facs(s, 'uppg').length, mks: facs(s, 'gascomp').length, gwellsOn: (s.gwells || []).filter(w => w.status !== 'idle').length,
      powerUnits: facs(s, 'substation').length + facs(s, 'gtes').length + facs(s, 'dgu').length,
      equipment: s.fac.length + Math.ceil((s.wells.length + (s.gwells || []).filter(w => w.status !== 'idle').length) / 3), staff
    };
  }
  function staffNeed(s) { const a = assetSummary(s); const o = {}; for (const r of D.ROLES) o[r.key] = r.need(a); return o; }
  function coverage(s) {
    const need = staffNeed(s); const cov = {}; const byDept = {};
    const active = {}; if (s.people) for (const p of s.people) if (!(p.sickUntil > s.day)) active[p.role] = (active[p.role] || 0) + 1;
    for (const r of D.ROLES) {
      const have = s.people ? (active[r.key] || 0) : s.staff[r.key].n;
      const c = need[r.key] ? clamp(have / need[r.key], 0, 1.2) : 1;
      cov[r.key] = c;
      (byDept[r.dept] = byDept[r.dept] || []).push(Math.min(1, c));
    }
    const sick = effVal(s, 'sick', 1), strike = effVal(s, 'strike', 1);
    const dept = {};
    const sk = s.people ? deptSkill(s) : {};
    for (const k in byDept) dept[k] = clamp(sum(byDept[k]) / byDept[k].length * sick * (k === 'cdng' || k === 'prs' ? strike : 1) * (sk[k] ? clamp(0.88 + 0.12 * sk[k], 0.9, 1.04) : 1), 0, 1.04);
    return { role: cov, dept, need };
  }
  const moraleF = s => 0.82 + 0.18 * s.morale / 100;

  /* ===================== энергия ===================== */
  function energyDemand(s, util) {
    const vfd = has(s, 'vfd') ? 0.85 : 1; const p = parts(s.day);
    let wells = 0;
    for (const w of s.wells) if (w.status === 'work' && w.connected) wells += (w.type === 'ecn' ? 70 : w.type === 'water' ? 30 : w.type === 'inj' ? 0 : 25) * (0.4 + 0.6 * util.k);
    wells *= vfd;
    const items = {
      'Скважины': wells,
      'АГЗУ': facs(s, 'agzu').length * 5,
      'УПСВ': sum(facs(s, 'upsv'), () => 60 * (0.3 + 0.7 * util.upsv)),
      'ЦКППН': sum(facs(s, 'ckppn'), () => 120 * (0.3 + 0.7 * util.ckppn)),
      'БКНС (ППД)': sum(facs(s, 'bkns'), () => 250 * (0.1 + 0.9 * util.bkns)) * vfd,
      'Внешняя перекачка': sum(facs(s, 'pump_ext'), () => 45 * (0.2 + 0.8 * util.ship)) * vfd,
      'МКС (компрессор ПНГ)': sum(facs(s, 'gascomp'), () => 180 * (0.25 + 0.75 * (util.gas != null ? util.gas : 0.8))),
      'УППГ': sum(facs(s, 'uppg'), () => 90 * (0.3 + 0.7 * Math.min(1, s.today && s.today.gas && s.today.gas.load != null ? s.today.gas.load : 0.5))),
      'Цеха и АБК': 80 + s.cdngs.length * 20 + assetSummary(s).staff * 0.4
    };
    const season = (p.m === 12 || p.m <= 2) ? 1.06 : (p.m >= 6 && p.m <= 8) ? 1.08 : 1;
    const w = effVal(s, 'heat', 1) * effVal(s, 'cold', 1) * effVal(s, 'energySave', 1);
    for (const k in items) items[k] *= season * w;
    return { items, total: sum(Object.values(items)) };
  }
  function energySupply(s, cov) {
    const out = effVal(s, 'gridOut', 0) ? 0 : 1;
    const elec = 0.85 + 0.15 * (cov ? cov.dept.energy : 1);
    const grid = capOf(s, 'substation') * out * elec;
    // ГТЭС работает на попутном газе: мощность ограничена газом, оставшимся после подогрева печей (≈0,32 м³ на 1 кВт·ч)
    const g0 = s.today && s.today.gas;
    const gasForGtes = g0 ? Math.max(0, g0.prod - g0.heat) + (g0.natNet || 0) : Infinity;
    const gtes = Math.min(capOf(s, 'gtes') * elec, gasForGtes / (24 * 0.32));
    const ses = capOf(s, 'ses') * 0.25;
    const dgu = s.auto.dgu && s.stock.diesel > 50 ? capOf(s, 'dgu') : 0;
    return { ses, gtes, grid, dgu, total: ses + gtes + grid + dgu };
  }

  /* ===================== ЦКППН: качество ===================== */
  function qualityOf(s, load, doseEff, cov) {
    const T = s.ckppnSet.temp;
    let r = 2.6 * Math.exp(-(T - 30) / 25) * (1.35 - 0.45 * Math.min(doseEff, 1.8));
    if (load > 0.9) r *= 1 + (load - 0.9) * 3;
    if (has(s, 'edeh')) r *= 0.6;
    if (has(s, 'ai')) r *= 0.9;
    r *= 1 + (1 - cov) * 0.8;
    const ck = facs(s, 'ckppn'); const avgH = ck.length ? sum(ck, f => f.health) / ck.length : 100;
    r *= 1 + (100 - avgH) / 200;
    r = clamp(r, 0.05, 6);
    const salt = r * 240 * (s.ckppnSet.wash ? 0.45 : 1);
    let group = 4;
    if (r <= 0.5 && salt <= 100) group = 1; else if (r <= 0.5 && salt <= 300) group = 2; else if (r <= 1.0 && salt <= 900) group = 3;
    return { water: r2(r), salt: Math.round(salt), group };
  }
  const QUALITY_DISC = { 1: 0, 2: 0.015, 3: 0.04, 4: 0.3 };

  /* ===================== один игровой день ===================== */
  function tick(s) {
    if (s.gameOver || s.pending || (s.report && s.report.open)) return false;
    s.day++;
    const p = parts(s.day);
    updateMarket(s);
    s.effects = s.effects.filter(e => e.until >= s.day);

    const cov = coverage(s);
    const today = { date: iso(s.day) };

    /* --- подключение скважин к АГЗУ и ЦДНГ --- */
    let agzuSlots = Math.floor(sum(facs(s, 'agzu').filter(f => f.status === 'ok'), f => f.cap));
    for (const w of s.wells) {
      if (w.type === 'inj' || w.type === 'water') { w.connected = true; continue; }
      w.connected = agzuSlots > 0; if (w.connected) agzuSlots--;
    }

    /* --- потенциал добычи --- */
    const R = s.reservoir;
    const pf = clamp(0.3 + 0.7 * R.pressure / 100, 0.3, 1.07);
    const reserveF = clamp(Math.pow(R.remaining / R.total, 0.3), 0.15, 1);
    const weather = effVal(s, 'storm', 1) * effVal(s, 'coldProd', 1);
    const tech = (has(s, 'smart') ? 1.05 : 1) * (has(s, 'ai') ? 1.04 : 1);
    const mF = moraleF(s);
    const rate = {}; let L = 0, O = 0, W = 0;
    const cdF = {}; for (const c of s.cdngs) { const e = chiefEff(s, c); cdF[c.id] = { prod: 0.85 + 0.15 * e, fail: clamp(1.25 - 0.25 * e, 0.8, 1.2) }; }
    for (const w of s.wells) {
      if (w.type === 'inj' || w.type === 'water' || w.status !== 'work' || !w.connected) continue;
      const cdCov = cov.dept.cdng;
      const liq = w.potential * pf * reserveF * (0.7 + 0.3 * w.health / 100) * (0.55 + 0.45 * cdCov) * mF * weather * tech * (cdF[w.cdng] ? cdF[w.cdng].prod : 1);
      rate[w.id] = liq; L += liq; O += liq * (1 - w.wc); W += liq * w.wc;
    }

    /* --- энергия (предварительно при полной загрузке) --- */
    const sup = energySupply(s, cov);
    const rawUpsv = capOf(s, 'upsv'), rawCk = capOf(s, 'ckppn'), rawBk = capOf(s, 'bkns'), rawSh = capOf(s, 'pump_ext');
    const estShip = sum(s.contracts.filter(c => c.status === 'active'), c => c.monthly / 30);
    const gasCapPrev = capOf(s, 'gascomp'); const gasUtilPrev = gasCapPrev && s.today && s.today.gas ? Math.min(1, s.today.gas.sale / gasCapPrev) : 0;
    const demFull = energyDemand(s, { gas: gasUtilPrev, k: 1, upsv: rawUpsv ? Math.min(1, L / rawUpsv) : 0, ckppn: rawCk ? Math.min(1, (O + W * 0.1) / rawCk) : 0,
      bkns: rawBk ? Math.min(1, L * s.ppd.comp / 100 / rawBk) : 0, ship: rawSh ? Math.min(1, estShip / rawSh) : 0 });
    const energyF = demFull.total > 0 ? clamp(sup.total / demFull.total, 0, 1) : 1;
    // при дефиците энергии отключаются насосы; скважины ограничиваются пропорционально
    if (energyF < 1) { for (const id in rate) rate[id] *= energyF; L *= energyF; O *= energyF; W *= energyF; }
    const capUpsv = capOf(s, 'upsv') * (0.6 + 0.4 * cov.dept.ckppn);
    const capCk = capOf(s, 'ckppn') * (0.6 + 0.4 * cov.dept.ckppn) * energyF;
    const injWellCap = sum(s.wells.filter(w => w.type === 'inj' && w.status === 'work'), w => w.potential * (0.7 + 0.3 * w.health / 100));
    const srcCap = sum(s.wells.filter(w => w.type === 'water' && w.status === 'work'), w => w.potential * (0.7 + 0.3 * w.health / 100)) * energyF;
    const capBkns = Math.min(capOf(s, 'bkns') * (0.5 + 0.5 * cov.dept.ppd) * energyF * effVal(s, 'bknsFail', 1), injWellCap);
    const capShip = capOf(s, 'pump_ext') * energyF;

    /* --- отгрузка по договорам (из товарных РВС) --- */
    const q0 = s.quality;
    let oilStock = tankVol(s, 'oil');
    const dim = daysInMonth(p.y, p.m); const daysLeft = dim - p.d + 1;
    const wants = [];
    for (const c of s.contracts) {
      if (c.status !== 'active') continue;
      const need = Math.max(0, c.monthly - c.shippedMonth);
      if (need <= 0) continue;
      wants.push({ c, q: need / daysLeft * (daysLeft <= 3 ? 1.6 : 1.15) });
    }
    let shipTotal = 0; const shipped = [];
    if (wants.length) {
      if (q0.group === 4) {
        if (!s.flags.badQ || s.flags.badQ < s.day - 10) { log(s, 'Некондиционная нефть: покупатели отказываются от приёмки. Настройте режим ЦКППН!', 'bad'); s.flags.badQ = s.day; }
      } else {
        const totalWant = sum(wants, x => x.q);
        const lim = Math.min(capShip, oilStock);
        const f = totalWant > lim ? lim / totalWant : 1;
        for (const x of wants) {
          const q = Math.min(x.q * f, x.c.monthly - x.c.shippedMonth);
          if (q <= 0.01) continue;
          const ch = D.CHANNELS[x.c.channel];
          const price = oilPriceT(s, ch.discount + x.c.discount) * (1 - QUALITY_DISC[q0.group]);
          x.c.shippedMonth += q; x.c.shippedTotal += q; shipTotal += q;
          transact(s, q * price, 'Продажа нефти', `${x.c.buyer} (договор №${x.c.id})`, 'c' + x.c.id);
          transact(s, -q * ch.tariff * idx(s), 'Транспорт нефти', ch.name, x.c.channel);
          if (ch.export) s.mExportRev += q * price;
          shipped.push({ id: x.c.id, q });
        }
        fillTanks(s, 'oil', -shipTotal);
        oilStock -= shipTotal;
      }
    }
    s.mSold += shipTotal;

    /* --- технологическая цепочка: подбор коэффициента загрузки k методом бисекции --- */
    const sep = 0.9 * (0.9 + 0.1 * cov.dept.ckppn);
    const tech0 = tankVol(s, 'tech'), techCap = tankCap(s, 'tech');
    const water0 = tankVol(s, 'water'), waterCap = tankCap(s, 'water');
    const oilFree = Math.max(0, tankCap(s, 'oil') - oilStock);
    const quota = effVal(s, 'quota', 1);
    const doseNeed = s.ckppnSet.dose * (has(s, 'ai') ? 0.8 : 1);
    const comp = s.ppd.comp / 100;
    const utilCap = s.auto.util ? 300 : 0;
    function sim(k) {
      const Ein = k * (O + W * (1 - sep)), EinW = k * W * (1 - sep), Win = k * W * sep;
      const vol = tech0 + Ein; const wf = vol > 0 ? (tech0 * s.techWf + EinW) / vol : 0;
      // рабочий уровень технологических РВС (отстой эмульсии): налив до ~45%, затем сработка до ~30%
      const reserveT = techCap * 0.30;
      const fillingT = s.flags.tFill !== false && tech0 < reserveT + techCap * 0.15;
      let P = Math.min(capCk, vol, fillingT ? Ein * 0.6 : Math.max(vol - reserveT, Ein * 0.6));
      const resid = s.quality.water / 100;
      let product = P * (1 - wf) / (1 - resid);
      if (product > oilFree) { P = P * oilFree / product; product = oilFree; }
      const removedW = Math.max(0, P * wf - product * resid);
      const techAfter = vol - P;
      const wVol = water0 + Win + removedW;
      const injTarget = k * L * comp;
      // неснижаемый остаток: БКНС не выкачивает водяные РВС ниже ~40%; пока уровень ниже — забирает только 70% дневного притока
      const reserve = waterCap * (s.ppd.reserve != null ? s.ppd.reserve : 40) / 100;
      const inflowW = Win + removedW;
      // цикл «налив до остатка+15% → сработка до остатка»: уровень в РВС живой, как у операторов
      const filling = s.flags.wFill !== false && water0 < reserve + waterCap * 0.15;
      const injProduced = Math.min(capBkns, wVol, injTarget, filling ? inflowW * 0.55 : Math.max(wVol - reserve, inflowW * 0.55));
      const injSource = Math.min(capBkns - injProduced, srcCap, Math.max(0, injTarget - injProduced));
      let wAfter = wVol - injProduced; let util = 0;
      if (wAfter > waterCap) { util = Math.min(utilCap, wAfter - waterCap); wAfter -= util; }
      // избыток воды можно закачать сверх цели компенсации, если есть мощность БКНС
      let extra = 0;
      if (wAfter > waterCap) { extra = Math.min(capBkns - injProduced - injSource, wAfter - waterCap); wAfter -= extra; }
      return { ok: techAfter <= techCap + 1e-6 && wAfter <= waterCap + 1e-6, Ein, EinW, Win, P, wf, product, removedW, techAfter, wAfter, inj: injProduced + injSource + extra, injSource, util };
    }
    let kMax = Math.min(1, quota, L > 0 ? capUpsv / L : 1);
    let k = kMax, res = sim(k);
    let limit = kMax < 1 ? (quota < 1 && quota <= kMax + 1e-9 ? 'Квота ОПЕК+' : 'Мощность УПСВ') : '';
    if (!res.ok) {
      let lo = 0, hi = kMax;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (sim(mid).ok) lo = mid; else hi = mid; }
      k = lo; res = sim(k);
      limit = res.techAfter >= techCap - 1 ? (oilFree < 1 ? 'Переполнены товарные РВС' : 'Переполнены технологические РВС / мощность ЦКППН') : 'Переполнены водяные РВС';
    }
    if (energyF < 0.999) limit = (limit ? limit + '; ' : '') + 'Дефицит электроэнергии';

    // применяем
    const loadCk = capCk > 0 ? res.P / Math.max(1, capOf(s, 'ckppn')) : 0;
    const demulgNeed = res.P * 0.15 * doseNeed;
    const demulgUse = Math.min(demulgNeed, s.stock.demulg);
    s.stock.demulg -= demulgUse;
    const doseEff = demulgNeed > 0 ? doseNeed * demulgUse / demulgNeed : doseNeed;
    s.quality = qualityOf(s, loadCk, doseEff, cov.dept.ckppn);
    s.techWf = res.techAfter > 0 ? clamp((tech0 * s.techWf + res.EinW - res.P * res.wf) / res.techAfter, 0, 0.6) : s.techWf;
    fillTanks(s, 'tech', res.techAfter - tech0);
    { const tc = tankCap(s, 'tech'), lv = tankVol(s, 'tech');
      if (lv >= tc * 0.45) s.flags.tFill = false; else if (lv <= tc * 0.30 + 1) s.flags.tFill = true; }
    fillTanks(s, 'oil', res.product);
    fillTanks(s, 'water', res.wAfter - water0);
    { const wc = tankCap(s, 'water'), rsv = wc * (s.ppd.reserve != null ? s.ppd.reserve : 40) / 100, lv = tankVol(s, 'water');
      if (lv >= rsv + wc * 0.15) s.flags.wFill = false; else if (lv <= rsv + 1) s.flags.wFill = true; }
    const inhNeed = (res.Win + res.removedW) * 0.012;
    const inhUse = Math.min(inhNeed, s.stock.inhib); s.stock.inhib -= inhUse;
    s.flags.inhibOk = inhNeed <= 0 || inhUse >= inhNeed * 0.95;
    // топливо печей и промывка
    transact(s, -res.P * Math.max(0, s.ckppnSet.temp - 20) * 8 * idx(s), 'Топливо и газ', 'Подогрев нефти в печах ЦКППН', 'heat');
    if (s.ckppnSet.wash) transact(s, -res.P * 30 * idx(s), 'Промывка нефти', 'Пресная вода для обессоливания', 'wash');
    if (res.util > 0) transact(s, -res.util * 1800 * idx(s), 'Утилизация воды', 'Вывоз подтоварной воды автоцистернами', 'util');

    /* --- скважины: факт по ЦДНГ, износ, отказы --- */
    const dayOil = O * k, dayLiq = L * k, dayWater = W * k;
    const pk = ym(p.y, p.m);
    const PF = ensurePF(s, p.y);
    const wearMul = (1.5 - 0.5 * cov.dept.repair) * (has(s, 'tele') ? 0.9 : 1);
    const failMul = (has(s, 'smart') ? 0.8 : 1) * (has(s, 'tele') ? 0.9 : 1) * (1.3 - 0.3 * cov.dept.repair);
    const overInj = R.pressure > 105 ? 2 : 1;
    for (const w of s.wells) {
      if (w.status === 'work') {
        if (rate[w.id] !== undefined) {
          const q = rate[w.id] * k; const qo = q * (1 - w.wc);
          w.cumOil += qo; w.today = qo; w.todayL = q;
          PF.fact[p.m - 1][w.cdng] = (PF.fact[p.m - 1][w.cdng] || 0) + qo;
          w.wc = clamp(w.wc + (w.type === 'ecn' ? 0.00006 : 0.00004) * overInj * (1.2 - 0.4 * cov.dept.geo), 0, 0.98);
          w.potential *= 1 - 0.00012;
        } else { w.today = 0; w.todayL = 0; }
        const wear = (w.type === 'ecn' ? 0.045 : w.type === 'inj' ? 0.02 : 0.03) * wearMul;
        w.health = clamp(w.health - wear, 1, 100);
        const pFail = 0.0011 * (1 + Math.pow((100 - w.health) / 20, 2)) * failMul * (w.type === 'ecn' ? 1.2 : 1) * (cdF[w.cdng] ? cdF[w.cdng].fail : 1);
        if (rnd(s) < pFail) failWell(s, w);
      } else { w.today = 0; w.todayL = 0; if (w.status === 'fail') w.down = (w.down || 0) + 1; }
      if ((w.type === 'sk' || w.type === 'ecn') && w.status !== 'work' && w.status !== 'idle') { const st = cdStat(s, w.cdng); st.down++; }
    }
    // ремонты собственными бригадами
    progressRepairs(s, cov);
    if (s.auto.prs) autoAssignRepairs(s);

    /* --- износ объектов --- */
    const WEAR = { agzu: 0.01, upsv: 0.012, ckppn: 0.012, bkns: 0.02, pump_ext: 0.015, substation: 0.006, gtes: 0.015, dgu: 0.01, ses: 0.006, cdng: 0.004, uppg: 0.012, gascomp: 0.014 };
    for (const f of s.fac) {
      if (f.status === 'service') {
        f.serviceDays--;
        // после аварии РВС возвращается в работу, когда истёк срок восстановления (если на нём нет подрядных работ)
        if (f.serviceDays <= 0 && !s.projects.some(p => p.target === f.id)) { f.status = 'ok'; log(s, `${f.name}: восстановительные работы завершены, резервуар снова в работе`, 'good'); }
        continue;
      }
      let wr = D.BUILD[f.type].tank ? (s.flags.inhibOk ? 0.008 : 0.02) : (WEAR[f.type] || 0.01);
      f.health = clamp(f.health - wr * wearMul, 1, 100);
      if (f.status === 'ok' && f.health < 25 && !D.BUILD[f.type].tank && rnd(s) < 0.004) {
        f.status = 'fail'; log(s, `Авария: остановлен ${f.name} (износ ${Math.round(f.health)}%). Требуется ремонт.`, 'bad');
      }
    }
    if (s.auto.to) autoMaintain(s, cov);

    /* --- пласт --- */
    R.remaining = Math.max(0, R.remaining - dayOil);
    const dP = 0.05 * (res.inj - dayLiq) / Math.max(400, dayLiq) + 0.004 * (100 - R.pressure) / 100;
    R.pressure = clamp(R.pressure + dP, 25, 115);

    /* --- энергия: фактическое потребление и стоимость --- */
    const util = { gas: gasUtilPrev, k, upsv: capUpsv > 0 ? dayLiq / Math.max(1, capOf(s, 'upsv')) : 0, ckppn: loadCk, bkns: capOf(s, 'bkns') > 0 ? res.inj / capOf(s, 'bkns') : 0, ship: capOf(s, 'pump_ext') > 0 ? shipTotal / capOf(s, 'pump_ext') : 0 };
    const dem = energyDemand(s, util);
    let need = Math.min(dem.total, sup.total); const used = {};
    for (const src of ['ses', 'gtes', 'grid', 'dgu']) { const u = Math.min(need, sup[src]); used[src] = u; need -= u; }
    const kwh = x => x * 24;
    transact(s, -kwh(used.grid) * 2.6 * idx(s), 'Электроэнергия', 'Сетевая электроэнергия', 'grid');
    if (used.gtes > 0) transact(s, -kwh(used.gtes) * 0.7 * idx(s), 'Электроэнергия', 'Генерация ГТЭС (попутный газ)', 'gtes');
    if (used.dgu > 0) s.stock.diesel = Math.max(0, s.stock.diesel - kwh(used.dgu) * 0.27);
    // попутный нефтяной газ: подогрев печей, ГТЭС, сдача на ГПЗ, остальное — факел
    const H = s.hse;
    const gasProd = dayOil * 85 * (1 + 0.4 * (1 - clamp(R.remaining / R.total, 0, 1)));
    const gasHeat = Math.min(gasProd, res.P * Math.max(0, s.ckppnSet.temp - 20) * 0.03);
    // ЦДПиТГ: МКС (аварийные остановы по защите) и природный газ через УППГ
    const mksF = facs(s, 'gascomp').filter(f => f.status === 'ok');
    if (s.gasTrip > 0) s.gasTrip--;
    else if (mksF.length && rnd(s) < 0.002 * (1 + (100 - sum(mksF, f => f.health) / mksF.length) / 25)) { s.gasTrip = 1; log(s, 'МКС: аварийный останов по защите — ПНГ на факел', 'warn'); }
    const mksCap = s.gasTrip > 0 ? 0 : capOf(s, 'gascomp') * energyF * (0.7 + 0.3 * (cov.dept.gas != null ? cov.dept.gas : 1));
    const N = natGasDay(s, cov, energyF);
    const natNet = Math.max(0, N.flow - N.boiler);
    const gtesNeed = kwh(used.gtes || 0) * 0.32;
    const gasGtes = Math.min(gasProd - gasHeat, gtesNeed);
    const gasGtesN = Math.min(natNet, Math.max(0, gtesNeed - gasGtes));
    const gasSale = Math.min(gasProd - gasHeat - gasGtes, mksCap);
    const natSale = natNet - gasGtesN;
    if (gasSale > 0) transact(s, gasSale * GAS_PRICE_P * idx(s), 'Продажа газа', 'Попутный газ (МКС)', 'gas');
    if (natSale > 0) transact(s, natSale * GAS_PRICE_N * (N.ok ? 1 : 0.7) * idx(s), 'Продажа газа', 'Природный газ (УППГ)', 'natgas');
    const gasUsed = gasHeat + gasGtes + gasSale;
    s.mGas += gasProd; s.mGasUsed += gasUsed; s.mFlare += gasProd - gasUsed; s.mGasN += N.flow; s.mGasNS += natSale;
    today.gas = { prod: gasProd, heat: gasHeat, gtes: gasGtes, sale: gasSale, flare: gasProd - gasUsed, util: gasProd > 0 ? gasUsed / gasProd : 1,
      mksCap, trip: s.gasTrip > 0, nat: N.flow, natPot: N.pot, natNet, gtesN: gasGtesN, natSale, boiler: N.boiler, dew: N.dew, norm: N.norm, ok: N.ok, load: N.load, deg: N.degUse, hyd: s.gasHyd > 0 };
    // ОТ и ПБ: износ готовности и культуры безопасности, несчастные случаи
    H.readiness = clamp(H.readiness - 0.05, 0, 100); H.culture = clamp(H.culture - 0.03, 0, 100);
    H.daysNoInj++;
    hseDaily(s, cov);
    // аналитика фонда
    const prodWellsAll = s.wells.filter(w => w.type === 'sk' || w.type === 'ecn');
    s.mWellDays += prodWellsAll.length; s.mWorkDays += prodWellsAll.filter(w => w.status === 'work' && w.connected && (w.today || 0) > 0).length;
    // срочные депозиты: возврат при наступлении срока
    for (const d of s.deposits.filter(d => d.end != null && s.day >= d.end)) {
      transact(s, d.principal, 'Депозит закрыт', `Возврат депозита №${d.id} (${D.DEPOSITS[d.type].name})`);
      if (d.amount > d.principal) transact(s, d.amount - d.principal, 'Проценты по депозитам', `Капитализированные проценты, депозит №${d.id}`);
      log(s, `Депозит №${d.id} закрыт по сроку: возвращено ${fmtMoney(d.amount)} (доход ${fmtMoney(d.amount - d.principal)})`, 'good');
    }
    s.deposits = s.deposits.filter(d => !(d.end != null && s.day >= d.end));
    // ГСМ транспорта и СИЗ
    s.stock.diesel = Math.max(0, s.stock.diesel - s.wells.length * 3 * (0.6 + 0.4 * cov.dept.trans));
    s.stock.ppe = Math.max(0, s.stock.ppe - assetSummary(s).staff / 365);

    /* --- персонал: найм, мораль --- */
    for (const c of s.cdngs) if (c.incoming && --c.incoming.days <= 0) { c.chief = c.incoming.chief; c.chief.since = iso(s.day); c.incoming = null; c.candidates = []; log(s, `${c.name}: к работе приступил новый начальник цеха ${c.chief.name} (коэффициент ${c.chief.eff.toFixed(2)})`, 'good'); }
    for (const h of s.hires) h.days--;
    for (const h of s.hires.filter(h => h.days <= 0)) { addPeople(s, h.role, h.n, { age: null }); log(s, `Приняты на работу: ${roleName(h.role)} — ${h.n} чел.`, 'good'); }
    s.hires = s.hires.filter(h => h.days > 0);
    const avgPct = sum(D.ROLES, r => s.staff[r.key].pct * s.staff[r.key].n) / Math.max(1, assetSummary(s).staff);
    const avgCov = sum(Object.values(cov.dept)) / Object.keys(cov.dept).length;
    const target = clamp(62 + (avgPct - 100) * 1.3 - (1 - avgCov) * 45 + (s.stock.ppe > 0 ? 0 : -10) + effVal(s, 'moraleBoost', 0), 5, 98);
    s.morale = clamp(s.morale + (target - s.morale) * 0.03, 0, 100);

    /* --- склад: поставки и автозакупка --- */
    for (const o of s.orders) o.days--;
    for (const o of s.orders.filter(o => o.days <= 0)) { s.stock[o.key] += o.qty; log(s, `Поставка на склад: ${matName(o.key)} — ${fmtNum(o.qty)} ${matUnit(o.key)}`, 'good'); }
    s.orders = s.orders.filter(o => o.days > 0);
    if (s.auto.buy && p.wd === 1) autoBuy(s);

    /* --- стройка и подряд --- */
    progressProjects(s);

    /* --- дневная сводка --- */
    Object.assign(today, {
      oil: dayOil, liquid: dayLiq, water: dayWater, potOil: O, product: res.product, k, limit, pf, energyF, inj: res.inj, injSource: res.injSource, util: res.util, P: res.P,
      ship: shipTotal, shipped, cap: { upsv: capUpsv, ckppn: capCk, bkns: capBkns, ship: capShip, src: srcCap, injWells: injWellCap },
      energy: { demand: dem.total, items: dem.items, supply: sup, used }, wcAvg: dayLiq > 0 ? dayWater / dayLiq : 0
    });
    s.today = today;
    s.mProd += dayOil; s.mLiq += dayLiq; s.mInj += res.inj; s.yProd += dayOil;
    s.daily.push({ d: today.date, oil: r2(dayOil), liq: r2(dayLiq), ship: r2(shipTotal), brent: s.market.brent, fx: s.market.fx,
      tOil: r2(tankVol(s, 'oil')), tTech: r2(tankVol(s, 'tech')), tWater: r2(tankVol(s, 'water')), p: r2(R.pressure), cash: Math.round(s.cash),
      eD: Math.round(dem.total), eS: Math.round(sup.total), q: s.quality.water, gN: Math.round(N.flow), dew: N.dew == null ? null : r2(N.dew) });
    if (s.daily.length > 400) s.daily.shift();

    /* --- события, цели, закрытие месяца --- */
    scheduledEvents(s);
    randomEvents(s, cov);
    checkGoals(s);
    const next = parts(s.day + 1);
    if (next.m !== p.m) closeMonth(s, p.y, p.m);
    if (next.y !== p.y) closeYear(s, p.y);
    return true;
  }

  /* ===================== кадровый реестр ===================== */
  const FEM_LAST = l => (/(ов|ев|ин)$/.test(l) ? l + 'а' : l);
  // фамилия без женского окончания — для проверки повторов
  const baseLast = name => { const l = String(name || '').split(' ')[0]; return /(ова|ева|ина)$/.test(l) ? l.slice(0, -1) : l; };
  function usedSurnames(s) {
    const u = new Set(); const add = x => { if (x && x.name) u.add(baseLast(x.name)); };
    for (const p of s.people || []) add(p);
    for (const c of s.cdngs || []) { add(c.chief); if (c.incoming) add(c.incoming.chief); for (const k of c.candidates || []) add(k); }
    return u;
  }
  function kazName(s, g) {
    const used = usedSurnames(s); const free = D.LAST.filter(l => !used.has(l));
    const first = pick(s, g === 'f' ? D.FIRST_F : D.FIRST_M), last = pick(s, free.length ? free : D.LAST);
    return `${g === 'f' ? FEM_LAST(last) : last} ${first}`;
  }
  function makeFace(s, g, age) {
    return { skin: ri(s, 0, 4), hair: ri(s, 0, 3), hs: ri(s, 0, 2), eye: ri(s, 0, 2), mus: g === 'm' && rnd(s) < 0.3, beard: g === 'm' && rnd(s) < 0.12, gls: rnd(s) < 0.18 + (age > 45 ? 0.15 : 0), d: r2(rr(s, 0, 4)) };
  }
  const FEM_DEPTS = ['hse', 'geo', 'aup'];
  function makePerson(s, role, o = {}) {
    // коллектив ≈99% мужчин; женщины — только экология/ОТ, геология и бухгалтерия (АУП)
    const g = o.g || (FEM_DEPTS.includes(D.ROLES.find(r => r.key === role).dept) && rnd(s) < 0.12 ? 'f' : 'm');
    const y = parts(s.day).y;
    const age = o.age != null ? o.age : ri(s, 21, 58);
    const prior = Math.max(0, Math.min(age - 19, o.prior != null ? o.prior : ri(s, 0, Math.max(0, age - 20))));
    const p = {
      id: uid(s), role, g, name: kazName(s, g),
      by: y - age, bm: ri(s, 1, 12), hired: o.hired || iso(s.day), prior,
      grade: clamp(o.grade || 2 + Math.min(4, Math.floor(prior / 6) + ri(s, 0, 1)), 2, 6),
      skill: r2(clamp(0.7 + prior * 0.012 + rr(s, -0.12, 0.15), 0.55, 1.3)), mood: ri(s, 55, 85), awards: 0, trained: 0, lastTrain: -999,
      cdng: null, face: null
    };
    p.face = makeFace(s, g, age);
    if (D.ROLES.find(r => r.key === role).dept === 'cdng' && s.cdngs.length) p.cdng = s.cdngs[s.people.filter(x => x.role === role).length % s.cdngs.length].id;
    return p;
  }
  const yearsBetween = (fromIso, toDay) => (toDay - Math.round((Date.parse(fromIso) - START) / DAY_MS)) / 365.25;
  function personAge(s, p) { const d = parts(s.day); return d.y - p.by - (d.m < p.bm ? 1 : 0) + (d.m - p.bm + (d.m < p.bm ? 12 : 0)) / 12; }
  function pensionAge(s, p) { return D.PENSION[p.g](parts(s.day).y); }
  function yearsToPension(s, p) { return Math.max(0, pensionAge(s, p) - personAge(s, p)); }
  function tenure(s, p) { return Math.max(0, yearsBetween(p.hired, s.day)); }
  function personSalary(s, p) {
    const r = D.ROLES.find(x => x.key === p.role); const pct = (s.staff[p.role] ? s.staff[p.role].pct : 100) / 100;
    const gradeK = 1 + (p.grade - 3) * 0.08, senior = Math.min(0.25, 0.02 * Math.floor(tenure(s, p)));
    return { base: r.salary * idx(s) * pct * gradeK, senior, total: r.salary * idx(s) * pct * gradeK * (1 + senior) };
  }
  function syncStaff(s) { for (const r of D.ROLES) s.staff[r.key].n = s.people.filter(p => p.role === r.key).length; }
  function addPeople(s, role, n, o = {}) { for (let i = 0; i < n; i++) s.people.push(makePerson(s, role, o)); syncStaff(s); }
  function removePeople(s, role, n) {
    const list = s.people.filter(p => p.role === role).sort((a, b) => a.skill - b.skill).slice(0, n);
    const ids = new Set(list.map(p => p.id)); s.people = s.people.filter(p => !ids.has(p.id)); syncStaff(s); return list;
  }
  function deptSkill(s) {
    const o = {}, n = {};
    for (const p of s.people) { const d = D.ROLES.find(r => r.key === p.role).dept; o[d] = (o[d] || 0) + p.skill; n[d] = (n[d] || 0) + 1; }
    for (const k in o) o[k] /= n[k];
    return o;
  }
  // ежемесячно: рост опыта, настроение, пенсии, уходы по собственному желанию
  function peopleMonth(s) {
    const retired = [], quit = [];
    for (const p of s.people) {
      const t = tenure(s, p);
      if (t < 15) p.skill = r2(clamp(p.skill + 0.003 + (t < 3 ? 0.003 : 0), 0.4, 1.35));
      p.mood = clamp(p.mood + (s.morale - p.mood) * 0.15 + rr(s, -3, 3), 0, 100);
      if (personAge(s, p) >= pensionAge(s, p)) retired.push(p);
      else if (p.mood < 25 && rnd(s) < 0.12) quit.push(p);
    }
    for (const p of retired) transact(s, -personSalary(s, p).total, 'ФОТ', `Выходное пособие при выходе на пенсию: ${p.name}`);
    const gone = new Set([...retired, ...quit].map(p => p.id));
    if (gone.size) {
      s.people = s.people.filter(p => !gone.has(p.id)); syncStaff(s);
      if (retired.length) log(s, `На заслуженный отдых проводили ${retired.length} чел.: ${retired.slice(0, 3).map(p => `${p.name.split(' ').slice(0, 2).join(' ')} (${roleName(p.role).toLowerCase()})`).join(', ')}${retired.length > 3 ? '…' : ''}. Подберите замену`, 'warn');
      if (quit.length) log(s, `Уволились по собственному желанию (плохое настроение): ${quit.length} чел.`, 'warn');
    }
    // начальники цехов тоже выходят на пенсию
    for (const c of s.cdngs) if (c.chief && c.chief.by && parts(s.day).y - c.chief.by >= D.PENSION[c.chief.g || 'm'](parts(s.day).y)) {
      log(s, `${c.name}: начальник цеха ${c.chief.name} вышел на пенсию. Назначьте нового`, 'warn'); c.chief = null; genCandidates(s, c);
    }
  }

  /* ===================== начальники цехов ===================== */
  const chiefName = (s, g) => kazName(s, g);
  function makeChief(s, effMin = 0.7, effMax = 1.2) {
    const eff = r2(rr(s, effMin, effMax)); const g = 'm'; const name = chiefName(s, g); // начальники цехов — только мужчины
    const age = ri(s, 34, 56);
    return { name, g, by: parts(s.day).y - age, face: makeFace(s, g, age), eff, loyalty: ri(s, 60, 80), exp: ri(s, 3, 22), remarks: 0, reprimands: 0, boost: 0, boostUntil: -1,
      salary: Math.round(D.CHIEF_SALARY * (0.7 + 0.6 * eff) / 1000) * 1000, since: iso(s.day), lastAction: null, bonuses: 0 };
  }
  // эффективность цеха: начальник (или исполняющий обязанности) + временная мотивация − низкая лояльность
  function chiefEff(s, c) {
    if (!c || !c.chief) return 0.7;
    const ch = c.chief;
    return clamp(ch.eff + (ch.boostUntil >= s.day ? ch.boost : 0) - (ch.loyalty < 30 ? 0.08 : 0), 0.4, 1.5);
  }
  function genCandidates(s, c) {
    c.candidates = [];
    for (let i = 0; i < 3; i++) {
      const ch = makeChief(s, 0.6, 1.35); ch.loyalty = ri(s, 65, 85);
      ch.demand = Math.round(ch.salary * rr(s, 0.95, 1.25) / 1000) * 1000; ch.salary = ch.demand;
      c.candidates.push(ch);
    }
    c.candidatesMonth = ym(parts(s.day).y, parts(s.day).m);
  }
  function lastCdReport(s, cdId) {
    const r = s.cdReports[s.cdReports.length - 1]; if (!r) return null;
    return r.rows.find(x => x.id === cdId) || null;
  }
  function chiefMonthUpdate(s, rows) {
    for (const c of s.cdngs) {
      if (c.incoming) continue;
      const ch = c.chief; if (!ch) continue;
      const row = rows.find(r => r.id === c.id);
      ch.exp += 1 / 12;
      // опыт растёт медленно, но только у мотивированных
      if (ch.loyalty >= 50) ch.eff = r2(clamp(ch.eff + 0.004, 0.4, 1.4));
      // лояльность стремится к 65, результат цеха влияет на самооценку
      ch.loyalty = clamp(ch.loyalty + (65 - ch.loyalty) * 0.08 + (row && row.ratio >= 1 ? 1 : 0), 0, 100);
      if (ch.loyalty < 20 && rnd(s) < 0.35) {
        log(s, `${c.name}: начальник цеха ${ch.name} уволился по собственному желанию (лояльность ${Math.round(ch.loyalty)}%). Цехом руководит и.о.`, 'bad');
        c.chief = null; genCandidates(s, c);
      }
    }
  }

  /* ===================== скважины ===================== */
  const FAILS = {
    sk: [['gnu', 'Отказ глубинного насоса', { gnu: 1, rods: 5 }], ['rods', 'Обрыв штанг', { rods: 25 }], ['nkt', 'Негерметичность НКТ', { nkt: 30 }], ['drive', 'Отказ привода СК', { skparts: 1 }]],
    ecn: [['ecn', 'Отказ ЭЦН', { ecn: 1 }], ['cable', 'Пробой кабеля', { cable: 1 }], ['nkt', 'Негерметичность НКТ', { nkt: 30 }]],
    inj: [['nkt', 'Негерметичность НКТ', { nkt: 25 }], ['pack', 'Негерметичность пакера', { nkt: 10, pparts: 1 }]],
    water: [['ecn', 'Отказ насоса водозабора', { pparts: 1 }], ['nkt', 'Негерметичность НКТ', { nkt: 20 }]]
  };
  function failWell(s, w) {
    const list = FAILS[w.type];
    const f = list[Math.floor(rnd(s) * list.length)];
    w.status = 'fail'; w.fail = f[0]; w.failName = f[1]; w.down = 0;
    cdStat(s, w.cdng).fails++; if (w.type === 'sk' || w.type === 'ecn') s.mFails = (s.mFails || 0) + 1;
    log(s, `Скважина ${w.name}: ${f[1].toLowerCase()} — остановлена`, 'warn');
  }
  function cdStat(s, id) { if (!s.cdStats[id]) s.cdStats[id] = { fails: 0, down: 0 }; return s.cdStats[id]; }
  const failMaterials = w => (FAILS[w.type].find(f => f[0] === w.fail) || [0, 0, {}])[2];
  function brigades(s) { return Math.floor(s.staff.prs.n / 4); }
  function progressRepairs(s, cov) {
    for (const r of s.repairs) r.days -= 1 * (0.6 + 0.4 * moraleF(s)) * (0.7 + 0.3 * cov.dept.prs);
    for (const r of s.repairs.filter(r => r.days <= 0)) {
      const w = s.wells.find(x => x.id === r.well);
      if (w) { w.status = 'work'; w.health = clamp(w.health + 22, 0, 100); w.fail = null; w.failName = null; log(s, `ПРС завершён: скважина ${w.name} запущена`, 'good'); s.goalsDone.repair = s.goalsDone.repair || 'pending'; }
    }
    s.repairs = s.repairs.filter(r => r.days > 0);
  }
  function canMaterials(s, mats) { for (const k in mats) if ((s.stock[k] || 0) < mats[k]) return false; return true; }
  function takeMaterials(s, mats) { for (const k in mats) s.stock[k] -= mats[k]; }
  function autoAssignRepairs(s) {
    const free = brigades(s) - s.repairs.length;
    if (free <= 0) return;
    const cands = s.wells.filter(w => w.status === 'fail' && !s.repairs.some(r => r.well === w.id)).sort((a, b) => (b.potential * (1 - b.wc)) - (a.potential * (1 - a.wc)));
    let n = free;
    for (const w of cands) { if (n <= 0) break; const m = failMaterials(w); if (!canMaterials(s, m)) continue; takeMaterials(s, m); s.repairs.push({ well: w.id, days: 3 }); w.status = 'repair'; n--; }
  }
  function autoMaintain(s, cov) {
    if (cov.dept.repair < 0.5) return;
    const f = s.fac.filter(f => !D.BUILD[f.type].tank && (f.health < 45 || f.status === 'fail') && f.status !== 'service').sort((a, b) => a.health - b.health)[0];
    if (f) { try { act(s, 'maintain', { id: f.id }); } catch (e) { /* нет денег или запчастей */ } }
  }

  /* ===================== подряд и стройка ===================== */
  function progressProjects(s) {
    for (const pr of s.projects) {
      if (pr.daysLeft > 0) {
        if (rnd(s) < (1 - pr.quality) * 0.12) { pr.delay++; continue; }
        pr.daysLeft--;
      }
      if (pr.daysLeft <= 0 && !pr.done) {
        const due = pr.total - pr.paid;
        if (s.cash < due) { if (!pr.warned) { log(s, `${pr.title}: работы завершены, но нет средств на окончательный расчёт ${fmtMoney(due)}`, 'warn'); pr.warned = true; } continue; }
        transact(s, -due, pr.kind === 'build' ? 'Капвложения' : (pr.type === 'seismic' ? 'Капвложения' : 'Подрядные работы'), `Окончательный расчёт: ${pr.title}`);
        pr.paid = pr.total; pr.done = true;
        completeProject(s, pr);
      }
    }
    s.projects = s.projects.filter(p => !p.done);
  }
  function completeProject(s, pr) {
    const B = D.BUILD[pr.type];
    if (pr.kind === 'build') {
      if (pr.type === 'well_gas') {
        const w = makeGwell(s, pr.quality); w.book = pr.total; s.gwells.push(w);
        log(s, `Газовая скважина ${w.name} пробурена: ${fmtNum(Math.round(w.q / 1000))} тыс. м³/сут`, 'good');
      } else if (pr.type.startsWith('well_')) {
        const t = pr.type === 'well_sk' ? 'sk' : pr.type === 'well_ecn' ? 'ecn' : pr.type === 'well_inj' ? 'inj' : 'water';
        const w = makeWell(s, t, pr.cdng, pr.quality);
        w.book = pr.total;
        s.wells.push(w);
        if (t === 'sk' || t === 'ecn') addWellToPlan(s, w);
        log(s, `Скважина ${w.name} (${wellTypeName(t)}) введена в эксплуатацию — ${s.cdngs.find(c => c.id === w.cdng).name}`, 'good');
        if (t === 'sk' || t === 'ecn') s.goalsDone.drill = s.goalsDone.drill || 'pending';
      } else if (pr.type === 'cdng') {
        const n = s.cdngs.length + 1; const nc = { id: uid(s), name: `ЦДНГ-${n}`, chief: null, candidates: [] }; s.cdngs.push(nc); genCandidates(s, nc);
        s.fac.push(makeFac(s, 'cdng', pr.quality, pr.total, `Здание ЦДНГ-${n}`));
        log(s, `Открыт новый цех добычи ЦДНГ-${n}`, 'good');
      } else {
        const f = makeFac(s, pr.type, pr.quality, pr.total, null, pr.purpose);
        s.fac.push(f);
        log(s, `Введён в эксплуатацию: ${f.name}`, 'good');
        if (B.tank) s.goalsDone.tank = s.goalsDone.tank || 'pending';
      }
      return;
    }
    // услуги
    if (pr.type === 'seismic') {
      const chance = 0.45 + pr.quality * 0.4;
      if (rnd(s) < chance) {
        const add = Math.round(rr(s, 2, 10) * 1e6 * (0.6 + pr.quality * 0.5));
        s.reservoir.total += add; s.reservoir.remaining += add; s.reservoir.prospects += 3;
        log(s, `Сейсморазведка 3D: выявлены новые структуры! Прирост запасов ${fmtNum(add / 1e6)} млн т, 3 перспективные точки бурения`, 'good');
      } else log(s, 'Сейсморазведка 3D завершена: новых промышленных запасов не выявлено', 'warn');
      return;
    }
    if (pr.type === 'anticor' || pr.type === 'clean') {
      const t = s.fac.find(f => f.id === pr.target);
      if (t) { t.status = 'ok'; t.health = clamp(t.health + (pr.type === 'anticor' ? 40 : 15) * (0.7 + 0.3 * pr.quality), 0, 100); if (pr.type === 'clean') t.clean = Math.min(1.05, (t.clean || 1) + 0.05); log(s, `${t.name}: ${D.SERVICES[pr.type].name.toLowerCase()} выполнена, резервуар в работе`, 'good'); }
      return;
    }
    const w = s.wells.find(x => x.id === pr.target);
    if (!w) return;
    if (pr.type === 'prs') { w.status = 'work'; w.health = clamp(w.health + 25 * (0.7 + 0.3 * pr.quality), 0, 100); w.fail = null; w.failName = null; s.goalsDone.repair = s.goalsDone.repair || 'pending'; }
    if (pr.type === 'krs') { w.status = 'work'; w.health = 100; w.potential *= 1 + 0.25 * pr.quality; w.fail = null; w.failName = null; }
    if (pr.type === 'grp') { w.status = 'work'; w.potential *= 1 + 0.4 * (0.6 + 0.4 * pr.quality); w.wc = clamp(w.wc + 0.05, 0, 0.98); w.health = clamp(w.health + 10, 0, 100); }
    if (pr.type === 'opz') { w.status = 'work'; w.potential *= 1 + 0.12 * (0.6 + 0.4 * pr.quality); }
    log(s, `${D.SERVICES[pr.type].name}: скважина ${w.name} — работы завершены`, 'good');
  }
  function makeFac(s, type, quality = 0.9, book = 0, name = null, purpose = null) {
    const B = D.BUILD[type]; const id = uid(s);
    const n = s.fac.filter(f => f.type === type).length + 1;
    const f = { id, type, name: name || (B.tank ? `${B.name} №${s.tankNo++}` : `${B.name} №${n}`), cap: B.cap || 0, health: Math.round(78 + 22 * quality), status: 'ok', book };
    if (B.tank) { f.purpose = purpose || 'oil'; f.volume = 0; }
    return f;
  }
  function makeWell(s, t, cdngId, quality = 0.9) {
    const id = uid(s);
    let pot, wc;
    const boost = s.reservoir.prospects > 0 && (t === 'sk' || t === 'ecn') ? (s.reservoir.prospects--, 1.3) : 1;
    if (t === 'sk') { pot = rr(s, 12, 30); wc = rr(s, 0.08, 0.35); }
    else if (t === 'ecn') { pot = rr(s, 40, 90); wc = rr(s, 0.18, 0.45); }
    else if (t === 'inj') { pot = 160; wc = 0; }
    else { pot = 300; wc = 1; }
    if (t === 'sk' || t === 'ecn') { pot *= (0.85 + 0.2 * quality) * boost * clamp(Math.pow(s.reservoir.remaining / s.reservoir.total, 0.25), 0.4, 1); }
    return { id, name: `№${s.wellNo++}`, type: t, cdng: cdngId, status: 'work', potential: r2(pot), wc: r2(wc), health: Math.round(80 + 20 * quality), cumOil: 0, today: 0, todayL: 0, connected: true, book: 0 };
  }
  function contractorOffers(s, cat, baseCost, baseDays) {
    const list = D.CONTRACTORS.filter(c => c.cat === cat);
    const mat = effVal(s, 'matPrice', 1);
    return list.map(c => {
      const rep = s.rep[c.id] ?? 0;
      const price = Math.round(baseCost * idx(s) * c.price * rr(s, 0.94, 1.08) * mat / 1000) * 1000;
      const days = Math.max(2, Math.round(baseDays * c.speed * rr(s, 0.9, 1.1)));
      return { cid: c.id, name: c.name, price, days, quality: clamp(c.quality + rep * 0.02, 0.4, 1) };
    }).sort((a, b) => a.price - b.price);
  }

  /* ===================== склад ===================== */
  const matName = k => D.MATERIALS.find(m => m.key === k).name;
  const matUnit = k => D.MATERIALS.find(m => m.key === k).unit;
  const roleName = k => D.ROLES.find(r => r.key === k).name;
  const fmtNum = n => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const matPrice = (s, k) => D.MATERIALS.find(m => m.key === k).price * idx(s) * effVal(s, 'matPrice', 1);
  function leadTime(s) { const c = coverage(s).dept.mts; return Math.round(12 - 6 * c); }
  function autoBuy(s) {
    for (const m of D.MATERIALS) {
      if (m.tech && !has(s, m.tech)) continue;
      const inTransit = sum(s.orders.filter(o => o.key === m.key), o => o.qty);
      const scale = m.key === 'demulg' || m.key === 'inhib' || m.key === 'diesel' ? Math.max(1, s.wells.length / 13) : Math.max(1, s.wells.length / 20);
      const min = Math.round(m.min * scale);
      if (s.stock[m.key] + inTransit < min) {
        const qty = Math.round(min * 2 - s.stock[m.key] - inTransit);
        const cost = qty * matPrice(s, m.key);
        if (cost < s.cash * 0.25) { transact(s, -cost, 'Закупка МТР', `Автозакупка: ${m.name} ${fmtNum(qty)} ${m.unit}`); s.orders.push({ key: m.key, qty, days: leadTime(s) }); }
      }
    }
  }

  /* ===================== план / факт ===================== */
  function ensurePF(s, y) {
    if (!s.pf[y]) s.pf[y] = { level: 'base', plan: Array.from({ length: 12 }, () => ({})), fact: Array.from({ length: 12 }, () => ({})), annual: {} };
    return s.pf[y];
  }
  function forecastByCdng(s, fromDay, toDay) {
    const R = s.reservoir; const pf = clamp(0.3 + 0.7 * R.pressure / 100, 0.3, 1.07);
    const reserveF = clamp(Math.pow(R.remaining / R.total, 0.3), 0.15, 1);
    const cov = coverage(s); const days = toDay - fromDay + 1;
    const o = {};
    for (const c of s.cdngs) o[c.id] = 0;
    let slots = Math.floor(sum(facs(s, 'agzu'), f => f.cap));
    for (const w of s.wells) {
      if (w.type === 'inj' || w.type === 'water') continue;
      if (slots-- <= 0) continue;
      const rate = w.potential * (1 - w.wc - 0.006) * pf * reserveF * (0.7 + 0.3 * w.health / 100) * (0.55 + 0.45 * cov.dept.cdng) * moraleF(s);
      o[w.cdng] += rate * days * 0.93 * (1 - 0.02 * days / 365);
    }
    return o;
  }
  // прогноз годовой добычи: факт с начала года + прогноз до 31 декабря (по цехам)
  function yearOutlook(s, y) {
    const PF = ensurePF(s, y); const p = parts(s.day);
    const startDay = Math.max(s.day + 1, Math.round((Date.UTC(y, 0, 1) - START) / DAY_MS));
    const endDay = Math.round((Date.UTC(y, 11, 31) - START) / DAY_MS);
    const fc = endDay >= startDay ? forecastByCdng(s, startDay, endDay) : {};
    const out = {};
    for (const c of s.cdngs) out[c.id] = { fact: sum(PF.fact, mo => mo[c.id] || 0), forecast: fc[c.id] || 0 };
    return { startDay, endDay, byCdng: out };
  }
  // собственный план игрока: годовой объём по цехам; прошедшие месяцы сохраняются, остаток распределяется по дням
  function setPlanCustom(s, y, byCdng, total) {
    const PF = ensurePF(s, y); const o = yearOutlook(s, y);
    const sp = parts(o.startDay); const span = o.endDay - o.startDay + 1;
    const cur = y === parts(s.day).y;
    // если задан только итог — делим по прогнозу цехов
    const want = {};
    const fcTot = sum(s.cdngs, c => o.byCdng[c.id].fact + o.byCdng[c.id].forecast) || 1;
    for (const c of s.cdngs) {
      const v = byCdng[c.id] != null && byCdng[c.id] !== '' ? Number(byCdng[c.id]) : (total != null ? Number(total) * (o.byCdng[c.id].fact + o.byCdng[c.id].forecast) / fcTot : (PF.annual[c.id] != null ? PF.annual[c.id] : o.byCdng[c.id].fact + o.byCdng[c.id].forecast));
      if (v == null || !Number.isFinite(v) || v < 0) throw new Error(`Укажите план для ${c.name}`);
      want[c.id] = v;
    }
    const T = sum(Object.values(want));
    if (T <= 0) throw new Error('План должен быть больше нуля');
    const fullFc = sum(s.cdngs, c => o.byCdng[c.id].fact + o.byCdng[c.id].forecast);
    if (fullFc > 0 && (T < fullFc * 0.5 || T > fullFc * 2)) throw new Error(`План должен быть от 50% до 200% прогноза (${fmtNum(Math.round(fullFc * 0.5))}–${fmtNum(Math.round(fullFc * 2))} т)`);
    for (const c of s.cdngs) {
      // план уже прошедших месяцев (и прошедших дней текущего) остаётся как был
      let past = 0;
      for (let m = 1; m <= 12; m++) {
        const pm = PF.plan[m - 1][c.id] || 0;
        if (cur && m < sp.m) past += pm;
        else if (cur && m === sp.m) past += pm * (sp.d - 1) / daysInMonth(y, m);
      }
      const rest = Math.max(0, want[c.id] - past);
      for (let m = 1; m <= 12; m++) {
        let dm = daysInMonth(y, m);
        if (m < sp.m) continue;
        if (m === sp.m) { dm = dm - sp.d + 1; const keep = cur ? (PF.plan[m - 1][c.id] || 0) * (sp.d - 1) / daysInMonth(y, m) : 0; PF.plan[m - 1][c.id] = keep + rest * dm / span; }
        else PF.plan[m - 1][c.id] = rest * dm / span;
      }
      PF.annual[c.id] = sum(PF.plan, mo => mo[c.id] || 0);
    }
    const total2 = sum(Object.values(PF.annual));
    const ratio = fullFc > 0 ? total2 / fullFc : 1;
    PF.level = ratio >= 1.08 ? 'amb' : ratio >= 0.98 ? 'base' : 'cons';
    PF.custom = true;
    return { total: total2, level: PF.level, ratio };
  }
  // план ГТМ: ввод новой скважины увеличивает план цеха на оставшиеся месяцы года
  function addWellToPlan(s, w) {
    const p = parts(s.day); const PF = s.pf[p.y]; if (!PF) return;
    const R = s.reservoir; const pf = clamp(0.3 + 0.7 * R.pressure / 100, 0.3, 1.07);
    const rate = w.potential * (1 - w.wc) * pf * clamp(Math.pow(R.remaining / R.total, 0.3), 0.15, 1) * 0.85;
    let add = 0;
    for (let m = p.m; m <= 12; m++) {
      const days = m === p.m ? daysInMonth(p.y, m) - p.d : daysInMonth(p.y, m);
      const v = rate * days; PF.plan[m - 1][w.cdng] = (PF.plan[m - 1][w.cdng] || 0) + v; add += v;
    }
    PF.annual[w.cdng] = (PF.annual[w.cdng] || 0) + add;
  }
  const PLAN_LEVELS = { cons: { name: 'Консервативный', k: 0.94, trust: 0 }, base: { name: 'Базовый', k: 1.0, trust: 2 }, amb: { name: 'Амбициозный', k: 1.12, trust: 6 } };
  function setPlan(s, y, level) {
    const PF = ensurePF(s, y); PF.level = level;
    const startDay = Math.max(s.day + 1, Math.round((Date.UTC(y, 0, 1) - START) / DAY_MS));
    const endDay = Math.round((Date.UTC(y, 11, 31) - START) / DAY_MS);
    const fc = forecastByCdng(s, startDay, endDay);
    const K = PLAN_LEVELS[level].k * (has(s, 'smart') ? 1.0 : 0.99);
    const sp = parts(startDay);
    PF.annual = {};
    for (const c of s.cdngs) {
      const total = fc[c.id] * K; PF.annual[c.id] = total;
      const span = endDay - startDay + 1;
      for (let m = 1; m <= 12; m++) {
        let dm = daysInMonth(y, m);
        if (m < sp.m) dm = 0; else if (m === sp.m) dm = dm - sp.d + 1;
        PF.plan[m - 1][c.id] = total * dm / span;
      }
    }
  }

  /* ===================== закрытие месяца ===================== */
  function closeMonth(s, y, m) {
    const key = ym(y, m);
    const sDays = daysInMonth(y, m);
    const PF = ensurePF(s, y);
    // зарплата и соцналог
    let payroll = 0; for (const pp of s.people) payroll += personSalary(s, pp).total;
    for (const c of s.cdngs) if (c.chief) payroll += c.chief.salary * idx(s);
    transact(s, -payroll, 'ФОТ', `Заработная плата: ${assetSummary(s).staff} чел.`);
    transact(s, -payroll * 0.11, 'Соц. налог', 'Социальный налог и отчисления');
    // обслуживание фонда
    const opWells = s.wells.length;
    transact(s, -opWells * 350000 * idx(s), 'Обслуживание фонда', `Текущее обслуживание ${opWells} скважин`);
    if (effVal(s, 'security', 0)) transact(s, -8e6 * idx(s), 'Прочие расходы', 'Охрана трубопроводов');
    // налоги
    const avgBrent = s.mBrentSum / Math.max(1, s.mDays), avgFx = s.mFxSum / Math.max(1, s.mDays);
    const mineral = s.mProd * avgBrent * BBL * avgFx * (y >= 2009 ? 0.07 : 0.06);
    transact(s, -mineral, 'НДПИ', `НДПИ за ${key}: ${fmtNum(s.mProd)} т`);
    const rentRate = avgBrent < 40 ? 0 : avgBrent < 60 ? 0.05 : avgBrent < 80 ? 0.08 : avgBrent < 100 ? 0.11 : 0.14;
    if (s.mExportRev > 0 && rentRate > 0) transact(s, -s.mExportRev * rentRate, 'Рентный налог', `Рентный налог на экспорт ${Math.round(rentRate * 100)}%`);
    const book = sum(s.fac, f => f.book) + sum(s.wells, w => w.book);
    transact(s, -book * 0.015 / 12, 'Налог на имущество', 'Налог на имущество 1,5% годовых');
    const dep = book * 0.08 / 12;
    for (const f of s.fac) f.book *= 1 - 0.08 / 12;
    for (const w of s.wells) w.book *= 1 - 0.08 / 12;
    // кредиты и депозиты
    for (const l of s.loans) {
      const interest = l.principal * l.rate / 12;
      const princ = Math.min(l.principal, l.payment - interest);
      transact(s, -interest, 'Проценты по кредитам', `Кредит №${l.id}`);
      transact(s, -princ, 'Погашение кредита', `Кредит №${l.id}`);
      l.principal -= princ; l.months--;
    }
    s.loans = s.loans.filter(l => l.principal > 1 && l.months > 0);
    for (const d of s.deposits) {
      const i = d.amount * d.rate / 12;
      if (d.type === 'demand') transact(s, i, 'Проценты по депозитам', `Депозит №${d.id} (до востребования)`);
      else { d.amount += i; }
    }
    // плата за эмиссии: сжигание ПНГ на факеле (с 2006 г. — сверхнормативное, ставка ×6)
    if (s.mFlare > 0) transact(s, -s.mFlare * (y >= 2006 ? 6 : 0.8) * idx(s), 'Плата за эмиссии', `Сжигание ${fmtNum(Math.round(s.mFlare / 1000))} тыс. м³ ПНГ на факеле`);
    // проверки госорганов
    govInspections(s);
    // договоры: штрафы за недопоставку (доверие: не более −2 в месяц)
    let shortCount = 0;
    for (const c of s.contracts.filter(c => c.status === 'active')) {
      const short = c.monthly - c.shippedMonth;
      if (short > c.monthly * 0.05) {
        const fine = short * oilPriceT(s, D.CHANNELS[c.channel].discount + c.discount) * c.penalty;
        transact(s, -fine, 'Штрафы и неустойки', `Недопоставка ${fmtNum(short)} т по договору №${c.id}`);
        log(s, `Штраф за недопоставку по договору №${c.id}: ${fmtMoney(fine)}`, 'bad');
        shortCount++;
      }
      c.history.push({ m: key, plan: c.monthly, fact: r2(c.shippedMonth) });
      c.shippedMonth = 0; c.monthsLeft--;
      if (c.monthsLeft <= 0) { c.status = 'done'; log(s, `Договор №${c.id} с ${c.buyer} исполнен`, 'info'); }
    }
    if (shortCount) s.trust = clamp(s.trust - Math.min(2, shortCount), 0, 100);
    // КПН
    const g = cat => -(s.mAcc[cat] || 0);
    const rev = sum(PNL.revenue, c => s.mAcc[c] || 0);
    const opex = sum(PNL.opex, g), taxes0 = g('НДПИ') + g('Рентный налог') + g('Налог на имущество'), interest = g('Проценты по кредитам');
    let ebt = rev - opex - taxes0 - interest - dep;
    let cit = 0;
    if (ebt > 0) { const base = Math.max(0, ebt - s.lossCarry); s.lossCarry = Math.max(0, s.lossCarry - ebt); cit = base * 0.2; if (cit > 0) transact(s, -cit, 'КПН', 'Корпоративный подоходный налог 20%'); }
    else s.lossCarry += -ebt;
    const net = ebt - cit;
    // план/факт и доверие
    const planM = sum(Object.values(PF.plan[m - 1])), factM = sum(Object.values(PF.fact[m - 1]));
    const ratio = planM > 0 ? factM / planM : 1;
    let dTrust = clamp((ratio - 1) * 40, -6, 1.5) + (net > 0 ? 0.5 : -2) + (65 - s.trust) * 0.04;
    if (ratio >= 1 && planM > 0) s.goalsDone.plan = s.goalsDone.plan || 'pending';
    s.trust = clamp(s.trust + dTrust, 0, 100);
    // рейтинг
    updateCompanies(s);
    const cap = capitalization(s);
    s.history.push({
      m: key, oil: Math.round(s.mProd), liq: Math.round(s.mLiq), inj: Math.round(s.mInj), sold: Math.round(s.mSold), plan: Math.round(planM), fact: Math.round(factM),
      rev: Math.round(rev), opex: Math.round(opex), taxes: Math.round(taxes0 + cit), interest: Math.round(interest), dep: Math.round(dep), net: Math.round(net),
      cash: Math.round(s.cash), brent: r2(avgBrent), fx: r2(avgFx), p: r2(s.reservoir.pressure), rank: s.rank, cap: Math.round(cap), trust: Math.round(s.trust),
      cats: Object.fromEntries(Object.entries(s.mAcc).map(([k, v]) => [k, Math.round(v)])),
      ebitda: Math.round(rev - opex - taxes0), wd: s.mWellDays, wk: s.mWorkDays, fails: s.mFails, staff: assetSummary(s).staff,
      gas: Math.round(s.mGas), gasUsed: Math.round(s.mGasUsed), gasN: Math.round(s.mGasN || 0), gasNS: Math.round(s.mGasNS || 0), inj2: s.mInjuries, dep: Math.round(sum(s.deposits, d => d.amount)), debt: Math.round(sum(s.loans, l => l.principal)),
      rate: baseRate(s), ready: Math.round(s.hse.readiness), hseIdx: Math.round(hseIndex(s)), score: Math.round(s.score || 0)
    });
    if (s.history.length > 400) s.history.shift();
    log(s, `Итоги ${monthName(m)} ${y}: добыча ${fmtNum(Math.round(factM))} т (${Math.round(ratio * 100)}% плана), чистая прибыль ${fmtMoney(net)}`, ratio >= 1 ? 'good' : ratio >= 0.95 ? 'info' : 'warn');
    // итоги по цехам и отчёт для решений по начальникам
    const rows = s.cdngs.map(c => {
      const plan = PF.plan[m - 1][c.id] || 0, fact = PF.fact[m - 1][c.id] || 0;
      const ws = s.wells.filter(w => w.cdng === c.id && (w.type === 'sk' || w.type === 'ecn'));
      const st = s.cdStats[c.id] || { fails: 0, down: 0 };
      const ch = c.chief;
      return { id: c.id, name: c.name, plan: Math.round(plan), fact: Math.round(fact), ratio: plan > 0 ? r2(fact / plan) : 1, wells: ws.length,
        work: ws.filter(w => w.status === 'work').length, fails: st.fails, down: st.down,
        chief: ch ? { name: ch.name, eff: ch.eff, effNow: r2(chiefEff(s, c)), loyalty: Math.round(ch.loyalty), remarks: ch.remarks, reprimands: ch.reprimands } : null };
    });
    s.cdReports.push({ m: key, rows }); if (s.cdReports.length > 36) s.cdReports.shift();
    s.cdStats = {};
    chiefMonthUpdate(s, rows);
    peopleMonth(s);
    s.report = { m: key, open: s.settings.monthReport !== false, decided: {} };
    // новые предложения покупателей
    genOffers(s);
    // сброс аккумуляторов
    s.mGas = 0; s.mGasUsed = 0; s.mFlare = 0; s.mGasN = 0; s.mGasNS = 0; s.mWellDays = 0; s.mWorkDays = 0; s.mFails = 0; s.mInjuries = 0;
    s.mAcc = {}; s.mProd = 0; s.mLiq = 0; s.mInj = 0; s.mSold = 0; s.mExportRev = 0; s.mBrentSum = 0; s.mFxSum = 0; s.mDays = 0;
    // банкротство и отставка
    if (s.cash < 0) { s.negMonths++; log(s, `Отрицательный остаток денежных средств (${s.negMonths}/3 мес.). Возьмите кредит или сократите расходы!`, 'bad'); }
    else s.negMonths = 0;
    if (s.negMonths >= 3) { s.gameOver = { reason: 'Банкротство: три месяца подряд отрицательный денежный баланс.' }; }
    if (s.trust <= 0) { s.gameOver = { reason: 'Совет директоров отправил вас в отставку: доверие упало до нуля.' }; }
    else if (s.trust < 20 && !s.pending) log(s, 'Совет директоров недоволен: доверие ниже 20. Выполняйте план и избегайте аварий!', 'bad');
  }
  function closeYear(s, y) {
    const PF = ensurePF(s, y);
    const plan = sum(Object.keys(PF.annual), k => PF.annual[k]);
    const fact = sum(PF.fact, mo => sum(Object.values(mo)));
    const ratio = plan > 0 ? fact / plan : 1;
    let bonus = 0;
    if (ratio >= 1) bonus = PLAN_LEVELS[PF.level].trust + 4; else if (ratio < 0.9) bonus = -8;
    s.trust = clamp(s.trust + bonus, 0, 100);
    s.yearReports.push({ y, plan: Math.round(plan), fact: Math.round(fact), ratio: r2(ratio), level: PF.level, rank: s.rank, cash: Math.round(s.cash),
      rev: Math.round(sum(PNL.revenue, c => s.yAcc[c] || 0)), net: Math.round(sum(s.history.filter(h => h.m.startsWith(String(y))), h => h.net)) });
    s.yAcc = {}; s.yProd = 0;
    log(s, `Итоги ${y} года: план ${fmtNum(Math.round(plan))} т, факт ${fmtNum(Math.round(fact))} т (${Math.round(ratio * 100)}%). Доверие ${bonus >= 0 ? '+' : ''}${bonus}`, ratio >= 1 ? 'good' : 'warn');
    for (const t of D.TECH) if (t.year === y + 1) log(s, `Доступна новая технология: ${t.name}`, 'info');
    s.pending = planEvent(s, y + 1, { y, plan, fact, ratio });
  }
  function planEvent(s, y, rep) {
    const fc = sum(Object.values(forecastByCdng(s, s.day + 1, s.day + daysInYear(y))));
    return {
      key: 'plan', title: `Годовой план добычи на ${y} год`,
      text: (rep ? `Итог ${rep.y} года: ${Math.round(rep.ratio * 100)}% плана (${fmtNum(Math.round(rep.fact))} т). ` : '') +
        `Геологическая служба прогнозирует ${fmtNum(Math.round(fc))} т нефти при текущем фонде скважин. Выберите план — амбициозный план даёт больше доверия совета директоров при выполнении, но наказывает при срыве.`,
      options: Object.entries(PLAN_LEVELS).map(([k, v]) => ({ label: `${v.name}: ${fmtNum(Math.round(fc * v.k))} т`, hint: k === 'cons' ? 'Легко выполнить, мало бонусов' : k === 'base' ? 'Сбалансированно' : 'Бонус доверия +' + (v.trust + 4) + ' при выполнении', data: k }))
        .concat([{ label: 'Задать свой план…', hint: 'Свой объём по каждому ЦДНГ (50–200% прогноза)', data: 'custom', custom: true }]),
      data: { y }
    };
  }
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const monthName = m => MONTHS[m - 1];

  /* ===================== договоры ===================== */
  function genOffers(s) {
    const p = parts(s.day + 1);
    const n = ri(s, 3, 5);
    const prodM = Math.max(1500, (s.today ? Math.max(s.today.potOil || 0, s.today.oil || 0) : 150) * 30);
    s.offers = [];
    for (let i = 0; i < n; i++) {
      const chKeys = Object.keys(D.CHANNELS).filter(k => !D.CHANNELS[k].minYear || p.y >= D.CHANNELS[k].minYear);
      const ch = pick(s, chKeys);
      const monthly = Math.round(prodM * rr(s, 0.25, 0.8) / 100) * 100;
      const months = pick(s, [3, 6, 6, 12, 12, 24]);
      const discount = r2(rr(s, -1.5, 2.5) - (months >= 12 ? 0.5 : 0));
      const penalty = pick(s, [0.05, 0.08, 0.1, 0.15]);
      s.offers.push({ id: uid(s), buyer: pick(s, D.BUYERS), channel: ch, monthly, months, discount, penalty, minGroup: ch === 'nprz' ? 3 : pick(s, [2, 3, 3]) });
    }
  }

  /* ===================== ОТ, ПБ и экология ===================== */
  function avgFacHealth(s) { const f = s.fac.filter(x => x.type !== 'cdng'); return f.length ? sum(f, x => x.health) / f.length : 100; }
  function hseRisk(s, cov) {
    cov = cov || coverage(s); const H = s.hse;
    const avgCov = sum(Object.values(cov.dept)) / Math.max(1, Object.keys(cov.dept).length);
    const f = {
      'Служба ОТ (укомплектованность)': 1.6 - 0.6 * cov.dept.hse,
      'СИЗ на складе': s.stock.ppe > assetSummary(s).staff * 0.1 ? 1 : s.stock.ppe > 0 ? 1.3 : 1.8,
      'Износ оборудования': 1 + Math.max(0, 70 - avgFacHealth(s)) / 70,
      'Усталость (нехватка людей)': avgCov < 0.85 ? 1 + (0.85 - avgCov) * 2 : 1,
      'Мораль': s.morale < 40 ? 1.3 : 1,
      'Культура безопасности': 1.35 - 0.6 * H.culture / 100,
      'Медосмотр': s.day - H.lastMed > 365 ? 1.25 : 1
    };
    let k = 1; for (const v of Object.values(f)) k *= v;
    return { k, f };
  }
  function hseDaily(s, cov) {
    const H = s.hse; const staff = assetSummary(s).staff; if (!staff) return;
    const p = 0.0011 * (staff / 40) * hseRisk(s, cov).k;
    if (rnd(s) >= p) return;
    const field = s.people.filter(x => !(x.sickUntil > s.day) && !['aup', 'mts', 'geo'].includes(D.ROLES.find(r => r.key === x.role).dept));
    const victim = field.length ? pick(s, field) : pick(s, s.people); if (!victim) return;
    // тяжесть: чем выше готовность (первая помощь, эвакуация), тем легче последствия
    const x = rnd(s) * (1.1 - 0.25 * H.readiness / 100);
    const sev = x < 0.72 ? 'light' : x < 0.97 ? 'severe' : 'grave';
    const sal = personSalary(s, victim).total;
    const SEV = { light: ['Лёгкая травма', [7, 21], 0.5, 0, 0], severe: ['Тяжёлая травма', [60, 150], 6, 15e6, 3], grave: ['Тяжёлый несчастный случай', [180, 330], 24, 60e6, 8] }[sev];
    const days = ri(s, SEV[1][0], SEV[1][1]);
    victim.sickUntil = s.day + days; victim.mood = clamp(victim.mood - 20, 0, 100);
    transact(s, -sal * SEV[2], 'Возмещение вреда', `${SEV[0]}: ${victim.name}`);
    if (SEV[3]) { const fine = SEV[3] * idx(s); transact(s, -fine, 'Штрафы и неустойки', `Расследование несчастного случая (${D.AUTHORITIES.labor})`); H.fines.push({ date: iso(s.day), org: D.AUTHORITIES.labor, reasons: [SEV[0]], amount: Math.round(fine) }); }
    s.trust = clamp(s.trust - SEV[4], 0, 100); s.morale = clamp(s.morale - (sev === 'light' ? 1 : sev === 'severe' ? 4 : 8), 0, 100);
    if (sev === 'grave') addEffect(s, 'strike', 4, 0.75, 'Расследование: работы приостановлены');
    H.injuries.push({ date: iso(s.day), day: s.day, sev, name: victim.name, role: victim.role, days, prevNoInj: H.daysNoInj });
    if (H.injuries.length > 200) H.injuries.shift();
    H.daysNoInj = 0; s.mInjuries++;
    const role = roleName(victim.role).toLowerCase();
    log(s, `${sev === 'light' ? 'Несчастный случай' : 'АВАРИЯ по ОТ'}: ${SEV[0].toLowerCase()} — ${victim.name} (${role}), больничный ${days} дн.${SEV[3] ? ` Штраф ${fmtMoney(SEV[3] * idx(s))}, доверие −${SEV[4]}` : ''}`, sev === 'light' ? 'warn' : 'bad');
  }
  function ltifr(s) {
    const inj = s.hse.injuries.filter(i => s.day - i.day <= 365).length;
    const hours = Math.max(1, assetSummary(s).staff * 1980);
    return inj * 1e6 / hours;
  }
  function gasUtil(s) { const h = s.history.slice(-3); const g = sum(h, x => x.gas || 0); return g > 0 ? sum(h, x => x.gasUsed || 0) / g : (s.today && s.today.gas ? s.today.gas.util : 1); }
  function hseIndex(s) { return clamp(40 * (1 - Math.min(1, s.hse.injuries.filter(i => s.day - i.day <= 365).length / Math.max(1, assetSummary(s).staff) * 100 / 8)) + 30 * gasUtil(s) + 30 * s.hse.readiness / 100 - Math.min(15, sum(s.hse.fines.filter(f => s.day - Math.round((Date.parse(f.date) - START) / DAY_MS) <= 365), f => f.amount) / (50e6 * idx(s)) * 5), 0, 100); }
  function hseAct(s, a) {
    const H = s.hse; const staff = assetSummary(s).staff;
    if (a.op === 'drill') {
      const Dr = D.DRILLS[a.kind]; if (!Dr) throw new Error('Неизвестные учения');
      if (s.day - (H.drills[a.kind] ?? -999) < 30) throw new Error('Эти учения уже проводились в последние 30 дней');
      pay(s, Dr.cost * idx(s), 'Охрана труда и ПБ', Dr.name);
      H.drills[a.kind] = s.day; H.readiness = clamp(H.readiness + Dr.add * (0.6 + 0.4 * coverage(s).dept.hse), 0, 100); H.culture = clamp(H.culture + 3, 0, 100);
      log(s, `Проведены ${Dr.name.toLowerCase()}. Готовность к ЧС: ${Math.round(H.readiness)}%`, 'good'); return H;
    }
    if (a.op === 'medical') {
      if (s.day - H.lastMed < 180) throw new Error('Медосмотр уже проводился в последние полгода');
      pay(s, staff * 12000 * idx(s), 'Охрана труда и ПБ', `Периодический медосмотр: ${staff} чел.`);
      H.lastMed = s.day; for (const p of s.people) p.mood = clamp(p.mood + 2, 0, 100);
      log(s, `Проведён периодический медосмотр персонала (${staff} чел.)`, 'good'); return H;
    }
    if (a.op === 'training') {
      if (s.day - H.lastTraining < 90) throw new Error('Обучение по ОТ уже проводилось в последние 3 месяца');
      pay(s, staff * 25000 * idx(s), 'Охрана труда и ПБ', `Обучение и проверка знаний по ОТ: ${staff} чел.`);
      H.lastTraining = s.day; H.culture = clamp(H.culture + 14, 0, 100);
      log(s, `Обучение по охране труда: культура безопасности ${Math.round(H.culture)}%`, 'good'); return H;
    }
    throw new Error('Неизвестное действие ОТ');
  }
  function govInspections(s) {
    const H = s.hse; const y = parts(s.day).y; const cov = coverage(s);
    const checks = {
      eco: () => { const v = []; const util = s.mGas > 0 ? s.mGasUsed / s.mGas : 1;
        if (y >= 2006 && util < 0.8) v.push([`сжигание ПНГ на факеле (утилизация ${Math.round(util * 100)}%)`, 6e6 + s.mFlare * 1.5]);
        if (!s.flags.inhibOk) v.push(['нет ингибитора: риск коррозии и разливов', 4e6]);
        if (s.log.some(l => /Порыв|разлив/i.test(l.text) && s.day - Math.round((Date.parse(l.date) - START) / DAY_MS) < 90)) v.push(['последствия разлива нефти', 8e6 * (s.day - (H.drills.spill ?? -999) < 365 ? 0.5 : 1)]);
        return v; },
      prom: () => { const v = []; const worn = s.fac.filter(f => f.health < 35 && f.type !== 'cdng').length;
        if (worn) v.push([`изношенное оборудование: ${worn} ед.`, worn * 5e6]);
        if (H.readiness < 45) v.push([`низкая готовность к ЧС (${Math.round(H.readiness)}%)`, 10e6]);
        if (s.day - (H.drills.gas ?? -999) > 365) v.push(['не проводились учения по газоопасным работам', 6e6]);
        if (cov.dept.hse < 0.8) v.push(['не укомплектована служба ОТ и ПБ', 5e6]);
        return v; },
      labor: () => { const v = []; const avgCov = sum(Object.values(cov.dept)) / Object.keys(cov.dept).length;
        if (s.day - H.lastMed > 365) v.push(['просрочен периодический медосмотр', 12e6]);
        if (avgCov < 0.85) v.push(['переработки сверх нормы (нехватка персонала)', 8e6]);
        if (s.stock.ppe <= 0) v.push(['работники без СИЗ', 10e6]);
        if (s.day - H.lastTraining > 365) v.push(['не проводилась проверка знаний по ОТ', 5e6]);
        return v; },
      fire: () => { const v = [];
        if (s.day - (H.drills.fire ?? -999) > 183) v.push(['не проводились пожарные учения более 6 месяцев', 6e6]);
        if (H.readiness < 35) v.push(['неготовность пожарной охраны объекта', 8e6]);
        return v; }
    };
    for (const org of Object.keys(checks)) {
      if (rnd(s) > 0.12) continue;
      const v = checks[org]();
      if (!v.length) { s.trust = clamp(s.trust + 1, 0, 100); log(s, `Проверка: ${D.AUTHORITIES[org]} — нарушений не выявлено. Доверие +1`, 'good'); continue; }
      const repeat = H.fines.some(f => f.org === D.AUTHORITIES[org] && s.day - Math.round((Date.parse(f.date) - START) / DAY_MS) < 365);
      const amount = Math.round(sum(v, x => x[1]) * idx(s) * (repeat ? 1.5 : 1));
      transact(s, -amount, 'Штрафы и неустойки', `${D.AUTHORITIES[org]}: предписание`);
      H.fines.push({ date: iso(s.day), org: D.AUTHORITIES[org], reasons: v.map(x => x[0]), amount });
      if (H.fines.length > 200) H.fines.shift();
      s.trust = clamp(s.trust - (repeat ? 3 : 2), 0, 100);
      log(s, `Проверка: ${D.AUTHORITIES[org]} — штраф ${fmtMoney(amount)}${repeat ? ' (повторное нарушение ×1,5)' : ''}: ${v.map(x => x[0]).join('; ')}`, 'bad');
    }
  }

  /* ===================== компании ТОП-100 ===================== */
  function initCompanies(s) {
    const used = new Set(); s.companies = [];
    while (s.companies.length < 99) {
      const name = `${pick(s, D.NAME_A)} ${pick(s, D.NAME_B)}`;
      if (used.has(name) || name === s.company.name) continue; used.add(name);
      const cap = Math.pow(10, rr(s, 9.4, 11.65));
      s.companies.push(compAttrs(s, { name, cap, g: rr(s, 0.001, 0.007), vol: rr(s, 0.02, 0.06), beta: rr(s, 0.3, 0.9), prev: 0, hist: [] }));
    }
    rankUpdate(s);
  }
  function compAttrs(s, c) { c.pm = rr(s, 0.04, 0.16); c.cost = rr(s, 7, 26); c.hse = rr(s, 35, 95); return c; }
  // 5 ключевых параметров рейтинга
  function myParams(s) {
    const recent = s.daily.slice(-30); const prod = recent.length ? sum(recent, d => d.oil) / recent.length : (s.today ? s.today.oil : 0);
    const h12 = s.history.slice(-12); const profit = sum(h12, h => h.net) * (h12.length ? 12 / h12.length : 0);
    const h3 = s.history.slice(-3); const f3 = sum(h3, h => h.fact), o3 = sum(h3, h => h.opex), fx3 = h3.length ? sum(h3, h => h.fx) / h3.length : s.market.fx;
    const cost = f3 > 0 ? o3 / (f3 * BBL) / fx3 : 20;
    return { prod, cap: capitalization(s), profit, cost, hse: hseIndex(s) };
  }
  function compParams(s, c) {
    // добыча по той же логике оценки, что у игрока: ~60% капитализации — стоимость добычи (1,5 года выручки)
    const prod = c.cap * 0.6 / (365 * oilPriceT(s, 3) * 1.5);
    return { prod, cap: c.cap, profit: c.cap * c.pm, cost: c.cost, hse: c.hse };
  }
  const RPARAMS = [['prod', 'Добыча', 1], ['cap', 'Капитализация', 1], ['profit', 'Прибыль 12 мес.', 1], ['cost', 'Себестоимость $/барр.', -1], ['hse', 'ОТ и экология', 1]];
  function scoreAll(s) {
    const rows = s.companies.map(c => ({ c, p: compParams(s, c) })); const me = { me: true, p: myParams(s) }; rows.push(me);
    const n = rows.length;
    for (const [k, , dir] of RPARAMS) {
      const sorted = rows.slice().sort((a, b) => dir * (b.p[k] - a.p[k]));
      sorted.forEach((r, i) => { r.pr = r.pr || {}; r.pr[k] = i + 1; r.pct = r.pct || {}; r.pct[k] = 1 - i / (n - 1); });
    }
    for (const r of rows) r.score = 100 * sum(RPARAMS, ([k]) => r.pct[k]) / RPARAMS.length;
    rows.sort((a, b) => b.score - a.score); rows.forEach((r, i) => r.rank = i + 1);
    return { rows, me };
  }
  function capitalization(s) {
    const book = sum(s.fac, f => f.book) + sum(s.wells, w => w.book);
    const reserves = s.reservoir.remaining * 0.25 * BBL * s.market.fx;
    const recent = s.daily.slice(-30); const avgOil = recent.length ? sum(recent, d => d.oil) / recent.length : (s.today ? s.today.oil : 0);
    const prodValue = avgOil * 365 * oilPriceT(s, 3) * 1.5;
    return s.cash + sum(s.deposits, d => d.amount) - sum(s.loans, l => l.principal) + book * 0.8 + reserves + prodValue;
  }
  function updateCompanies(s) {
    const prevB = s.lastBrent || s.market.brent, prevF = s.lastFx || s.market.fx;
    const db = s.market.brent / prevB - 1, df = s.market.fx / prevF - 1;
    for (const c of s.companies) {
      c.cap *= Math.max(0.7, 1 + c.g + c.beta * db * 0.5 + df * 0.5 + gauss(s) * c.vol * 0.6 + 0.002);
      if (c.pm == null) compAttrs(s, c);
      c.pm = clamp(c.pm + gauss(s) * 0.004 + db * 0.02, 0.01, 0.25); c.cost = clamp(c.cost * (1 + gauss(s) * 0.01 + 0.004), 5, 45); c.hse = clamp(c.hse + gauss(s) * 1.5, 20, 99);
    }
    // редкие слияния
    if (rnd(s) < 0.04) {
      const i = ri(s, 50, 98), j = ri(s, 10, 49);
      const sorted = s.companies.slice().sort((a, b) => b.cap - a.cap);
      const a = sorted[j], b = sorted[i];
      if (a && b) { a.cap += b.cap * 0.9; log(s, `Рынок: «${a.name}» поглотила «${b.name}»`, 'info'); b.name = `${pick(s, D.NAME_A)} ${pick(s, D.NAME_B)} Нью`; b.cap = Math.pow(10, rr(s, 9.4, 10)); }
    }
    s.lastBrent = s.market.brent; s.lastFx = s.market.fx;
    rankUpdate(s);
  }
  function rankUpdate(s) {
    for (const c of s.companies) if (c.pm == null) compAttrs(s, c);
    const { rows, me } = scoreAll(s);
    s.prevRank = s.rank || 100;
    s.rank = me.rank; s.score = me.score; s.paramRanks = me.pr;
    for (const r of rows) if (!r.me) { r.c.prev = r.c.rank || r.rank; r.c.rank = r.rank; r.c.score = r.score; }
    if (s.rank <= 50) s.goalsDone.top50 = s.goalsDone.top50 || 'pending';
    if (s.rank <= 10) s.goalsDone.top10 = s.goalsDone.top10 || 'pending';
  }
  function leaderboard(s) {
    for (const c of s.companies) if (c.pm == null) compAttrs(s, c);
    const { rows } = scoreAll(s);
    return rows.map(r => Object.assign({ name: r.me ? s.company.name : r.c.name, me: !!r.me, rank: r.rank, score: r.score, pr: r.pr, prev: r.me ? s.prevRank : r.c.prev }, r.p));
  }

  /* ===================== цели ===================== */
  function checkGoals(s) {
    if (s.contracts.length) s.goalsDone.contract = s.goalsDone.contract || 'pending';
    if (s.quality.group === 1 && (s.today.P || 0) > 0) s.goalsDone.ckppn = s.goalsDone.ckppn || 'pending';
    const c = coverage(s); if (c.role.op >= 1 && c.role.master >= 1) s.goalsDone.hire = s.goalsDone.hire || 'pending';
    if (s.today.oil >= 500) s.goalsDone.p500 = s.goalsDone.p500 || 'pending';
    if (s.today.oil >= 2000) s.goalsDone.p2000 = s.goalsDone.p2000 || 'pending';
    for (const g of D.GOALS) if (s.goalsDone[g.key] === 'pending') {
      s.goalsDone[g.key] = iso(s.day);
      s.trust = clamp(s.trust + g.trust, 0, 100);
      log(s, `Цель выполнена: ${g.title}. Доверие +${g.trust}`, 'good');
    }
  }

  /* ===================== события ===================== */
  const SCHEDULED = {
    '2001-09-12': s => { addEffect(s, 'priceShock', 40, 0.88, 'Паника на рынках'); log(s, 'Мировые рынки в шоке: нефть дешевеет, банки ужесточают кредитование', 'warn'); },
    '2008-09-15': s => { addEffect(s, 'credit', 365, 0.06, 'Мировой финансовый кризис'); log(s, 'Мировой финансовый кризис: ставки по кредитам выросли на 6 п.п. на год, цены на нефть падают', 'bad'); },
    '2009-02-04': s => { addEffect(s, 'matPrice', 300, 1.2, 'Девальвация: импорт дороже'); log(s, 'Девальвация тенге: выручка в тенге растёт, импортное оборудование и материалы дороже на 20%', 'warn'); },
    '2014-02-11': s => { addEffect(s, 'matPrice', 300, 1.15, 'Девальвация: импорт дороже'); log(s, 'Девальвация тенге: материалы дорожают на 15%', 'warn'); },
    '2014-11-27': s => log(s, 'Картель экспортёров не сократил добычу — цены на нефть обвалились', 'bad'),
    '2015-08-20': s => { addEffect(s, 'matPrice', 365, 1.25, 'Свободное плавание тенге'); log(s, 'Нацбанк перешёл к свободно плавающему курсу. Импортные материалы +25%', 'warn'); },
    '2020-03-16': s => { s.pending = EVENTS.find(e => e.key === 'pandemic').make(s); },
    '2020-05-01': s => { addEffect(s, 'quota', 240, 0.9, 'Квота ОПЕК+ −10%'); log(s, 'Соглашение ОПЕК+: добыча ограничена квотой −10% на 8 месяцев', 'bad'); },
    '2022-03-01': s => { addEffect(s, 'matPrice', 240, 1.18, 'Санкционная турбулентность'); log(s, 'Геополитический шок: нефть резко дорожает, логистика оборудования усложнена (+18%)', 'warn'); }
  };
  function scheduledEvents(s) {
    if (s.market.mode !== 'history') return;
    const f = SCHEDULED[iso(s.day)]; if (f) f(s);
  }
  // Каждое событие: key, w (вес), cond, make → {title,text,options}, resolve(s, data)
  const EVENTS = [
    { key: 'storm', w: 3, cond: s => { const m = parts(s.day).m; return m >= 4 && m <= 9; },
      make: s => { addEffect(s, 'storm', 3, 0.85, 'Пыльная буря'); log(s, 'Пыльная буря: на 3 дня добыча снижена на 15%', 'warn'); } },
    { key: 'heat', w: 2, cond: s => { const m = parts(s.day).m; return m >= 6 && m <= 8; },
      make: s => { addEffect(s, 'heat', 10, 1.15, 'Аномальная жара'); s.morale -= 3; log(s, 'Аномальная жара +45°C: энергопотребление +15% на 10 дней', 'warn'); } },
    { key: 'cold', w: 3, cond: s => { const m = parts(s.day).m; return m === 12 || m <= 2; },
      make: s => ({ title: 'Сильные морозы −32°C', text: 'Риск запарафинивания и замерзания выкидных линий. Можно заказать пропарку ППУ подрядчиком или рискнуть.',
        options: [{ label: `Пропарка ППУ (${fmtMoney(6e6 * idx(s))})`, hint: 'Потерь нет', data: 'ppu' }, { label: 'Рискнуть', hint: 'Возможны отказы 3–5 скважин и −10% добычи', data: 'risk' }] }),
      resolve: (s, d) => {
        addEffect(s, 'cold', 7, 1.08, 'Морозы');
        if (d === 'ppu') { transact(s, -6e6 * idx(s), 'Подрядные работы', 'Пропарка ППУ'); log(s, 'Выкидные линии пропарены, скважины работают', 'good'); }
        else { addEffect(s, 'coldProd', 7, 0.9, 'Замерзание линий'); const ws = s.wells.filter(w => w.status === 'work' && w.type !== 'inj' && w.type !== 'water'); for (let i = 0; i < ri(s, 3, 5) && ws.length; i++) failWell(s, ws.splice(ri(s, 0, ws.length - 1), 1)[0]); }
      } },
    { key: 'leak', w: 3, cond: s => s.wells.length > 6,
      make: s => ({ title: 'Порыв нефтесборного коллектора', text: 'Обнаружен порыв трубопровода от АГЗУ. Разлив около 12 тонн. Как ликвидируем?',
        options: [{ label: `Срочная ликвидация и рекультивация (${fmtMoney(12e6 * idx(s))})`, hint: 'Доверие +2, без штрафа', data: 'fast' },
          { label: `Стандартный ремонт (${fmtMoney(3e6 * idx(s))})`, hint: 'Риск экологического штрафа 60%', data: 'slow' }] }),
      resolve: (s, d) => {
        if (d === 'fast') { transact(s, -12e6 * idx(s), 'Ремонт и ТО', 'Ликвидация порыва коллектора'); s.trust += 2; }
        else { transact(s, -3e6 * idx(s), 'Ремонт и ТО', 'Ремонт коллектора'); if (rnd(s) < 0.6) { const f = 40e6 * idx(s); transact(s, -f, 'Штрафы и неустойки', 'Экологический штраф за разлив'); s.trust -= 4; log(s, `Экологическая инспекция: штраф ${fmtMoney(f)}`, 'bad'); } }
      } },
    { key: 'inspect', w: 0, cond: () => false,
      make: s => {
        const c = coverage(s); const avgH = sum(s.fac, f => f.health) / Math.max(1, s.fac.length);
        const score = c.dept.hse * 40 + (s.stock.ppe > 10 ? 25 : 0) + avgH * 0.35;
        if (score > 75) { s.trust += 2; log(s, `Проверка органа промышленной безопасности: нарушений не выявлено (оценка ${Math.round(score)}/100). Доверие +2`, 'good'); }
        else { const fine = (75 - score) * 1.2e6 * idx(s); transact(s, -fine, 'Штрафы и неустойки', 'Предписание надзорного органа'); s.trust -= 3; log(s, `Проверка промбезопасности: нарушения (оценка ${Math.round(score)}/100), штраф ${fmtMoney(fine)}. Наймите инженеров ОТ, закупите СИЗ, проведите ТО`, 'bad'); }
      } },
    { key: 'strike', w: 6, cond: s => s.morale < 38,
      make: s => ({ title: 'Угроза забастовки', text: `Мораль коллектива ${Math.round(s.morale)}%. Профсоюз требует повышения зарплаты и улучшения условий.`,
        options: [{ label: 'Повысить зарплаты всем на 10%', hint: 'Мораль быстро вырастет', data: 'raise' }, { label: 'Переговоры и премия (' + fmtMoney(assetSummary(s).staff * 40000 * idx(s)) + ')', hint: '50% — забастовка всё равно', data: 'talk' }, { label: 'Отказать', hint: 'Забастовка 7 дней, ЦДНГ и ПРС −50%', data: 'no' }] }),
      resolve: (s, d) => {
        if (d === 'raise') { for (const r of D.ROLES) s.staff[r.key].pct = Math.min(200, s.staff[r.key].pct + 10); s.morale += 12; }
        else if (d === 'talk') { transact(s, -assetSummary(s).staff * 40000 * idx(s), 'ФОТ', 'Разовая премия коллективу'); s.morale += 8; if (rnd(s) < 0.5) { addEffect(s, 'strike', 5, 0.5, 'Забастовка'); log(s, 'Часть бригад всё же объявила забастовку на 5 дней', 'bad'); } }
        else { addEffect(s, 'strike', 7, 0.5, 'Забастовка'); s.morale -= 5; s.trust -= 3; log(s, 'Забастовка: ЦДНГ и бригады ПРС работают вполсилы 7 дней', 'bad'); }
      } },
    { key: 'grid', w: 3, cond: () => true,
      make: s => { const d = ri(s, 1, 3); addEffect(s, 'gridOut', d, 1, 'Отключение ЛЭП'); log(s, `Авария на внешней ЛЭП: сетевое питание отключено на ${d} дн. Выручит собственная генерация (ГТЭС / ДГУ)`, 'bad'); } },
    { key: 'tankfire', w: 5, cond: s => s.fac.some(f => D.BUILD[f.type].tank && f.health < 35 && f.volume > 50),
      make: s => {
        const t = s.fac.filter(f => D.BUILD[f.type].tank && f.health < 35).sort((a, b) => a.health - b.health)[0];
        const lost = t.volume; t.volume = 0; t.health = 15; t.status = 'service'; t.serviceDays = 30;
        const fine = 60e6 * idx(s); transact(s, -fine, 'Штрафы и неустойки', `Пожар/разгерметизация ${t.name}`); s.trust -= 8;
        log(s, `АВАРИЯ: разгерметизация и возгорание ${t.name}! Потеряно ${fmtNum(lost)} т, штраф ${fmtMoney(fine)}, резервуар выведен на 30 дней`, 'bad');
      } },
    { key: 'asset', w: 1, cond: s => s.cash > 400e6 * idx(s),
      make: s => { const n = ri(s, 3, 6); const price = Math.round(n * 95e6 * idx(s) * rr(s, 0.8, 1.15)); return { title: 'Предложение о покупке актива', text: `Соседний недропользователь продаёт участок с ${n} действующими скважинами СК за ${fmtMoney(price)}. Скважины будут переданы в ЦДНГ с наименьшей загрузкой.`, options: [{ label: 'Купить', hint: 'Нужно свободное место в АГЗУ', data: { n, price } }, { label: 'Отказаться', data: null }] }; },
      resolve: (s, d) => {
        if (!d) return; if (s.cash < d.price) { log(s, 'Сделка сорвалась: недостаточно средств', 'warn'); return; }
        transact(s, -d.price, 'Капвложения', `Покупка участка: ${d.n} скважин`);
        for (let i = 0; i < d.n; i++) { const c = cdngFree(s); if (!c) break; const w = makeWell(s, 'sk', c.id, 0.6); w.health = ri(s, 45, 75); w.book = d.price / d.n; s.wells.push(w); addWellToPlan(s, w); }
        log(s, `Куплен участок: +${d.n} скважин. Проверьте АГЗУ, энергию и персонал!`, 'good');
      } },
    { key: 'tax', w: 2, cond: s => coverage(s).dept.aup < 0.85,
      make: s => { const f = Math.max(5e6, s.cash * 0.01); transact(s, -f, 'Штрафы и неустойки', 'Доначисление по налоговой проверке'); log(s, `Налоговая проверка: ошибки в учёте, доначислено ${fmtMoney(f)}. Нужны экономисты в АУП`, 'bad'); } },
    { key: 'grant', w: 1, cond: s => s.cash < 300e6 * idx(s),
      make: s => { const g = 150e6 * idx(s); transact(s, g, 'Прочие доходы', 'Государственная программа поддержки недропользователей'); log(s, `Получена субсидия по госпрограмме поддержки: ${fmtMoney(g)}`, 'good'); } },
    { key: 'theft', w: 2, cond: s => tankVol(s, 'oil') > 500 && !effVal(s, 'security', 0),
      make: s => ({ title: 'Несанкционированная врезка', text: 'На нефтепроводе обнаружена врезка: похищено около 150 тонн нефти. Усилить охрану трубопроводов?',
        options: [{ label: 'Нанять охранное предприятие на год', hint: `${fmtMoney(8e6 * idx(s))}/мес, кражи исключены`, data: 'guard' }, { label: 'Только заварить врезку', hint: 'Кражи могут повториться', data: 'no' }] }),
      resolve: (s, d) => { fillTanks(s, 'oil', -150); if (d === 'guard') addEffect(s, 'security', 365, 1, 'Охрана трубопроводов'); } },
    { key: 'metal', w: 2, cond: () => true,
      make: s => { addEffect(s, 'matPrice', 90, 1.2, 'Рост цен на металл'); log(s, 'Металлопрокат подорожал: материалы и строительство +20% на 3 месяца', 'warn'); } },
    { key: 'expert', w: 1, cond: () => true,
      make: s => ({ title: 'Опытный технолог ищет работу', text: 'Известный специалист по разработке месторождений готов перейти к вам. Его методика снижает рост обводнённости.',
        options: [{ label: `Нанять (подъёмные ${fmtMoney(15e6 * idx(s))})`, hint: '+2 геолога, мораль +3', data: 'yes' }, { label: 'Отказаться', data: 'no' }] }),
      resolve: (s, d) => { if (d === 'yes') { transact(s, -15e6 * idx(s), 'Найм персонала', 'Подъёмные технологу'); addPeople(s, 'geo', 2, { prior: 20, age: 48, grade: 6 }); s.morale += 3; } } },
    { key: 'ratio', w: 2, cond: () => true,
      make: s => ({ title: 'Рационализаторское предложение', text: 'Энергетики предлагают оптимизировать режимы работы оборудования. Нужна премия авторам.',
        options: [{ label: `Внедрить (премия ${fmtMoney(5e6 * idx(s))})`, hint: 'Энергопотребление −6% на год, мораль +4', data: 'yes' }, { label: 'Отклонить', hint: 'Мораль −2', data: 'no' }] }),
      resolve: (s, d) => { if (d === 'yes') { transact(s, -5e6 * idx(s), 'ФОТ', 'Премия рационализаторам'); addEffect(s, 'energySave', 365, 0.94, 'Оптимизация энергопотребления'); addEffect(s, 'moraleBoost', 120, 6, 'Признание сотрудников'); } else s.morale -= 2; } },
    { key: 'bkns', w: 2, cond: s => facs(s, 'bkns').length > 0,
      make: s => { const f = pick(s, facs(s, 'bkns')); f.health = Math.max(5, f.health - 30); log(s, `Вибрация и перегрев на ${f.name}: износ −30 п.п. Проведите ТО, иначе возможна авария`, 'warn'); } },
    { key: 'discovery', w: 1, cond: s => s.projects.some(p => p.type === 'well_sk' || p.type === 'well_ecn'),
      make: s => { s.reservoir.prospects += 1; log(s, 'Буровики вскрыли продуктивный пропласток: следующая новая скважина даст +30% дебита', 'good'); } },
    { key: 'spill', w: 1, cond: s => s.contracts.some(c => c.status === 'active' && c.channel === 'rail'),
      make: s => { const f = 15e6 * idx(s); transact(s, -f, 'Штрафы и неустойки', 'Разлив при наливе в цистерны'); s.trust -= 2; log(s, `Разлив нефти на ж/д эстакаде: штраф ${fmtMoney(f)}`, 'bad'); } },
    { key: 'training', w: 1, cond: s => s.morale < 70,
      make: s => ({ title: 'Программа обучения персонала', text: 'Учебный центр предлагает курс повышения квалификации и охраны труда.',
        options: [{ label: `Оплатить курс (${fmtMoney(assetSummary(s).staff * 60000 * idx(s))})`, hint: 'Мораль +8, ОТ лучше', data: 'yes' }, { label: 'Не сейчас', data: 'no' }] }),
      resolve: (s, d) => { if (d === 'yes') { transact(s, -assetSummary(s).staff * 60000 * idx(s), 'Прочие расходы', 'Обучение персонала'); s.morale += 8; addEffect(s, 'moraleBoost', 180, 5, 'Обучение'); } } },
    { key: 'pandemic', w: 0, cond: () => false,
      make: s => ({ title: 'Пандемия: санитарные ограничения', text: 'Вводятся карантинные меры. Можно перевести вахты на изолированный режим 30/30 с тестированием — это дорого, но защищает от вспышек.',
        options: [{ label: `Изолированные вахты (${fmtMoney(assetSummary(s).staff * 150000 * idx(s))})`, hint: 'Без потерь персонала', data: 'iso' }, { label: 'Обычный режим', hint: 'Персонал −25% на 45 дней', data: 'no' }] }),
      resolve: (s, d) => { if (d === 'iso') transact(s, -assetSummary(s).staff * 150000 * idx(s), 'Прочие расходы', 'Изолированные вахты'); else addEffect(s, 'sick', 45, 0.75, 'Вспышка заболеваемости'); } }
  ];
  function randomEvents(s, cov) {
    if (s.pending || s.day - s.lastEvent < 8) return;
    const chance = 1 / 24 * (1.3 - 0.3 * cov.dept.hse);
    if (rnd(s) > chance) return;
    const list = EVENTS.filter(e => e.w > 0 && e.cond(s));
    const tot = sum(list, e => e.w); let x = rnd(s) * tot;
    const e = list.find(e => (x -= e.w) < 0) || list[0];
    if (!e) return;
    s.lastEvent = s.day;
    const r = e.make(s);
    if (r && r.options) s.pending = Object.assign({ key: e.key }, r);
  }
  function cdngFree(s) {
    const load = c => s.wells.filter(w => w.cdng === c.id).length;
    return s.cdngs.filter(c => load(c) < 40).sort((a, b) => load(a) - load(b))[0] || null;
  }

  /* ===================== действия игрока ===================== */
  function int(x, a, b, what = 'значение') { x = Math.round(Number(x)); if (!Number.isFinite(x) || x < a || x > b) throw new Error(`${what}: от ${a} до ${b}`); return x; }
  function baseRate(s) {
    const y = parts(s.day).y;
    const base = y < 2003 ? 0.16 : y < 2008 ? 0.12 : y < 2011 ? 0.15 : y < 2015 ? 0.11 : y < 2017 ? 0.17 : y < 2022 ? 0.12 : 0.17;
    return r2(base + effVal(s, 'credit', 0));
  }
  function loanRate(s) { return r2(baseRate(s) + (60 - s.trust) / 1000); }
  function depositRate(s, type) { return Math.max(0.01, r2(baseRate(s) + D.DEPOSITS[type].spread)); }
  function creditLimit(s) { return Math.max(0, Math.max(1e9 * idx(s), capitalization(s) * 0.4) * clamp(s.trust / 60, 0.2, 1.5) - sum(s.loans, l => l.principal)); }
  function act(s, type, a = {}) {
    if (s.gameOver) throw new Error('Игра окончена');
    switch (type) {
      case 'hire': {
        const r = D.ROLES.find(x => x.key === a.role); if (!r) throw new Error('Неизвестная должность');
        const n = int(a.n, 1, 200, 'Количество');
        pay(s, n * r.salary * idx(s) * 0.3, 'Найм персонала', `Подбор: ${r.name}, ${n} чел.`);
        s.hires.push({ role: r.key, n, days: 4 + Math.ceil(n / 2) }); break;
      }
      case 'fire': {
        const r = D.ROLES.find(x => x.key === a.role); const n = int(a.n, 1, 500, 'Количество');
        if (s.staff[r.key].n < n) throw new Error('Столько работников нет');
        const gone = removePeople(s, r.key, n);
        const sev = sum(gone, p => personSalary(s, p).total * (yearsToPension(s, p) < 2 ? 3 : 1));
        transact(s, -sev, 'ФОТ', `Выходное пособие: ${r.name}, ${n} чел.`);
        s.morale = clamp(s.morale - Math.min(10, n * 0.8), 0, 100); break;
      }
      case 'salary': { const r = s.staff[a.role]; if (!r) throw new Error('Неизвестная должность'); r.pct = int(a.pct, 70, 200, 'Уровень оплаты, %'); break; }
      case 'salaryAll': { const pct = int(a.pct, 70, 200, 'Уровень оплаты, %'); for (const k in s.staff) s.staff[k].pct = pct; break; }
      case 'buy': {
        const m = D.MATERIALS.find(x => x.key === a.key); if (!m) throw new Error('Материал не найден');
        if (m.tech && !has(s, m.tech)) throw new Error('Требуется технология');
        const qty = int(a.qty, 1, 10000000, 'Количество');
        pay(s, qty * matPrice(s, m.key), 'Закупка МТР', `${m.name}: ${fmtNum(qty)} ${m.unit}`);
        s.orders.push({ key: m.key, qty, days: leadTime(s) }); break;
      }
      case 'toggle': { if (!(a.key in s.auto)) throw new Error('Нет настройки'); s.auto[a.key] = !s.auto[a.key]; break; }
      case 'ckppn': {
        if (a.temp !== undefined) s.ckppnSet.temp = int(a.temp, 30, 85, 'Температура');
        if (a.dose !== undefined) s.ckppnSet.dose = clamp(Number(a.dose), 0, 2);
        if (a.wash !== undefined) s.ckppnSet.wash = !!a.wash; break;
      }
      case 'gasSet': { if (a.deg !== undefined) s.gasSet.deg = int(a.deg, 15, 50, 'Расход ДЭГ, л/ч'); if (a.reg !== undefined) s.gasSet.reg = int(a.reg, 140, 175, 'Регенерация ДЭГ, °C'); break; }
      case 'gwell': {
        const w = s.gwells.find(x => x.id === Number(a.id)); if (!w) throw new Error('Скважина не найдена');
        if (a.op === 'open') {
          if (w.status !== 'idle') throw new Error('Скважина не в консервации');
          if (!facs(s, 'uppg').length) throw new Error('Сначала постройте УППГ');
          pay(s, 12e6 * idx(s), 'Подрядные работы', `Расконсервация газовой скважины ${w.name}`); w.status = 'prep'; w.down = 10;
        } else if (a.op === 'repair') { if (w.status !== 'fail') throw new Error('Ремонт не нужен'); gwRepair(s, w, true); }
        else if (a.op === 'stop') { if (w.status !== 'work') throw new Error('Скважина не в работе'); w.status = 'stop'; }
        else if (a.op === 'start') { if (w.status !== 'stop') throw new Error('Скважина не остановлена'); w.status = 'work'; }
        else throw new Error('Неизвестная операция');
        break;
      }
      case 'ppd': { if (a.comp !== undefined) s.ppd.comp = int(a.comp, 0, 150, 'Компенсация, %'); if (a.reserve !== undefined) s.ppd.reserve = int(a.reserve, 0, 80, 'Неснижаемый остаток, %'); break; }
      case 'tender': {
        const B = D.BUILD[a.type], S = D.SERVICES[a.type];
        if (B) {
          if (B.tech && !has(s, B.tech)) throw new Error('Требуется технология: ' + D.TECH.find(t => t.key === B.tech).name);
          if (a.type.startsWith('well_') && a.type !== 'well_gas' && !cdngFree(s)) throw new Error('Все ЦДНГ заполнены (40 скважин на цех). Постройте новый ЦДНГ');
          s.tender = { kind: 'build', type: a.type, purpose: a.purpose || (B.tank ? 'oil' : null), offers: contractorOffers(s, B.cat, B.cost, B.days), title: B.name };
        } else if (S) {
          if (S.tech && !has(s, S.tech)) throw new Error('Требуется технология');
          let target = a.target != null ? Number(a.target) : null;
          if (['prs', 'krs', 'grp', 'opz'].includes(a.type)) {
            const w = s.wells.find(x => x.id === target); if (!w) throw new Error('Выберите скважину');
            if (s.projects.some(p => p.target === w.id) || s.repairs.some(r => r.well === w.id)) throw new Error('На скважине уже ведутся работы');
            if (a.type === 'prs' && w.status !== 'fail') throw new Error('ПРС нужен только остановленной скважине');
          }
          if (['anticor', 'clean'].includes(a.type)) {
            const t = s.fac.find(f => f.id === target); if (!t) throw new Error('Выберите резервуар');
            if (t.status === 'service') throw new Error('Резервуар уже в работах');
          }
          s.tender = { kind: 'service', type: a.type, target, offers: contractorOffers(s, S.cat, S.cost, S.days), title: S.name };
        } else throw new Error('Неизвестный объект');
        return s.tender;
      }
      case 'award': {
        const T = s.tender; if (!T) throw new Error('Нет активного тендера');
        const o = T.offers[int(a.i, 0, T.offers.length - 1)];
        const adv = T.kind === 'build' ? 0.25 : 0.5;
        pay(s, o.price * adv, T.kind === 'build' || T.type === 'seismic' ? 'Капвложения' : 'Подрядные работы', `Аванс ${adv * 100}%: ${T.title} — ${o.name}`);
        const pr = { id: uid(s), kind: T.kind, type: T.type, title: T.title + (T.purpose ? ` (${D.TANK_PURPOSE[T.purpose].split(' ')[0].toLowerCase()})` : ''), contractor: o.name, cid: o.cid, total: o.price, paid: o.price * adv, daysTotal: o.days, daysLeft: o.days, quality: o.quality, delay: 0, purpose: T.purpose, target: T.target };
        if (T.type.startsWith('well_') && T.type !== 'well_gas') pr.cdng = (a.cdng && s.cdngs.find(c => c.id === Number(a.cdng)) && s.wells.filter(w => w.cdng === Number(a.cdng)).length < 40) ? Number(a.cdng) : cdngFree(s).id;
        if (['prs', 'krs', 'grp', 'opz'].includes(T.type)) { const w = s.wells.find(x => x.id === T.target); if (T.type === 'prs') { const m = failMaterials(w); if (!canMaterials(s, m)) { transact(s, pr.paid, 'Подрядные работы', 'Возврат аванса'); throw new Error('Не хватает материалов на складе для ПРС'); } takeMaterials(s, m); } w.status = 'repair'; }
        if (['anticor', 'clean'].includes(T.type)) {
          const t = s.fac.find(f => f.id === T.target);
          if (t.volume > 1) { const moved = fillTanksExcept(s, t, t.volume); if (moved + 1e-6 < t.volume) { transact(s, pr.paid, 'Подрядные работы', 'Возврат аванса'); throw new Error('Некуда перекачать содержимое резервуара — освободите место в других РВС того же назначения'); } t.volume = 0; }
          t.status = 'service'; t.serviceDays = o.days;
        }
        s.projects.push(pr); s.tender = null;
        log(s, `Заключён договор подряда: ${pr.title} — ${o.name}, ${o.days} дн.`, 'info'); break;
      }
      case 'cancelTender': s.tender = null; break;
      case 'cancelProject': {
        const pr = s.projects.find(p => p.id === Number(a.id)); if (!pr) throw new Error('Проект не найден');
        transact(s, pr.paid * 0.4, 'Прочие доходы', `Возврат части аванса: ${pr.title}`);
        if (pr.target) { const w = s.wells.find(x => x.id === pr.target); if (w && w.status === 'repair') w.status = pr.type === 'prs' ? 'fail' : 'work'; const t = s.fac.find(f => f.id === pr.target); if (t && t.status === 'service') t.status = 'ok'; }
        s.projects = s.projects.filter(p => p !== pr); log(s, `Проект отменён: ${pr.title}`, 'warn'); break;
      }
      case 'repair': {
        const w = s.wells.find(x => x.id === Number(a.id)); if (!w || w.status !== 'fail') throw new Error('Скважина не требует ПРС');
        if (brigades(s) - s.repairs.length <= 0) throw new Error('Все бригады ПРС заняты. Наймите рабочих ПРС (4 чел. = бригада) или вызовите подрядчика');
        const m = failMaterials(w); if (!canMaterials(s, m)) throw new Error('Не хватает материалов: ' + Object.entries(m).map(([k, v]) => `${matName(k)} ×${v}`).join(', '));
        takeMaterials(s, m); s.repairs.push({ well: w.id, days: 3 }); w.status = 'repair'; break;
      }
      case 'wellToggle': {
        const w = s.wells.find(x => x.id === Number(a.id)); if (!w) throw new Error('Скважина не найдена');
        if (w.status === 'work') w.status = 'idle'; else if (w.status === 'idle') w.status = 'work'; else throw new Error('Скважина в ремонте/отказе'); break;
      }
      case 'wellCdng': { const w = s.wells.find(x => x.id === Number(a.id)); const c = s.cdngs.find(x => x.id === Number(a.cdng)); if (!w || !c) throw new Error('Не найдено'); if (s.wells.filter(x => x.cdng === c.id).length >= 40) throw new Error('Цех заполнен'); w.cdng = c.id; break; }
      case 'maintain': {
        const f = s.fac.find(x => x.id === Number(a.id)); if (!f) throw new Error('Объект не найден');
        if (D.BUILD[f.type].tank) throw new Error('Для РВС используйте подрядные работы: антикор или зачистка');
        if (f.status === 'service') throw new Error('Объект на обслуживании');
        if (s.staff.mech.n < 1) throw new Error('Нет слесарей ПРЦЭО');
        const part = ['substation', 'gtes', 'dgu', 'ses'].includes(f.type) ? null : 'pparts';
        if (part && s.stock[part] < 1) throw new Error('Нет запчастей насосов на складе');
        pay(s, 1.5e6 * idx(s) * (f.type === 'gtes' ? 4 : 1), 'Ремонт и ТО', `ТО: ${f.name}`);
        if (part) s.stock[part] -= 1;
        f.health = clamp(f.health + 35, 0, 100); f.status = 'ok'; break;
      }
      case 'demolish': {
        const f = s.fac.find(x => x.id === Number(a.id)); if (!f) throw new Error('Объект не найден');
        if (f.type === 'cdng') throw new Error('Цех снести нельзя');
        if (D.BUILD[f.type].tank && f.volume > 1) throw new Error('Сначала освободите резервуар');
        if (s.fac.filter(x => x.type === f.type).length <= 1 && !D.BUILD[f.type].tank) throw new Error('Нельзя снести последний объект этого типа');
        pay(s, 3e6 * idx(s), 'Прочие расходы', `Демонтаж: ${f.name}`); s.fac = s.fac.filter(x => x !== f); break;
      }
      case 'tankPurpose': {
        const t = s.fac.find(x => x.id === Number(a.id)); if (!t || !D.BUILD[t.type].tank) throw new Error('Резервуар не найден');
        if (t.volume > 1) throw new Error('Перепрофилировать можно только пустой РВС');
        if (!D.TANK_PURPOSE[a.purpose]) throw new Error('Неверное назначение');
        pay(s, 2e6 * idx(s), 'Ремонт и ТО', `Перепрофилирование ${t.name}`); t.purpose = a.purpose; break;
      }
      case 'tech': {
        const t = D.TECH.find(x => x.key === a.key); if (!t) throw new Error('Технология не найдена');
        if (has(s, t.key)) throw new Error('Уже внедрено');
        if (parts(s.day).y < t.year) throw new Error(`Станет доступно в ${t.year} году`);
        pay(s, t.cost * idx(s), 'Технологии', `Внедрение: ${t.name}`); s.tech[t.key] = iso(s.day);
        log(s, `Внедрена технология: ${t.name}`, 'good'); break;
      }
      case 'accept': {
        const o = s.offers.find(x => x.id === Number(a.id)); if (!o) throw new Error('Предложение не найдено');
        if (s.quality.group > o.minGroup) throw new Error(`Покупатель требует качество не ниже ${o.minGroup} группы. Сейчас: ${s.quality.group === 4 ? 'некондиция' : s.quality.group + ' группа'}`);
        s.contracts.push({ id: o.id, buyer: o.buyer, channel: o.channel, monthly: o.monthly, monthsLeft: o.months, months: o.months, discount: o.discount, penalty: o.penalty, minGroup: o.minGroup, shippedMonth: 0, shippedTotal: 0, status: 'active', start: iso(s.day), history: [] });
        s.offers = s.offers.filter(x => x !== o);
        log(s, `Заключён договор №${o.id}: ${o.buyer}, ${fmtNum(o.monthly)} т/мес на ${o.months} мес.`, 'good'); break;
      }
      case 'cancelContract': {
        const c = s.contracts.find(x => x.id === Number(a.id) && x.status === 'active'); if (!c) throw new Error('Договор не найден');
        const fine = c.monthly * oilPriceT(s, D.CHANNELS[c.channel].discount) * 0.1;
        pay(s, fine, 'Штрафы и неустойки', `Расторжение договора №${c.id}`); c.status = 'cancelled'; s.trust -= 2; break;
      }
      case 'spot': {
        const qty = int(a.qty, 1, 1e7, 'Объём');
        if (s.quality.group === 4) throw new Error('Некондицию не принимает даже спот-рынок');
        if (qty > tankVol(s, 'oil') + 1e-6) throw new Error('В товарных РВС столько нет');
        if ((s.spotDay === s.day ? s.spotQty : 0) + qty > 400) throw new Error('Автоналив спот: не более 400 т в сутки');
        const price = oilPriceT(s, 4) * 0.8;
        fillTanks(s, 'oil', -qty); transact(s, qty * price, 'Спотовая продажа', `Спот (автоналив) ${fmtNum(qty)} т, дисконт 20%`);
        transact(s, -qty * 3000 * idx(s), 'Транспорт нефти', 'Автоналив'); s.mSold += qty;
        s.spotQty = (s.spotDay === s.day ? s.spotQty : 0) + qty; s.spotDay = s.day; break;
      }
      case 'loan': {
        const amount = int(a.amount, 1e6, 1e13, 'Сумма'); const months = int(a.months, 6, 120, 'Срок');
        if (amount > creditLimit(s)) throw new Error(`Превышен кредитный лимит: ${fmtMoney(creditLimit(s))}`);
        const rate = loanRate(s), i = rate / 12; const payment = amount * i / (1 - Math.pow(1 + i, -months));
        s.loans.push({ id: uid(s), principal: amount, rate, months, payment, start: iso(s.day) });
        transact(s, amount, 'Кредит получен', `Кредит ${Math.round(rate * 100)}% на ${months} мес.`); break;
      }
      case 'repay': { const l = s.loans.find(x => x.id === Number(a.id)); if (!l) throw new Error('Кредит не найден'); pay(s, l.principal, 'Погашение кредита', `Досрочное погашение №${l.id}`); s.loans = s.loans.filter(x => x !== l); break; }
      case 'deposit': {
        const amount = int(a.amount, 1e6, 1e13, 'Сумма'); const type = D.DEPOSITS[a.type] ? a.type : 'demand'; const T = D.DEPOSITS[type];
        pay(s, amount, 'Депозит открыт', `${T.name}`);
        const d = { id: uid(s), type, principal: amount, amount, rate: depositRate(s, type), start: s.day, end: T.months ? s.day + Math.round(T.months * 30.44) : null };
        s.deposits.push(d); log(s, `Открыт депозит №${d.id}: ${T.name}, ${fmtMoney(amount)} под ${(d.rate * 100).toFixed(1)}%`, 'info'); return d;
      }
      case 'withdraw': {
        const d = s.deposits.find(x => x.id === Number(a.id)); if (!d) throw new Error('Депозит не найден');
        let interest = 0;
        if (d.type !== 'demand') { const months = (s.day - d.start) / 30.44; interest = d.principal * depositRate(s, 'demand') * months / 12; }
        transact(s, d.principal, 'Депозит закрыт', `Депозит №${d.id}${d.type !== 'demand' ? ' — досрочно' : ''}`);
        if (interest > 0) transact(s, interest, 'Проценты по депозитам', `Проценты при досрочном закрытии №${d.id}`);
        s.deposits = s.deposits.filter(x => x !== d); return { returned: d.principal + interest, lost: Math.max(0, d.amount - d.principal - interest) };
      }
      case 'hse': return hseAct(s, a);
      case 'resolve': {
        const ev = s.pending; if (!ev) throw new Error('Нет события');
        const opt = ev.options[int(a.i, 0, ev.options.length - 1)];
        s.pending = null;
        if (ev.key === 'plan' && opt.data === 'custom') { s.pending = ev; throw new Error('Для своего плана используйте форму ввода'); }
        if (ev.key === 'plan') { setPlan(s, ev.data.y, opt.data); log(s, `Утверждён план на ${ev.data.y} год: ${PLAN_LEVELS[opt.data].name.toLowerCase()}`, 'info'); }
        else { const e = EVENTS.find(x => x.key === ev.key); if (e && e.resolve) e.resolve(s, opt.data); }
        s.trust = clamp(s.trust, 0, 100); s.morale = clamp(s.morale, 0, 100);
        break;
      }
      case 'person': {
        const p = s.people.find(x => x.id === Number(a.id)); if (!p) throw new Error('Работник не найден');
        const sal = personSalary(s, p).total;
        if (a.op === 'grade') {
          if (p.grade >= 6) throw new Error('Высший разряд/категория уже присвоены');
          if (p.skill < 0.7 + (p.grade - 2) * 0.08) throw new Error(`Не хватает квалификации: нужна эффективность ${(0.7 + (p.grade - 2) * 0.08).toFixed(2)}. Отправьте на обучение`);
          p.grade++; p.mood = clamp(p.mood + 12, 0, 100); log(s, `${p.name}: присвоен ${p.grade}-й разряд/категория (оклад +8%)`, 'good');
        } else if (a.op === 'bonus') {
          pay(s, sal, 'ФОТ', `Премия: ${p.name}`); p.awards++; p.mood = clamp(p.mood + 18, 0, 100); s.morale = clamp(s.morale + 0.3, 0, 100);
        } else if (a.op === 'train') {
          if (s.day - p.lastTrain < 180) throw new Error('Обучение не чаще раза в полгода');
          pay(s, sal * 0.6, 'Прочие расходы', `Обучение и повышение квалификации: ${p.name}`);
          p.skill = r2(clamp(p.skill + 0.06, 0.4, 1.35)); p.trained++; p.lastTrain = s.day; p.mood = clamp(p.mood + 5, 0, 100);
        } else if (a.op === 'fire') {
          const pre = yearsToPension(s, p) < 2;
          transact(s, -sal * (pre ? 3 : 1), 'ФОТ', `Выходное пособие: ${p.name}`);
          s.people = s.people.filter(x => x !== p); syncStaff(s);
          s.morale = clamp(s.morale - (pre ? 2.5 : 0.8), 0, 100);
          log(s, `Уволен: ${p.name} (${roleName(p.role).toLowerCase()})${pre ? ' — предпенсионный возраст, коллектив недоволен' : ''}`, 'warn');
        } else if (a.op === 'cdng') {
          const c = s.cdngs.find(x => x.id === Number(a.cdng)); if (!c) throw new Error('Цех не найден'); p.cdng = c.id;
        } else throw new Error('Неизвестное действие');
        return p;
      }
      case 'closeReport': { if (s.report) s.report.open = false; break; }
      case 'chief': {
        const c = s.cdngs.find(x => x.id === Number(a.cdng)); if (!c) throw new Error('Цех не найден');
        const ch = c.chief; const key = ym(parts(s.day).y, parts(s.day).m);
        const rep = lastCdReport(s, c.id); const good = rep ? rep.ratio >= 1 : true; const bad = rep ? rep.ratio < 0.95 : false;
        if (a.op === 'search') { pay(s, D.CHIEF_SALARY * idx(s) * 0.5, 'Найм персонала', `Поиск кандидатов: начальник ${c.name}`); genCandidates(s, c); return c.candidates; }
        if (a.op === 'hire') {
          if (ch) throw new Error('Должность занята — сначала освободите её');
          if (c.incoming) throw new Error('Новый начальник уже выходит на работу');
          const cand = (c.candidates || [])[int(a.i, 0, 2)]; if (!cand) throw new Error('Кандидат не найден');
          pay(s, cand.salary * idx(s), 'Найм персонала', `Подбор начальника ${c.name}: ${cand.name}`);
          c.incoming = { chief: cand, days: 10 }; c.candidates = [];
          log(s, `${c.name}: принято решение о назначении ${cand.name} (коэфф. ${cand.eff.toFixed(2)}), выход через 10 дней`, 'info');
          if (s.report) s.report.decided[c.id] = 'hire';
          return c.incoming;
        }
        if (!ch) throw new Error('В цехе нет начальника (работает и.о.)');
        if (['remark', 'reprimand', 'bonus'].includes(a.op) && ch.lastAction === key) throw new Error('По этому начальнику решение в этом месяце уже принято');
        if (a.op === 'remark') {
          ch.remarks++; ch.lastAction = key;
          if (bad) { ch.boost = 0.05; ch.boostUntil = s.day + 90; ch.loyalty = clamp(ch.loyalty - 5, 0, 100); log(s, `${c.name}: замечание начальнику ${ch.name}. Обещал исправить ситуацию (+0,05 к эффективности на 3 мес.)`, 'warn'); }
          else { ch.loyalty = clamp(ch.loyalty - 12, 0, 100); s.morale = clamp(s.morale - 1, 0, 100); log(s, `${c.name}: замечание без оснований — ${ch.name} обижен (лояльность −12)`, 'warn'); }
        } else if (a.op === 'reprimand') {
          ch.reprimands++; ch.lastAction = key;
          if (bad) { ch.boost = 0.1; ch.boostUntil = s.day + 90; ch.loyalty = clamp(ch.loyalty - 14, 0, 100); log(s, `${c.name}: выговор начальнику ${ch.name} (${ch.reprimands}-й). Мотивация +0,10 на 3 мес., лояльность −14`, 'warn'); }
          else { ch.loyalty = clamp(ch.loyalty - 25, 0, 100); s.morale = clamp(s.morale - 3, 0, 100); log(s, `${c.name}: необоснованный выговор — коллектив возмущён (мораль −3), ${ch.name}: лояльность −25`, 'bad'); }
        } else if (a.op === 'bonus') {
          const b = ch.salary * idx(s) * 2; pay(s, b, 'ФОТ', `Премия начальнику ${c.name}: ${ch.name}`);
          ch.lastAction = key; ch.bonuses++; ch.loyalty = clamp(ch.loyalty + (good ? 15 : 6), 0, 100);
          if (good) ch.eff = r2(clamp(ch.eff + 0.02, 0.4, 1.4));
          if (ch.remarks > 0) ch.remarks--;
          log(s, `${c.name}: премия начальнику ${ch.name}${good ? ' за выполнение плана' : ''}`, 'good');
        } else if (a.op === 'fire') {
          const sev = ch.reprimands >= 2 ? 0 : ch.salary * idx(s) * 3;
          if (sev) pay(s, sev, 'ФОТ', `Выходное пособие начальнику ${c.name}`);
          log(s, `${c.name}: начальник цеха ${ch.name} уволен${sev ? '' : ' по дисциплинарному основанию (без выходного пособия)'}. До назначения нового цехом руководит и.о. (коэфф. 0,70)`, 'warn');
          c.chief = null; s.morale = clamp(s.morale - (good ? 4 : 1), 0, 100); genCandidates(s, c);
        } else throw new Error('Неизвестное решение');
        if (s.report) s.report.decided[c.id] = a.op;
        break;
      }
      case 'setting': { if (a.key === 'monthReport') s.settings.monthReport = !!a.value; break; }
      case 'rename': {
        if (a.name !== undefined) { const n = String(a.name).trim().slice(0, 40); if (!n) throw new Error('Пустое название компании'); s.company.name = n; }
        if (a.field !== undefined) { const f = String(a.field).trim().slice(0, 40); if (!f) throw new Error('Пустое название месторождения'); s.company.field = f; }
        break;
      }
      case 'planCustom': {
        const y = a.y ? Number(a.y) : parts(s.day).y;
        const isEvent = s.pending && s.pending.key === 'plan' && s.pending.data.y === y;
        if (!isEvent && y !== parts(s.day).y) throw new Error('План можно задать только на текущий год');
        const r = setPlanCustom(s, y, a.byCdng || {}, a.total);
        if (isEvent) { s.pending = null; log(s, `Утверждён собственный план на ${y} год: ${fmtNum(Math.round(r.total))} т (${PLAN_LEVELS[r.level].name.toLowerCase()} уровень)`, 'info'); }
        else {
          const PF = ensurePF(s, y); PF.corrections = (PF.corrections || 0) + 1;
          const pen = parts(s.day).m === 1 && PF.corrections === 1 ? 0 : 3;
          s.trust = clamp(s.trust - pen, 0, 100);
          log(s, `План ${y} года скорректирован: ${fmtNum(Math.round(r.total))} т${pen ? `. Совет директоров недоволен корректировкой: доверие −${pen}` : ''}`, pen ? 'warn' : 'info');
        }
        return r;
      }
      default: throw new Error('Неизвестное действие: ' + type);
    }
    return s;
  }
  function fillTanksExcept(s, t, vol) {
    const keep = t.status; t.status = 'off';
    const moved = fillTanks(s, t.purpose, vol); t.status = keep; return moved;
  }

  /* ===================== ЦДПиТГ: природный газ ===================== */
  const GAS_PRICE_N = 5, GAS_PRICE_P = 4; // ₸/м³ в базовых ценах
  const winterGas = s => { const m = parts(s.day).m; return m >= 11 || m <= 3; };
  function dewNorm(s) { return winterGas(s) ? -20 : -10; }
  function degConc(s) { return clamp(87 + (s.gasSet.reg - 155) * 0.45, 70, 96); }
  function gasDew(s, load) {
    const g = s.gasSet, u = facs(s, 'uppg').filter(f => f.status === 'ok');
    const h = u.length ? sum(u, f => f.health) / u.length : 100;
    const m = parts(s.day).m; const warm = m >= 5 && m <= 9 ? 3 : 0;
    return -27 + Math.max(0, 32 - g.deg) * 1.6 + Math.max(0, 89 - degConc(s)) * 1.4 + (100 - h) * 0.08 + Math.max(0, (load || 0) - 0.95) * 40 + (s.stock.deg > 0 ? 0 : 30) + warm;
  }
  function gwellPot(s, w) { const G = s.gasRes; return w.q * Math.pow(clamp(G.remaining / G.total, 0, 1), 0.6) * (0.6 + 0.4 * w.health / 100); }
  function makeGwell(s, quality = 0.9, status = 'work') {
    return { id: uid(s), name: `Г-${s.gwNo++}`, q: Math.round(rr(s, 25, 55) * (0.85 + 0.2 * quality)) * 1000, health: Math.round(78 + 22 * quality), status, down: 0, today: 0, cum: 0, book: 0 };
  }
  function gwRepair(s, w, manual) {
    const cost = 6e6 * idx(s);
    if (!manual && s.cash < cost * 3) return false;
    pay(s, cost, 'Подрядные работы', `Ремонт газовой скважины ${w.name}`);
    w.status = 'repair'; w.down = 6; w.health = Math.min(100, w.health + 20); return true;
  }
  function initGas(s) {
    s.gwNo = 1; s.gwells = []; s.gasRes = { total: 8e9, remaining: 8e9 }; s.gasSet = { deg: 32, reg: 160 }; s.gasHyd = 0; s.gasTrip = 0; s.mGasN = 0; s.mGasNS = 0;
    for (let i = 0; i < 5; i++) { const w = makeGwell(s, 0.6, 'idle'); w.health = ri(s, 55, 80); w.book = 30e6; s.gwells.push(w); }
    if (s.stock.deg == null) s.stock.deg = 300;
  }
  function natGasDay(s, cov, energyF) {
    const G = s.gasRes, nU = facs(s, 'uppg').filter(f => f.status === 'ok').length, rawCap = capOf(s, 'uppg');
    const capU = rawCap * energyF * (0.6 + 0.4 * (cov.dept.gas != null ? Math.min(1, cov.dept.gas) : 1)) * (s.gasHyd > 0 ? 0.35 : 1);
    let pot = 0, slots = nU * 22; const list = [];
    for (const w of s.gwells) {
      w.today = 0;
      if (w.status === 'prep' || w.status === 'repair') { if (--w.down <= 0) { w.status = 'work'; log(s, `Газовая скважина ${w.name} в работе`, 'good'); } continue; }
      if (w.status !== 'work' || !nU || slots <= 0) continue;
      slots--; const q = gwellPot(s, w); pot += q; list.push([w, q]);
    }
    const flow = Math.min(pot, capU), load = rawCap > 0 ? pot / rawCap : 0, k = pot > 0 ? flow / pot : 0;
    for (const [w, q] of list) {
      w.today = q * k; w.cum += w.today; w.q *= 0.99965; w.health = clamp(w.health - 0.012, 1, 100);
      if (rnd(s) < 0.0004 * (1.6 - w.health / 100)) { w.status = 'fail'; w.failName = rnd(s) < 0.5 ? 'порыв шлейфа' : 'пропуск фонтанной арматуры'; log(s, `Газовая скважина ${w.name}: ${w.failName} — закрыта`, 'bad'); }
    }
    if (s.auto.prs) for (const w of s.gwells) if (w.status === 'fail') gwRepair(s, w, false);
    G.remaining = Math.max(0, G.remaining - flow);
    const dew = flow > 0 ? gasDew(s, load) : null, norm = dewNorm(s);
    let degUse = 0, boiler = 0;
    if (flow > 0) {
      degUse = flow / 1000 * 0.06 * (s.gasSet.deg / 32) * (s.gasSet.reg > 166 ? 1 + (s.gasSet.reg - 166) * 0.12 : 1);
      s.stock.deg = Math.max(0, s.stock.deg - degUse);
      boiler = flow * 0.003 * s.gasSet.reg / 160;
    }
    if (s.gasHyd > 0) s.gasHyd--;
    else if (flow > 0 && dew > norm && rnd(s) < 0.012 * (dew - norm)) { s.gasHyd = 2; log(s, `УППГ: гидратная пробка — точка росы ${Math.round(dew)}°C при норме ${norm}°C`, 'bad'); }
    return { flow, pot, load, dew, norm, degUse, boiler, ok: dew == null || dew <= norm };
  }

  /* ===================== новая игра ===================== */
  function newGame(o = {}) {
    const diff = { easy: { cash: 6e9, trust: 70 }, normal: { cash: 3e9, trust: 60 }, hard: { cash: 1.2e9, trust: 50 } }[o.difficulty || 'normal'];
    const s = {
      v: VERSION, seed: o.seed || (Date.now() % 1e9), rng: 0, day: 0, nextId: 1, wellNo: 101, tankNo: 1,
      company: { name: (o.name || 'Сарыбулак Петролеум').slice(0, 40), field: o.field || D.FIELD_NAMES[0], difficulty: o.difficulty || 'normal' },
      cash: diff.cash, priceIndex: 1, trust: diff.trust, morale: 66,
      market: { mode: o.market || 'history', base: 25.5, brent: 25.5, fx: 138, fxBase: 138, noiseB: 0, noiseF: 0 },
      reservoir: { total: 25e6, remaining: 25e6, pressure: 92, prospects: 0 },
      cdngs: [], wells: [], fac: [], staff: {}, hires: [], repairs: [], stock: {}, orders: [], projects: [], tender: null,
      contracts: [], offers: [], loans: [], deposits: [], tech: {}, rep: {},
      people: [], namesV: 3, genderV: 5, hse: { readiness: 45, culture: 50, daysNoInj: 0, lastMed: -200, lastTraining: -400, drills: {}, injuries: [], fines: [] },
      mGas: 0, mGasUsed: 0, mFlare: 0, mWellDays: 0, mWorkDays: 0, mFails: 0, mInjuries: 0, auto: { buy: false, prs: true, to: false, dgu: false, util: true }, settings: { monthReport: true }, cdStats: {}, cdReports: [], report: null,
      ckppnSet: { temp: 55, dose: 0.9, wash: false }, ppd: { comp: 100 }, quality: { water: 0.8, salt: 190, group: 3 }, techWf: 0.06,
      pf: {}, history: [], daily: [], ledger: [], log: [], flash: [], effects: [], yearReports: [], goalsDone: {}, flags: {},
      mAcc: {}, yAcc: {}, mProd: 0, mLiq: 0, mInj: 0, mSold: 0, mExportRev: 0, mBrentSum: 0, mFxSum: 0, mDays: 0, yProd: 0,
      lossCarry: 0, negMonths: 0, lastEvent: 0, pending: null, gameOver: null, today: null, rank: 100, prevRank: 100, spotDay: -1, spotQty: 0
    };
    s.rng = s.seed >>> 0;
    for (let n = 1; n <= 4; n++) s.cdngs.push({ id: uid(s), name: `ЦДНГ-${n}`, chief: null, candidates: [] });
    for (const c of s.cdngs) c.chief = makeChief(s, 0.75, 1.15);
    s.cdngs[ri(s, 0, 3)].chief.eff = 0.68; // один слабый начальник — повод для кадровых решений
    const cd = i => s.cdngs[i % 4].id;
    const c1 = s.cdngs[0].id;
    // стартовый фонд: 11 добывающих (по цехам 3/3/3/2), 2 нагнетательных, 1 водозаборная
    for (let i = 0; i < 11; i++) { const w = makeWell(s, 'sk', cd(i), 0.7); w.health = ri(s, 55, 92); w.wc = r2(rr(s, 0.15, 0.42)); w.book = 60e6; s.wells.push(w); }
    failWellSilent(s, s.wells[3]); failWellSilent(s, s.wells[8]);
    for (let i = 0; i < 2; i++) { const w = makeWell(s, 'inj', cd(i + 1), 0.7); w.book = 40e6; s.wells.push(w); }
    const ww = makeWell(s, 'water', c1, 0.7); ww.book = 25e6; s.wells.push(ww);
    const F = (t, q, purpose, book) => { const f = makeFac(s, t, q, book, null, purpose); s.fac.push(f); return f; };
    F('agzu', 0.6, null, 8e6); F('agzu', 0.7, null, 8e6);
    F('upsv', 0.7, null, 60e6); F('ckppn', 0.7, null, 110e6); F('bkns', 0.7, null, 50e6); F('pump_ext', 0.8, null, 20e6);
    F('substation', 0.8, null, 45e6);
    for (let n = 1; n <= 4; n++) { const f = F('cdng', 0.8, null, 20e6); f.name = `Здание ЦДНГ-${n}`; }
    F('tank1000', 0.6, 'tech', 25e6).volume = 380; F('tank1000', 0.6, 'tech', 25e6).volume = 360;
    F('tank2000', 0.7, 'oil', 40e6).volume = 900; F('tank2000', 0.7, 'oil', 40e6).volume = 850;
    F('tank1000', 0.5, 'water', 25e6).volume = 300;
    // персонал
    const need = staffNeed(s);
    for (const r of D.ROLES) s.staff[r.key] = { n: Math.max(1, Math.round(need[r.key] * (r.key === 'op' ? 0.67 : r.key === 'master' ? 1 : 0.9))), pct: 100 };
    s.staff.prs.n = 4;
    s.people = [];
    for (const r of D.ROLES) { const n = s.staff[r.key].n; for (let i = 0; i < n; i++) { const p = makePerson(s, r.key); p.hired = iso(s.day - ri(s, 30, 365 * Math.min(12, Math.max(1, p.prior + 1)))); s.people.push(p); } }
    // пара предпенсионеров для наглядности
    if (s.people.length > 6) { s.people[2].by = 2000 - 62; s.people[2].g = 'm'; s.people[5].by = 2000 - 56; s.people[5].g = s.people[5].g; }
    syncStaff(s);
    // склад
    const st = { nkt: 80, rods: 120, gnu: 5, ecn: 0, cable: 0, skparts: 3, pparts: 3, demulg: 4000, inhib: 1200, diesel: 15000, ppe: 60, deg: 300 };
    for (const m of D.MATERIALS) s.stock[m.key] = st[m.key] || 0;
    initGas(s);
    initCompanies(s);
    genOffers(s);
    s.flash = [];
    log(s, `Компания «${s.company.name}» получила лицензию на месторождение ${s.company.field}. Добро пожаловать, генеральный директор!`, 'info');
    s.today = preview(s);
    s.pending = planEvent(s, 2000, null);
    return s;
  }
  function failWellSilent(s, w) { const f = FAILS.sk[0]; w.status = 'fail'; w.fail = f[0]; w.failName = f[1]; w.down = 3; }
  function preview(s) {
    const c = JSON.parse(JSON.stringify(s)); c.pending = null; c.flash = [];
    tick(c);
    const t = c.today; t.date = iso(s.day); return t;
  }

  /* ===================== продвижение времени ===================== */
  function advance(s, days) {
    const done = [];
    for (let i = 0; i < days; i++) {
      if (s.pending || s.gameOver || (s.report && s.report.open)) break;
      const p = parts(s.day);
      s.mBrentSum += s.market.brent; s.mFxSum += s.market.fx; s.mDays++;
      tick(s); done.push(p);
    }
    return done.length;
  }
  function daysToNextMonth(s) { const p = parts(s.day); return daysInMonth(p.y, p.m) - p.d + 1; }

  /* ===================== сохранение ===================== */
  function serialize(s) { const c = Object.assign({}, s); c.flash = []; return JSON.stringify(c); }
  function deserialize(txt) {
    const s = JSON.parse(txt);
    if (!s || s.v !== VERSION || !Array.isArray(s.wells) || !s.market) throw new Error('Несовместимый формат сохранения (нужна версия Oil Management 2)');
    s.flash = s.flash || [];
    migrate(s);
    return s;
  }
  function migrate(s) {
    s.hse = s.hse || { readiness: 45, culture: 50, daysNoInj: 0, lastMed: s.day - 200, lastTraining: s.day - 400, drills: {}, injuries: [], fines: [] };
    for (const k of ['mGas', 'mGasUsed', 'mFlare', 'mWellDays', 'mWorkDays', 'mFails', 'mInjuries']) if (s[k] == null) s[k] = 0;
    for (const d of s.deposits) { if (!d.type) d.type = 'demand'; if (d.principal == null) d.principal = d.amount; if (d.start == null) d.start = s.day; if (d.end === undefined) d.end = null; }
    for (const c of s.companies || []) if (c.pm == null) compAttrs(s, c);
    s.settings = s.settings || { monthReport: true };
    if (!s.gwells) initGas(s);
    if (s.stock.deg == null) s.stock.deg = 300;
    if (!s.staff.gasop) { s.staff.gasop = { n: 0, pct: 100 }; if (s.people) { const p = makePerson(s, 'gasop'); p.hired = iso(Math.max(0, s.day - 400)); s.people.push(p); syncStaff(s); } }
    s.cdStats = s.cdStats || {}; s.cdReports = s.cdReports || [];
    for (const c of s.cdngs) { if (c.chief === undefined) c.chief = makeChief(s); c.candidates = c.candidates || []; if (c.chief && !c.chief.face) { const age = ri(s, 35, 55); c.chief.g = 'm'; c.chief.by = parts(s.day).y - age; c.chief.face = makeFace(s, 'm', age); } }
    // v4: начальники — мужчины, коллектив 95/5
    if (s.genderV !== 4) {
      const toMale = x => { const age = x.by ? parts(s.day).y - x.by : 40; x.g = 'm'; x.name = kazName(s, 'm'); x.face = makeFace(s, 'm', age); };
      for (const c of s.cdngs) {
        if (c.chief && c.chief.g === 'f') toMale(c.chief);
        if (c.incoming && c.incoming.chief.g === 'f') toMale(c.incoming.chief);
        for (const k of c.candidates || []) if (k.g === 'f') toMale(k);
      }
      s.genderV = 4;
    }
    // v5: женщины только в экологии, геологии, бухгалтерии (≈1%); фамилии без повторов
    if (s.genderV !== 5) {
      const toMale = x => { const age = x.by ? parts(s.day).y - x.by : 40; x.g = 'm'; x.name = kazName(s, 'm'); x.face = makeFace(s, 'm', age); };
      const ppl = s.people || []; const maxF = Math.max(1, Math.round(ppl.length * 0.01));
      for (const p of ppl) if (p.g === 'f' && !FEM_DEPTS.includes(D.ROLES.find(r => r.key === p.role).dept)) toMale(p);
      ppl.filter(p => p.g === 'f').slice(maxF).forEach(toMale);
      const seen = new Set(); const ents = [...ppl];
      for (const c of s.cdngs) { if (c.chief) ents.push(c.chief); if (c.incoming) ents.push(c.incoming.chief); ents.push(...(c.candidates || [])); }
      for (const x of ents) { if (seen.has(baseLast(x.name))) x.name = kazName(s, x.g || 'm'); seen.add(baseLast(x.name)); }
      s.genderV = 5;
    }
    if (s.namesV !== 3) {
      for (const p of s.people || []) p.name = kazName(s, p.g);
      for (const c of s.cdngs) {
        if (c.chief) { c.chief.g = c.chief.g || 'm'; c.chief.name = kazName(s, c.chief.g); }
        if (c.incoming) c.incoming.chief.name = kazName(s, c.incoming.chief.g || 'm');
        for (const k of c.candidates || []) k.name = kazName(s, k.g || 'm');
      }
      s.namesV = 3;
    }
    if (!s.people) { s.people = []; for (const r of D.ROLES) for (let i = 0; i < (s.staff[r.key] ? s.staff[r.key].n : 0); i++) s.people.push(makePerson(s, r.key)); }
  }

  /* ===================== производные показатели для интерфейса ===================== */
  function kpi(s) {
    const t = s.today || {};
    const p = parts(s.day);
    const PF = ensurePF(s, p.y);
    const planMonth = sum(Object.values(PF.plan[p.m - 1])), factMonth = sum(Object.values(PF.fact[p.m - 1]));
    const elapsed = p.d / daysInMonth(p.y, p.m);
    const planYear = sum(Object.values(PF.annual)), factYear = sum(PF.fact, mo => sum(Object.values(mo)));
    const dayOfYear = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(p.y, 0, 1)) / DAY_MS) + 1;
    const yStartDay = Math.round((Date.UTC(p.y, 0, 1) - START) / DAY_MS);
    const planStart = Math.max(0, yStartDay);
    const planToDate = sum(PF.plan.slice(0, p.m - 1), mo => sum(Object.values(mo))) + planMonth * elapsed;
    const wellsWork = s.wells.filter(w => w.status === 'work' && w.type !== 'inj' && w.type !== 'water' && w.connected).length;
    const prodWells = s.wells.filter(w => w.type !== 'inj' && w.type !== 'water').length;
    return {
      date: iso(s.day), y: p.y, m: p.m, d: p.d, wd: p.wd, oil: t.oil || 0, liquid: t.liquid || 0, wc: t.wcAvg || 0, limit: t.limit || '',
      planMonth, factMonth, planToDateMonth: planMonth * elapsed, planYear, factYear, planToDate, dayOfYear, planStart,
      wellsWork, prodWells, failed: s.wells.filter(w => w.status === 'fail').length,
      oilTank: { v: tankVol(s, 'oil'), c: tankCap(s, 'oil') }, techTank: { v: tankVol(s, 'tech'), c: tankCap(s, 'tech') }, waterTank: { v: tankVol(s, 'water'), c: tankCap(s, 'water') },
      energy: t.energy, energyF: t.energyF ?? 1, pressure: s.reservoir.pressure, quality: s.quality,
      cap: capitalization(s), rank: s.rank, trust: s.trust, morale: s.morale, cov: coverage(s), staff: assetSummary(s).staff,
      debt: sum(s.loans, l => l.principal), deposits: sum(s.deposits, d => d.amount), credit: creditLimit(s), loanRate: loanRate(s)
    };
  }

  const API = {
    VERSION, SAVE_KEY, BBL, PNL, PLAN_LEVELS, MONTHS, FAILS,
    newGame, tick, advance, act, kpi, dewNorm, degConc, gwellPot, GAS_PRICE_N, GAS_PRICE_P, coverage, staffNeed, assetSummary, capitalization, leaderboard, energyDemand, energySupply,
    tanks, tankCap, tankVol, capOf, facs, brigades, failMaterials, canMaterials, matPrice, leadTime, loanRate, creditLimit,
    baseRate, depositRate, hseRisk, ltifr, gasUtil, hseIndex, myParams, RPARAMS, avgFacHealth,
    baseLast, usedSurnames, ensurePF, forecastByCdng, yearOutlook, chiefEff, lastCdReport, migrate, personAge, pensionAge, yearsToPension, tenure, personSalary, deptSkill, daysToNextMonth, parts, iso, daysInMonth, has, serialize, deserialize, oilPriceT, effVal, cdngFree,
    wellTypeName, fmtMoney, fmtNum, matName, roleName, qualityOf
  };
  function wellTypeName(t) { return { sk: 'СК (ШГН)', ecn: 'ЭЦН', inj: 'нагнетательная', water: 'водозаборная' }[t]; }
  root.OMEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
