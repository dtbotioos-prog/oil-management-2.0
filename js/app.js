/* Oil Management 2.0 — интерфейс. */
(function () {
  'use strict';
  const E = window.OMEngine, D = window.OMData, G = window.OMCharts, C = G.C, esc = G.esc;
  const SND = window.OMSound || { init() { }, play() { }, ambient() { }, setOn() { }, setVol() { }, setAmb() { }, settings: { on: false, vol: 0, amb: false } };
  const root = document.getElementById('app');
  const LS = { get: k => { try { return LS.get(k); } catch (e) { return null; } }, set: (k, v) => { try { LS.set(k, v); return true; } catch (e) { return false; } }, del: k => { try { LS.del(k); } catch (e) { } } };
  let s = null;
  const ui = { tab: 'home', sub: {}, page: 0, wellFilter: 'all', wellSort: 'rate', modal: null, running: false, stop: false, sheet: false, ledgerFilter: '', logFilter: 'all', finRange: 12 };

  /* ===================== форматирование ===================== */
  const num = (n, d = 0) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const money = n => G.short(n) + ' ₸';
  const moneyF = n => Math.round(n || 0).toLocaleString('ru-RU') + ' ₸';
  const pct = (n, d = 0) => (Number(n || 0) * 100).toFixed(d) + '%';
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const dateRu = isoD => { const [y, m, d] = isoD.split('-'); return `${+d} ${MON[+m - 1]} ${y}`; };
  const ymRu = k => { const [y, m] = k.split('-'); return `${MON[+m - 1]} ${y.slice(2)}`; };
  const lvl = (v, good, warn, reverse) => reverse ? (v <= good ? 'good' : v <= warn ? 'warn' : 'bad') : (v >= good ? 'good' : v >= warn ? 'warn' : 'bad');
  const bar = (v, cls) => `<div class="bar"><span class="${cls || lvl(v, 0.65, 0.3)}" style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></span></div>`;
  const pill = (text, cls) => `<span class="pill ${cls}">${cls === 'bad' ? '▲ ' : cls === 'warn' ? '● ' : cls === 'good' ? '✓ ' : ''}${esc(text)}</span>`;
  const btn = (label, act, arg = '', cls = '', dis = false) => `<button class="${cls}" data-act="${act}" data-arg="${esc(arg)}" ${dis ? 'disabled' : ''}>${label}</button>`;
  const kpiTile = (label, value, sub, cls = '', extra = '') => `<div class="kpi ${cls}"><div class="k-l">${label}</div><div class="k-v">${value}</div>${sub ? `<div class="k-s">${sub}</div>` : ''}${extra}</div>`;
  const card = (title, body, right = '', cls = '') => `<section class="card ${cls}">${title ? `<div class="card-h"><h3>${title}</h3>${right}</div>` : ''}${body}</section>`;
  const idx = () => s.priceIndex;

  /* ===================== навигация ===================== */
  const NAV = [
    ['home', 'Сводка', 'home'], ['prod', 'Добыча', 'prod'], ['ckppn', 'ЦКППН', 'ckppn'], ['sales', 'Сбыт', 'sales'], ['staff', 'Персонал', 'staff'],
    ['build', 'Подряд и стройка', 'build'], ['stock', 'Склад', 'stock'], ['energy', 'Энергетика', 'energy'], ['hse', 'ОТ, ПБ и экология', 'hse'], ['fin', 'Финансы', 'fin'], ['bank', 'Банк', 'bank'], ['kpi', 'Аналитика', 'kpi'],
    ['rating', 'ТОП-100', 'rating'], ['tech', 'Технологии', 'tech'], ['events', 'Журнал', 'events'], ['settings', 'Настройки', 'settings']
  ];
  const SUBS = {
    prod: [['cdng', 'Цеха: план / факт'], ['wells', 'Скважины'], ['res', 'Пласт и ППД']],
    ckppn: [['scheme', 'Схема'], ['mode', 'Режим подготовки'], ['tanks', 'Резервуары'], ['equip', 'Оборудование']],
    sales: [['contracts', 'Договоры'], ['offers', 'Предложения'], ['market', 'Рынок']],
    build: [['catalog', 'Объекты'], ['services', 'Услуги'], ['projects', 'Проекты']],
    fin: [['pnl', 'Прибыль и убытки'], ['ledger', 'Журнал операций']],
    hse: [['main', 'Обзор'], ['gas', 'Попутный газ'], ['log', 'Журнал происшествий']],
    staff: [['roles', 'Штатное расписание'], ['people', 'Сотрудники']],
    events: [['log', 'События'], ['goals', 'Цели'], ['years', 'Годовые итоги']]
  };
  const BOTTOM = ['home', 'prod', 'ckppn', 'fin'];
  const sub = () => ui.sub[ui.tab] || (SUBS[ui.tab] ? SUBS[ui.tab][0][0] : null);

  /* ===================== проблемы и подсказки ===================== */
  function alerts() {
    const k = E.kpi(s), t = s.today || {}, out = [];
    if (s.cash < 0) out.push({ l: 'bad', t: `Отрицательный баланс ${money(s.cash)} — возьмите кредит`, go: 'bank', tab: 'bank' });
    const failed = s.wells.filter(w => w.status === 'fail');
    if (failed.length) out.push({ l: failed.length > 2 ? 'bad' : 'warn', t: `${failed.length} скв. остановлено в ожидании ПРС (бригад: ${E.brigades(s)}, в работе ${s.repairs.length})`, go: 'prod:wells:fail', tab: 'prod' });
    const unc = s.wells.filter(w => !w.connected && (w.type === 'sk' || w.type === 'ecn')).length;
    if (unc) out.push({ l: 'bad', t: `${unc} скв. не подключены — не хватает АГЗУ`, go: 'build:catalog', tab: 'build' });
    if (k.oilTank.v > k.oilTank.c * 0.85) out.push({ l: k.oilTank.v > k.oilTank.c * 0.97 ? 'bad' : 'warn', t: `Товарные РВС заполнены на ${pct(k.oilTank.v / k.oilTank.c)} — нужны договоры или новые РВС`, go: 'sales:offers', tab: 'sales' });
    if (k.techTank.c && k.techTank.v > k.techTank.c * 0.85) out.push({ l: 'warn', t: `Технологические РВС ${pct(k.techTank.v / k.techTank.c)} — ЦКППН не справляется`, go: 'ckppn:scheme', tab: 'ckppn' });
    if (k.waterTank.c && k.waterTank.v > k.waterTank.c * 0.85) out.push({ l: 'warn', t: `Водяные РВС ${pct(k.waterTank.v / k.waterTank.c)} — увеличьте закачку (БКНС, нагнетательные)`, go: 'prod:res', tab: 'prod' });
    if (t.limit) out.push({ l: 'bad', t: `Ограничение добычи: ${t.limit}`, go: 'ckppn:scheme', tab: 'ckppn' });
    if (k.quality.group === 4) out.push({ l: 'bad', t: `Некондиция: вода ${k.quality.water}% — отгрузки остановлены`, go: 'ckppn:mode', tab: 'ckppn' });
    else if (k.quality.group === 3) out.push({ l: 'info', t: `Нефть III группы (−4% к цене). Поднимите температуру/реагент`, go: 'ckppn:mode', tab: 'ckppn' });
    if (k.energyF < 0.999) out.push({ l: 'bad', t: `Дефицит электроэнергии: покрыто ${pct(k.energyF)}`, go: 'energy', tab: 'energy' });
    for (const [dk, name] of Object.entries(D.DEPTS)) if (k.cov.dept[dk] < 0.85) out.push({ l: k.cov.dept[dk] < 0.6 ? 'bad' : 'warn', t: `Нехватка персонала: ${name} — ${pct(k.cov.dept[dk])}`, go: 'staff', tab: 'staff' });
    const low = D.MATERIALS.filter(m => (!m.tech || E.has(s, m.tech)) && s.stock[m.key] < m.min * 0.5 && !s.orders.some(o => o.key === m.key));
    if (low.length) out.push({ l: 'warn', t: `Мало на складе: ${low.map(m => m.name).slice(0, 3).join(', ')}${low.length > 3 ? '…' : ''}`, go: 'stock', tab: 'stock' });
    if (!s.contracts.some(c => c.status === 'active')) out.push({ l: 'warn', t: 'Нет действующих договоров — нефть копится в РВС', go: 'sales:offers', tab: 'sales' });
    if (k.pressure < 80) out.push({ l: k.pressure < 70 ? 'bad' : 'warn', t: `Пластовое давление ${num(k.pressure, 1)}% — нужна закачка`, go: 'prod:res', tab: 'prod' });
    const broken = s.fac.filter(f => f.status === 'fail');
    if (broken.length) out.push({ l: 'bad', t: `Аварийно остановлено: ${broken.map(f => f.name).join(', ')}`, go: 'ckppn:equip', tab: 'ckppn' });
    const worn = s.fac.filter(f => f.status === 'ok' && f.health < 35);
    if (worn.length) out.push({ l: 'warn', t: `Критический износ: ${worn.length} объект(ов)`, go: 'ckppn:equip', tab: 'ckppn' });
    if (s.morale < 45) out.push({ l: 'warn', t: `Низкая мораль ${num(s.morale)}% — риск забастовки`, go: 'staff', tab: 'staff' });
    if (s.trust < 30) out.push({ l: 'bad', t: `Доверие совета директоров ${num(s.trust)} — выполняйте план!`, go: 'prod:cdng', tab: 'prod' });
    const H = s.hse, y = E.parts(s.day).y;
    if (H) {
      if (s.day - H.lastMed > 365) out.push({ l: 'warn', t: 'Просрочен медосмотр персонала — риск штрафа инспекции труда', go: 'hse', tab: 'hse' });
      if (s.day - (H.drills.fire ?? -999) > 183) out.push({ l: 'warn', t: 'Пожарные учения не проводились больше 6 месяцев', go: 'hse', tab: 'hse' });
      if (H.readiness < 35) out.push({ l: 'warn', t: `Низкая готовность к ЧС: ${num(H.readiness)}% — проведите учения`, go: 'hse', tab: 'hse' });
      const g = s.today && s.today.gas; if (y >= 2006 && g && g.prod > 0 && g.util < 0.8) out.push({ l: 'warn', t: `Факел: утилизация ПНГ ${pct(g.util)} — штрафы экологов и плата за эмиссии`, go: 'hse:gas', tab: 'hse' });
      const sick = s.people.filter(p => p.sickUntil > s.day).length; if (sick) out.push({ l: 'info', t: `На больничном: ${sick} чел.`, go: 'hse:log', tab: 'hse' });
    }
    const soon = s.deposits.filter(d => d.end && d.end - s.day <= 14 && d.end > s.day); if (soon.length) out.push({ l: 'info', t: `Скоро возврат депозитов: ${soon.length}`, go: 'bank', tab: 'bank' });
    const pre3 = s.people.filter(p => E.yearsToPension(s, p) < 0.25).length; if (pre3) out.push({ l: 'info', t: `В ближайшие 3 месяца на пенсию: ${pre3} чел. — подберите замену`, go: 'staff:people', tab: 'staff' });
    const order = { bad: 0, warn: 1, info: 2 };
    return out.sort((a, b) => order[a.l] - order[b.l]);
  }

  /* ===================== каркас ===================== */
  function render() {
    if (!s) { root.innerHTML = startScreen(); return; }
    const scroll = document.querySelector('.page')?.scrollTop;
    const al = alerts(); const badge = {}; for (const a of al) if (a.l !== 'info') badge[a.tab] = (badge[a.tab] || 0) + 1;
    const k = E.kpi(s);
    const brentPrev = s.daily.length > 7 ? s.daily[s.daily.length - 8].brent : s.market.brent;
    const subs = SUBS[ui.tab];
    root.innerHTML = `
      <div class="app ${ui.running ? 'is-running' : ''}">
        <aside class="side"><div class="logo"><img src="assets/logo.png" alt=""><div><b>OIL MANAGEMENT</b><small>${esc(s.company.name)}</small></div></div>
          <nav>${NAV.map(([id, name, ic]) => `<button class="${ui.tab === id ? 'on' : ''}" data-tab="${id}">${G.icon(ic)}<span>${name}</span>${badge[id] ? `<em>${badge[id]}</em>` : ''}</button>`).join('')}</nav></aside>
        <div class="main">
          <header class="top">
            <div class="t-date ${ui.lastDay !== undefined && ui.lastDay !== s.day ? 'pulse' : ''}"><b>${dateRu(k.date)}</b><small>${WD[k.wd]} · ${esc(s.company.field)}</small></div>
            <div class="t-chips">
              <div class="chip cashchip ${s.cash < 0 ? 'bad' : ''}"><small>Деньги</small><b id="cashv">${money(ui.prevCash ?? s.cash)}</b></div>
              <div class="chip"><small>Brent</small><b>$${num(s.market.brent, 1)} <span class="${s.market.brent >= brentPrev ? 'up' : 'dn'}">${s.market.brent >= brentPrev ? '▲' : '▼'}</span></b></div>
              <div class="chip hide-s"><small>Курс</small><b>${num(s.market.fx, 1)} ₸/$</b></div>
              <div class="chip"><small>Рейтинг</small><b>№${s.rank}</b></div>
            </div>
          </header>
          ${subs ? `<div class="subtabs">${subs.map(([id, n]) => `<button class="${sub() === id ? 'on' : ''}" data-sub="${id}">${n}</button>`).join('')}</div>` : ''}
          <main class="page" id="page">${view()}</main>
        </div>
        <div class="timebar">
          ${ui.running ? `<div class="runinfo"><span class="spin"></span>Идёт время… ${dateRu(k.date)}</div>${btn('Стоп', 'stop', '', 'danger')}` :
        `${btn('+1 день', 'adv', '1', 'tb')}${btn('+7 дней', 'adv', '7', 'tb')}${btn('+Месяц', 'adv', 'm', 'tb primary')}`}
        </div>
        <nav class="bottom">${BOTTOM.map(id => { const n = NAV.find(x => x[0] === id); return `<button class="${ui.tab === id ? 'on' : ''}" data-tab="${id}">${G.icon(n[2])}<span>${n[1]}</span>${badge[id] ? `<em>${badge[id]}</em>` : ''}</button>`; }).join('')}
          <button class="${!BOTTOM.includes(ui.tab) || ui.sheet ? 'on' : ''}" data-act="sheet">${G.icon('more')}<span>Ещё</span>${Object.entries(badge).filter(([t]) => !BOTTOM.includes(t)).reduce((a, [, v]) => a + v, 0) ? '<em>•</em>' : ''}</button></nav>
        ${ui.sheet ? sheet(badge) : ''}
        ${modalHtml()}
        <div id="tip" class="tip"></div><div id="toasts" class="toasts"></div>
      </div>`;
    if (scroll && !ui.resetScroll) { const p = document.querySelector('.page'); if (p) p.scrollTop = scroll; }
    ui.resetScroll = false;
    toasts();
    afterFx();
  }
  /* ---------- анимации: бегущие числа, пульс даты, фоновый шум ---------- */
  function countUp(el, from, to, fmt, ms = 450) {
    if (!el) return; if (from === to || !Number.isFinite(from)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(); const tok = (el._tok = Math.random());
    const step = now => { if (el._tok !== tok) return; const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function afterFx() {
    countUp(document.getElementById('cashv'), ui.prevCash ?? s.cash, s.cash, money, ui.running ? 120 : 500);
    const oil = s.today ? s.today.oil : 0;
    countUp(document.getElementById('oilv'), ui.prevOil ?? oil, oil, v => num(v, 1), ui.running ? 120 : 500);
    ui.prevCash = s.cash; ui.prevOil = oil; ui.lastDay = s.day;
    if (s.pending && ui.lastPending !== s.pending.title) { ui.lastPending = s.pending.title; SND.play('event'); }
    if (!s.pending) ui.lastPending = null;
    if (s.report && s.report.open && ui.lastReport !== s.report.m) { ui.lastReport = s.report.m; SND.play('month'); }
    const t = s.today || {}; const work = s.wells.filter(w => w.status === 'work' && (w.type === 'sk' || w.type === 'ecn')).length;
    SND.ambient(!document.hidden && !s.gameOver, (t.k || 0) * Math.min(1, work / 10));
  }
  function floatDelta(d) {
    const chip = document.querySelector('.cashchip'); if (!chip || !Math.round(d)) return;
    const el = document.createElement('div'); el.className = 'float ' + (d >= 0 ? 'pos' : 'neg'); el.textContent = (d >= 0 ? '+' : '−') + money(Math.abs(d));
    const r = chip.getBoundingClientRect(); el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.bottom + 4) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#e53935', '#c98500', '#199e70', '#3987e5', '#9085e9', '#f2f2f2'];
    for (let i = 0; i < 60; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length]; p.style.animationDelay = (Math.random() * 0.4) + 's'; p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's'; p.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(p); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 3200);
  }
  function shake() { const a = document.querySelector('.app'); if (!a) return; a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); setTimeout(() => a.classList.remove('shake'), 600); }
  function sheet(badge) {
    return `<div class="sheet-bg" data-act="sheet"></div><div class="sheet"><div class="grab"></div><div class="sheet-grid">${NAV.map(([id, name, ic]) => `<button data-tab="${id}" class="${ui.tab === id ? 'on' : ''}">${G.icon(ic)}<span>${name}</span>${badge[id] ? `<em>${badge[id]}</em>` : ''}</button>`).join('')}</div></div>`;
  }
  function toasts() {
    if (!s || !s.flash.length) return;
    const all = s.flash; const items = s.flash.filter(f => f.type !== 'info' || s.flash.length < 3).slice(-3);
    s.flash = [];
    // звук и эффекты: выбираем самое важное событие пачки
    const txt = all.map(f => f.text).join(' | ');
    if (/Цель выполнена/.test(txt)) { SND.play('fanfare'); confetti(); }
    else if (all.some(f => f.type === 'bad' && /АВАРИЯ|Авария|разгерметизац|возгоран|ЛЭП|Порыв/i.test(f.text))) { SND.play('alarm'); shake(); }
    else if (all.some(f => f.type === 'bad')) SND.play(ui.lastErr ? 'error' : 'fail');
    else if (/введен|введена|Открыт новый цех|приступил/.test(txt)) SND.play('build');
    else if (/Поставка на склад/.test(txt)) SND.play('delivery');
    else if (/Приняты на работу/.test(txt)) SND.play('pop');
    else if (all.some(f => f.type === 'warn')) SND.play('warn');
    ui.lastErr = false;
    const box = document.getElementById('toasts'); if (!box) return;
    for (const f of items) {
      const el = document.createElement('div'); el.className = 'toast ' + f.type; el.textContent = f.text; box.appendChild(el);
      setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300);
    }
  }
  function view() {
    switch (ui.tab) {
      case 'home': return vHome(); case 'prod': return vProd(); case 'ckppn': return vCkppn(); case 'sales': return vSales();
      case 'staff': return vStaff(); case 'build': return vBuild(); case 'stock': return vStock(); case 'energy': return vEnergy();
      case 'bank': return vBank(); case 'hse': return vHse(); case 'kpi': return vKpi();
      case 'fin': return vFin(); case 'rating': return vRating(); case 'tech': return vTech(); case 'events': return vEvents(); case 'settings': return vSettings();
    }
    return '';
  }

  /* ===================== СВОДКА ===================== */
  function vHome() {
    const k = E.kpi(s), t = s.today || {};
    const al = alerts();
    const mPct = k.planToDateMonth > 0 ? k.factMonth / k.planToDateMonth : 1;
    const yPct = k.planToDate > 0 ? k.factYear / k.planToDate : 1;
    const d60 = s.daily.slice(-60);
    const PF = E.ensurePF(s, k.y); const dailyPlan = k.planMonth / E.daysInMonth(k.y, k.m);
    const prevOil = s.daily.length > 1 ? s.daily[s.daily.length - 2].oil : t.oil;
    const lastH = s.history[s.history.length - 1];
    return `
      <div class="hero">
        <div><h1>${esc(s.company.name)}</h1><p>Месторождение ${esc(s.company.field)} · ${s.cdngs.length} ЦДНГ · ${s.wells.length} скважин · ${k.staff} работников</p></div>
        <div class="hero-g">
          ${G.gauge({ value: mPct * 100, min: 70, max: 120, bands: [{ to: 95, color: C.red }, { to: 100, color: C.yellow }, { to: 120, color: C.aqua }], text: pct(mPct), label: 'План месяца (на дату)' })}
          ${G.gauge({ value: s.trust, min: 0, max: 100, bands: [{ to: 30, color: C.red }, { to: 55, color: C.yellow }, { to: 100, color: C.aqua }], text: num(s.trust), label: 'Доверие совета' })}
        </div>
      </div>
      <div class="kpis">
        ${kpiTile('Добыча нефти', `<span id="oilv">${num(ui.prevOil ?? t.oil, 1)}</span> <small>т/сут</small>`, `${t.oil >= prevOil ? '▲' : '▼'} ${num(Math.abs(t.oil - prevOil), 1)} · план ${num(dailyPlan, 0)}`, t.oil >= dailyPlan ? 'good' : t.oil >= dailyPlan * 0.95 ? 'warn' : 'bad', G.spark(d60.map(x => x.oil), C.blue))}
        ${kpiTile('Жидкость / обводн.', `${num(t.liquid, 0)} <small>т/сут</small>`, `обводнённость ${pct(t.wcAvg || 0, 1)}`, '')}
        ${kpiTile('Факт месяца', `${num(k.factMonth)} <small>т</small>`, `план ${num(k.planMonth)} т · ${pct(k.planMonth ? k.factMonth / k.planMonth : 0)}`, lvl(mPct, 1, 0.95))}
        ${kpiTile('Факт года', `${num(k.factYear)} <small>т</small>`, `к плану на дату ${pct(yPct)}`, lvl(yPct, 1, 0.95))}
        ${kpiTile('Фонд в работе', `${k.wellsWork} / ${k.prodWells}`, k.failed ? `${k.failed} в отказе` : 'отказов нет', k.failed > 2 ? 'bad' : k.failed ? 'warn' : 'good')}
        ${kpiTile('Товарные РВС', `${pct(k.oilTank.c ? k.oilTank.v / k.oilTank.c : 0)}`, `${num(k.oilTank.v)} / ${num(k.oilTank.c)} т`, lvl(k.oilTank.v / Math.max(1, k.oilTank.c), 0.75, 0.9, true), bar(k.oilTank.v / Math.max(1, k.oilTank.c), lvl(k.oilTank.v / Math.max(1, k.oilTank.c), 0.75, 0.9, true)))}
        ${kpiTile('Качество нефти', k.quality.group === 4 ? 'Некондиция' : `${k.quality.group} группа`, `вода ${k.quality.water}% · соли ${k.quality.salt} мг/дм³`, k.quality.group === 1 ? 'good' : k.quality.group <= 3 ? 'warn' : 'bad')}
        ${kpiTile('Энергобаланс', pct(k.energyF), t.energy ? `${num(t.energy.demand)} / ${num(t.energy.supply.total)} кВт` : '', k.energyF >= 1 ? 'good' : 'bad')}
        ${kpiTile('Пласт. давление', `${num(k.pressure, 1)}%`, `компенсация ${t.liquid ? pct(t.inj / t.liquid) : '—'}`, lvl(k.pressure, 88, 78))}
        ${kpiTile('Прибыль (прошл. мес.)', lastH ? money(lastH.net) : '—', lastH ? `выручка ${money(lastH.rev)}` : 'после 1-го месяца', lastH ? (lastH.net >= 0 ? 'good' : 'bad') : '')}
        ${kpiTile('Капитализация', money(k.cap), `ТОП-100: №${s.rank} ${s.rank < s.prevRank ? '▲' : s.rank > s.prevRank ? '▼' : ''}`, '')}
        ${kpiTile('Мораль', `${num(s.morale)}%`, `персонал ${k.staff} чел.`, lvl(s.morale, 60, 45))}
      </div>
      ${homeKpi()}
      ${card('Технологическая цепочка (онлайн)', `<div class="scheme-wrap">${scheme()}</div>`, `<button class="link" data-tab="ckppn">Подробнее →</button>`)}
      <div class="grid2">
        ${card('Требует внимания', al.length ? `<div class="alerts">${al.slice(0, 8).map(a => `<button class="alert ${a.l}" data-go="${a.go}">${G.icon(a.l === 'info' ? 'drop' : 'warn')}<span>${esc(a.t)}</span><i>›</i></button>`).join('')}</div>` : `<div class="okmsg">${G.icon('ok')} Всё под контролем. Отличная работа!</div>`)}
        ${card('Добыча за 60 дней, т/сут', G.line({ labels: d60.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Факт', color: C.blue, values: d60.map(x => x.oil), area: true }, { name: 'План', color: C.plan, values: d60.map(() => dailyPlan), dash: true }], height: 190, unit: 'т/сут' }))}
      </div>
      <div class="grid2">
        ${card('Ближайшие цели', goalsList(3), `<button class="link" data-go="events:goals">Все →</button>`)}
        ${card('Последние события', `<div class="loglist">${s.log.slice(0, 6).map(logRow).join('')}</div>`, `<button class="link" data-go="events:log">Журнал →</button>`)}
      </div>
      ${s.effects.length ? card('Действующие факторы', `<div class="chips">${s.effects.map(e => `<span class="pill warn">${esc(e.label)} · до ${dateRu(E.iso(e.until))}</span>`).join('')}</div>`) : ''}`;
  }
  function homeKpi() {
    const hl = s.history[s.history.length - 1]; const H = s.hse; const g = s.today && s.today.gas;
    const cost = hl && hl.fact > 0 ? hl.opex / (hl.fact * E.BBL) / hl.fx : null; const marg = hl && hl.rev > 0 ? hl.ebitda / hl.rev : null;
    return `<div class="kpis kpi4">
      <button class="kpi lnk ${cost != null && hl ? (cost < hl.brent * 0.3 ? 'good' : 'warn') : ''}" data-go="kpi"><div class="k-l">Себестоимость</div><div class="k-v">${cost != null ? '$' + num(cost, 1) : '—'} <small>/барр</small></div><div class="k-s">Brent $${num(s.market.brent, 1)}</div></button>
      <button class="kpi lnk ${marg != null ? (marg > 0.4 ? 'good' : marg > 0.15 ? 'warn' : 'bad') : ''}" data-go="kpi"><div class="k-l">Маржа EBITDA</div><div class="k-v">${marg != null ? pct(marg, 1) : '—'}</div><div class="k-s">${hl ? money(hl.ebitda || 0) : 'после 1-го месяца'}</div></button>
      <button class="kpi lnk ${H.daysNoInj >= 180 ? 'good' : H.daysNoInj >= 30 ? '' : 'warn'}" data-go="hse"><div class="k-l">Дней без травм</div><div class="k-v">${H.daysNoInj}</div><div class="k-s">готовность к ЧС ${num(H.readiness)}%</div></button>
      <button class="kpi lnk ${!g || g.util >= 0.8 ? 'good' : g.util >= 0.4 ? 'warn' : 'bad'}" data-go="hse:gas"><div class="k-l">Утилизация ПНГ</div><div class="k-v">${g ? pct(g.util) : '—'}</div><div class="k-s">на факел ${g ? num(g.flare) : 0} м³/сут</div></button>
    </div>`;
  }
  const logRow = l => `<div class="logrow ${l.type}"><small>${dateRu(l.date)}</small><span>${esc(l.text)}</span></div>`;
  function goalsList(limit) {
    const list = D.GOALS.map(g => ({ g, done: s.goalsDone[g.key] && s.goalsDone[g.key] !== 'pending' ? s.goalsDone[g.key] : null }));
    const shown = limit ? list.filter(x => !x.done).slice(0, limit) : list;
    if (!shown.length) return '<div class="okmsg">Все цели выполнены! Вы — легенда отрасли.</div>';
    return `<div class="goals">${shown.map(({ g, done }) => `<div class="goal ${done ? 'done' : ''}"><span class="gk">${done ? '✓' : '○'}</span><div><b>${esc(g.title)}</b><small>${done ? 'Выполнено ' + dateRu(done) : esc(g.hint)}</small></div><em>+${g.trust}</em></div>`).join('')}</div>`;
  }

  /* ===================== ТЕХНОЛОГИЧЕСКАЯ СХЕМА ===================== */
  function scheme() {
    const t = s.today || {}; const k = E.kpi(s);
    const cap = t.cap || {};
    const dur = f => Math.max(0.5, Math.min(6, 6 / (f / 120 + 0.25))).toFixed(2);
    const pipe = (d, flow, col, label, lx, ly) => `<path d="${d}" class="pipe"/><path d="${d}" class="flow ${flow > 0.1 ? 'on' : ''}" stroke="${col}" style="animation-duration:${dur(flow)}s"/>${label != null ? `<text x="${lx}" y="${ly}" class="pl">${label}</text>` : ''}`;
    const node = (x, y, w, h, title, val, load) => {
      const cls = load == null ? '' : load > 0.97 ? 'n-bad' : load > 0.85 ? 'n-warn' : '';
      return `<g class="node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + w / 2}" y="${y + 16}" class="nt">${title}</text><text x="${x + w / 2}" y="${y + 31}" class="nv">${val}</text>${load != null ? `<rect x="${x + 8}" y="${y + h - 9}" width="${w - 16}" height="4" rx="2" class="nb"/><rect x="${x + 8}" y="${y + h - 9}" width="${((w - 16) * Math.min(1, load)).toFixed(1)}" height="4" rx="2" class="nbf"/>` : ''}</g>`;
    };
    const nest = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `);
    const prodW = s.wells.filter(w => w.type === 'sk' || w.type === 'ecn');
    const work = prodW.filter(w => w.status === 'work' && w.connected).length;
    const agzuCap = E.facs(s, 'agzu').reduce((a, f) => a + f.cap, 0);
    const upsvCap = E.capOf(s, 'upsv'), ckCap = E.capOf(s, 'ckppn');
    const injW = s.wells.filter(w => w.type === 'inj'), injWork = injW.filter(w => w.status === 'work').length;
    const fails = prodW.some(w => w.status === 'fail');
    return `<svg class="scheme" viewBox="0 0 940 332" role="img" aria-label="Технологическая схема">
      ${pipe('M102 84 H150', t.liquid, C.orange, `${num(t.liquid)} т`, 126, 76)}
      ${pipe('M214 84 H250', t.liquid, C.orange)}
      ${pipe('M362 84 H400', t.P, C.orange, `${num((t.liquid || 0) - (t.water || 0) * 0.9)} т`, 381, 76)}
      ${pipe('M500 92 H532', t.P, C.orange)}
      ${pipe('M608 92 H632', t.P, C.yellow)}
      ${pipe('M722 92 H752', t.P, C.yellow, `${num(t.P ? t.P * (1 - 0.1) : 0)} т`, 737, 84)}
      ${pipe('M852 100 H935', t.ship, C.yellow, `${num(t.ship)} т`, 893, 92)}
      ${pipe('M306 108 V188', (t.water || 0) * 0.9, C.blue, `${num((t.water || 0) * 0.9)} м³`, 336, 150)}
      ${pipe('M356 246 H430', t.inj - (t.injSource || 0), C.blue)}
      ${pipe('M520 246 H600', t.inj, C.blue, `${num(t.inj)} м³`, 560, 238)}
      ${pipe('M86 280 V306 H475 V272', t.injSource, C.blue, `водозабор ${num(t.injSource)} м³/сут`, 190, 324)}
      ${nest(G.pumpjack({ running: work > 0 && t.k > 0.01, fail: fails, w: 92, h: 64 }), 8, 40)}
      <text x="54" y="122" class="nt">Скважины ${work}/${prodW.length}</text><text x="54" y="137" class="nv">${num(t.oil, 1)} т/сут нефти</text>
      ${node(150, 58, 64, 54, 'АГЗУ', `${Math.min(prodW.length, agzuCap)}/${agzuCap}`, agzuCap ? prodW.length / agzuCap : 1)}
      <g class="vessel"><rect x="250" y="62" width="112" height="46" rx="23"/><text x="306" y="82" class="nt">УПСВ</text><text x="306" y="97" class="nv">${num(t.liquid)} / ${num(upsvCap)}</text></g>
      ${nest(G.tank({ v: k.techTank.v, c: k.techTank.c, purpose: 'tech', w: 100, h: 92, id: 'st' }), 400, 30)}
      <text x="450" y="136" class="nt">Технол. РВС</text><text x="450" y="150" class="nv">${pct(k.techTank.c ? k.techTank.v / k.techTank.c : 0)}</text>
      ${nest(G.furnace({ on: (t.P || 0) > 0, temp: s.ckppnSet.temp, w: 80, h: 80 }), 530, 40)}
      <text x="570" y="136" class="nt">Печи ${s.ckppnSet.temp}°C</text>
      <g class="vessel ${t.P > ckCap * 0.97 ? 'n-bad' : ''}"><rect x="632" y="70" width="90" height="42" rx="21"/><text x="677" y="88" class="nt">${E.has(s, 'edeh') ? 'ЭДГ' : 'Отстойник'}</text><text x="677" y="102" class="nv">${num(t.P)} / ${num(ckCap)}</text></g>
      <text x="677" y="136" class="nt">ЦКППН</text><text x="677" y="150" class="nv q${k.quality.group}">${k.quality.group === 4 ? 'некондиция' : k.quality.group + ' гр.'} · ${k.quality.water}%</text>
      ${nest(G.tank({ v: k.oilTank.v, c: k.oilTank.c, purpose: 'oil', w: 100, h: 92, id: 'so' }), 752, 30)}
      <text x="802" y="136" class="nt">Товарные РВС</text><text x="802" y="150" class="nv">${num(k.oilTank.v)} т</text>
      <text x="912" y="122" class="nt">→ Покупатели</text>
      ${nest(G.tank({ v: k.waterTank.v, c: k.waterTank.c, purpose: 'water', w: 100, h: 92, id: 'sw' }), 256, 188)}
      <text x="306" y="294" class="nt">Водяные РВС ${pct(k.waterTank.c ? k.waterTank.v / k.waterTank.c : 0)}</text>
      <g class="node bkns ${cap.bkns && t.inj > cap.bkns * 0.97 ? 'n-warn' : ''}"><rect x="430" y="220" width="90" height="52" rx="8"/><g class="impeller ${t.inj > 1 ? 'spin' : ''}" style="transform-origin:452px 246px"><circle cx="452" cy="246" r="11" fill="none" stroke="${C.blue}" stroke-width="2"/><path d="M452 235V257M441 246H463" stroke="${C.blue}" stroke-width="2"/></g><text x="490" y="242" class="nt">БКНС</text><text x="490" y="258" class="nv">${num(cap.bkns || 0)}</text></g>
      ${nest(G.injHead({ running: t.inj > 1, w: 92, h: 64 }), 600, 200)}
      <text x="646" y="282" class="nt">Нагнет. ${injWork}/${injW.length}</text>
      ${nest(G.injHead({ running: (t.injSource || 0) > 1, w: 92, h: 64 }), 40, 216)}
      <text x="86" y="210" class="nt">Водозабор</text>
      <g class="node res"><rect x="730" y="214" width="190" height="64" rx="10"/><text x="825" y="236" class="nt">Пласт</text><text x="825" y="254" class="nv">P = ${num(k.pressure, 1)}%</text><text x="825" y="269" class="ns">запасы ${num(s.reservoir.remaining / 1e6, 2)} млн т</text></g>
    </svg>`;
  }

  /* ===================== ДОБЫЧА ===================== */
  /* ---------- начальники цехов ---------- */
  const effCls = e => e >= 1.05 ? 'tgood' : e >= 0.85 ? 'twarn' : 'tbad';
  function chiefBlock(c, rep, inReport) {
    const ch = c.chief; const decided = s.report && inReport ? s.report.decided[c.id] : null;
    const DEC = { remark: 'объявлено замечание', reprimand: 'объявлен выговор', bonus: 'выдана премия', fire: 'уволен', hire: 'назначен новый' };
    if (!ch) {
      return `<div class="chief vac"><div class="ch-h"><div class="ch-av">и.о.</div><div><b>Вакансия начальника цеха</b><small>${c.incoming ? `Назначен ${esc(c.incoming.chief.name)} (К ${c.incoming.chief.eff.toFixed(2)}), выход через ${c.incoming.days} дн.` : 'Руководит исполняющий обязанности — К = 0,70'}</small></div></div>
        ${c.incoming ? '' : `<div class="btnrow s">${btn('Выбрать начальника', 'chiefCand', c.id, 'small primary')}</div>`}${decided ? `<div class="dec">✓ Решение: ${DEC[decided]}</div>` : ''}</div>`;
    }
    const eNow = E.chiefEff(s, c);
    return `<div class="chief"><div class="ch-h">${G.face({ face: ch.face, g: ch.g, age: ch.by ? E.parts(s.day).y - ch.by : 45, mood: ch.loyalty, dept: 'chief', size: 52, id: 'ch' + c.id })}<div class="grow"><b>${esc(ch.name)}</b><small>Начальник ${esc(c.name)} · ${ch.by ? yrs(E.parts(s.day).y - ch.by) + ' · ' : ''}стаж ${Math.round(ch.exp)} лет · оклад ${money(ch.salary * idx())}</small></div>
        <div class="ch-k"><small>К</small><b class="${effCls(eNow)}">${eNow.toFixed(2)}</b>${eNow !== ch.eff ? `<small>${eNow > ch.eff ? '▲' : '▼'} база ${ch.eff.toFixed(2)}</small>` : ''}</div></div>
      <div class="ch-m"><span>Лояльность</span>${bar(ch.loyalty / 100, lvl(ch.loyalty / 100, 0.55, 0.3))}<b>${Math.round(ch.loyalty)}%</b></div>
      <div class="ch-d">${ch.remarks ? `<span class="pill warn">Замечаний: ${ch.remarks}</span>` : ''}${ch.reprimands ? `<span class="pill bad">Выговоров: ${ch.reprimands}</span>` : ''}${ch.bonuses ? `<span class="pill good">Премий: ${ch.bonuses}</span>` : ''}${rep ? `<span class="pill ${rep.ratio >= 1 ? 'good' : rep.ratio >= 0.95 ? 'warn' : 'bad'}">План прошл. мес.: ${pct(rep.ratio)}</span>` : ''}</div>
      ${decided ? `<div class="dec">✓ Решение: ${DEC[decided]}</div>` : `<div class="btnrow s ch-a">${btn('Премия', 'chiefOp', c.id + ':bonus', 'small good')}${btn('Замечание', 'chiefOp', c.id + ':remark', 'small')}${btn('Выговор', 'chiefOp', c.id + ':reprimand', 'small warnb')}${btn('Уволить', 'chiefOp', c.id + ':fire', 'small ghost')}</div>`}</div>`;
  }
  function reportHtml() {
    const r = s.cdReports[s.cdReports.length - 1]; if (!r) return '';
    const totP = r.rows.reduce((a, x) => a + x.plan, 0), totF = r.rows.reduce((a, x) => a + x.fact, 0);
    const [y, mo] = r.m.split('-');
    const live = s.report && s.report.open;
    return `<div class="modal-bg"></div><div class="modal wide report"><h2>Итоги ${E.MONTHS[+mo - 1]} ${y} по цехам</h2>
      <div class="rep-sum"><div><small>План</small><b>${num(totP)} т</b></div><div><small>Факт</small><b>${num(totF)} т</b></div><div><small>Выполнение</small><b class="${totF >= totP ? 'tgood' : totF >= totP * 0.95 ? 'twarn' : 'tbad'}">${pct(totP ? totF / totP : 1)}</b></div><div><small>Отклонение</small><b class="${totF >= totP ? 'tgood' : 'tbad'}">${totF - totP >= 0 ? '+' : ''}${num(totF - totP)} т</b></div></div>
      <div class="rep-rows">${r.rows.map(x => { const c = s.cdngs.find(cc => cc.id === x.id); return `<div class="rep ${x.ratio >= 1 ? 'good' : x.ratio >= 0.95 ? 'warn' : 'bad'}">
        <div class="rep-h"><b>${esc(x.name)}</b><span class="pill ${x.ratio >= 1 ? 'good' : x.ratio >= 0.95 ? 'warn' : 'bad'}">${pct(x.ratio)}</span></div>
        <div class="kv3"><div><span>План / факт</span><b>${num(x.plan)} / ${num(x.fact)} т</b></div><div><span>Отклонение</span><b class="${x.fact >= x.plan ? 'tgood' : 'tbad'}">${x.fact - x.plan >= 0 ? '+' : ''}${num(x.fact - x.plan)} т</b></div><div><span>Скважин в работе</span><b>${x.work} / ${x.wells}</b></div>
          <div><span>Отказов за месяц</span><b class="${x.fails > 2 ? 'tbad' : ''}">${x.fails}</b></div><div><span>Простой</span><b>${x.down} скв.-сут</b></div><div><span>К начальника</span><b class="${x.chief ? effCls(x.chief.effNow) : 'tbad'}">${x.chief ? x.chief.effNow.toFixed(2) : 'и.о. 0,70'}</b></div></div>
        ${c ? chiefBlock(c, x, true) : ''}</div>`; }).join('')}</div>
      <label class="check"><input type="checkbox" data-change="repSetting" ${s.settings.monthReport !== false ? 'checked' : ''}> Показывать итоги по цехам после каждого месяца</label>
      <div class="btnrow">${btn(live ? 'Продолжить работу →' : 'Закрыть', 'closeReport', '', 'primary')}</div></div>`;
  }
  function vProd() {
    const sb = sub();
    if (sb === 'wells') return vWells();
    if (sb === 'res') return vRes();
    // Цеха: план/факт
    const k = E.kpi(s); const PF = E.ensurePF(s, k.y);
    const months = Array.from({ length: 12 }, (_, i) => i);
    const plan = months.map(i => Object.values(PF.plan[i]).reduce((a, b) => a + b, 0));
    const fact = months.map(i => i < k.m ? Object.values(PF.fact[i]).reduce((a, b) => a + b, 0) : null);
    let cp = 0, cf = 0; const cumP = plan.map(v => cp += v); const cumF = fact.map(v => v == null ? null : (cf += v));
    const lvlName = E.PLAN_LEVELS[PF.level]?.name || '';
    const devCell = (f, p, cur) => { if (!p) return '<td class="muted">—</td>'; const r = f / p; const c = cur ? 'cur' : r >= 1 ? 'good' : r >= 0.95 ? 'warn' : 'bad'; return `<td class="dev ${c}"><b>${pct(r)}</b><small>${num(f)} / ${num(p)}</small></td>`; };
    const rows = s.cdngs.map(c => {
      const ws = s.wells.filter(w => w.cdng === c.id);
      const pw = ws.filter(w => w.type === 'sk' || w.type === 'ecn');
      const today = pw.reduce((a, w) => a + (w.today || 0), 0);
      const ap = PF.annual[c.id] || 0; const af = PF.fact.reduce((a, mo) => a + (mo[c.id] || 0), 0);
      return { c, ws, pw, today, ap, af };
    });
    return `
      <div class="kpis">
        ${kpiTile(`План ${k.y} г.`, `${num(k.planYear)} <small>т</small>`, lvlName + ' уровень' + (PF.custom ? ' · свой' : ''), '', `<button class="small primary planbtn" data-act="planForm">Изменить план</button>`)}
        ${kpiTile('Факт с начала года', `${num(k.factYear)} <small>т</small>`, `${pct(k.planYear ? k.factYear / k.planYear : 0)} годового плана`, '')}
        ${kpiTile('Отклонение на дату', `${k.factYear - k.planToDate >= 0 ? '+' : ''}${num(k.factYear - k.planToDate)} <small>т</small>`, `${pct(k.planToDate ? k.factYear / k.planToDate : 1)} к плану на дату`, lvl(k.planToDate ? k.factYear / k.planToDate : 1, 1, 0.95))}
        ${kpiTile('Прогноз на год', `${num(k.factYear + (s.today?.oil || 0) * (365 - k.dayOfYear))} <small>т</small>`, 'при текущем дебите', '')}
      </div>
      <div class="grid2">
        ${card(`Добыча по месяцам ${k.y}, т`, G.bars({ labels: MON, series: [{ name: 'План', color: C.plan, values: plan, outline: true }, { name: 'Факт', color: (v, i) => !plan[i] ? C.blue : v >= plan[i] ? C.aqua : v >= plan[i] * 0.95 ? C.yellow : C.red, values: fact.map(v => v || 0) }], height: 210, unit: 'т', extraTip: i => plan[i] && fact[i] != null ? `Отклонение: ${num(fact[i] - plan[i])} т (${pct(fact[i] / plan[i])})` : '' }))}
        ${card('Нарастающим итогом, т', G.line({ labels: MON, series: [{ name: 'План', color: C.plan, values: cumP, dash: true }, { name: 'Факт', color: C.blue, values: cumF, area: true }], height: 210, unit: 'т' }))}
      </div>
      ${card('Выполнение плана по цехам и месяцам', `<div class="tscroll"><table class="pf"><thead><tr><th>Цех</th>${MON.map((m, i) => `<th class="${i + 1 === k.m ? 'curh' : ''}">${m}</th>`).join('')}<th>Год</th></tr></thead><tbody>
        ${rows.map(r => `<tr><th>${esc(r.c.name)}</th>${months.map(i => i + 1 > k.m ? `<td class="muted">${PF.plan[i][r.c.id] ? num(PF.plan[i][r.c.id]) : '—'}</td>` : devCell(PF.fact[i][r.c.id] || 0, PF.plan[i][r.c.id] || 0, i + 1 === k.m)).join('')}${devCell(r.af, r.ap)}</tr>`).join('')}
        <tr class="tot"><th>Итого</th>${months.map(i => i + 1 > k.m ? `<td class="muted">${plan[i] ? num(plan[i]) : '—'}</td>` : devCell(fact[i] || 0, plan[i], i + 1 === k.m)).join('')}${devCell(k.factYear, k.planYear)}</tr>
      </tbody></table></div><p class="hint">Зелёный — план выполнен, жёлтый — отставание до 5%, красный — более 5%. Текущий месяц — синим (идёт накопление).</p>`)}
      <div class="cards3">${rows.map(r => card(esc(r.c.name), `
        <div class="row"><div>${G.pumpjack({ running: r.today > 0, w: 70, h: 48 })}</div><div class="grow">
        <div class="kv"><span>Скважин</span><b>${r.pw.filter(w => w.status === 'work').length}/${r.pw.length} доб. · ${r.ws.length - r.pw.length} проч.</b></div>
        <div class="kv"><span>Добыча сегодня</span><b>${num(r.today, 1)} т/сут</b></div>
        <div class="kv"><span>План / факт года</span><b>${num(r.ap)} / ${num(r.af)} т</b></div>
        <div class="kv"><span>Загрузка цеха</span><b>${r.ws.length}/40</b></div>${bar(r.ws.length / 40, lvl(r.ws.length / 40, 0.8, 0.95, true))}</div></div>
        ${chiefBlock(r.c, E.lastCdReport(s, r.c.id))}`)).join('')}</div>
      ${s.cdReports.length ? `<div class="btnrow">${btn('Итоги прошлого месяца по цехам', 'viewReport', '', 'primary')}</div>` : ''}
      <p class="hint">Коэффициент эффективности начальника (К) влияет на добычу цеха (от −6% при К=0,6 до +4,5% при К=1,3) и на частоту отказов скважин. Замечание и выговор при невыполнении плана временно повышают К на 3 месяца, но снижают лояльность; без оснований — только портят отношения и мораль. Премия повышает лояльность. При лояльности ниже 20% начальник может уволиться сам. Два выговора — увольнение без выходного пособия.</p>`;
  }
  function wellStatus(w) {
    if (w.status === 'work' && !w.connected) return pill('нет АГЗУ', 'bad');
    if (w.status === 'work') return pill('в работе', 'good');
    if (w.status === 'fail') return pill(w.failName || 'отказ', 'bad');
    if (w.status === 'repair') { const r = s.repairs.find(r => r.well === w.id); const p = s.projects.find(p => p.target === w.id); return pill(r ? `ПРС ${Math.ceil(r.days)} дн.` : p ? `${E.fmtNum(p.daysLeft)} дн. подряд` : 'ремонт', 'warn'); }
    return pill('остановлена', 'muted');
  }
  function vWells() {
    const f = ui.wellFilter;
    let list = s.wells.slice();
    if (f === 'fail') list = list.filter(w => w.status === 'fail');
    else if (f === 'work') list = list.filter(w => w.status === 'work');
    else if (f === 'repair') list = list.filter(w => w.status === 'repair' || w.status === 'idle');
    else if (f === 'inj') list = list.filter(w => w.type === 'inj' || w.type === 'water');
    else if (f !== 'all') list = list.filter(w => String(w.cdng) === f);
    const srt = { rate: (a, b) => (b.today || 0) - (a.today || 0), wc: (a, b) => b.wc - a.wc, health: (a, b) => a.health - b.health, name: (a, b) => a.id - b.id };
    list.sort(srt[ui.wellSort]);
    const per = 20, pages = Math.max(1, Math.ceil(list.length / per)); ui.page = Math.min(ui.page, pages - 1);
    const shown = list.slice(ui.page * per, ui.page * per + per);
    const cnt = x => s.wells.filter(x).length;
    const fl = [['all', `Все ${s.wells.length}`], ['work', `В работе ${cnt(w => w.status === 'work')}`], ['fail', `Отказ ${cnt(w => w.status === 'fail')}`], ['repair', `Ремонт/стоп ${cnt(w => w.status === 'repair' || w.status === 'idle')}`], ['inj', 'ППД/водозабор'], ...s.cdngs.map(c => [String(c.id), c.name])];
    const head = w => w.type === 'sk' ? G.pumpjack({ running: w.status === 'work' && w.today > 0, fail: w.status === 'fail', w: 64, h: 44 }) : w.type === 'ecn' ? G.ecnHead({ running: w.status === 'work' && w.today > 0, fail: w.status === 'fail', w: 64, h: 44 }) : G.injHead({ running: w.status === 'work', fail: w.status === 'fail', w: 64, h: 44 });
    return `
      <div class="toolbar"><div class="chips scroll">${fl.map(([id, n]) => `<button class="fchip ${f === id ? 'on' : ''}" data-act="wf" data-arg="${id}">${n}</button>`).join('')}</div>
      <label class="sel">Сортировка <select data-change="wsort">${[['rate', 'по дебиту'], ['wc', 'по обводнённости'], ['health', 'по износу'], ['name', 'по номеру']].map(([v, n]) => `<option value="${v}" ${ui.wellSort === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="brig">Бригады ПРС: <b>${E.brigades(s)}</b> (в работе ${s.repairs.length}) · Автоназначение ПРС: ${btn(s.auto.prs ? 'вкл' : 'выкл', 'toggle', 'prs', 'small ' + (s.auto.prs ? 'on' : ''))} ${s.wells.some(w => w.status === 'fail') ? btn('Ремонт всех возможных', 'repairAll', '', 'small primary') : ''}</div>
      <div class="wells">${shown.map(w => {
        const cd = s.cdngs.find(c => c.id === w.cdng);
        const prodW = w.type === 'sk' || w.type === 'ecn';
        return `<div class="well ${w.status}">
          <div class="w-ic">${head(w)}</div>
          <div class="w-main"><div class="w-t"><b>Скв. ${esc(w.name)}</b><small>${E.wellTypeName(w.type)} · ${esc(cd?.name || '')}</small>${wellStatus(w)}</div>
            <div class="w-m">${prodW ? `<span>Нефть <b>${num(w.today, 1)}</b> т/сут</span><span>Жидк. <b>${num(w.todayL, 1)}</b></span><span>Обводн. <b class="${w.wc > 0.8 ? 'tbad' : w.wc > 0.6 ? 'twarn' : ''}">${pct(w.wc)}</b></span><span>Потенциал <b>${num(w.potential, 1)}</b></span>` : `<span>${w.type === 'inj' ? 'Приёмистость' : 'Дебит воды'} <b>${num(w.potential)}</b> м³/сут</span>`}<span>Накоп. <b>${num(w.cumOil)}</b> т</span></div>
            <div class="w-h"><small>Износ оборудования</small>${bar(w.health / 100)}<small>${num(w.health)}%</small></div></div>
          <div class="w-a">
            ${w.status === 'fail' ? btn('ПРС своими', 'repair', w.id, 'small primary') + btn('Подрядчик', 'svc', `prs:${w.id}`, 'small') : ''}
            ${w.status === 'work' || w.status === 'idle' ? btn(w.status === 'work' ? 'Стоп' : 'Пуск', 'wtoggle', w.id, 'small') : ''}
            ${prodW && w.status !== 'repair' ? btn('КРС', 'svc', `krs:${w.id}`, 'small') + btn('ОПЗ', 'svc', `opz:${w.id}`, 'small') + (E.has(s, 'grp') ? btn('ГРП', 'svc', `grp:${w.id}`, 'small') : '') : ''}
          </div></div>`;
      }).join('') || '<div class="empty">Нет скважин по фильтру</div>'}</div>
      ${pages > 1 ? `<div class="pager">${btn('‹', 'page', -1, 'small', ui.page === 0)}<span>${ui.page + 1} / ${pages}</span>${btn('›', 'page', 1, 'small', ui.page >= pages - 1)}</div>` : ''}
      <p class="hint">ПРС своими силами требует свободную бригаду (4 рабочих) и материалы со склада. Материалы по отказам: насос — ГНУ + штанги; штанги — 25 шт; НКТ — 30 труб; привод — запчасти СК.</p>`;
  }
  // что ограничивает закачку: подсказка игроку
  function injLimit() {
    const t = s.today || {}; if (!t.cap) return '';
    const target = (t.liquid || 0) * s.ppd.comp / 100;
    const bkns = E.capOf(s, 'bkns'), wells = t.cap.injWells || 0;
    const water = (t.water || 0) * 0.9 + (t.cap.src || 0) + E.tankVol(s, 'water');
    if (target <= 0) return '';
    if (t.inj >= target * 0.97) return `<div class="banner info">${G.icon('ok')} Закачка ${num(t.inj)} м³/сут выполняет цель ${num(target)} м³/сут.</div>`;
    const lims = [['мощность БКНС', bkns, 'Постройте насосный агрегат БКНС (+800 м³/сут)'], ['приёмистость нагнетательных скважин', wells, 'Пробурите нагнетательные скважины (+160 м³/сут каждая)'], ['нехватка воды (подтоварная + водозабор)', water, 'Пробурите водозаборную скважину (+300 м³/сут)']];
    lims.sort((a, b) => a[1] - b[1]);
    const [name, val, fix] = lims[0];
    const need = target - val;
    return `<div class="banner bad">${G.icon('warn')}<span>Закачка ${num(t.inj)} из ${num(target)} м³/сут. Ограничивает: <b>${name}</b> (${num(val)} м³/сут). ${fix}${need > 0 ? ` — не хватает ≈${num(need)} м³/сут` : ''}.</span></div>`;
  }
  function vRes() {
    const R = s.reservoir, t = s.today || {}, h = s.history.slice(-36), d = s.daily.slice(-120);
    const comp = t.liquid ? t.inj / t.liquid : 0;
    return `
      <div class="kpis">
        <div class="kpi">${G.gauge({ value: R.pressure, min: 40, max: 115, bands: [{ to: 75, color: C.red }, { to: 88, color: C.yellow }, { to: 106, color: C.aqua }, { to: 115, color: C.orange }], text: num(R.pressure, 1) + '%', label: 'Пластовое давление' })}</div>
        <div class="kpi">${G.gauge({ value: comp * 100, min: 0, max: 150, bands: [{ to: 80, color: C.red }, { to: 95, color: C.yellow }, { to: 120, color: C.aqua }, { to: 150, color: C.orange }], text: pct(comp), label: 'Компенсация отбора' })}</div>
        ${kpiTile('Извлекаемые запасы', `${num(R.remaining / 1e6, 2)} <small>млн т</small>`, `выработано ${pct(1 - R.remaining / R.total, 1)}`, '', bar(R.remaining / R.total))}
        ${kpiTile('Перспективные точки', R.prospects, 'следующие скважины +30% дебита', R.prospects ? 'good' : '')}
      </div>
      ${card('Система поддержания пластового давления (ППД)', `
        <div class="slider"><label>Целевая компенсация отбора закачкой: <b id="compv">${s.ppd.comp}%</b></label><input type="range" min="0" max="150" step="5" value="${s.ppd.comp}" data-input="comp" data-change="comp"></div>
        <div class="slider"><label>Неснижаемый остаток в водяных РВС: <b id="resv">${s.ppd.reserve ?? 40}%</b></label><input type="range" min="0" max="80" step="5" value="${s.ppd.reserve ?? 40}" data-input="reserve" data-change="reserve"></div>
        <div class="kv3">
          <div><span>Отбор жидкости</span><b>${num(t.liquid)} т/сут</b></div><div><span>Закачка</span><b>${num(t.inj)} м³/сут</b></div>
          <div><span>Мощность БКНС</span><b>${num(t.cap?.bkns || 0)} м³/сут</b></div><div><span>Приёмистость нагн. скважин</span><b>${num(t.cap?.injWells || 0)} м³/сут</b></div>
          <div><span>Водозабор (ресурс)</span><b>${num(t.cap?.src || 0)} м³/сут</b></div><div><span>Подтоварная вода в РВС</span><b>${num(E.tankVol(s, 'water'))} м³</b></div>
        </div>
        <p class="hint">Давление падает, если закачка меньше отбора жидкости, и растёт при перекомпенсации. Ниже 80% дебиты заметно снижаются; выше 105% — быстрее растёт обводнённость (прорыв воды). Для закачки нужны БКНС, нагнетательные скважины и источник воды (подтоварная вода + водозабор). Неснижаемый остаток — запас воды в РВС для отстоя и защиты насосов: пока уровень ниже него, БКНС берёт часть притока, а недостаток добирает из водозабора.</p>
        ${injLimit()}
        <div class="btnrow">${btn('Нагнетательная скважина', 'tender', 'well_inj')}${btn('Водозаборная скважина', 'tender', 'well_water')}${btn('Насосный агрегат БКНС', 'tender', 'bkns')}${btn('Сейсморазведка 3D', 'tender', 'seismic')}</div>`)}
      <div class="grid2">
        ${card('Пластовое давление, % (120 дней)', G.line({ labels: d.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Давление', color: C.violet, values: d.map(x => x.p) }], height: 180, zero: false, unit: '%' }))}
        ${card('Отбор жидкости и закачка по месяцам', G.bars({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Отбор жидкости, т', color: C.orange, values: h.map(x => x.liq) }, { name: 'Закачка, м³', color: C.blue, values: h.map(x => x.inj) }], height: 180, empty: 'Появится после первого месяца' }))}
      </div>`;
  }

  /* ===================== ЦКППН ===================== */
  function vCkppn() {
    const sb = sub(); const t = s.today || {}; const k = E.kpi(s);
    if (sb === 'mode') return vMode();
    if (sb === 'tanks') return vTanks();
    if (sb === 'equip') return vEquip();
    const capCk = E.capOf(s, 'ckppn'), capUp = E.capOf(s, 'upsv');
    return `${card('Технологическая схема подготовки нефти', `<div class="scheme-wrap big">${scheme()}</div><p class="hint">Жидкость со скважин → АГЗУ (замер) → УПСВ (предварительный сброс воды) → технологические РВС → печи подогрева → отстойники/электродегидраторы → товарные РВС → насос внешней перекачки → покупатели. Вода → водяные РВС → БКНС → нагнетательные скважины → пласт. Красная рамка — узкое место.</p>`)}
      <div class="kpis">
        ${kpiTile('Загрузка УПСВ', pct(capUp ? t.liquid / capUp : 0), `${num(t.liquid)} / ${num(capUp)} т/сут`, lvl(capUp ? t.liquid / capUp : 0, 0.85, 0.97, true), bar(capUp ? t.liquid / capUp : 0, lvl(capUp ? t.liquid / capUp : 0, 0.85, 0.97, true)))}
        ${kpiTile('Загрузка ЦКППН', pct(capCk ? t.P / capCk : 0), `${num(t.P)} / ${num(capCk)} т/сут`, lvl(capCk ? t.P / capCk : 0, 0.85, 0.97, true), bar(capCk ? t.P / capCk : 0, lvl(capCk ? t.P / capCk : 0, 0.85, 0.97, true)))}
        ${kpiTile('Внешняя перекачка', pct(t.cap?.ship ? t.ship / t.cap.ship : 0), `${num(t.ship)} / ${num(t.cap?.ship || 0)} т/сут`, '')}
        ${kpiTile('Качество', k.quality.group === 4 ? 'Некондиция' : `${k.quality.group} группа`, `вода ${k.quality.water}% · соли ${k.quality.salt}`, k.quality.group === 1 ? 'good' : k.quality.group === 4 ? 'bad' : 'warn')}
      </div>
      ${t.limit ? `<div class="banner bad">${G.icon('warn')} Ограничение: ${esc(t.limit)}</div>` : ''}`;
  }
  function vMode() {
    const k = E.kpi(s), t = s.today || {};
    const load = E.capOf(s, 'ckppn') ? (t.P || 0) / E.capOf(s, 'ckppn') : 0;
    const q = E.qualityOf(s, load, s.ckppnSet.dose, k.cov.dept.ckppn);
    const d = s.daily.slice(-90);
    const heatCost = (t.P || 0) * Math.max(0, s.ckppnSet.temp - 20) * 8 * idx();
    const reagCost = (t.P || 0) * 0.15 * s.ckppnSet.dose * E.matPrice(s, 'demulg');
    return `
      <div class="grid2">
        ${card('Режим подготовки нефти', `
          <div class="mode-vis">${G.furnace({ on: true, temp: s.ckppnSet.temp, w: 96, h: 96 })}<div>
            <div class="slider"><label>Температура в печах: <b id="tv">${s.ckppnSet.temp}°C</b></label><input type="range" min="30" max="85" step="1" value="${s.ckppnSet.temp}" data-input="temp" data-change="temp"></div>
            <div class="slider"><label>Дозировка деэмульгатора: <b id="dv">${Math.round(s.ckppnSet.dose * 100)}%</b> <small>(${num(s.ckppnSet.dose * 150, 0)} г/т)</small></label><input type="range" min="0" max="200" step="5" value="${Math.round(s.ckppnSet.dose * 100)}" data-input="dose" data-change="dose"></div>
            <label class="check"><input type="checkbox" data-change="wash" ${s.ckppnSet.wash ? 'checked' : ''}> Промывка пресной водой (обессоливание, −55% солей)</label></div></div>
          <div id="qprev" class="qprev">${qBox(q)}</div>
          <div class="kv3"><div><span>Подогрев, в сутки</span><b>${money(heatCost)}</b></div><div><span>Реагент, в сутки</span><b>${money(reagCost)}</b></div><div><span>Деэмульгатор на складе</span><b class="${s.stock.demulg < 300 ? 'tbad' : ''}">${num(s.stock.demulg)} кг</b></div></div>`)}
        ${card('Требования к товарной нефти', `<table class="tbl"><thead><tr><th>Группа</th><th>Вода, %</th><th>Соли, мг/дм³</th><th>Цена</th></tr></thead><tbody>
          <tr class="${k.quality.group === 1 ? 'hl' : ''}"><td>I</td><td>≤ 0,5</td><td>≤ 100</td><td>100%</td></tr>
          <tr class="${k.quality.group === 2 ? 'hl' : ''}"><td>II</td><td>≤ 0,5</td><td>≤ 300</td><td>−1,5%</td></tr>
          <tr class="${k.quality.group === 3 ? 'hl' : ''}"><td>III</td><td>≤ 1,0</td><td>≤ 900</td><td>−4%</td></tr>
          <tr class="${k.quality.group === 4 ? 'hl' : ''}"><td>Некондиция</td><td>&gt; 1,0</td><td>&gt; 900</td><td>не принимается</td></tr></tbody></table>
          <p class="hint">Качество улучшается при повышении температуры и дозировки реагента, ухудшается при перегрузке ЦКППН (&gt;90%), износе оборудования и нехватке операторов. Электродегидраторы (технология) снижают остаточную воду на 40%.</p>`)}
      </div>
      ${card('Остаточная вода в товарной нефти, % (90 дней)', G.line({ labels: d.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Вода, %', color: C.orange, values: d.map(x => x.q) }, { name: 'Порог I–II гр.', color: C.aqua, values: d.map(() => 0.5), dash: true }, { name: 'Порог III гр.', color: C.red, values: d.map(() => 1), dash: true }], height: 180, unit: '%' }))}`;
  }
  const qBox = q => `<div class="qb q${q.group}"><b>${q.group === 4 ? 'НЕКОНДИЦИЯ' : q.group + ' группа качества'}</b><span>вода ${q.water}% · соли ${q.salt} мг/дм³</span></div>`;
  function vTanks() {
    const list = s.fac.filter(f => D.BUILD[f.type].tank);
    const groups = ['oil', 'tech', 'water'];
    return `${groups.map(p => {
      const ts = list.filter(t => t.purpose === p); const v = E.tankVol(s, p), c = E.tankCap(s, p);
      return card(`${D.TANK_PURPOSE[p]} — ${num(v)} / ${num(c)} ${p === 'water' ? 'м³' : 'т'} (${pct(c ? v / c : 0)})`, `<div class="tanks">${ts.map(t => {
        const pr = s.projects.find(x => x.target === t.id);
        return `<div class="tankc ${t.status}">${G.tank({ v: t.volume, c: t.cap * (t.clean || 1), purpose: t.purpose, status: t.status, id: 't' + t.id, w: 110, h: 100 })}
        <b>${esc(t.name)}</b><small>${num(t.volume)} / ${num(t.cap * (t.clean || 1))} · ${pct(t.volume / Math.max(1, t.cap))}</small>
        <div class="w-h"><small>Износ</small>${bar(t.health / 100)}<small>${num(t.health)}%</small></div>
        ${t.status === 'service' ? pill(pr ? `${pr.daysLeft} дн. работ` : 'ремонт', 'warn') : `<div class="btnrow s">${btn('Антикор', 'svc', `anticor:${t.id}`, 'small')}${btn('Зачистка', 'svc', `clean:${t.id}`, 'small')}${btn('Назначение', 'purpose', t.id, 'small')}${btn('Снос', 'demolish', t.id, 'small ghost')}</div>`}</div>`;
      }).join('') || '<div class="empty">Нет резервуаров этого назначения</div>'}</div>`);
    }).join('')}
      <div class="btnrow">${btn('Построить РВС-1000', 'tender', 'tank1000')}${btn('РВС-2000', 'tender', 'tank2000')}${btn('РВС-5000', 'tender', 'tank5000')}${btn('РВС-10000', 'tender', 'tank10000')}</div>
      <p class="hint">Износ РВС быстрее растёт без ингибитора коррозии. При износе ниже 35% возможна разгерметизация и пожар — тяжёлый штраф и потеря нефти. Перед антикором/зачисткой содержимое перекачивается в другие РВС того же назначения.</p>`;
  }
  function vEquip() {
    const list = s.fac.filter(f => !D.BUILD[f.type].tank);
    return card('Оборудование и объекты', `<div class="eqlist">
      ${list.map(f => { const B = D.BUILD[f.type]; return `<div class="eq ${f.status}"><div class="eq-t"><b>${esc(f.name)}</b>${f.status === 'ok' ? pill('в работе', 'good') : f.status === 'fail' ? pill('авария', 'bad') : pill('обслуживание', 'warn')}</div>
        <div class="eq-m"><small>${B.cap ? 'Мощность ' + num(f.cap) + (f.type === 'agzu' || f.type === 'cdng' ? ' скв.' : ['substation', 'dgu', 'gtes', 'ses'].includes(f.type) ? ' кВт' : ' т/сут') : ''}${B.kw ? ' · ' + B.kw + ' кВт' : ''}</small><div class="w-h"><small>Износ</small>${bar(f.health / 100)}<small>${num(f.health)}%</small></div></div>
        ${f.type !== 'cdng' ? btn('ТО', 'maintain', f.id, 'small') : ''}</div>`; }).join('')}
      </div>
      <div class="brig">Авто-ТО при износе &lt;45%: ${btn(s.auto.to ? 'вкл' : 'выкл', 'toggle', 'to', 'small ' + (s.auto.to ? 'on' : ''))} <small>ТО: ${money(1.5e6 * idx())} + 1 комплект запчастей насосов (кроме энергообъектов), +35% к ресурсу.</small></div>`);
  }

  /* ===================== СБЫТ ===================== */
  function vSales() {
    const sb = sub(); const k = E.kpi(s);
    if (sb === 'offers') return vOffers();
    if (sb === 'market') return vMarket();
    const act = s.contracts.filter(c => c.status === 'active');
    const p = E.parts(s.day); const dim = E.daysInMonth(p.y, p.m);
    return `
      <div class="kpis">
        ${kpiTile('Действующие договоры', act.length, `${num(act.reduce((a, c) => a + c.monthly, 0))} т/мес обязательств`, act.length ? '' : 'warn')}
        ${kpiTile('Добыча в месяц (оценка)', `${num((s.today?.oil || 0) * dim)} т`, 'при текущем дебите', '')}
        ${kpiTile('Товарная нефть в РВС', `${num(k.oilTank.v)} т`, `свободно ${num(k.oilTank.c - k.oilTank.v)} т`, lvl(k.oilTank.v / Math.max(1, k.oilTank.c), 0.75, 0.9, true))}
        ${kpiTile('Отгружено сегодня', `${num(s.today?.ship || 0, 1)} т`, `мощность насосов ${num(s.today?.cap?.ship || 0)} т/сут`, '')}
      </div>
      ${card('Договоры поставки', act.length ? `<div class="contracts">${act.map(c => {
        const ch = D.CHANNELS[c.channel]; const prog = c.shippedMonth / c.monthly; const exp = p.d / dim;
        const price = E.oilPriceT(s, ch.discount + c.discount);
        return `<div class="contract"><div class="c-h"><b>№${c.id} · ${esc(c.buyer)}</b>${pill(prog >= exp * 0.95 ? 'по графику' : 'отставание', prog >= exp * 0.95 ? 'good' : 'warn')}</div>
          <div class="kv3"><div><span>Канал</span><b>${esc(ch.name)}</b></div><div><span>Объём</span><b>${num(c.monthly)} т/мес</b></div><div><span>Осталось</span><b>${c.monthsLeft} мес.</b></div>
          <div><span>Цена</span><b>Brent − $${num(ch.discount + c.discount, 1)}</b></div><div><span>Сейчас</span><b>${num(price)} ₸/т</b></div><div><span>Неустойка</span><b>${pct(c.penalty)}</b></div></div>
          <div class="cprog"><small>Отгружено в этом месяце: ${num(c.shippedMonth)} из ${num(c.monthly)} т</small><div class="bar dual"><span class="${prog >= exp * 0.95 ? 'good' : 'warn'}" style="width:${Math.min(100, prog * 100)}%"></span><i style="left:${exp * 100}%"></i></div></div>
          <div class="btnrow s">${btn('Расторгнуть', 'cancelContract', c.id, 'small ghost')}</div></div>`;
      }).join('')}</div>` : `<div class="empty">Нет действующих договоров. ${btn('Посмотреть предложения', 'gosub', 'sales:offers', 'primary')}</div>`)}
      ${card('Спотовая продажа (автоналив)', `<p class="hint">Продажа из товарных РВС без договора: дисконт 20% от Brent−$4, транспорт ${money(3000 * idx())}/т, до 400 т в сутки. Помогает разгрузить РВС, но менее выгодна.</p><div class="btnrow">${btn('Продать 100 т', 'spot', 100)}${btn('Продать 400 т', 'spot', 400)}${btn('Другой объём…', 'spotForm')}</div>`)}
      ${s.contracts.filter(c => c.status !== 'active').length ? card('Архив договоров', `<div class="tscroll"><table class="tbl"><thead><tr><th>№</th><th>Покупатель</th><th>Отгружено</th><th>Статус</th></tr></thead><tbody>${s.contracts.filter(c => c.status !== 'active').slice(-15).reverse().map(c => `<tr><td>${c.id}</td><td>${esc(c.buyer)}</td><td>${num(c.shippedTotal)} т</td><td>${c.status === 'done' ? 'исполнен' : 'расторгнут'}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
  }
  function vOffers() {
    const q = s.quality.group;
    return `${card('Предложения покупателей', `<p class="hint">Новые предложения появляются в начале каждого месяца. Цена — Brent минус дисконт канала и покупателя. При недопоставке более 5% месячного объёма — неустойка.</p>
      <div class="offers">${s.offers.map(o => {
        const ch = D.CHANNELS[o.channel]; const price = E.oilPriceT(s, ch.discount + o.discount); const okQ = q <= o.minGroup;
        return `<div class="offer"><div class="c-h"><b>${esc(o.buyer)}</b><span class="tag">${esc(ch.name)}</span></div>
          <div class="kv3"><div><span>Объём</span><b>${num(o.monthly)} т/мес</b></div><div><span>Срок</span><b>${o.months} мес.</b></div><div><span>Цена</span><b>Brent − $${num(ch.discount + o.discount, 1)}</b></div>
          <div><span>Сейчас за тонну</span><b>${num(price)} ₸</b></div><div><span>Транспорт</span><b>${num(ch.tariff * idx())} ₸/т</b></div><div><span>Качество</span><b class="${okQ ? '' : 'tbad'}">не ниже ${o.minGroup} гр.</b></div></div>
          <div class="kv"><span>Выручка в месяц ≈</span><b>${money(o.monthly * price)}</b></div>${ch.export ? '<small class="muted">Экспортный канал: рентный налог при Brent > $40</small>' : '<small class="muted">Внутренний рынок: без рентного налога</small>'}
          <div class="btnrow s">${btn('Заключить договор', 'accept', o.id, 'primary small', !okQ)}</div></div>`;
      }).join('') || '<div class="empty">Новых предложений нет — дождитесь начала месяца</div>'}</div>`)}`;
  }
  function vMarket() {
    const d = s.daily.slice(-365), h = s.history.slice(-120);
    const lab = d.map(x => x.d.slice(5).split('-').reverse().join('.') + '.' + x.d.slice(2, 4));
    return `<div class="kpis">${kpiTile('Brent сегодня', `$${num(s.market.brent, 2)}`, 'за баррель', '')}${kpiTile('Курс', `${num(s.market.fx, 2)} ₸/$`, '', '')}${kpiTile('Цена тонны (Brent)', `${num(E.oilPriceT(s, 0))} ₸`, `${E.BBL} барр./т`, '')}${kpiTile('Индекс цен (инфляция)', `×${num(s.priceIndex, 2)}`, 'к уровню 2000 г.', '')}</div>
      <div class="grid2">${card('Brent за год, $/барр.', G.line({ labels: lab, series: [{ name: 'Brent', color: C.yellow, values: d.map(x => x.brent), area: true }], height: 190, zero: false, unit: '$' }))}
      ${card('Курс тенге за год, ₸/$', G.line({ labels: lab, series: [{ name: 'Курс', color: C.violet, values: d.map(x => x.fx) }], height: 190, zero: false, unit: '₸' }))}</div>
      ${card('История средних цен по месяцам', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Brent, $', color: C.yellow, values: h.map(x => x.brent) }], height: 170, unit: '$', empty: 'Появится после первого месяца' }))}
      <p class="hint">${s.market.mode === 'history' ? 'Режим «История»: цены следуют реальной динамике рынка 2000–2026 гг. с дневными колебаниями, после — случайное блуждание.' : 'Режим «Случайный рынок»: цены формируются случайным процессом с возвратом к среднему.'}</p>`;
  }

  /* ===================== ПЕРСОНАЛ ===================== */
  /* ---------- сотрудники ---------- */
  const ROLE = k => D.ROLES.find(r => r.key === k);
  const yrs = n => { const a = Math.floor(n); const m10 = a % 10, m100 = a % 100; return `${a} ${m10 === 1 && m100 !== 11 ? 'год' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'года' : 'лет'}`; };
  const ym2 = n => { const y = Math.floor(n), m = Math.floor((n - y) * 12); return y ? `${yrs(y)}${m ? ' ' + m + ' мес.' : ''}` : `${m} мес.`; };
  function pFace(p, size) { return G.face({ face: p.face, g: p.g, age: E.personAge(s, p), mood: p.mood, dept: ROLE(p.role).dept === 'aup' || ROLE(p.role).dept === 'mts' ? null : ROLE(p.role).dept, size, id: p.id }); }
  function badges(p) {
    const b = []; const tp = E.yearsToPension(s, p), t = E.tenure(s, p), a = E.personAge(s, p);
    if (tp < 2) b.push(pill(`предпенсионер · ${ym2(tp)}`, 'warn'));
    if (a < 30 && t < 3) b.push(pill('молодой специалист', 'good'));
    if (t + p.prior >= 25) b.push(pill('ветеран отрасли', 'muted'));
    if (p.mood < 35) b.push(pill('недоволен', 'bad'));
    if (p.sickUntil > s.day) b.push(pill(`больничный до ${dateRu(E.iso(p.sickUntil))}`, 'bad'));
    return b.join('');
  }
  function vPeople() {
    const ppl = s.people; const n = ppl.length || 1;
    const ages = ppl.map(p => E.personAge(s, p));
    const pre = ppl.filter(p => E.yearsToPension(s, p) < 2).length;
    const yearEnd = ppl.filter(p => E.yearsToPension(s, p) < (13 - E.parts(s.day).m) / 12).length;
    const groups = [['до 30', 0, 30], ['30–39', 30, 40], ['40–49', 40, 50], ['50–59', 50, 60], ['60+', 60, 99]];
    const f = ui.pf || 'all', srt = ui.ps || 'name';
    let list = ppl.slice();
    if (f === 'pre') list = list.filter(p => E.yearsToPension(s, p) < 2);
    else if (f === 'young') list = list.filter(p => E.personAge(s, p) < 30);
    else if (f === 'sad') list = list.filter(p => p.mood < 40);
    else if (f.startsWith('d:')) list = list.filter(p => ROLE(p.role).dept === f.slice(2));
    else if (f.startsWith('r:')) list = list.filter(p => p.role === f.slice(2));
    const S = { name: (a, b) => a.name.localeCompare(b.name, 'ru'), age: (a, b) => E.personAge(s, b) - E.personAge(s, a), tenure: (a, b) => E.tenure(s, b) - E.tenure(s, a), skill: (a, b) => b.skill - a.skill, pension: (a, b) => E.yearsToPension(s, a) - E.yearsToPension(s, b), salary: (a, b) => E.personSalary(s, b).total - E.personSalary(s, a).total };
    list.sort(S[srt]);
    const per = 20, pages = Math.max(1, Math.ceil(list.length / per)); ui.page = Math.min(ui.page, pages - 1);
    const shown = list.slice(ui.page * per, ui.page * per + per);
    return `<div class="kpis">
      ${kpiTile('Численность', `${ppl.length} чел.`, `средний возраст ${num(ages.reduce((a, b) => a + b, 0) / n, 1)} лет`, '')}
      ${kpiTile('Средний стаж в компании', ym2(ppl.reduce((a, p) => a + E.tenure(s, p), 0) / n), `общий ${num(ppl.reduce((a, p) => a + E.tenure(s, p) + p.prior, 0) / n, 1)} лет`, '')}
      ${kpiTile('Предпенсионеры', `${pre} чел.`, `до конца года на пенсию: ${yearEnd}`, pre ? 'warn' : '')}
      ${kpiTile('Квалификация', num(ppl.reduce((a, p) => a + p.skill, 0) / n, 2), 'средняя эффективность', '')}
      ${kpiTile('Средняя зарплата', money(ppl.reduce((a, p) => a + E.personSalary(s, p).total, 0) / n), 'с надбавкой за стаж', '')}
      ${kpiTile('Настроение', `${num(ppl.reduce((a, p) => a + p.mood, 0) / n)}%`, `недовольных: ${ppl.filter(p => p.mood < 40).length}`, '')}
    </div>
    ${card('Возрастная структура', G.bars({ labels: groups.map(g => g[0]), series: [{ name: 'Человек', color: C.blue, values: groups.map(g => ages.filter(a => a >= g[1] && a < g[2]).length) }], height: 150, unit: 'чел.' }))}
    <div class="toolbar"><div class="chips scroll">${[['all', 'Все'], ['pre', 'Предпенсионеры'], ['young', 'Молодёжь'], ['sad', 'Недовольные']].map(([id, nm]) => `<button class="fchip ${f === id ? 'on' : ''}" data-act="pf" data-arg="${id}">${nm}</button>`).join('')}</div>
      <div class="row"><label class="sel"><select data-change="pfd"><option value="">Подразделение…</option>${Object.entries(D.DEPTS).map(([k, v]) => `<option value="d:${k}" ${f === 'd:' + k ? 'selected' : ''}>${v}</option>`).join('')}${D.ROLES.map(r => `<option value="r:${r.key}" ${f === 'r:' + r.key ? 'selected' : ''}>· ${r.name}</option>`).join('')}</select></label>
      <label class="sel"><select data-change="ps">${[['name', 'по ФИО'], ['age', 'по возрасту'], ['tenure', 'по стажу'], ['pension', 'до пенсии'], ['skill', 'по эффективности'], ['salary', 'по зарплате']].map(([v, nm]) => `<option value="${v}" ${srt === v ? 'selected' : ''}>${nm}</option>`).join('')}</select></label></div></div>
    <div class="people">${shown.map(p => { const sal = E.personSalary(s, p); const c = p.cdng && s.cdngs.find(x => x.id === p.cdng); return `<button class="person" data-act="personCard" data-arg="${p.id}">${pFace(p, 52)}
      <div class="pp-b"><b>${esc(p.name)}</b><small>${esc(ROLE(p.role).name)}${c ? ' · ' + esc(c.name) : ''}</small>
        <div class="pp-m"><span>${yrs(E.personAge(s, p))}</span><span>стаж ${ym2(E.tenure(s, p))}</span><span>${p.grade} разр.</span><span>${money(sal.total)}</span></div>
        <div class="pp-s">${bar(p.skill / 1.35, p.skill >= 1 ? 'good' : p.skill >= 0.8 ? 'warn' : 'bad')}<small>К ${p.skill.toFixed(2)}</small></div>${badges(p)}</div></button>`; }).join('') || '<div class="empty">Никого по фильтру</div>'}</div>
    ${pages > 1 ? `<div class="pager">${btn('‹', 'page', -1, 'small', ui.page === 0)}<span>${ui.page + 1} / ${pages} · ${list.length} чел.</span>${btn('›', 'page', 1, 'small', ui.page >= pages - 1)}</div>` : ''}
    <p class="hint">Нажмите на сотрудника, чтобы открыть карточку. Эффективность (К) растёт с опытом и обучением и влияет на работу подразделения. Пенсионный возраст: мужчины — 63, женщины — 58 (с 2018 г. повышается на полгода ежегодно до 63). При выходе на пенсию — пособие в размере зарплаты; людей нужно заменять заранее.</p>`;
  }
  function personCard(p) {
    const r = ROLE(p.role); const sal = E.personSalary(s, p); const age = E.personAge(s, p), pa = E.pensionAge(s, p), tp = E.yearsToPension(s, p), t = E.tenure(s, p);
    const c = p.cdng && s.cdngs.find(x => x.id === p.cdng);
    const needSkill = 0.7 + (p.grade - 2) * 0.08;
    return `<div class="pcard"><div class="pc-h">${pFace(p, 120)}<div><h2>${esc(p.name)}</h2><p class="muted">${esc(r.name)}</p><p class="muted">${esc(D.DEPTS[r.dept])}${c ? ' · ' + esc(c.name) : ''}</p><div class="chips">${badges(p)}</div></div></div>
      <div class="pc-grid">
        <div><span>Возраст</span><b>${yrs(age)}</b><small>${p.bm < 10 ? '0' + p.bm : p.bm}.${p.by} г.р.</small></div>
        <div><span>Стаж общий</span><b>${ym2(t + p.prior)}</b><small>до компании ${yrs(p.prior)}</small></div>
        <div><span>Стаж в компании</span><b>${ym2(t)}</b><small>принят ${dateRu(p.hired)}</small></div>
        <div><span>Разряд / категория</span><b>${p.grade}</b><small>${p.grade < 6 ? `для повышения нужен К ${needSkill.toFixed(2)}` : 'высший'}</small></div>
        <div><span>Оклад</span><b>${money(sal.base)}</b><small>${s.staff[p.role].pct}% тарифа · ×${(1 + (p.grade - 3) * 0.08).toFixed(2)} за разряд</small></div>
        <div><span>Надбавка за стаж</span><b>+${Math.round(sal.senior * 100)}%</b><small>2% за год, до 25%</small></div>
        <div><span>Зарплата в месяц</span><b class="tgood">${moneyF(sal.total)}</b><small>в год ${money(sal.total * 12)}</small></div>
        <div><span>Премии / обучения</span><b>${p.awards} / ${p.trained}</b><small>${p.trained ? 'последнее ' + dateRu(E.iso(p.lastTrain)) : 'не обучался'}</small></div>
      </div>
      <div class="pc-bars">
        <div><span>Эффективность К</span>${bar(p.skill / 1.35, p.skill >= 1 ? 'good' : p.skill >= 0.8 ? 'warn' : 'bad')}<b>${p.skill.toFixed(2)}</b></div>
        <div><span>Настроение</span>${bar(p.mood / 100, lvl(p.mood / 100, 0.6, 0.35))}<b>${Math.round(p.mood)}%</b></div>
        <div><span>До пенсии (${num(pa, 1)} лет)</span>${bar(Math.min(1, (age - 18) / (pa - 18)), tp < 2 ? 'warn' : 'good')}<b>${ym2(tp)}</b></div>
      </div>
      <div class="btnrow pc-a">${btn('Повысить разряд', 'pOp', p.id + ':grade', 'small primary', p.grade >= 6)}${btn(`Премия (${money(sal.total)})`, 'pOp', p.id + ':bonus', 'small good')}${btn(`Обучение (${money(sal.total * 0.6)})`, 'pOp', p.id + ':train', 'small', s.day - p.lastTrain < 180)}${btn('Уволить', 'pOp', p.id + ':fire', 'small ghost')}</div>
      ${r.dept === 'cdng' ? `<div class="form"><label>Закреплён за цехом<select data-change="pcdng" data-id="${p.id}">${s.cdngs.map(x => `<option value="${x.id}" ${x.id === p.cdng ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>` : ''}</div>`;
  }
  function vStaff() {
    if (sub() === 'people') return vPeople();
    const k = E.kpi(s); const need = k.cov.need;
    const payroll = D.ROLES.reduce((a, r) => a + s.staff[r.key].n * r.salary * s.staff[r.key].pct / 100 * idx(), 0);
    const depts = Object.entries(D.DEPTS);
    return `
      <div class="kpis">
        <div class="kpi">${G.gauge({ value: s.morale, min: 0, max: 100, bands: [{ to: 40, color: C.red }, { to: 60, color: C.yellow }, { to: 100, color: C.aqua }], text: num(s.morale) + '%', label: 'Мораль коллектива' })}</div>
        ${kpiTile('Численность', `${k.staff} чел.`, `требуется ${Object.values(need).reduce((a, b) => a + b, 0)}`, '')}
        ${kpiTile('ФОТ в месяц', money(payroll), `+ соц. налог ${money(payroll * 0.11)}`, '')}
        ${kpiTile('В подборе', `${s.hires.reduce((a, h) => a + h.n, 0)} чел.`, s.hires.length ? `ближайший выход через ${Math.min(...s.hires.map(h => h.days))} дн.` : 'нет заявок', '')}
      </div>
      ${card('Укомплектованность подразделений', `<div class="depts">${depts.map(([dk, n]) => `<div class="dept"><span>${n}</span>${bar(k.cov.dept[dk], lvl(k.cov.dept[dk], 0.95, 0.75))}<b>${pct(k.cov.dept[dk])}</b></div>`).join('')}</div>
        <p class="hint">Нехватка людей снижает добычу (ЦДНГ), скорость ремонтов (ПРС), качество подготовки (ЦКППН), закачку (ЦППД), надёжность энергетики и оборудования, а также повышает риск штрафов (ОТ, АУП).</p>`)}
      ${card('Штатное расписание', `<div class="btnrow s">${btn('Всем оклад 100%', 'salAll', 100, 'small')}${btn('Всем 110%', 'salAll', 110, 'small')}${btn('Всем 125%', 'salAll', 125, 'small')}${btn('Нанять по потребности', 'hireNeed', '', 'small primary')}</div>
        <div class="roles">${D.ROLES.map(r => {
          const st = s.staff[r.key], nd = need[r.key], hire = s.hires.filter(h => h.role === r.key).reduce((a, h) => a + h.n, 0);
          const c = nd ? st.n / nd : 1;
          return `<div class="role"><div class="r-t"><b>${esc(r.name)}</b><small>${esc(D.DEPTS[r.dept])}</small></div>
            <div class="r-n"><b class="${c < 0.85 ? 'tbad' : c < 1 ? 'twarn' : 'tgood'}">${st.n}</b><small>/ ${nd}${hire ? ` (+${hire})` : ''}</small></div>
            <div class="r-s"><small>Оклад</small><b>${num(r.salary * st.pct / 100 * idx())} ₸</b><select data-change="sal" data-role="${r.key}">${[80, 90, 100, 110, 120, 135, 150].map(v => `<option value="${v}" ${st.pct === v ? 'selected' : ''}>${v}%</option>`).join('')}${[80, 90, 100, 110, 120, 135, 150].includes(st.pct) ? '' : `<option selected>${st.pct}%</option>`}</select></div>
            <div class="r-a">${btn('Люди', 'roleList', r.key, 'small')}${btn('+ Нанять', 'hire', r.key, 'small primary')}${btn('Уволить', 'fire', r.key, 'small ghost', st.n < 1)}</div></div>`;
        }).join('')}</div>`)}
      <p class="hint">Мораль зависит от уровня оплаты, перегрузки (нехватки людей), наличия СИЗ и событий. Ниже 40% — риск забастовки. Найм: 30% месячного оклада за подбор, срок 4–10 дней.</p>`;
  }

  /* ===================== ПОДРЯД И СТРОЙКА ===================== */
  const CAT_GROUPS = [['Бурение', ['well_sk', 'well_ecn', 'well_inj', 'well_water']], ['Сбор и подготовка', ['agzu', 'upsv', 'ckppn', 'bkns', 'pump_ext', 'gascomp', 'cdng']], ['Резервуары', ['tank1000', 'tank2000', 'tank5000', 'tank10000']], ['Энергетика', ['substation', 'dgu', 'gtes', 'ses']]];
  function vBuild() {
    const sb = sub();
    if (sb === 'services') return vServices();
    if (sb === 'projects') return vProjects();
    const mat = E.effVal(s, 'matPrice', 1);
    return `${s.projects.length ? `<div class="banner info">${G.icon('build')} В работе ${s.projects.length} проект(ов). ${btn('Открыть', 'gosub', 'build:projects', 'small')}</div>` : ''}
      ${CAT_GROUPS.map(([g, list]) => card(g, `<div class="catalog">${list.map(key => {
        const B = D.BUILD[key]; const locked = B.tech && !E.has(s, B.tech);
        const t = locked ? D.TECH.find(x => x.key === B.tech) : null;
        const count = key.startsWith('well_') ? s.wells.filter(w => w.type === { well_sk: 'sk', well_ecn: 'ecn', well_inj: 'inj', well_water: 'water' }[key]).length : s.fac.filter(f => f.type === key).length;
        const inProg = s.projects.filter(p => p.type === key).length;
        return `<div class="cat ${locked ? 'locked' : ''}"><div class="cat-ic">${catIcon(key)}</div><div class="cat-b"><b>${esc(B.name)}</b><small>${esc(B.desc)}</small>
          <div class="cat-m"><span>≈ ${money(B.cost * idx() * mat)}</span><span>${B.days} дн.</span>${B.kw ? `<span>${B.kw} кВт</span>` : ''}<span>есть: ${count}${inProg ? ` (+${inProg})` : ''}</span></div></div>
          ${locked ? `<div class="lock">🔒 ${esc(t.name)} (${t.year})</div>` : btn('Тендер', 'tender', key, 'small primary')}</div>`;
      }).join('')}</div>`)).join('')}
      <p class="hint">Тендер: выберите подрядчика по цене, сроку и качеству. Аванс 25% сразу, 75% — при сдаче объекта. Низкое качество подрядчика — риск задержек и меньший ресурс объекта.</p>`;
  }
  function catIcon(key) {
    if (key === 'well_sk') return G.pumpjack({ running: true, w: 56, h: 40 });
    if (key === 'well_ecn') return G.ecnHead({ running: true, w: 56, h: 40 });
    if (key === 'well_inj' || key === 'well_water') return G.injHead({ running: true, w: 56, h: 40 });
    if (key.startsWith('tank')) return G.tank({ v: 60, c: 100, purpose: 'oil', w: 50, h: 46, id: 'c' + key });
    if (key === 'ckppn') return G.furnace({ w: 46, h: 46 });
    return `<div class="cico">${G.icon({ agzu: 'prod', upsv: 'ckppn', bkns: 'drop', pump_ext: 'sales', gascomp: 'hse', cdng: 'home', substation: 'energy', dgu: 'energy', gtes: 'energy', ses: 'energy' }[key] || 'build')}</div>`;
  }
  function vServices() {
    return card('Подрядные услуги', `<div class="catalog">${Object.entries(D.SERVICES).map(([key, S]) => {
      const locked = S.tech && !E.has(s, S.tech);
      const target = ['prs', 'krs', 'grp', 'opz'].includes(key) ? 'скважина' : ['anticor', 'clean'].includes(key) ? 'резервуар' : 'месторождение';
      return `<div class="cat ${locked ? 'locked' : ''}"><div class="cat-ic"><div class="cico">${G.icon(key === 'seismic' ? 'rating' : key === 'anticor' || key === 'clean' ? 'stock' : 'prod')}</div></div><div class="cat-b"><b>${esc(S.name)}</b><small>${esc(S.desc)}</small><div class="cat-m"><span>≈ ${money(S.cost * idx())}</span><span>${S.days} дн.</span><span>объект: ${target}</span></div></div>
        ${locked ? '<div class="lock">🔒 технология</div>' : key === 'seismic' ? btn('Тендер', 'tender', key, 'small primary') : btn('Выбрать', 'svcPick', key, 'small primary')}</div>`;
    }).join('')}</div><p class="hint">Аванс по услугам — 50%. ПРС подрядчиком быстрее найма бригады, но дороже. КРС, ОПЗ и ГРП увеличивают потенциал скважины. Зачистка и антикор продлевают жизнь РВС.</p>`);
  }
  function vProjects() {
    if (!s.projects.length) return `<div class="empty">Нет активных проектов. ${btn('Каталог объектов', 'gosub', 'build:catalog', 'primary')}</div>`;
    return card('Активные проекты', `<div class="projects">${s.projects.map(p => {
      const prog = 1 - p.daysLeft / p.daysTotal;
      return `<div class="project"><div class="c-h"><b>${esc(p.title)}</b>${p.daysLeft <= 0 ? pill('ожидает оплаты', 'bad') : p.delay > 2 ? pill(`задержка ${p.delay} дн.`, 'warn') : pill('по графику', 'good')}</div>
        <small>${esc(p.contractor)} · качество ${Math.round(p.quality * 100)}%${p.target ? ' · объект ' + esc((s.wells.find(w => w.id === p.target) || s.fac.find(f => f.id === p.target) || {}).name || '') : ''}</small>
        <div class="pbar"><span style="width:${(prog * 100).toFixed(1)}%"></span><em>${p.daysLeft > 0 ? `осталось ${p.daysLeft} дн.` : 'работы завершены'}</em></div>
        <div class="kv3"><div><span>Стоимость</span><b>${money(p.total)}</b></div><div><span>Оплачено</span><b>${money(p.paid)}</b></div><div><span>К оплате при сдаче</span><b>${money(p.total - p.paid)}</b></div></div>
        <div class="btnrow s">${btn('Отменить (возврат 40% аванса)', 'cancelProject', p.id, 'small ghost')}</div></div>`;
    }).join('')}</div>`);
  }

  /* ===================== СКЛАД ===================== */
  function vStock() {
    const groups = [...new Set(D.MATERIALS.map(m => m.group))];
    const val = D.MATERIALS.reduce((a, m) => a + s.stock[m.key] * E.matPrice(s, m.key), 0);
    return `<div class="kpis">${kpiTile('Стоимость запасов', money(val), '', '')}${kpiTile('В пути', `${s.orders.length} поставок`, s.orders.length ? `ближайшая через ${Math.min(...s.orders.map(o => o.days))} дн.` : '', '')}${kpiTile('Срок поставки', `${E.leadTime(s)} дн.`, 'зависит от службы МТС', '')}
      <div class="kpi"><div class="k-l">Автозакупка</div><div class="k-v">${btn(s.auto.buy ? 'Включена' : 'Выключена', 'toggle', 'buy', s.auto.buy ? 'on' : '')}</div><div class="k-s">по понедельникам до 2× минимума</div></div></div>
      ${groups.map(g => card(g, `<div class="stock">${D.MATERIALS.filter(m => m.group === g).map(m => {
        const locked = m.tech && !E.has(s, m.tech); const st = s.stock[m.key];
        const scale = ['demulg', 'inhib', 'diesel'].includes(m.key) ? Math.max(1, s.wells.length / 13) : Math.max(1, s.wells.length / 20);
        const min = Math.round(m.min * scale); const r = st / Math.max(1, min * 2);
        const tr = s.orders.filter(o => o.key === m.key).reduce((a, o) => a + o.qty, 0);
        return `<div class="mat ${locked ? 'locked' : ''}"><div class="m-t"><b>${esc(m.name)}</b><small>${num(E.matPrice(s, m.key))} ₸ / ${m.unit}</small></div>
          <div class="m-q"><b class="${st < min * 0.5 ? 'tbad' : st < min ? 'twarn' : 'tgood'}">${num(st)}</b><small>${m.unit} · мин. ${num(min)}${tr ? ` · в пути ${num(tr)}` : ''}</small>${bar(r, st < min * 0.5 ? 'bad' : st < min ? 'warn' : 'good')}</div>
          <div class="m-a">${locked ? '<small>🔒 нужна технология</small>' : btn(`+${num(min)}`, 'buy', `${m.key}:${min}`, 'small') + btn('Купить…', 'buyForm', m.key, 'small primary')}</div></div>`;
      }).join('')}</div>`)).join('')}
      ${s.orders.length ? card('Поставки в пути', `<table class="tbl"><tbody>${s.orders.map(o => `<tr><td>${esc(E.matName(o.key))}</td><td>${num(o.qty)}</td><td>${o.days} дн.</td></tr>`).join('')}</tbody></table>`) : ''}
      <p class="hint">Расход: деэмульгатор — на подготовку нефти; ингибитор — на подтоварную воду (без него быстрее корродируют РВС); дизель — транспорт и ДГУ; СИЗ — ~1 комплект на работника в год (без них падает мораль и растут штрафы); НКТ, штанги, ГНУ, ЭЦН — на ремонты скважин.</p>`;
  }

  /* ===================== ЭНЕРГЕТИКА ===================== */
  function vEnergy() {
    const t = s.today || {}; const en = t.energy || { items: {}, supply: { total: 0 }, used: {} };
    const d = s.daily.slice(-90);
    const items = Object.entries(en.items).sort((a, b) => b[1] - a[1]); const maxI = Math.max(1, ...items.map(i => i[1]));
    const src = [['Сеть (подстанции)', 'grid', C.blue], ['ГТЭС', 'gtes', C.aqua], ['СЭС', 'ses', C.yellow], ['ДГУ', 'dgu', C.orange]];
    const tariff = 2.6 * idx();
    const pf = s.fac.filter(f => ['substation', 'dgu', 'gtes', 'ses'].includes(f.type));
    return `<div class="kpis">
      <div class="kpi">${G.gauge({ value: en.supply.total ? en.demand / en.supply.total * 100 : 100, min: 0, max: 120, bands: [{ to: 80, color: C.aqua }, { to: 95, color: C.yellow }, { to: 120, color: C.red }], text: pct(en.supply.total ? en.demand / en.supply.total : 0), label: 'Загрузка мощностей' })}</div>
      ${kpiTile('Потребление', `${num(en.demand)} кВт`, `${num(en.demand * 24 / 1000, 1)} МВт·ч/сут`, '')}
      ${kpiTile('Доступная мощность', `${num(en.supply.total)} кВт`, `резерв ${num(en.supply.total - en.demand)} кВт`, en.supply.total >= en.demand ? 'good' : 'bad')}
      ${kpiTile('Тариф сети', `${num(tariff, 2)} ₸/кВт·ч`, `в сутки ≈ ${money((en.used.grid || 0) * 24 * tariff)}`, '')}</div>
      <div class="grid2">${card('Потребители, кВт', `<div class="hbars">${items.map(([n, v]) => `<div class="hb"><span>${esc(n)}</span><div class="hbt"><i style="width:${(v / maxI * 100).toFixed(1)}%"></i></div><b>${num(v)}</b></div>`).join('')}</div>`)}
      ${card('Источники', G.donut({ items: src.map(([n, k, c]) => ({ name: n, value: en.used[k] || 0, color: c })), center: num(en.demand), sub: 'кВт', unit: 'кВт' }) + `<div class="brig">Дизель-генераторы в работе: ${btn(s.auto.dgu ? 'вкл' : 'выкл', 'toggle', 'dgu', 'small ' + (s.auto.dgu ? 'on' : ''))} <small>Дизель: ${num(s.stock.diesel)} л</small></div>`)}</div>
      ${card('Мощность и потребление, кВт (90 дней)', G.line({ labels: d.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Доступная мощность', color: C.aqua, values: d.map(x => x.eS) }, { name: 'Потребление (при полной загрузке)', color: C.orange, values: d.map(x => x.eD) }], height: 180, unit: 'кВт' }))}
      ${card('Энергообъекты', `<table class="tbl"><tbody>${pf.map(f => `<tr><td><b>${esc(f.name)}</b></td><td>${num(f.cap)} кВт</td><td style="min-width:100px">${bar(f.health / 100)}</td><td>${f.status === 'ok' ? pill('в работе', 'good') : pill('авария', 'bad')}</td><td>${btn('ТО', 'maintain', f.id, 'small')}</td></tr>`).join('')}</tbody></table>
        <div class="btnrow">${btn('Подстанция +2000 кВт', 'tender', 'substation')}${btn('ДГУ 500 кВт', 'tender', 'dgu')}${E.has(s, 'gtes') ? btn('ГТЭС 4 МВт', 'tender', 'gtes') : ''}${E.has(s, 'ses') ? btn('СЭС 1 МВт', 'tender', 'ses') : ''}</div>
        <p class="hint">При дефиците мощности скважины и насосы ограничиваются пропорционально. Летом потребление растёт (охлаждение), зимой — подогрев. При аварии на ЛЭП выручит собственная генерация: ДГУ (дорогое топливо) или ГТЭС на попутном газе (с 2009 г.). Частотные преобразователи снижают потребление на 15%.</p>`)}`;
  }

  /* ===================== ФИНАНСЫ ===================== */
  function vFin() {
    const sb = sub();
    if (sb === 'ledger') return vLedger();
    const h = s.history.slice(-ui.finRange);
    const cur = s.mAcc; const sumC = list => list.reduce((a, c) => a + (cur[c] || 0), 0);
    const rev = sumC(E.PNL.revenue), opex = -sumC(E.PNL.opex), tax = -sumC(E.PNL.taxes), intr = -sumC(E.PNL.interest), capex = -sumC(E.PNL.capex);
    const last = h[h.length - 1];
    const cats = last ? Object.entries(last.cats).filter(([c, v]) => v < 0 && (E.PNL.opex.includes(c) || E.PNL.taxes.includes(c) || E.PNL.interest.includes(c))).map(([c, v]) => [c, -v]).sort((a, b) => b[1] - a[1]) : [];
    const palette = [C.blue, C.orange, C.aqua, C.yellow, C.magenta, C.green, C.violet, C.red];
    const top = cats.slice(0, 7); const other = cats.slice(7).reduce((a, x) => a + x[1], 0);
    const donutItems = top.map(([n, v], i) => ({ name: n, value: v, color: palette[i] })).concat(other ? [{ name: 'Прочее', value: other, color: '#6b7a89' }] : []);
    const row = (n, v, cls = '') => `<tr class="${cls}"><td>${n}</td><td class="num ${v < 0 ? 'tbad' : ''}">${moneyF(v)}</td></tr>`;
    return `<div class="kpis">${kpiTile('Денежные средства', money(s.cash), moneyF(s.cash), s.cash >= 0 ? '' : 'bad')}${kpiTile('Выручка (тек. месяц)', money(rev), '', '')}${kpiTile('Операционная прибыль (тек.)', money(rev - opex - tax - intr), 'до КПН и амортизации', rev - opex - tax - intr >= 0 ? 'good' : 'bad')}${kpiTile('Капвложения (тек.)', money(capex), 'строительство, технологии', '')}</div>
      <div class="seg">${[12, 36, 120].map(n => `<button class="${ui.finRange === n ? 'on' : ''}" data-act="finRange" data-arg="${n}">${n === 120 ? 'Всё' : n + ' мес.'}</button>`).join('')}</div>
      <div class="grid2">${card('Выручка и затраты по месяцам', G.bars({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Выручка', color: C.blue, values: h.map(x => x.rev) }, { name: 'Опер. затраты', color: C.orange, values: h.map(x => x.opex) }, { name: 'Налоги', color: C.violet, values: h.map(x => x.taxes) }], height: 210, unit: '₸', empty: 'Появится после первого месяца' }))}
      ${card('Чистая прибыль по месяцам', G.bars({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Чистая прибыль', color: v => v >= 0 ? C.aqua : C.red, values: h.map(x => x.net) }], height: 210, unit: '₸', empty: 'Появится после первого месяца' }))}</div>
      <div class="grid2">${card('Остаток денежных средств', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Деньги', color: C.aqua, values: h.map(x => x.cash), area: true }], height: 190, unit: '₸', empty: 'Появится после первого месяца' }))}
      ${card(`Структура затрат${last ? ' — ' + ymRu(last.m) : ''}`, G.donut({ items: donutItems, center: last ? G.short(cats.reduce((a, x) => a + x[1], 0)) : '', sub: '₸ всего', unit: '₸' }))}</div>
      ${card('Отчёт о прибылях и убытках — текущий месяц', `<table class="tbl pnl"><tbody>
        ${E.PNL.revenue.filter(c => cur[c]).map(c => row(c, cur[c])).join('')}${row('Итого доходы', rev, 'sum')}
        ${E.PNL.opex.filter(c => cur[c]).map(c => row(c, cur[c])).join('')}${row('Операционные расходы', -opex, 'sum')}
        ${[...E.PNL.taxes, ...E.PNL.interest].filter(c => cur[c]).map(c => row(c, cur[c])).join('')}
        ${row('Результат (без амортизации и КПН)', rev - opex - tax - intr, 'total')}</tbody></table>
        <p class="hint">Зарплата, налоги (НДПИ, рентный, на имущество, КПН 20%), обслуживание фонда и проценты начисляются в последний день месяца. Капвложения и операции с кредитами/депозитами в прибыль не входят.</p>`)}
      ${h.length ? card('Помесячная отчётность', `<div class="tscroll"><table class="tbl"><thead><tr><th>Месяц</th><th>Добыча, т</th><th>План, т</th><th>Выручка</th><th>Затраты</th><th>Налоги</th><th>Приб.</th><th>Brent</th></tr></thead><tbody>${h.slice().reverse().map(x => `<tr><td>${ymRu(x.m)}</td><td>${num(x.fact)}</td><td>${num(x.plan)}</td><td>${money(x.rev)}</td><td>${money(x.opex)}</td><td>${money(x.taxes)}</td><td class="${x.net >= 0 ? 'tgood' : 'tbad'}">${money(x.net)}</td><td>$${num(x.brent, 1)}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
  }
  /* ===================== БАНК ===================== */
  function vBank() {
    const k = E.kpi(s); const base = E.baseRate(s);
    const depTot = s.deposits.reduce((a, d) => a + d.amount, 0); const yInc = s.deposits.reduce((a, d) => a + d.amount * d.rate, 0);
    const pay = s.loans.reduce((a, l) => a + l.payment, 0);
    const h = s.history.slice(-ui.finRange);
    return `<div class="kpis">
      ${kpiTile('Деньги на счёте', money(s.cash), '', s.cash < 0 ? 'bad' : '')}
      ${kpiTile('Депозиты', money(depTot), `доход ≈ ${money(yInc)} в год`, depTot > 0 ? 'good' : '')}
      ${kpiTile('Кредиты', money(k.debt), pay ? `платёж ${money(pay)}/мес` : 'долгов нет', k.debt > 0 ? 'warn' : '')}
      ${kpiTile('Базовая ставка', pct(base, 1), `кредит для вас ${pct(k.loanRate, 1)}`, '')}
      ${kpiTile('Кредитный лимит', money(k.credit), 'зависит от капитализации и доверия', '')}
      ${kpiTile('Чистая позиция', money(s.cash + depTot - k.debt), 'деньги + депозиты − долг', s.cash + depTot - k.debt >= 0 ? 'good' : 'bad')}</div>
    ${card('Депозитные продукты', `<div class="deps">${Object.entries(D.DEPOSITS).map(([key, T]) => `<div class="dep"><div class="c-h"><b>${esc(T.name)}</b><span class="rate">${pct(E.depositRate(s, key), 1)}</span></div><small>${esc(T.desc)}</small>${btn('Открыть', 'depOpen', key, 'small primary')}</div>`).join('')}</div>`)}
    ${card('Мои депозиты', s.deposits.length ? `<div class="deplist">${s.deposits.map(d => { const T = D.DEPOSITS[d.type]; const prog = d.end ? Math.min(1, (s.day - d.start) / (d.end - d.start)) : null; return `<div class="depi">
        <div class="c-h"><b>№${d.id} · ${esc(T.name)}</b><span class="rate">${pct(d.rate, 1)}</span></div>
        <div class="kv3"><div><span>Вложено</span><b>${money(d.principal)}</b></div><div><span>Сейчас</span><b class="tgood">${money(d.amount)}</b></div><div><span>${d.end ? 'Срок до' : 'Открыт'}</span><b>${dateRu(E.iso(d.end || d.start))}</b></div></div>
        ${prog != null ? `<div class="pbar"><span style="width:${(prog * 100).toFixed(1)}%"></span><em>${Math.max(0, d.end - s.day)} дн. до возврата</em></div>` : ''}
        <div class="btnrow s">${btn(d.end ? 'Снять досрочно' : 'Закрыть', 'withdraw', d.id, 'small ' + (d.end ? 'ghost' : ''))}</div></div>`; }).join('')}</div>` : '<div class="empty">Депозитов нет. Свободные деньги могут приносить доход.</div>')}
    ${card('Кредиты', `${s.loans.length ? `<div class="deplist">${s.loans.map(l => `<div class="depi"><div class="c-h"><b>Кредит №${l.id}</b><span class="rate bad">${pct(l.rate, 1)}</span></div><div class="kv3"><div><span>Остаток</span><b>${money(l.principal)}</b></div><div><span>Платёж/мес</span><b>${money(l.payment)}</b></div><div><span>Осталось</span><b>${l.months} мес.</b></div></div><div class="btnrow s">${btn('Погасить досрочно', 'repay', l.id, 'small')}</div></div>`).join('')}</div>` : '<div class="empty">Кредитов нет</div>'}
      <div class="btnrow">${btn('Взять кредит…', 'loanForm', '', 'primary')}</div><p class="hint">Аннуитетный платёж в конце месяца. Ставка зависит от рыночной конъюнктуры (кризис 2008, девальвации) и доверия совета директоров.</p>`)}
    <div class="seg">${[12, 36, 120].map(n => `<button class="${ui.finRange === n ? 'on' : ''}" data-act="finRange" data-arg="${n}">${n === 120 ? 'Всё' : n + ' мес.'}</button>`).join('')}</div>
    <div class="grid2">${card('Ставки по месяцам, %', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Базовая', color: C.violet, values: h.map(x => x.rate != null ? x.rate * 100 : null) }, { name: 'Депозит 12 мес.', color: C.aqua, values: h.map(x => x.rate != null ? Math.max(1, (x.rate + D.DEPOSITS.t12.spread) * 100) : null), dash: true }], height: 180, unit: '%', zero: false, empty: 'Появится после первого месяца' }))}
      ${card('Депозиты и долг', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Депозиты', color: C.aqua, values: h.map(x => x.dep ?? null), area: true }, { name: 'Долг', color: C.red, values: h.map(x => x.debt ?? null) }], height: 180, unit: '₸', empty: 'Появится после первого месяца' }))}</div>
    ${card('Процентные доходы и расходы по месяцам', G.bars({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Доход по депозитам', color: C.aqua, values: h.map(x => (x.cats || {})['Проценты по депозитам'] || 0) }, { name: 'Проценты по кредитам', color: C.red, values: h.map(x => -((x.cats || {})['Проценты по кредитам'] || 0)) }], height: 180, unit: '₸', empty: 'Появится после первого месяца' }))}`;
  }
  function vLedger() {
    const f = ui.ledgerFilter; const cats = [...new Set(s.ledger.map(l => l.cat))];
    const list = s.ledger.filter(l => !f || l.cat === f).slice(0, 200);
    return card('Журнал финансовых операций', `<label class="sel">Категория <select data-change="ledger"><option value="">Все</option>${cats.map(c => `<option ${f === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <div class="ledger">${list.map(l => `<div class="lr"><div><small>${dateRu(l.date)} · ${esc(l.cat)}</small><span>${esc(l.note)}</span></div><b class="${l.a < 0 ? 'tbad' : 'tgood'}">${l.a > 0 ? '+' : ''}${moneyF(l.a)}</b></div>`).join('') || '<div class="empty">Операций нет</div>'}</div>
      <p class="hint">Ежедневные начисления (продажи по договору, электроэнергия, транспорт, подогрев) сгруппированы по месяцу.</p>`);
  }

  /* ===================== РЕЙТИНГ ===================== */
  function vRating() {
    const list = E.leaderboard(s); const me = list.find(x => x.me);
    const h = s.history.slice(-60);
    const P = E.RPARAMS; const fmtP = { prod: v => num(v) + ' т/сут', cap: money, profit: money, cost: v => '$' + num(v, 1), hse: v => num(v) + ' / 100' };
    const srt = ui.rsort || 'score';
    const sorted = srt === 'score' ? list : list.slice().sort((a, b) => a.pr[srt] - b.pr[srt]);
    const near = list.slice(Math.max(0, me.rank - 3), me.rank + 2);
    const weakest = P.slice().sort((a, b) => me.pr[b[0]] - me.pr[a[0]])[0];
    const tips = { prod: 'бурите новые скважины, делайте ГРП и держите давление закачкой', cap: 'наращивайте добычу и активы, прирост запасов (сейсморазведка), гасите долги', profit: 'выполняйте договоры, держите I группу качества, сокращайте штрафы и простои', cost: 'снижайте затраты на тонну: ЧРП, ГТЭС, автозакупка, меньше вывоза воды и простоев', hse: 'проводите учения, медосмотры и обучение по ОТ, утилизируйте попутный газ' };
    return `<div class="kpis">${kpiTile('Место в ТОП-100', `№${me.rank}`, s.rank < s.prevRank ? `▲ поднялись с ${s.prevRank}` : s.rank > s.prevRank ? `▼ опустились с ${s.prevRank}` : 'без изменений', s.rank <= 10 ? 'good' : '')}${kpiTile('Итоговый балл', num(me.score, 1) + ' / 100', 'среднее по 5 параметрам', '')}${kpiTile('До ТОП-50', me.rank <= 50 ? 'достигнуто' : '+' + num(list[49].score - me.score, 1) + ' балла', '', me.rank <= 50 ? 'good' : '')}${kpiTile('До ТОП-10', me.rank <= 10 ? 'достигнуто' : '+' + num(list[9].score - me.score, 1) + ' балла', '', me.rank <= 10 ? 'good' : '')}</div>
      ${card('Ваши позиции по 5 ключевым параметрам', `<div class="rparams">${P.map(([key, name, dir]) => { const place = me.pr[key]; const pctl = 1 - (place - 1) / 99; return `<div class="rp"><div class="rp-h"><b>${name}</b><span class="${place <= 10 ? 'tgood' : place <= 50 ? 'twarn' : 'tbad'}">${place}-е место</span></div>
        <div class="rp-v">${fmtP[key](me[key])}${dir < 0 ? ' <small>(меньше — лучше)</small>' : ''}</div>${bar(pctl, pctl >= 0.9 ? 'good' : pctl >= 0.5 ? 'warn' : 'bad')}</div>`; }).join('')}</div>
        <div class="banner info">${G.icon('up')}<span>Слабее всего: <b>${weakest[1]}</b> (${me.pr[weakest[0]]}-е место) — ${tips[weakest[0]]}.</span></div>
        <p class="hint">Каждый параметр весит 20%. Балл компании — среднее её мест по пяти параметрам (1-е место = 100, последнее = 0). Себестоимость — операционные затраты на баррель за 3 месяца; ОТ и экология — травматизм, утилизация попутного газа, готовность к ЧС и штрафы.</p>`)}
      ${card('Место в рейтинге по месяцам', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Место', color: C.blue, values: h.map(x => 101 - x.rank) }], height: 160, fmt: v => String(Math.round(101 - v)), empty: 'Появится после первого месяца' }) + '<p class="hint">Чем выше линия — тем выше место.</p>')}
      ${card('Ваши соседи', `<div class="lb">${near.map(lbRow).join('')}</div>`)}
      ${card('ТОП-100 нефтяных компаний региона', `<label class="sel">Сортировать <select data-change="rsort"><option value="score" ${srt === 'score' ? 'selected' : ''}>по итоговому баллу</option>${P.map(([k2, n2]) => `<option value="${k2}" ${srt === k2 ? 'selected' : ''}>${n2}</option>`).join('')}</select></label><div class="lb">${sorted.map(lbRow).join('')}</div>`)}`;
  }
  const lbRow = c => { const mv = c.prev ? c.prev - c.rank : 0; return `<div class="lbr ${c.me ? 'me' : ''} ${c.rank <= 3 ? 'top' : ''}"><span class="rk">${c.rank}</span><b>${esc(c.name)}${c.me ? ' (вы)' : ''}</b><span class="mv ${mv > 0 ? 'up' : mv < 0 ? 'dn' : ''}">${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : ''}</span><span class="cap">${num(c.score, 1)}</span>
    <small class="lbp">${num(c.prod)} т/сут · ${money(c.cap)} · приб. ${money(c.profit)} · $${num(c.cost, 1)}/барр · ОТ ${num(c.hse)}</small></div>`; };

  /* ===================== ОТ, ПБ И ЭКОЛОГИЯ ===================== */
  function vHse() {
    const sb = sub(); const H = s.hse; const k = E.kpi(s);
    const inj12 = H.injuries.filter(i => s.day - i.day <= 365); const fines12 = H.fines.filter(f => s.day - Math.round((Date.parse(f.date) - Date.parse('2000-01-01')) / 864e5) <= 365);
    const g = (s.today && s.today.gas) || { prod: 0, heat: 0, gtes: 0, sale: 0, flare: 0, util: 1 };
    const y = E.parts(s.day).y;
    if (sb === 'log') return card('Несчастные случаи', inj12.length || H.injuries.length ? `<div class="ledger">${H.injuries.slice().reverse().slice(0, 50).map(i => `<div class="lr"><div><small>${dateRu(i.date)} · ${esc(E.roleName(i.role))}</small><span>${{ light: 'Лёгкая травма', severe: 'Тяжёлая травма', grave: 'Тяжёлый несчастный случай' }[i.sev]}: ${esc(i.name)}, больничный ${i.days} дн.</span></div><b class="${i.sev === 'light' ? 'twarn' : 'tbad'}">${i.sev === 'light' ? 'лёгкая' : 'тяжёлая'}</b></div>`).join('')}</div>` : '<div class="empty">Несчастных случаев не было</div>') +
      card('Проверки и штрафы госорганов', H.fines.length ? `<div class="ledger">${H.fines.slice().reverse().slice(0, 50).map(f => `<div class="lr"><div><small>${dateRu(f.date)} · ${esc(f.org)}</small><span>${esc(f.reasons.join('; '))}</span></div><b class="tbad">−${money(f.amount)}</b></div>`).join('')}</div>` : '<div class="empty">Штрафов не было</div>');
    if (sb === 'gas') {
      const hh = s.history.slice(-36);
      return `<div class="kpis"><div class="kpi">${G.gauge({ value: g.util * 100, min: 0, max: 100, bands: [{ to: 50, color: C.red }, { to: 80, color: C.yellow }, { to: 100, color: C.aqua }], text: pct(g.util), label: 'Утилизация ПНГ' })}</div>
        ${kpiTile('Добыча ПНГ', num(g.prod) + ' м³/сут', 'газовый фактор ≈85 м³/т', '')}${kpiTile('На факел', num(g.flare) + ' м³/сут', y >= 2006 ? 'с 2006 г. — сверхнормативная плата ×6' : 'с 2006 г. плата вырастет в 6 раз', g.flare > g.prod * 0.2 ? 'bad' : 'good')}${kpiTile('Сдано на ГПЗ', num(g.sale) + ' м³/сут', `доход ${money(g.sale * 4 * idx())}/сут`, g.sale > 0 ? 'good' : '')}</div>
        <div class="grid2">${card('Баланс попутного газа сегодня', G.donut({ items: [{ name: 'Подогрев печей ЦКППН', value: g.heat, color: C.orange }, { name: 'ГТЭС (электроэнергия)', value: g.gtes, color: C.aqua }, { name: 'Сдача на ГПЗ', value: g.sale, color: C.blue }, { name: 'Факел', value: g.flare, color: C.red }], center: num(g.prod), sub: 'м³/сут', unit: 'м³' }))}
        ${card('Утилизация ПНГ по месяцам, %', G.line({ labels: hh.map(x => ymRu(x.m)), series: [{ name: 'Утилизация', color: C.aqua, values: hh.map(x => x.gas ? x.gasUsed / x.gas * 100 : null), area: true }, { name: 'Норматив 80%', color: C.plan, values: hh.map(() => 80), dash: true }], height: 190, unit: '%', min: 0, max: 100, empty: 'Появится после первого месяца' }))}</div>
        ${card('Как утилизировать газ', `<p class="hint" style="margin-top:0">Попутный газ идёт на подогрев нефти в печах, на собственную ГТЭС (с 2009 г., дешёвая электроэнергия) и сдаётся на ГПЗ через компрессорную станцию. Остаток сжигается на факеле: ежемесячная плата за эмиссии, а при утилизации ниже 80% после 2006 г. — штрафы Департамента экологии.</p>
          <div class="btnrow">${btn('Компрессорная станция ПНГ', 'tender', 'gascomp', 'primary')}${E.has(s, 'gtes') ? btn('ГТЭС 4 МВт', 'tender', 'gtes') : btn('Технология ГТЭС (2009)', 'gotech', '', '')}</div>`)}`;
    }
    const risk = E.hseRisk(s);
    const drill = key => { const last = H.drills[key]; const ago = last == null ? null : s.day - last; const lim = key === 'fire' ? 183 : 365; return { last, ago, over: ago == null || ago > lim }; };
    return `<div class="kpis">
      ${kpiTile('Дней без травм', `<span class="bignum">${H.daysNoInj}</span>`, H.injuries.length ? `последний случай ${dateRu(H.injuries[H.injuries.length - 1].date)}` : 'с начала работы', H.daysNoInj >= 365 ? 'good' : H.daysNoInj >= 90 ? '' : 'warn')}
      ${kpiTile('Травм за 12 мес.', inj12.length, `LTIFR ${num(E.ltifr(s), 2)} на 1 млн чел.-ч`, inj12.length ? 'bad' : 'good')}
      <div class="kpi">${G.gauge({ value: H.readiness, min: 0, max: 100, bands: [{ to: 40, color: C.red }, { to: 65, color: C.yellow }, { to: 100, color: C.aqua }], text: num(H.readiness) + '%', label: 'Готовность к ЧС' })}</div>
      <div class="kpi">${G.gauge({ value: H.culture, min: 0, max: 100, bands: [{ to: 40, color: C.red }, { to: 65, color: C.yellow }, { to: 100, color: C.aqua }], text: num(H.culture) + '%', label: 'Культура безопасности' })}</div>
      ${kpiTile('Штрафы за 12 мес.', money(fines12.reduce((a, f) => a + f.amount, 0)), `${fines12.length} предписаний`, fines12.length ? 'bad' : 'good')}
      ${kpiTile('Индекс ОТ и экологии', num(E.hseIndex(s)) + ' / 100', `место в ТОП-100: ${(s.paramRanks || {}).hse || '—'}`, E.hseIndex(s) >= 70 ? 'good' : E.hseIndex(s) >= 40 ? 'warn' : 'bad')}
    </div>
    <div class="grid2">${card('Факторы риска травматизма', `<div class="hbars">${Object.entries(risk.f).map(([n, v]) => `<div class="hb"><span>${esc(n)}</span><div class="hbt"><i style="width:${Math.min(100, (v - 0.4) / 1.6 * 100)}%;background:${v > 1.2 ? 'var(--bad)' : v > 1 ? 'var(--warn)' : 'var(--good)'}"></i></div><b>×${num(v, 2)}</b></div>`).join('')}</div>
      <div class="banner ${risk.k > 1.5 ? 'bad' : 'info'}" style="margin-top:10px">${G.icon('warn')}<span>Итоговый коэффициент риска: <b>×${num(risk.k, 2)}</b>. ${risk.k > 1.5 ? 'Высокий риск несчастных случаев!' : 'Норма — около ×1.'}</span></div>`)}
    ${card('Мероприятия по ОТ и ПБ', `<div class="hsea">${Object.entries(D.DRILLS).map(([key, Dr]) => { const d = drill(key); return `<div class="hsei"><div><b>${esc(Dr.name)}</b><small>${esc(Dr.desc)}</small><small class="${d.over ? 'tbad' : 'tgood'}">${d.last == null ? 'не проводились' : 'последние: ' + dateRu(E.iso(d.last))}</small></div>${btn(money(Dr.cost * idx()), 'hseOp', 'drill:' + key, 'small ' + (d.over ? 'primary' : ''), d.ago != null && d.ago < 30)}</div>`; }).join('')}
      <div class="hsei"><div><b>Периодический медосмотр</b><small>Обязателен раз в год. Просрочка — штраф инспекции труда и рост травматизма.</small><small class="${s.day - H.lastMed > 365 ? 'tbad' : 'tgood'}">${H.lastMed < 0 && H.lastMed < s.day - 365 ? 'просрочен' : 'последний: ' + dateRu(E.iso(Math.max(0, H.lastMed)))}</small></div>${btn(money(k.staff * 12000 * idx()), 'hseOp', 'medical', 'small ' + (s.day - H.lastMed > 365 ? 'primary' : ''), s.day - H.lastMed < 180)}</div>
      <div class="hsei"><div><b>Обучение и проверка знаний по ОТ</b><small>Повышает культуру безопасности. Раз в 3 месяца.</small><small class="${s.day - H.lastTraining > 365 ? 'tbad' : 'tgood'}">${H.lastTraining < 0 ? 'не проводилось' : 'последнее: ' + dateRu(E.iso(H.lastTraining))}</small></div>${btn(money(k.staff * 25000 * idx()), 'hseOp', 'training', 'small', s.day - H.lastTraining < 90)}</div>
      <div class="hsei"><div><b>СИЗ и спецодежда</b><small>Без СИЗ риск травм ×1,8 и штрафы. На складе: ${num(s.stock.ppe)} компл.</small></div>${btn('Склад →', 'gosub', 'stock', 'small')}</div></div>`)}</div>
    <div class="grid2">${card('Травмы и штрафы по месяцам', G.bars({ labels: s.history.slice(-24).map(x => ymRu(x.m)), series: [{ name: 'Несчастные случаи', color: C.red, values: s.history.slice(-24).map(x => x.inj2 || 0) }], height: 170, unit: 'шт.', empty: 'Появится после первого месяца' }))}
    ${card('Штрафы госорганов за 12 мес.', G.donut({ items: Object.values(D.AUTHORITIES).map((o, i) => ({ name: o, value: fines12.filter(f => f.org === o).reduce((a, f) => a + f.amount, 0), color: [C.aqua, C.orange, C.violet, C.red][i] })), center: money(fines12.reduce((a, f) => a + f.amount, 0)), sub: 'за год', unit: '₸' }))}</div>
    <p class="hint">Проверки госорганов проходят случайно (примерно раз в 8 месяцев каждый орган) и проверяют реальное состояние: износ, учения, медосмотры, СИЗ, переработки, сжигание газа, разливы. Повторное нарушение в течение года — штраф ×1,5. Чистая проверка — доверие совета +1.</p>`;
  }

  /* ===================== АНАЛИТИКА ===================== */
  function vKpi() {
    const h = s.history.slice(-ui.finRange);
    if (!h.length) return '<div class="empty">Аналитика появится после закрытия первого месяца</div>';
    const L = h.map(x => ymRu(x.m));
    const cost$ = x => x.fact > 0 ? x.opex / (x.fact * E.BBL) / x.fx : null;
    const costT = x => x.fact > 0 ? x.opex / x.fact : null;
    const marg = x => x.rev > 0 ? x.ebitda / x.rev * 100 : null;
    const last = h[h.length - 1]; const h12 = s.history.slice(-12);
    const fails12 = h12.reduce((a, x) => a + (x.fails || 0), 0), work12 = h12.reduce((a, x) => a + (x.wk || 0), 0), wd12 = h12.reduce((a, x) => a + (x.wd || 0), 0);
    const mrp = fails12 ? work12 / fails12 : null; const kexp = wd12 ? work12 / wd12 : null;
    const perEmp = h12.reduce((a, x) => a + x.fact, 0) / Math.max(1, last.staff || 1) * (12 / Math.max(1, h12.length));
    const R = s.reservoir; const kin = (R.total - R.remaining) / R.total;
    const wcM = x => x.liq > 0 ? (1 - x.fact / x.liq) * 100 : null;
    return `<div class="seg">${[12, 36, 120].map(n => `<button class="${ui.finRange === n ? 'on' : ''}" data-act="finRange" data-arg="${n}">${n === 120 ? 'Всё' : n + ' мес.'}</button>`).join('')}</div>
    <div class="kpis">
      ${kpiTile('Себестоимость', cost$(last) != null ? '$' + num(cost$(last), 1) + ' <small>/барр</small>' : '—', costT(last) != null ? num(costT(last)) + ' ₸/т · Brent $' + num(last.brent, 1) : '', cost$(last) != null && cost$(last) < last.brent * 0.3 ? 'good' : 'warn')}
      ${kpiTile('EBITDA', money(last.ebitda || 0), marg(last) != null ? 'маржа ' + num(marg(last), 1) + '%' : '', (last.ebitda || 0) >= 0 ? 'good' : 'bad')}
      ${kpiTile('Чистая маржа', last.rev ? num(last.net / last.rev * 100, 1) + '%' : '—', 'прибыль / выручка', last.net >= 0 ? 'good' : 'bad')}
      ${kpiTile('МРП скважин', mrp ? num(mrp) + ' сут' : '∞', 'межремонтный период, 12 мес.', mrp == null || mrp > 365 ? 'good' : mrp > 180 ? 'warn' : 'bad')}
      ${kpiTile('Коэфф. эксплуатации', kexp != null ? pct(kexp, 1) : '—', 'доля времени скважин в работе', kexp == null || kexp > 0.95 ? 'good' : kexp > 0.85 ? 'warn' : 'bad')}
      ${kpiTile('Добыча на работника', num(perEmp) + ' т/год', `${last.staff || 0} чел.`, '')}
      ${kpiTile('Выработанность запасов', pct(kin, 1), `остаток ${num(R.remaining / 1e6, 2)} млн т`, '')}
      ${kpiTile('Обводнённость', wcM(last) != null ? num(wcM(last), 1) + '%' : '—', 'средняя за месяц', '')}
    </div>
    <div class="grid2">${card('Себестоимость и цена нефти, $/барр', G.line({ labels: L, series: [{ name: 'Brent', color: C.yellow, values: h.map(x => x.brent) }, { name: 'Себестоимость (опер. затраты)', color: C.red, values: h.map(cost$) }, { name: 'Полная (с налогами)', color: C.orange, values: h.map(x => x.fact > 0 ? (x.opex + x.taxes) / (x.fact * E.BBL) / x.fx : null), dash: true }], height: 200, unit: '$' }))}
      ${card('EBITDA и чистая прибыль', G.bars({ labels: L, series: [{ name: 'EBITDA', color: C.blue, values: h.map(x => x.ebitda || 0) }, { name: 'Чистая прибыль', color: v => v >= 0 ? C.aqua : C.red, values: h.map(x => x.net) }], height: 200, unit: '₸' }))}</div>
    <div class="grid2">${card('Рентабельность по EBITDA, %', G.line({ labels: L, series: [{ name: 'Маржа EBITDA', color: C.aqua, values: h.map(marg), area: true }], height: 170, unit: '%' }))}
      ${card('Коэффициент эксплуатации фонда, %', G.line({ labels: L, series: [{ name: 'Кэкспл', color: C.blue, values: h.map(x => x.wd ? x.wk / x.wd * 100 : null) }, { name: 'Цель 95%', color: C.plan, values: h.map(() => 95), dash: true }], height: 170, unit: '%', zero: false }))}</div>
    <div class="grid2">${card('Отказы скважин по месяцам', G.bars({ labels: L, series: [{ name: 'Отказы', color: C.orange, values: h.map(x => x.fails || 0) }], height: 170, unit: 'шт.' }))}
      ${card('Обводнённость продукции, %', G.line({ labels: L, series: [{ name: 'Обводнённость', color: C.blue, values: h.map(wcM) }], height: 170, unit: '%', zero: false }))}</div>
    ${card('Структура себестоимости тонны (последний месяц), ₸/т', last.fact > 0 ? `<div class="hbars">${Object.entries(last.cats || {}).filter(([c, v]) => v < 0 && E.PNL.opex.includes(c)).map(([c, v]) => [c, -v / last.fact]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v], i, arr) => `<div class="hb"><span>${esc(c)}</span><div class="hbt"><i style="width:${(v / arr[0][1] * 100).toFixed(1)}%"></i></div><b>${num(v)}</b></div>`).join('')}</div>` : '<div class="empty">Нет добычи</div>')}
    <p class="hint">Себестоимость — операционные затраты (без налогов и капвложений) на баррель добытой нефти. МРП — среднее число суток работы скважины между отказами. Коэффициент эксплуатации — доля времени, когда скважины фонда дают продукцию. Ориентиры отрасли: Кэкспл &gt; 95%, МРП &gt; 365 сут.</p>`;
  }

  /* ===================== ТЕХНОЛОГИИ ===================== */
  function vTech() {
    const y = E.parts(s.day).y;
    return `<div class="techs">${D.TECH.map(t => {
      const done = E.has(s, t.key), avail = y >= t.year;
      return `<div class="tech ${done ? 'done' : avail ? '' : 'locked'}"><div class="tc-y">${t.year}</div><div class="tc-b"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><div class="cat-m"><span>${money(t.cost * idx())}</span></div></div>
        ${done ? pill('внедрено', 'good') : avail ? btn('Внедрить', 'tech', t.key, 'small primary') : `<div class="lock">🔒 с ${t.year} г.</div>`}</div>`;
    }).join('')}</div><p class="hint">Технологии открываются по мере хода истории. Их внедрение — капитальные затраты, а эффект действует постоянно.</p>`;
  }

  /* ===================== ЖУРНАЛ ===================== */
  function vEvents() {
    const sb = sub();
    if (sb === 'goals') return card('Цели карьеры', goalsList(0) + '<p class="hint">За каждую цель растёт доверие совета директоров.</p>');
    if (sb === 'years') return card('Годовые итоги', s.yearReports.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Год</th><th>План</th><th>Факт</th><th>%</th><th>Уровень</th><th>Выручка</th><th>Чистая приб.</th><th>Место</th></tr></thead><tbody>${s.yearReports.slice().reverse().map(r => `<tr><td>${r.y}</td><td>${num(r.plan)}</td><td>${num(r.fact)}</td><td class="${r.ratio >= 1 ? 'tgood' : r.ratio >= 0.95 ? 'twarn' : 'tbad'}">${pct(r.ratio)}</td><td>${E.PLAN_LEVELS[r.level].name}</td><td>${money(r.rev)}</td><td>${money(r.net)}</td><td>№${r.rank}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Итоги появятся после 31 декабря</div>');
    const f = ui.logFilter; const list = s.log.filter(l => f === 'all' || l.type === f);
    return `<div class="chips">${[['all', 'Все'], ['bad', 'Аварии и штрафы'], ['warn', 'Предупреждения'], ['good', 'Успехи'], ['info', 'Информация']].map(([id, n]) => `<button class="fchip ${f === id ? 'on' : ''}" data-act="lf" data-arg="${id}">${n}</button>`).join('')}</div>
      ${card('', `<div class="loglist">${list.map(logRow).join('') || '<div class="empty">Пусто</div>'}</div>`)}`;
  }

  /* ===================== НАСТРОЙКИ ===================== */
  function vSettings() {
    return `${card('Компания', `<div class="kv3"><div><span>Название</span><b>${esc(s.company.name)}</b></div><div><span>Месторождение</span><b>${esc(s.company.field)}</b></div><div><span>Сложность</span><b>${{ easy: 'Лёгкая', normal: 'Нормальная', hard: 'Сложная' }[s.company.difficulty]}</b></div></div><div class="btnrow">${btn('Изменить названия', 'renameForm')}</div>`)}
      ${card('Сохранения', `<p class="hint">Игра сохраняется автоматически после каждого действия и прокрутки времени (в памяти браузера). Экспортируйте файл, чтобы перенести игру на другое устройство.</p><div class="btnrow">${btn('Сохранить сейчас', 'save', '', 'primary')}${btn('Экспорт в файл', 'export')}${btn('Импорт из файла', 'import')}<input type="file" id="importFile" accept=".json,application/json" hidden></div>`)}
      ${card('Звук и анимации', `<label class="check"><input type="checkbox" data-change="sndOn" ${SND.settings.on ? 'checked' : ''}> Звуковые эффекты</label>
        <div class="slider"><label>Громкость: <b id="volv">${Math.round(SND.settings.vol * 100)}%</b></label><input type="range" min="0" max="100" step="5" value="${Math.round(SND.settings.vol * 100)}" data-input="vol" data-change="vol"></div>
        <label class="check"><input type="checkbox" data-change="sndAmb" ${SND.settings.amb ? 'checked' : ''}> Фоновый шум промысла (гул насосов, скрип станков-качалок)</label>
        <div class="btnrow">${btn('Проверить звук', 'sndTest', '', 'small')}</div>
        <p class="hint">На iPhone звук включается после первого касания экрана. Если звука нет — выключите беззвучный режим (переключатель на боковой стороне телефона) и прибавьте громкость.</p>`)}
      ${card('Игровой процесс', `<label class="check"><input type="checkbox" data-change="repSetting" ${s.settings.monthReport !== false ? 'checked' : ''}> Показывать итоги по цехам после каждого месяца (время останавливается до решения)</label>`)}
      ${card('Помощь', `<div class="btnrow">${btn('Как играть', 'help', '', 'primary')}</div>`)}
      ${card('Новая игра', `<p class="hint">Текущий прогресс будет потерян (если не экспортирован).</p><div class="btnrow">${btn('Начать заново', 'newGame', '', 'danger')}</div>`)}
      <p class="hint center">Oil Management 2.0 · все компании, месторождения и люди вымышлены · цены нефти 2000–2026 гг. приблизительно повторяют реальную динамику</p>`;
  }

  /* ===================== СТАРТОВЫЙ ЭКРАН ===================== */
  function startScreen() {
    const has = !!LS.get(E.SAVE_KEY);
    return `<div class="start"><div class="start-card">
      <img src="assets/logo.png" alt="Oil Management">
      <h1>OIL MANAGEMENT 2.0</h1><p class="sub">Экономический симулятор нефтедобывающей компании · 2000 — …</p>
      ${has ? `<button class="primary big" data-act="continue">Продолжить карьеру</button>` : ''}
      <div class="form">
        <label>Название компании<input id="ng-name" value="Сарыбулак Петролеум" maxlength="40"></label>
        <label>Месторождение<input id="ng-field" value="${esc(D.FIELD_NAMES[0])}" maxlength="40" list="ng-fields" placeholder="Введите своё название"><datalist id="ng-fields">${D.FIELD_NAMES.map(f => `<option value="${esc(f)}">`).join('')}</datalist><small>Впишите любое название или выберите из подсказок</small></label>
        <label>Сложность<select id="ng-diff"><option value="easy">Лёгкая — 6 млрд ₸, доверие 70</option><option value="normal" selected>Нормальная — 3 млрд ₸, доверие 60</option><option value="hard">Сложная — 1,2 млрд ₸, доверие 50</option></select></label>
        <label>Рынок нефти<select id="ng-market"><option value="history">История 2000–2026 (кризисы 2008, 2014, 2020)</option><option value="random">Случайный рынок</option></select></label>
      </div>
      <button class="${has ? '' : 'primary'} big" data-act="startNew">Новая игра с 1 января 2000 г.</button>
      <button class="ghost" data-act="import">Загрузить из файла</button><input type="file" id="importFile" accept=".json,application/json" hidden>
      <small class="muted">Все названия компаний вымышлены</small>
    </div>${modalHtml()}</div>`;
  }

  /* ===================== МОДАЛЬНЫЕ ОКНА ===================== */
  function modalHtml() {
    if (s && s.gameOver) return `<div class="modal-bg"></div><div class="modal"><h2>Игра окончена</h2><p>${esc(s.gameOver.reason)}</p><p>Дата: ${dateRu(E.iso(s.day))}. Место в рейтинге: №${s.rank}.</p><div class="btnrow">${btn('Новая игра', 'newGame', '', 'primary')}${btn('Экспорт сохранения', 'export')}</div></div>`;
    if (s && s.pending && !(ui.modal && s.pending.key === 'plan')) {
      const p = s.pending;
      return `<div class="modal-bg"></div><div class="modal event"><div class="ev-ic">${G.icon(p.key === 'plan' ? 'prod' : 'warn')}</div><h2>${esc(p.title)}</h2><p>${esc(p.text)}</p><div class="opts">${p.options.map((o, i) => `<button class="opt" data-act="resolve" data-arg="${i}"><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</button>`).join('')}</div></div>`;
    }
    if (s && ((s.report && s.report.open) || ui.viewReport) && !ui.modal) return reportHtml();
    const m = ui.modal; if (!m) return '';
    return `<div class="modal-bg" data-act="closeModal"></div><div class="modal ${m.wide ? 'wide' : ''}"><button class="x" data-act="closeModal">${G.icon('close')}</button><h2>${esc(m.title)}</h2>${m.desc ? `<p class="muted">${m.desc}</p>` : ''}
      ${m.html || ''}
      ${m.fields ? `<div class="form">${m.fields.map(f => `<label>${esc(f.label)}${f.type === 'select' ? `<select id="f-${f.name}">${f.options.map(o => `<option value="${esc(o[0])}" ${o[0] == f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : `<input id="f-${f.name}" type="${f.type || 'text'}" inputmode="${f.type === 'number' ? 'numeric' : 'text'}" value="${esc(f.value)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}>`}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`).join('')}</div>` : ''}
      ${m.err ? `<div class="banner bad">${esc(m.err)}</div>` : ''}
      ${m.submit ? `<div class="btnrow">${btn(m.ok || 'Подтвердить', 'modalOk', '', 'primary')}${btn('Отмена', 'closeModal')}</div>` : ''}</div>`;
  }
  function form(title, desc, fields, submit, ok) { ui.modal = { title, desc, fields, submit, ok }; render(); setTimeout(() => { const el = document.querySelector('.modal input'); if (el && !matchMedia('(pointer:coarse)').matches) el.focus(); }, 30); }
  function confirmBox(title, desc, fn, ok = 'Подтвердить') { ui.modal = { title, desc, submit: () => fn(), ok }; render(); }
  function tenderModal() {
    const T = s.tender; if (!T) return;
    const isWell = T.type.startsWith('well_');
    const html = `${T.purpose !== undefined && T.purpose !== null ? `<div class="form"><label>Назначение резервуара<select id="f-purpose">${Object.entries(D.TANK_PURPOSE).map(([k, v]) => `<option value="${k}" ${T.purpose === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>` : ''}
      ${isWell ? `<div class="form"><label>Цех добычи<select id="f-cdng">${s.cdngs.map(c => { const n = s.wells.filter(w => w.cdng === c.id).length; return `<option value="${c.id}" ${n >= 40 ? 'disabled' : ''}>${esc(c.name)} — ${n}/40</option>`; }).join('')}</select></label></div>` : ''}
      <div class="offers2">${T.offers.map((o, i) => `<div class="tof"><b>${esc(o.name)}</b>
        <div class="kv3"><div><span>Цена</span><b>${money(o.price)}</b></div><div><span>Срок</span><b>${o.days} дн.</b></div><div><span>Качество</span><b>${'★'.repeat(Math.round(o.quality * 5))}${'☆'.repeat(5 - Math.round(o.quality * 5))}</b></div></div>
        <small class="muted">Аванс ${T.kind === 'build' ? '25' : '50'}%: ${money(o.price * (T.kind === 'build' ? 0.25 : 0.5))}</small>
        ${btn('Выбрать подрядчика', 'award', i, 'primary small', s.cash < o.price * (T.kind === 'build' ? 0.25 : 0.5))}</div>`).join('')}</div>`;
    ui.modal = { title: 'Тендер: ' + T.title, desc: esc((D.BUILD[T.type] || D.SERVICES[T.type]).desc), html, wide: true, onClose: () => E.act(s, 'cancelTender') };
    render();
  }

  /* ===================== действия ===================== */
  function save() { if (!LS.set(E.SAVE_KEY, E.serialize(s)) && !ui.saveWarned) { ui.saveWarned = true; flash('Браузер не даёт сохранять игру в памяти — используйте экспорт в файл', 'warn'); } }
  function flash(text, type = 'info') { if (s) s.flash.push({ text, type }); else alert(text); }
  const ACT_SND = { accept: 'cash', spot: 'cash', hire: 'pop', buy: 'spend', award: 'stamp', tech: 'good', loan: 'coin', deposit: 'coin', withdraw: 'coin', repay: 'spend', maintain: 'hiss', repair: 'hiss', planCustom: 'stamp', cancelContract: 'leave', cancelProject: 'leave', fire: 'leave', salaryAll: 'coin', tankPurpose: 'hiss', demolish: 'build' };
  const OP_SND = { bonus: 'coin', remark: 'warn', reprimand: 'fail', fire: 'leave', hire: 'pop', grade: 'good', train: 'good', search: 'click' };
  function doAct(type, a, okMsg) {
    try {
      const r = E.act(s, type, a); if (okMsg) flash(okMsg, 'good'); save();
      const snd = (type === 'chief' || type === 'person') ? OP_SND[a.op] : ACT_SND[type]; if (snd) SND.play(snd);
      return r || true;
    } catch (e) { SND.play('error'); ui.lastErr = true; if (ui.modal && ui.modal.fields) { ui.modal.err = e.message; } else flash(e.message, 'bad'); return false; }
  }
  function advance(days) {
    if (ui.running || !s || s.pending || s.gameOver) return;
    if (days === 'm') days = E.daysToNextMonth(s);
    days = Number(days);
    ui.running = true; ui.stop = false;
    const delay = days === 1 ? 0 : days <= 7 ? 160 : 70;
    let left = days; const cash0 = s.cash;
    if (days > 1) SND.play('whoosh');
    const finish = () => { ui.running = false; save(); render(); floatDelta(s.cash - cash0); };
    const step = () => {
      if (ui.stop || s.pending || s.gameOver || left <= 0) { finish(); return; }
      E.advance(s, 1); left--; SND.play('day');
      if (left > 0 && !s.pending && !s.gameOver && !ui.stop) { render(); setTimeout(step, delay); }
      else finish();
    };
    step();
  }
  const handlers = {
    adv: a => advance(a === 'm' ? 'm' : Number(a)), stop: () => { ui.stop = true; },
    sheet: () => { ui.sheet = !ui.sheet; render(); },
    resolve: a => { const o = s.pending && s.pending.options[Number(a)]; if (o && o.custom) { handlers.planForm(s.pending.data.y); return; } doAct('resolve', { i: Number(a) }); render(); },
    closeModal: () => { if (ui.modal && ui.modal.onClose) ui.modal.onClose(); ui.modal = null; render(); },
    modalOk: () => {
      const m = ui.modal; const vals = {};
      for (const f of m.fields || []) vals[f.name] = document.getElementById('f-' + f.name).value;
      m.err = null; const r = m.submit(vals);
      if (r !== false && !m.err) ui.modal = null; render();
    },
    wf: a => { ui.wellFilter = a; ui.page = 0; render(); }, lf: a => { ui.logFilter = a; render(); }, page: a => { ui.page += Number(a); render(); },
    finRange: a => { ui.finRange = Number(a); render(); },
    gosub: a => { go(a); },
    toggle: a => { doAct('toggle', { key: a }); render(); },
    repair: a => { doAct('repair', { id: a }, 'Бригада ПРС выехала на скважину'); render(); },
    repairAll: () => { let n = 0; for (const w of s.wells.filter(w => w.status === 'fail')) { try { E.act(s, 'repair', { id: w.id }); n++; } catch (e) { } } flash(n ? `Назначено ремонтов: ${n}` : 'Нет свободных бригад или материалов', n ? 'good' : 'warn'); save(); render(); },
    wtoggle: a => { doAct('wellToggle', { id: a }); render(); },
    svc: a => { const [type, id] = a.split(':'); const r = doAct('tender', { type, target: Number(id) }); if (r) tenderModal(); else render(); },
    svcPick: a => {
      if (['anticor', 'clean'].includes(a)) { const ts = s.fac.filter(f => D.BUILD[f.type].tank && f.status === 'ok'); form(D.SERVICES[a].name, 'Выберите резервуар', [{ name: 't', label: 'Резервуар', type: 'select', options: ts.map(t => [t.id, `${t.name} — ${D.TANK_PURPOSE[t.purpose].split(' ')[0]}, износ ${Math.round(t.health)}%`]) }], v => { ui.modal = null; handlers.svc(`${a}:${v.t}`); return false; }, 'К тендеру'); return; }
      const ws = s.wells.filter(w => (w.type === 'sk' || w.type === 'ecn') && w.status !== 'repair' && (a !== 'prs' || w.status === 'fail'));
      if (!ws.length) { flash('Нет подходящих скважин', 'warn'); render(); return; }
      form(D.SERVICES[a].name, 'Выберите скважину', [{ name: 'w', label: 'Скважина', type: 'select', options: ws.sort((x, y) => x.health - y.health).map(w => [w.id, `${w.name} — ${E.wellTypeName(w.type)}, потенциал ${num(w.potential, 1)}, обводн. ${pct(w.wc)}, износ ${Math.round(w.health)}%`]) }], v => { ui.modal = null; handlers.svc(`${a}:${v.w}`); return false; }, 'К тендеру');
    },
    tender: a => { const r = doAct('tender', { type: a }); if (r) tenderModal(); else render(); },
    award: a => {
      const pur = document.getElementById('f-purpose'), cd = document.getElementById('f-cdng');
      if (pur) s.tender.purpose = pur.value;
      const r = doAct('award', { i: Number(a), cdng: cd ? cd.value : null });
      if (r) { ui.modal = null; flash('Договор подряда заключён', 'good'); } render();
    },
    cancelProject: a => confirmBox('Отменить проект?', 'Вернётся 40% уплаченного аванса.', () => { doAct('cancelProject', { id: a }); }),
    maintain: a => { doAct('maintain', { id: a }, 'ТО выполнено'); render(); },
    demolish: a => confirmBox('Снести резервуар?', `Стоимость демонтажа ${money(3e6 * idx())}. Резервуар должен быть пустым.`, () => { doAct('demolish', { id: a }); }),
    purpose: a => form('Перепрофилировать РВС', `Только пустой резервуар. Стоимость ${money(2e6 * idx())}.`, [{ name: 'p', label: 'Назначение', type: 'select', options: Object.entries(D.TANK_PURPOSE), value: s.fac.find(f => f.id === Number(a)).purpose }], v => doAct('tankPurpose', { id: a, purpose: v.p }) ? true : false),
    hire: a => { const r = D.ROLES.find(x => x.key === a); const need = Math.max(1, E.staffNeed(s)[a] - s.staff[a].n - s.hires.filter(h => h.role === a).reduce((x, h) => x + h.n, 0)); form('Подбор персонала', `${esc(r.name)}. Подбор: 30% месячного оклада за человека.`, [{ name: 'n', label: 'Количество', type: 'number', value: need, min: 1, hint: `Стоимость подбора: ${money(r.salary * idx() * 0.3)} за чел.` }], v => doAct('hire', { role: a, n: v.n }, 'Заявка на подбор размещена') ? true : false, 'Нанять'); },
    fire: a => form('Увольнение', 'Выходное пособие — месячный оклад. Мораль снизится.', [{ name: 'n', label: 'Количество', type: 'number', value: 1, min: 1 }], v => doAct('fire', { role: a, n: v.n }) ? true : false, 'Уволить'),
    hireNeed: () => { const need = E.staffNeed(s); let n = 0, cost = 0; for (const r of D.ROLES) { const d = need[r.key] - s.staff[r.key].n - s.hires.filter(h => h.role === r.key).reduce((x, h) => x + h.n, 0); if (d > 0) { n += d; cost += d * r.salary * idx() * 0.3; } } if (!n) { flash('Штат укомплектован', 'good'); render(); return; } confirmBox('Нанять по потребности?', `Будет нанято ${n} чел. Стоимость подбора ${money(cost)}.`, () => { for (const r of D.ROLES) { const d = need[r.key] - s.staff[r.key].n - s.hires.filter(h => h.role === r.key).reduce((x, h) => x + h.n, 0); if (d > 0) doAct('hire', { role: r.key, n: d }); } flash(`Подбор ${n} чел. начат`, 'good'); }, 'Нанять'); },
    salAll: a => { doAct('salaryAll', { pct: a }); render(); },
    buy: a => { const [key, q] = a.split(':'); doAct('buy', { key, qty: q }, 'Заказ размещён'); render(); },
    buyForm: a => { const m = D.MATERIALS.find(x => x.key === a); form('Закупка: ' + m.name, `Цена ${num(E.matPrice(s, a))} ₸ за ${m.unit}. Срок поставки ${E.leadTime(s)} дн.`, [{ name: 'q', label: `Количество, ${m.unit}`, type: 'number', value: m.min, min: 1 }], v => doAct('buy', { key: a, qty: v.q }, 'Заказ размещён') ? true : false, 'Купить'); },
    accept: a => { doAct('accept', { id: a }, 'Договор заключён'); render(); },
    cancelContract: a => confirmBox('Расторгнуть договор?', 'Неустойка — 10% месячного объёма по текущей цене. Доверие −2.', () => { doAct('cancelContract', { id: a }); }),
    spot: a => { doAct('spot', { qty: a }, `Продано ${a} т на споте`); render(); },
    spotForm: () => form('Спотовая продажа', 'Не более 400 т в сутки.', [{ name: 'q', label: 'Объём, т', type: 'number', value: 200, min: 1, max: 400 }], v => doAct('spot', { qty: v.q }, 'Продано') ? true : false, 'Продать'),
    loanForm: () => form('Кредит', `Лимит ${money(E.creditLimit(s))}, ставка ${pct(E.loanRate(s), 1)} годовых.`, [{ name: 'a', label: 'Сумма, ₸', type: 'number', value: Math.round(Math.min(E.creditLimit(s), 500e6) / 1e6) * 1e6, min: 1e6 }, { name: 'm', label: 'Срок', type: 'select', value: 36, options: [[12, '12 месяцев'], [24, '24 месяца'], [36, '36 месяцев'], [60, '60 месяцев'], [120, '120 месяцев']] }], v => doAct('loan', { amount: v.a, months: v.m }, 'Кредит получен') ? true : false, 'Получить'),
    depFormOld: () => form('Депозит', `Ставка ${pct(Math.max(0, E.loanRate(s) - 0.06), 1)} годовых, выплата ежемесячно.`, [{ name: 'a', label: 'Сумма, ₸', type: 'number', value: Math.round(Math.max(1e6, s.cash * 0.3) / 1e6) * 1e6, min: 1e6 }], v => doAct('deposit', { amount: v.a }, 'Депозит открыт') ? true : false, 'Открыть'),
    repay: a => confirmBox('Погасить кредит досрочно?', 'Будет списан весь остаток основного долга.', () => { doAct('repay', { id: a }); }),
    withdraw: a => { const d = s.deposits.find(x => x.id === Number(a)); if (d && d.end) { confirmBox('Снять депозит досрочно?', `Вернётся ${money(d.principal)} + проценты только по ставке «до востребования». Накопленные ${money(d.amount - d.principal)} капитализации будут потеряны.`, () => { doAct('withdraw', { id: a }, 'Депозит закрыт досрочно'); }, 'Снять'); return; } doAct('withdraw', { id: a }, 'Депозит закрыт'); render(); },
    tech: a => { const t = D.TECH.find(x => x.key === a); confirmBox('Внедрить технологию?', `${esc(t.name)} — ${money(t.cost * idx())}`, () => { doAct('tech', { key: a }); }, 'Внедрить'); },
    renameForm: () => form('Компания и месторождение', '', [{ name: 'n', label: 'Название компании', value: s.company.name }, { name: 'f', label: 'Название месторождения', value: s.company.field }], v => doAct('rename', { name: v.n, field: v.f }, 'Сохранено') ? true : false),
    planForm: a => {
      const y = a ? Number(a) : E.parts(s.day).y; const o = E.yearOutlook(s, y); const PF = E.ensurePF(s, y);
      const fromEvent = s.pending && s.pending.key === 'plan';
      const tot = s.cdngs.reduce((acc, c) => acc + o.byCdng[c.id].fact + o.byCdng[c.id].forecast, 0);
      const fields = s.cdngs.map(c => { const b = o.byCdng[c.id]; const cur = PF.annual[c.id]; return { name: 'c' + c.id, label: `${c.name}, т/год`, type: 'number', min: 0, value: Math.round(!fromEvent && cur ? cur : b.fact + b.forecast), hint: `Прогноз ${num(b.fact + b.forecast)} т${b.fact ? ` (факт с начала года ${num(b.fact)} т)` : ''}` }; });
      const pen = !fromEvent && !(E.parts(s.day).m === 1 && !(PF.corrections));
      ui.modal = null;
      form(`Свой план добычи на ${y} год`, `Прогноз геологической службы: <b>${num(tot)} т</b>. Допустимо 50–200% прогноза. Прошедшие месяцы не меняются — новый объём распределяется на оставшиеся дни года. Уровень плана (и бонус доверия при выполнении) определяется отношением к прогнозу: ≥108% — амбициозный, ≥98% — базовый, ниже — консервативный.${pen ? ' <b class="twarn">Корректировка после января: доверие совета −3.</b>' : ''}`, fields,
        v => { const by = {}; for (const c of s.cdngs) by[c.id] = v['c' + c.id]; const r = doAct('planCustom', { y, byCdng: by }); if (r) flash(`План ${y}: ${num(r.total)} т (${E.PLAN_LEVELS[r.level].name.toLowerCase()})`, 'good'); return r ? true : false; }, 'Утвердить план');
      if (fromEvent) ui.modal.onClose = () => { };
    },
    save: () => { save(); flash('Игра сохранена', 'good'); render(); },
    export: () => { const blob = new Blob([E.serialize(s)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `oil-management-${E.iso(s.day)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
    import: () => document.getElementById('importFile')?.click(),
    newGame: () => { if (s && !s.gameOver) { confirmBox('Начать новую игру?', 'Текущий прогресс будет удалён из браузера.', () => { LS.del(E.SAVE_KEY); s = null; ui.modal = null; }); } else { LS.del(E.SAVE_KEY); s = null; ui.modal = null; render(); } },
    continue: () => { try { s = E.deserialize(LS.get(E.SAVE_KEY)); ui.tab = 'home'; render(); } catch (e) { alert(e.message); } },
    startNew: () => {
      s = E.newGame({ name: document.getElementById('ng-name').value.trim() || 'Сарыбулак Петролеум', field: document.getElementById('ng-field').value.trim() || D.FIELD_NAMES[0], difficulty: document.getElementById('ng-diff').value, market: document.getElementById('ng-market').value });
      ui.tab = 'home'; ui.sub = {}; save(); render();
      if (!LS.get('om2_help_seen')) { LS.set('om2_help_seen', '1'); setTimeout(() => { if (!s.pending) handlers.help(); else ui.showHelpAfter = true; }, 50); }
    },
    pf: a => { ui.pf = a; ui.page = 0; render(); },
    roleList: a => { ui.pf = 'r:' + a; ui.page = 0; ui.sub.staff = 'people'; ui.resetScroll = true; render(); },
    personCard: id => { const p = s.people.find(x => x.id === Number(id)); if (!p) return; ui.modal = { title: 'Карточка работника', html: personCard(p), wide: true, pid: p.id }; render(); },
    pOp: a => {
      const [id, op] = a.split(':'); const p = s.people.find(x => x.id === Number(id));
      if (op === 'fire') { const pre = E.yearsToPension(s, p) < 2; confirmBox(`Уволить ${p.name}?`, `Выходное пособие: ${money(E.personSalary(s, p).total * (pre ? 3 : 1))}${pre ? ' (3 зарплаты — предпенсионный возраст, коллектив будет недоволен)' : ''}.`, () => { doAct('person', { id: p.id, op: 'fire' }); }, 'Уволить'); return; }
      const ok = doAct('person', { id: p.id, op }, { grade: 'Разряд повышен', bonus: 'Премия выплачена', train: 'Направлен на обучение' }[op]);
      if (ok) ui.modal.html = personCard(p); render();
    },
    sndTest: () => { SND.init(); SND.play('cash'); setTimeout(() => SND.play('fanfare'), 500); confetti(); },
    depOpen: type => { const T = D.DEPOSITS[type]; form('Депозит: ' + T.name, `${esc(T.desc)} Ставка ${pct(E.depositRate(s, type), 1)} годовых.`, [{ name: 'a', label: 'Сумма, ₸', type: 'number', value: Math.round(Math.max(1e6, s.cash * 0.3) / 1e6) * 1e6, min: 1e6 }], v => doAct('deposit', { amount: v.a, type }, 'Депозит открыт') ? true : false, 'Открыть депозит'); },
    hseOp: a => { const [op, kind] = a.split(':'); doAct('hse', { op, kind }, op === 'drill' ? 'Учения проведены' : op === 'medical' ? 'Медосмотр проведён' : 'Обучение проведено'); render(); },
    gotech: () => go('tech'),
    viewReport: () => { ui.viewReport = true; render(); },
    closeReport: () => { ui.viewReport = false; if (s.report && s.report.open) doAct('closeReport'); render(); },
    chiefOp: a => {
      const [id, op] = a.split(':'); const c = s.cdngs.find(x => x.id === Number(id)); const ch = c.chief;
      if (op === 'fire') { const sev = ch.reprimands >= 2 ? 0 : ch.salary * idx() * 3; confirmBox(`Уволить начальника ${c.name}?`, `${esc(ch.name)}, К = ${ch.eff.toFixed(2)}. ${sev ? `Выходное пособие ${money(sev)} (3 оклада).` : 'Два выговора — увольнение без выходного пособия.'} До назначения нового цехом руководит и.о. (К = 0,70), мораль снизится.`, () => { if (doAct('chief', { cdng: c.id, op: 'fire' })) { handlers.chiefCand(c.id); return false; } }, 'Уволить'); return; }
      const msg = { bonus: 'Премия выдана', remark: 'Замечание объявлено', reprimand: 'Выговор объявлен' }[op];
      doAct('chief', { cdng: c.id, op }, msg); render();
    },
    chiefCand: id => {
      const c = s.cdngs.find(x => x.id === Number(id)); if (!c.candidates || !c.candidates.length) { doAct('chief', { cdng: c.id, op: 'search' }); }
      ui.modal = { title: `Кандидаты на должность начальника ${c.name}`, desc: 'Коэффициент эффективности (К) — опыт и деловые качества. Сильный кандидат дороже. Найм: один оклад кадровому агентству, выход через 10 дней.', wide: true,
        html: `<div class="offers2">${(c.candidates || []).map((k, i) => `<div class="tof"><div class="row">${G.face({ face: k.face, g: k.g, age: k.by ? E.parts(s.day).y - k.by : 40, mood: 70, dept: 'chief', size: 48, id: 'cd' + i })}<b>${esc(k.name)}${k.by ? `<small class="muted"> · ${yrs(E.parts(s.day).y - k.by)}</small>` : ''}</b></div><div class="kv3"><div><span>Коэффициент К</span><b class="${effCls(k.eff)}">${k.eff.toFixed(2)}</b></div><div><span>Стаж</span><b>${Math.round(k.exp)} лет</b></div><div><span>Оклад</span><b>${money(k.salary * idx())}</b></div></div>${btn('Назначить', 'chiefHire', c.id + ':' + i, 'primary small')}</div>`).join('')}</div>
          <div class="btnrow">${btn(`Новый поиск (${money(D.CHIEF_SALARY * idx() * 0.5)})`, 'chiefSearch', c.id, 'small')}</div>` };
      render();
    },
    chiefHire: a => { const [id, i] = a.split(':'); if (doAct('chief', { cdng: Number(id), op: 'hire', i: Number(i) }, 'Начальник цеха назначен')) ui.modal = null; render(); },
    chiefSearch: id => { if (doAct('chief', { cdng: Number(id), op: 'search' })) handlers.chiefCand(id); else render(); },
    help: () => { ui.modal = { title: 'Как играть', html: HELP, wide: true }; render(); }
  };
  const HELP = `<div class="help">
    <p><b>Вы — генеральный директор</b> молодой нефтедобывающей компании. 1 января 2000 года, 11 скважин со станками-качалками, небольшой ЦКППН и 3 млрд ₸. Цель — выполнять планы, расти и войти в ТОП-10 компаний региона.</p>
    <ol>
      <li><b>Время.</b> Кнопки внизу: +1 день, +7 дней, +Месяц. В конце месяца — зарплата, налоги, итоги план/факт.</li>
      <li><b>Цепочка добычи.</b> Скважины → АГЗУ → УПСВ → технологические РВС → печи ЦКППН → товарные РВС → отгрузка. Если любой узел переполнен — добыча автоматически ограничивается. Следите за вкладкой «ЦКППН → Схема».</li>
      <li><b>Сбыт.</b> Нефть продаётся только по договорам (или со скидкой на споте). Заключите договор в первые недели — товарные РВС заполнятся примерно за месяц.</li>
      <li><b>Качество.</b> Подберите температуру печей и дозировку деэмульгатора: I группа — полная цена, некондицию не берут.</li>
      <li><b>Отказы скважин.</b> Бригады ПРС ремонтируют их автоматически при наличии материалов. Включите автозакупку на складе.</li>
      <li><b>Пласт.</b> Закачивайте воду (БКНС + нагнетательные скважины), иначе давление и дебиты падают.</li>
      <li><b>Рост.</b> Бурите скважины через тендер подрядчиков, стройте РВС, УПСВ, блоки ЦКППН, подстанции. Каждые 8 скважин — АГЗУ, каждые 40 — новый ЦДНГ.</li>
      <li><b>Цеха и начальники.</b> Скважины разделены на ЦДНГ-1…4. После каждого месяца — итоги по цехам: премируйте, делайте замечания, объявляйте выговоры или меняйте начальников. Их коэффициент эффективности влияет на добычу и отказы.</li>
      <li><b>ОТ, ПБ и экология.</b> Проводите учения, медосмотры и обучение, держите СИЗ на складе — иначе растут несчастные случаи и штрафы госорганов. Утилизируйте попутный газ (компрессорная станция, ГТЭС): факел облагается платой за эмиссии.</li>
      <li><b>Банк и аналитика.</b> Свободные деньги — на депозит, нехватку — кредитом. Во вкладке «Аналитика» — себестоимость барреля, EBITDA, межремонтный период и коэффициент эксплуатации скважин.</li>
      <li><b>Рейтинг ТОП-100</b> считается по 5 параметрам: добыча, капитализация, прибыль, себестоимость, ОТ и экология.</li>
      <li><b>План.</b> В начале года выберите уровень плана. Выполнение повышает доверие совета директоров; доверие 0 — отставка. Три месяца с минусом на счёте — банкротство.</li>
    </ol>
    <p class="muted">Красные пункты на «Сводке» подскажут, что сейчас мешает больше всего.</p></div>`;
  function go(spec) { const [tab, sb, extra] = spec.split(':'); ui.tab = tab; if (sb) ui.sub[tab] = sb; if (extra) { ui.wellFilter = extra; ui.page = 0; } ui.sheet = false; ui.resetScroll = true; render(); const p = document.querySelector('.page'); if (p) p.scrollTop = 0; window.scrollTo(0, 0); }

  document.addEventListener('visibilitychange', () => { if (document.hidden) SND.ambient(false); else if (s) afterFx(); });
  /* ===================== события DOM ===================== */
  root.addEventListener('click', e => {
    SND.init();
    const t = e.target.closest('[data-tab],[data-sub],[data-act],[data-go]'); if (!t || t.disabled) return;
    if (t.dataset.tab || t.dataset.sub || t.dataset.go) SND.play('tab');
    else if (!['adv', 'sndTest'].includes(t.dataset.act) && !ACT_SND[t.dataset.act]) SND.play('click');
    if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.sheet = false; ui.page = 0; ui.resetScroll = true; render(); const p = document.querySelector('.page'); if (p) p.scrollTop = 0; window.scrollTo(0, 0); return; }
    if (t.dataset.sub) { ui.sub[ui.tab] = t.dataset.sub; ui.page = 0; ui.resetScroll = true; render(); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    const h = handlers[t.dataset.act]; if (h) h(t.dataset.arg);
    if (ui.showHelpAfter && s && !s.pending && t.dataset.act === 'resolve') { ui.showHelpAfter = false; handlers.help(); }
  });
  root.addEventListener('input', e => {
    const k = e.target.dataset.input; if (!k) return; const v = Number(e.target.value);
    if (k === 'temp') { document.getElementById('tv').textContent = v + '°C'; previewQ(v, s.ckppnSet.dose); }
    if (k === 'dose') { document.getElementById('dv').textContent = v + '%'; previewQ(s.ckppnSet.temp, v / 100); }
    if (k === 'comp') document.getElementById('compv').textContent = v + '%';
    if (k === 'reserve') document.getElementById('resv').textContent = v + '%';
    if (k === 'vol') document.getElementById('volv').textContent = v + '%';
  });
  function previewQ(temp, dose) {
    const k = E.kpi(s), t = s.today || {}; const load = E.capOf(s, 'ckppn') ? (t.P || 0) / E.capOf(s, 'ckppn') : 0;
    const keep = Object.assign({}, s.ckppnSet); s.ckppnSet.temp = temp; s.ckppnSet.dose = dose;
    const q = E.qualityOf(s, load, dose, k.cov.dept.ckppn); Object.assign(s.ckppnSet, keep);
    const el = document.getElementById('qprev'); if (el) el.innerHTML = qBox(q);
  }
  root.addEventListener('change', e => {
    const el = e.target, k = el.dataset.change;
    if (el.id === 'importFile') {
      const file = el.files[0]; if (!file) return; const r = new FileReader();
      r.onload = () => { try { s = E.deserialize(r.result); save(); ui.tab = 'home'; ui.modal = null; flash('Сохранение загружено', 'good'); render(); } catch (err) { alert(err.message); } };
      r.readAsText(file); return;
    }
    if (!k) return;
    if (k === 'temp') doAct('ckppn', { temp: el.value });
    else if (k === 'dose') doAct('ckppn', { dose: Number(el.value) / 100 });
    else if (k === 'wash') doAct('ckppn', { wash: el.checked });
    else if (k === 'comp') doAct('ppd', { comp: el.value });
    else if (k === 'reserve') doAct('ppd', { reserve: el.value });
    else if (k === 'sal') doAct('salary', { role: el.dataset.role, pct: parseInt(el.value) });
    else if (k === 'wsort') { ui.wellSort = el.value; }
    else if (k === 'ledger') { ui.ledgerFilter = el.value; }
    else if (k === 'rsort') { ui.rsort = el.value; }
    else if (k === 'pfd') { ui.pf = el.value || 'all'; ui.page = 0; }
    else if (k === 'ps') { ui.ps = el.value; ui.page = 0; }
    else if (k === 'pcdng') { const p = s.people.find(x => x.id === Number(el.dataset.id)); doAct('person', { id: el.dataset.id, op: 'cdng', cdng: el.value }); if (ui.modal && p) ui.modal.html = personCard(p); }
    else if (k === 'sndOn') { SND.init(); SND.setOn(el.checked); }
    else if (k === 'vol') { SND.setVol(Number(el.value) / 100); SND.play('coin'); }
    else if (k === 'sndAmb') { SND.init(); SND.setAmb(el.checked); }
    else if (k === 'repSetting') { doAct('setting', { key: 'monthReport', value: el.checked }); }
    render();
  });
  // всплывающие подсказки графиков
  const tipShow = e => {
    const t = e.target.closest && e.target.closest('[data-tip]'); const tip = document.getElementById('tip'); if (!tip) return;
    if (!t) { tip.style.opacity = 0; document.querySelectorAll('.xhair.on').forEach(x => x.classList.remove('on')); return; }
    const parts = t.dataset.tip.split('|');
    tip.innerHTML = `<b>${parts[0]}</b>${parts.slice(1).map(p => `<div>${p}</div>`).join('')}`;
    tip.style.opacity = 1;
    const x = e.clientX ?? (e.touches && e.touches[0].clientX), y = e.clientY ?? (e.touches && e.touches[0].clientY);
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 14) + 'px';
    if (t.dataset.x) { const svg = t.ownerSVGElement; const xh = svg && svg.querySelector('.xhair'); if (xh) { xh.setAttribute('x1', t.dataset.x); xh.setAttribute('x2', t.dataset.x); xh.classList.add('on'); } }
  };
  root.addEventListener('pointermove', tipShow);
  root.addEventListener('pointerdown', tipShow);
  root.addEventListener('pointerleave', () => { const tip = document.getElementById('tip'); if (tip) tip.style.opacity = 0; });
  document.addEventListener('keydown', e => {
    if (!s || ui.modal || s.pending || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'd') { e.preventDefault(); advance(1); } else if (e.key === 'w') advance(7); else if (e.key === 'm') advance('m');
  });

  /* ===================== запуск ===================== */
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  window.OMApp = { get state() { return s; }, render, advance, ui };
})();
