/* Oil Management 2.0 — интерфейс. */
(function () {
  'use strict';
  const E = window.OMEngine, D = window.OMData, G = window.OMCharts, C = G.C, esc = G.esc;
  const SND = window.OMSound || { init() { }, play() { }, ambient() { }, setOn() { }, setVol() { }, setAmb() { }, settings: { on: false, vol: 0, amb: false } };
  const root = document.getElementById('app');
  const LS = { get: k => { try { return window.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: k => { try { window.localStorage.removeItem(k); } catch (e) { } } };
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
    ['home', 'Сводка', 'home'], ['prod', 'Добыча', 'prod'], ['ckppn', 'Подготовка', 'ckppn'], ['gas', 'ЦДПиТГ', 'gas'], ['sales', 'Сбыт', 'sales'], ['npz', 'НПЗ', 'npz'], ['azs', 'АЗС', 'azs'], ['soc', 'Быт', 'dorm'], ['fleet', 'Автопарк', 'truck'], ['shares', 'Акции', 'shares'], ['staff', 'Персонал', 'staff'],
    ['build', 'Подряд и стройка', 'build'], ['stock', 'Склад', 'stock'], ['energy', 'Энергетика', 'energy'], ['hse', 'ОТ, ПБ и экология', 'hse'], ['fin', 'Финансы', 'fin'], ['bank', 'Банк', 'bank'], ['kpi', 'Аналитика', 'kpi'],
    ['rating', 'ТОП-100', 'rating'], ['tech', 'Технологии', 'tech'], ['events', 'Журнал', 'events'], ['settings', 'Настройки', 'settings']
  ];
  const SUBS = {
    prod: [['cdng', 'Цеха: план / факт'], ['years', 'По годам'], ['wells', 'Скважины'], ['res', 'Пласт и ППД']],
    ckppn: [['scheme', 'Схема'], ['mode', 'Режим подготовки'], ['tanks', 'Резервуары'], ['equip', 'Оборудование']],
    gas: [['scheme', 'Схема'], ['uppg', 'УППГ'], ['mks', 'МКС и ПНГ'], ['lpg', 'СУГ'], ['gwells', 'Скважины'], ['balance', 'Баланс']],
    soc: [['camp', 'Посёлок'], ['food', 'Столовая'], ['dorm', 'Общежития']],
    fleet: [['park', 'Парк'], ['cars', 'Машины'], ['to', 'ТО и запчасти']],
    npz: [['scheme', 'Схема'], ['g_prod', 'Производство', [['kpi', 'Показатели'], ['mode', 'Режим'], ['prod', 'Продукты'], ['contracts', 'Договоры']]], ['g_units', 'Установки', [['units', 'Состав'], ['repair', 'Ремонт']]], ['g_ops', 'Обеспечение', [['staff', 'Персонал'], ['energy', 'Энергия'], ['stock', 'Склад'], ['safety', 'Безопасность']]]],
    azs: [['net', 'Сеть'], ['st', 'Станции'], ['g_trade', 'Торговля', [['fin', 'Финансы'], ['price', 'Цены']]], ['g_ops', 'Обеспечение', [['staff', 'Персонал'], ['energy', 'Энергия'], ['repair', 'Ремонт'], ['stock', 'Склад']]]],
    shares: [['my', 'Наши акции'], ['market', 'Биржа']],
    sales: [['contracts', 'Договоры'], ['offers', 'Предложения'], ['market', 'Рынок']],
    build: [['catalog', 'Объекты'], ['services', 'Услуги'], ['projects', 'Проекты']],
    fin: [['pnl', 'Прибыль и убытки'], ['ledger', 'Журнал операций']],
    hse: [['main', 'Обзор'], ['log', 'Журнал происшествий']],
    staff: [['roles', 'Штатное расписание'], ['people', 'Сотрудники']],
    events: [['log', 'События'], ['goals', 'Цели'], ['years', 'Годовые итоги']]
  };
  const BOTTOM = ['home', 'prod', 'ckppn', 'gas', 'fin'];
  // вкладка может быть группой: [ключ, название, [[лист, название], ...]] — тогда второй ряд вкладок
  const leaves = L => L.flatMap(x => x[2] ? x[2].map(c => c[0]) : [x[0]]);
  const sub = () => { const L = SUBS[ui.tab]; if (!L) return null; const v = ui.sub[ui.tab]; return v && leaves(L).includes(v) ? v : leaves(L)[0]; };
  const subGroup = () => { const L = SUBS[ui.tab], v = sub(); return L && L.find(x => x[2] && x[2].some(c => c[0] === v)); };
  ui.subMem = ui.subMem || {};

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
    { const L = s.dsLack || {}; if (L.npzreag || L.npzadd) out.push({ l: 'warn', t: `Склад НПЗ: закончились ${[L.npzreag ? 'реагенты ЭЛОУ' : '', L.npzadd ? 'присадки' : ''].filter(Boolean).join(' и ')}`, go: 'npz:stock', tab: 'npz' }); if (L.trkcons) out.push({ l: 'warn', t: 'Склад АЗС: закончились фильтры ТРК', go: 'azs:stock', tab: 'azs' }); }
    { const pa = s.pc ? s.pc.list.filter(c => c.status === 'active' && c.why) : []; if (pa.length) out.push({ l: 'warn', t: `Договоры НПЗ: отгрузка стоит по ${pa.length} — ${pa[0].why}`, go: 'npz:contracts', tab: 'npz' }); }
    const low = D.MATERIALS.filter(m => m.group !== 'НПЗ и АЗС' && (!m.tech || E.has(s, m.tech)) && s.stock[m.key] < m.min * 0.5 && !s.orders.some(o => o.key === m.key));
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
      const g = s.today && s.today.gas; if (y >= 2006 && g && g.prod > 0 && g.util < 0.8) out.push({ l: 'warn', t: `Факел: утилизация ПНГ ${pct(g.util)} — штрафы экологов и плата за эмиссии`, go: 'gas:mks', tab: 'gas' });
      if (g && g.nat > 0 && !g.ok) out.push({ l: 'warn', t: `Газ не по ГОСТ: точка росы ${num(g.dew, 0)}°C (норма ${g.norm}°C) — увеличьте подачу ДЭГ`, go: 'gas:uppg', tab: 'gas' });
      if (g && g.hyd) out.push({ l: 'bad', t: 'УППГ: гидратная пробка — производительность снижена', go: 'gas:uppg', tab: 'gas' });
      if (g && g.nat > 0 && g.deg > 0 && s.stock.deg < g.deg * 10) out.push({ l: 'warn', t: `ДЭГ заканчивается: ${num(s.stock.deg)} кг`, go: 'stock', tab: 'stock' });
      { const fl = s.fleet; if (fl) { const br = fl.cars.filter(c => c.status === 'fail' || c.status === 'ban').length, ov = fl.cars.filter(c => s.day > c.to).length; const em = fl.cars.filter(c => c.status === 'ok' && (c.fl || 0) < D.VEH[c.type].fuel * 0.5).length; if (em) out.push({ l: 'warn', t: `Автопарк: ${em} машин стоят с пустым баком`, go: 'fleet:cars', tab: 'fleet' }); if (br) out.push({ l: 'warn', t: `Автопарк: ${br} машин не на линии`, go: 'fleet:cars', tab: 'fleet' }); else if (ov) out.push({ l: 'info', t: `Автопарк: просрочено ТО у ${ov} машин`, go: 'fleet:to', tab: 'fleet' }); } }
      { const so = E.socStats(s); if (so.homeless > 0) out.push({ l: 'warn', t: `Не хватает мест в общежитии: ${so.homeless} чел. снимают жильё`, go: 'soc:dorm', tab: 'soc' }); if (so.unfed > 0) out.push({ l: 'info', t: `Столовая мала: ${so.unfed} чел. на сухом пайке`, go: 'soc:food', tab: 'soc' }); }
      const dsd = s.today && s.today.ds; if (dsd && dsd.lost > 0.5) out.push({ l: 'bad', t: `АЗС без топлива: не продано ${num(dsd.lost, 1)} т — включите докупку`, go: 'azs:price', tab: 'azs' });
      if (dsd && dsd.calc && dsd.calc.saltOut > 3) out.push({ l: 'warn', t: `ЭЛОУ: соли ${num(dsd.calc.saltOut, 1)} мг/л — коррозия колонны. Поднимите температуру и промывку`, go: 'npz:mode', tab: 'npz' });
      if (dsd && dsd.calc && dsd.calc.coke > 0) out.push({ l: 'warn', t: 'Печь П-1 перегрета — коксование змеевика', go: 'npz:mode', tab: 'npz' });
      if (E.facs(s, 'npz_ref').length && s.cat.rf < 0.6) out.push({ l: 'warn', t: `Катализатор риформинга ${pct(s.cat.rf)} — нужна регенерация`, go: 'npz:units', tab: 'npz' });
      if (E.facs(s, 'npz_hdo').length && s.cat.hdo < 0.6) out.push({ l: 'warn', t: `Катализатор гидроочистки ${pct(s.cat.hdo)} — нужна регенерация`, go: 'npz:units', tab: 'npz' });
      if (dsd && dsd.queue > 30) out.push({ l: 'info', t: `Очереди на АЗС: ${num(dsd.queue)} машин уехали — добавьте колонки`, go: 'azs:st', tab: 'azs' });
      if (dsd && dsd.full) out.push({ l: 'warn', t: 'Парк НПЗ заполнен — постройте РВС НПЗ или продавайте ежедневно', go: 'npz:prod', tab: 'npz' });
      else if (dsd && E.facs(s, 'npz').length && s.ds.feed > 50 && dsd.feed < s.ds.feed * 0.5) out.push({ l: 'warn', t: `НПЗ недогружен: ${num(dsd.feed)} из ${s.ds.feed} т/сут`, go: 'npz:mode', tab: 'npz' });
      const gwf = (s.gwells || []).filter(w => w.status === 'fail').length; if (gwf) out.push({ l: 'warn', t: `${gwf} газ. скв. в аварии — нужен ремонт`, go: 'gas:gwells', tab: 'gas' });
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
    const scroll = document.querySelector('.page')?.scrollTop; const mScroll = document.querySelector('.modal')?.scrollTop || 0;
    const keepSel = ['.subtabs', '.scheme-wrap', '.tscroll', '.lb', '.chips.scroll', '.loglist', '.modal', '.sheet'];
    const kept = (ui.keepFor === ui.tab + '|' + (ui.sub[ui.tab] || '')) ? keepSel.map(sel => [...document.querySelectorAll(sel)].map(e => [e.scrollLeft, e.scrollTop])) : null;
    const subLeft = document.querySelector('.subtabs')?.scrollLeft;
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
              <div class="chip"><small>Место</small><b>№${s.rank}</b></div>
            </div>
          </header>
          ${subs ? (() => { const cur = sub(), grp = subGroup(); return `<div class="subtabs${grp || subs.some(x => x[2]) ? ' fit' : ''}">${subs.map(([id, n, ch]) => ch ? `<button class="${grp && grp[0] === id ? 'on' : ''} grpb" data-sub="${ui.subMem[ui.tab + ':' + id] && ch.some(c => c[0] === ui.subMem[ui.tab + ':' + id]) ? ui.subMem[ui.tab + ':' + id] : ch[0][0]}">${n}</button>` : `<button class="${cur === id ? 'on' : ''}" data-sub="${id}">${n}</button>`).join('')}</div>${grp ? `<div class="subtabs sub2">${grp[2].map(([id, n]) => `<button class="${cur === id ? 'on' : ''}" data-sub="${id}">${n}</button>`).join('')}</div>` : ''}`; })() : ''}
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
    if (ui.modalStay && mScroll) { const m = document.querySelector('.modal'); if (m) m.scrollTop = mScroll; }
    if (kept) keepSel.forEach((sel, i) => document.querySelectorAll(sel).forEach((e, j) => { const v = kept[i][j]; if (v) { e.scrollLeft = v[0]; e.scrollTop = v[1]; } }));
    else { const st = document.querySelector('.subtabs'); if (st) { if (subLeft != null && ui.lastTabForSub === ui.tab) st.scrollLeft = subLeft; const on = st.querySelector('.on'); if (on && (on.offsetLeft < st.scrollLeft || on.offsetLeft + on.offsetWidth > st.scrollLeft + st.clientWidth)) st.scrollLeft = on.offsetLeft - 12; } }
    ui.keepFor = ui.tab + '|' + (ui.sub[ui.tab] || ''); ui.lastTabForSub = ui.tab;
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
  function shake() { const f = document.createElement('div'); f.className = 'alarmflash'; document.body.appendChild(f); setTimeout(() => f.remove(), 1300); }
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
      case 'home': return vHome(); case 'prod': return vProd(); case 'ckppn': return vCkppn(); case 'gas': return vGasTab(); case 'npz': return vNpz(); case 'soc': return vSoc(); case 'fleet': return vFleet(); case 'azs': return vAzs(); case 'shares': return vShares(); case 'sales': return vSales();
      case 'staff': return vStaff(); case 'build': return vBuild(); case 'stock': return vStock(); case 'energy': return vEnergy();
      case 'bank': return vBank(); case 'hse': return vHse(); case 'kpi': return vKpi();
      case 'fin': return vFin(); case 'rating': return vRating(); case 'tech': return vTech(); case 'events': return vEvents(); case 'settings': return vSettings();
    }
    return '';
  }

  /* ===================== Добыча: план / факт по годам ===================== */
  function yearsData() {
    const k = E.kpi(s), Y = {};
    for (const h of s.history) { const y = +h.m.slice(0, 4), m = +h.m.slice(5, 7) - 1; const r = Y[y] || (Y[y] = { y, plan: 0, fact: 0, rev: 0, net: 0, mp: Array(12).fill(null), mf: Array(12).fill(null), full: 0 });
      r.plan += h.plan || 0; r.fact += h.fact || 0; r.rev += h.rev || 0; r.net += h.net || 0; r.mp[m] = h.plan || 0; r.mf[m] = h.fact || 0; r.full++; }
    // текущий год: закрытые месяцы + текущий месяц на дату
    const cy = Y[k.y] || (Y[k.y] = { y: k.y, plan: 0, fact: 0, rev: 0, net: 0, mp: Array(12).fill(null), mf: Array(12).fill(null), full: 0 });
    cy.cur = true; cy.plan += k.planToDateMonth || 0; cy.fact += k.factMonth || 0; cy.mp[k.m - 1] = k.planToDateMonth || 0; cy.mf[k.m - 1] = k.factMonth || 0;
    cy.planYear = k.planYear;
    // точные данные по цехам (без округления истории), где они сохранились
    const sm = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
    for (const r of Object.values(Y)) { const PF = s.pf && s.pf[r.y]; if (!PF) continue;
      for (let m = 0; m < 12; m++) if (r.mf[m] != null) { r.mf[m] = sm(PF.fact[m]); r.mp[m] = r.cur && m === k.m - 1 ? r.mp[m] : sm(PF.plan[m]); }
      r.fact = r.mf.reduce((a, v) => a + (v || 0), 0); r.plan = r.mp.reduce((a, v) => a + (v || 0), 0); }
    return Object.values(Y).sort((a, b) => a.y - b.y);
  }
  function vYears() {
    const Ys = yearsData(), k = E.kpi(s);
    if (!Ys.length) return '<p class="hint">Пока нет данных.</p>';
    const ys = Ys.map(r => r.y);
    let A = ui.yA && ys.includes(ui.yA) ? ui.yA : ys[ys.length - 1], B = ui.yB && ys.includes(ui.yB) ? ui.yB : (ys.length > 1 ? ys[ys.length - 2] : A);
    const rA = Ys.find(r => r.y === A), rB = Ys.find(r => r.y === B);
    const best = Ys.filter(r => !r.cur && r.full === 12).sort((a, b) => b.fact - a.fact)[0];
    const lv = r => r.plan ? (r.fact / r.plan >= 1 ? 'tgood' : r.fact / r.plan >= 0.95 ? 'twarn' : 'tbad') : '';
    const table = `<div class="tscroll"><table class="tbl yrs"><thead><tr><th>Год</th><th>План, т</th><th>Факт, т</th><th>%</th><th>Откл., т</th><th>Чистая прибыль</th></tr></thead><tbody>${Ys.slice().reverse().map(r => `<tr${r.y === A || r.y === B ? ' class="sel"' : ''}><td><b>${r.y}</b>${r.cur ? ' <small>(на дату)</small>' : r.full < 12 ? ` <small>(${r.full} мес)</small>` : ''}${best && best.y === r.y ? ' 🏆' : ''}</td><td>${num(r.plan)}</td><td>${num(r.fact)}</td><td class="${lv(r)}">${r.plan ? pct(r.fact / r.plan) : '—'}</td><td class="${lv(r)}">${r.fact - r.plan >= 0 ? '+' : ''}${num(r.fact - r.plan)}</td><td class="${r.net < 0 ? 'tbad' : ''}">${money(r.net)}</td></tr>`).join('')}</tbody></table></div>`;
    const yChart = G.bars({ labels: Ys.map(r => String(r.y)), series: [{ name: 'План', color: C.plan, values: Ys.map(r => r.plan), outline: true }, { name: 'Факт', color: (v, i) => !Ys[i].plan ? C.blue : v >= Ys[i].plan ? C.aqua : v >= Ys[i].plan * 0.95 ? C.yellow : C.red, values: Ys.map(r => r.fact) }], height: 200, unit: 'т', extraTip: i => Ys[i].plan ? `Выполнение: ${pct(Ys[i].fact / Ys[i].plan)}` : '' });
    const sel = (key, v) => `<select data-change="${key}">${ys.slice().reverse().map(y => `<option value="${y}"${y === v ? ' selected' : ''}>${y}</option>`).join('')}</select>`;
    const cmp = G.bars({ labels: MON, series: [{ name: `План ${A}`, color: C.plan, values: rA.mp.map(v => v || 0), outline: true }, { name: `Факт ${A}`, color: C.aqua, values: rA.mf.map(v => v || 0) }, { name: `Факт ${B}`, color: C.orange, values: rB.mf.map(v => v || 0) }], height: 220, unit: 'т' });
    const mrows = MON.map((mn, i) => { const fa = rA.mf[i], fb = rB.mf[i], pa = rA.mp[i]; if (fa == null && fb == null) return '';
      const d = fa != null && fb != null ? fa - fb : null;
      return `<tr><td>${mn}</td><td>${pa != null ? num(pa) : '—'}</td><td class="${pa ? (fa >= pa ? 'tgood' : fa >= pa * 0.95 ? 'twarn' : 'tbad') : ''}">${fa != null ? num(fa) : '—'}</td><td>${fb != null ? num(fb) : '—'}</td><td class="${d == null ? '' : d >= 0 ? 'tgood' : 'tbad'}">${d == null ? '—' : (d >= 0 ? '+' : '') + num(d)}</td></tr>`; }).join('');
    // сравнение за одинаковый период: только месяцы, где есть факт в обоих годах
    const mm = MON.map((_, i) => i).filter(i => rA.mf[i] != null && rB.mf[i] != null);
    const per = mm.length === 12 ? 'за год' : mm.length ? `за ${MON[mm[0]]}–${MON[mm[mm.length - 1]]}` : '';
    const sF = r => sum(mm, i => r.mf[i] || 0), sP = r => sum(mm, i => r.mp[i] || 0);
    const tot = r => `${num(sF(r))} т${sP(r) ? ' · ' + pct(sF(r) / sP(r)) + ' плана' : ''}`;
    return `<div class="kpis">
        ${kpiTile('Лет в истории', num(Ys.length), `с ${Ys[0].y} года`, '')}
        ${kpiTile('Всего добыто', num(sum(Ys, r => r.fact)) + ' <small>т</small>', `план ${num(sum(Ys, r => r.plan))} т`, '')}
        ${kpiTile('Лучший год', best ? String(best.y) : '—', best ? `${num(best.fact)} т · ${pct(best.fact / (best.plan || 1))} плана` : 'нет полного года', best ? 'good' : '')}
        ${kpiTile('Выполнение за всё время', pct(sum(Ys, r => r.fact) / Math.max(1, sum(Ys, r => r.plan))), 'факт к плану на дату', lvl(sum(Ys, r => r.fact) / Math.max(1, sum(Ys, r => r.plan)), 1, 0.95))}
      </div>
      <div class="grid2">${card('План / факт по годам, т', yChart)}${card('Итоги по годам', table)}</div>
      ${card('Сравнение двух лет по месяцам', `<div class="ycmp"><label>Год А ${sel('yA', A)}</label><label>Год Б ${sel('yB', B)}</label></div>
        <div class="kv3"><div><span>${A} ${per}</span><b>${tot(rA)}</b></div><div><span>${B} ${per}</span><b>${tot(rB)}</b></div><div><span>Разница А − Б</span><b class="${sF(rA) - sF(rB) >= 0 ? 'tgood' : 'tbad'}">${sF(rA) - sF(rB) >= 0 ? '+' : ''}${num(sF(rA) - sF(rB))} т</b></div></div><p class="hint">Сравнение ${per} — одинаковые месяцы в обоих годах.</p>
        ${cmp}
        <div class="tscroll"><table class="tbl"><thead><tr><th>Мес</th><th>План ${A}</th><th>Факт ${A}</th><th>Факт ${B}</th><th>А − Б</th></tr></thead><tbody>${mrows}</tbody></table></div>
        ${rA.cur || rB.cur ? '<p class="hint">Текущий год — по сегодняшний день, текущий месяц — план на дату.</p>' : ''}`)}`;
  }

  /* ===================== Ход работ (для Сводки) ===================== */
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // раскрывающаяся группа: заголовок-кнопка, содержимое только когда открыта
  const grpOpen = k => (ui.grp || {})[k];
  const group = (k, title, meta, body, warn) => `<div class="grp ${grpOpen(k) ? 'open' : ''}"><button class="grp-h ${warn ? 'warn' : ''}" data-act="grp" data-arg="${esc(k)}"><span class="grp-a">${grpOpen(k) ? '▾' : '▸'}</span><b>${title}</b><span class="grp-m">${meta}</span></button>${grpOpen(k) ? `<div class="grp-b">${body}</div>` : ''}</div>`;
  // сегментная шкала из 10 ламп
  const segBar = (v, c) => { const n = Math.round(clamp01(v) * 10); return `<div class="segbar ${c}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`; };
  // куда вести по нажатию на работу
  const facGo = f => D.BUILD[f.type] && (D.BUILD[f.type].ptank || ['npz', 'npz_vac', 'npz_ref', 'npz_hdo', 'npz_fcc', 'npz_bit'].includes(f.type)) ? 'npz:units' : f.type === 'azs' ? 'azs:st' : ['dorm', 'canteen', 'banya', 'club'].includes(f.type) ? 'soc:dorm' : 'ckppn:equip';
  function worksList() {
    const W = [], wellName = id => { const w = s.wells.find(x => x.id === id); return w ? w.name : 'скважина'; };
    const add = (ico, title, sub, left, total, go, st) => W.push({ ico, title, sub, left: Math.max(0, left), p: total > 0 ? clamp01(1 - left / total) : 0, go, st });
    for (const p of s.projects) add(p.kind === 'build' ? 'build' : 'tech', p.title, p.contractor, p.daysLeft, p.daysTotal || p.daysLeft || 1, 'build:projects', p.daysLeft <= 0 ? 'pay' : p.delay > 2 ? 'late' : '');
    for (const r of s.repairs) add('prod', 'ПРС: ' + wellName(r.well), 'бригада ПРС', r.days, r.d0 || 3, 'prod:wells', '');
    for (const f of s.fac) {
      if (f.status === 'service' && f.serviceDays > 0) add('tech', f.name, f.fixKind === 'kr' ? 'капремонт' : f.fixKind ? 'ремонт' : D.BUILD[f.type].tank ? 'работы на резервуаре' : 'обслуживание', f.serviceDays, f.serviceD0 || Math.max(f.serviceDays, 1), D.BUILD[f.type].tank ? 'ckppn:tanks' : facGo(f), '');
      if (f.regen > 0) add('npz', f.name, 'регенерация катализатора', f.regen, 8, 'npz:units', '');
    }
    for (const o of s.orders) { const m = D.MATERIALS.find(x => x.key === o.key); add('stock', 'Поставка: ' + (m ? m.name : o.key), `${num(o.qty)} ${m ? m.unit : ''}`, o.days, o.d0 || Math.max(o.days, 7), 'stock', ''); }
    if (s.fleet) for (const c of s.fleet.cars) if (c.status === 'repair') add('truck', c.name, c.down0 === 1 ? 'ТО-2' : 'ремонт в мастерской', c.down, c.down0 || 3, 'fleet:cars', '');
    return W.sort((a, b) => (b.st === 'pay') - (a.st === 'pay') || a.left - b.left);
  }
  function worksCard() {
    const W = worksList(); if (!W.length) return '';
    const open = ui.worksOpen, show = open ? W : W.slice(0, 4);
    const day = d => { const x = new Date(Date.parse(E.iso(s.day)) + Math.ceil(d) * 864e5); return x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
    return `<section class="card works"><div class="c-h"><h3>Ход работ</h3><span class="wk-n">${W.length} в работе · ${W.filter(w => w.left <= 1).length} завершатся завтра</span></div>
      <div class="wk-list">${show.map(w => `<button class="wk ${w.st}" data-go="${w.go}">${G.icon(w.ico)}<div class="wk-b"><div class="wk-t"><b>${esc(w.title)}</b><span>${w.st === 'pay' ? 'ожидает оплаты' : w.left <= 0.01 ? 'сегодня' : `${Math.ceil(w.left)} дн · ${day(w.left)}`}</span></div>
        <div class="wk-bar"><i style="width:${(w.p * 100).toFixed(1)}%"></i>${[25, 50, 75].map(x => `<em style="left:${x}%"></em>`).join('')}</div><small>${esc(w.sub)} · ${Math.round(w.p * 100)}%${w.st === 'late' ? ' · <span class="tbad">задержка</span>' : ''}</small></div></button>`).join('')}</div>
      ${W.length > 4 ? `<button class="link" data-act="worksOpen">${open ? 'Свернуть' : `Ещё ${W.length - 4} →`}</button>` : ''}</section>`;
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
    return `${worksCard()}
      <div class="hero">
        <div><h1>${esc(s.company.name)}</h1><p>Месторождение ${esc(s.company.field)} · ${s.cdngs.length} ЦДНГ · ${s.wells.length} скважин · ${k.staff} работников</p></div>
        <div class="odorow"><div class="odobox"><small>Добыто с начала, т</small>${G.odometer(sum(s.history, h => h.fact || 0) + (k.factMonth || 0), 8, 'cum', 1)}</div><div class="odobox"><small>Нефть за сутки, т</small>${G.odometer((t.oil || 0) * 10, 7, 'day', 1)}</div><div class="odobox ship"><small>Отгружено сегодня, т</small>${G.odometer((t.ship || 0) * 10, 7, 'ship', 1)}${(() => { const cap = (t.cap && t.cap.ship) || 0, r = cap ? (t.ship || 0) / cap : 0; return `<div class="shipind"><div class="shipbar ${r > 0.95 ? 'bad' : r > 0.01 ? 'good' : 'warn'}"><span style="width:${(Math.min(1, r) * 100).toFixed(1)}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div><small>${cap ? 'насосы загружены на ' + pct(r) + ' из ' + num(cap) + ' т/сут' : 'нет насосов отгрузки'}</small></div>`; })()}</div></div>
        <div class="hero-g">
          ${G.linear({ value: mPct * 100, min: 70, max: 120, marker: 100, ticks: [70, 85, 100, 120], unit: '%', bands: [{ to: 95, color: C.red }, { to: 100, color: C.yellow }, { to: 120, color: C.aqua }], text: pct(mPct), label: 'План месяца (на дату)', sub: `факт ${num(k.factMonth)} т из ${num(k.planToDateMonth)} т` })}
          ${G.linear({ value: s.trust, min: 0, max: 100, ticks: [0, 30, 55, 100], bands: [{ to: 30, color: C.red }, { to: 55, color: C.yellow }, { to: 100, color: C.aqua }], text: num(s.trust) + ' / 100', label: 'Доверие совета', sub: s.trust < 30 ? 'риск отставки' : s.trust < 55 ? 'совет недоволен' : 'совет доволен' })}
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
      <button class="kpi lnk ${!g || g.util >= 0.8 ? 'good' : g.util >= 0.4 ? 'warn' : 'bad'}" data-go="gas:mks"><div class="k-l">Утилизация ПНГ</div><div class="k-v">${g ? pct(g.util) : '—'}</div><div class="k-s">на факел ${g ? num(g.flare) : 0} м³/сут</div></button>
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
      ${nest(G.pumpjack({ running: work > 0 && (t.k > 0.01 || !s.daily.length), fail: fails, w: 92, h: 64 }), 8, 40)}
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
    if (sb === 'years') return vYears();
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
        ${kpiTile(`План ${k.y} г.`, `${num(k.planYear)} <small>т</small>`, (PF.prev ? 'на уровне прошлого года' : lvlName + ' уровень' + (PF.custom ? ' · свой' : '')) + ' · утверждён до 31 декабря', '', `<button class="small primary planbtn" data-act="planForm">Изменить план</button>`)}
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
      </tbody></table></div><p class="hint">Зелёный — план выполнен, жёлтый — отставание до 5%, красный — больше.</p>`)}
      <div class="cards3">${rows.map(r => card(esc(r.c.name), `
        <div class="row"><div>${G.pumpjack({ running: r.today > 0 || (!s.daily.length && r.status === 'work'), w: 70, h: 48 })}</div><div class="grow">
        <div class="kv"><span>Скважин</span><b>${r.pw.filter(w => w.status === 'work').length}/${r.pw.length} доб. · ${r.ws.length - r.pw.length} проч.</b></div>
        <div class="kv"><span>Добыча сегодня</span><b>${num(r.today, 1)} т/сут</b></div>
        <div class="kv"><span>План / факт года</span><b>${num(r.ap)} / ${num(r.af)} т</b></div>
        <div class="kv"><span>Загрузка цеха</span><b>${r.ws.length}/40</b></div>${bar(r.ws.length / 40, lvl(r.ws.length / 40, 0.8, 0.95, true))}</div></div>
        ${chiefBlock(r.c, E.lastCdReport(s, r.c.id))}`)).join('')}</div>
      ${s.cdReports.length ? `<div class="btnrow">${btn('Итоги прошлого месяца по цехам', 'viewReport', '', 'primary')}</div>` : ''}
      <p class="hint">К начальника влияет на добычу цеха и отказы. Замечание и выговор временно повышают К, но снижают лояльность.</p>`;
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
    const head = w => w.type === 'sk' ? G.pumpjack({ running: w.status === 'work' && (w.today > 0 || !s.daily.length), fail: w.status === 'fail', w: 64, h: 44 }) : w.type === 'ecn' ? G.ecnHead({ running: w.status === 'work' && (w.today > 0 || !s.daily.length), fail: w.status === 'fail', w: 64, h: 44 }) : G.injHead({ running: w.status === 'work', fail: w.status === 'fail', w: 64, h: 44 });
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
      <p class="hint">ПРС своими силами: свободная бригада и материалы со склада.</p>`;
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
        <p class="hint">Закачка меньше отбора — давление падает, больше — растёт. Ниже 80% падают дебиты, выше 105% растёт обводнённость.</p>
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
    return `${card('Технологическая схема подготовки нефти', `<div class="swipe-hint">← листайте схему →</div><div class="scheme-wrap big">${scheme()}</div><p class="hint">Скважины → АГЗУ → УПСВ → техн. РВС → печи → отстойники → товарные РВС → перекачка. Вода → БКНС → пласт.</p>`)}
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
            <div class="vrow">${valveBtn(s.ckppnSet.wash, 'ckwash', '', 'ckwash', 'Пресная вода')}<small>Промывка пресной водой (обессоливание, −55% солей)</small></div></div></div>
          <div id="qprev" class="qprev">${qBox(q)}</div>
          <div class="kv3"><div><span>Подогрев, в сутки</span><b>${money(heatCost)}</b></div><div><span>Реагент, в сутки</span><b>${money(reagCost)}</b></div><div><span>Деэмульгатор на складе</span><b class="${s.stock.demulg < 300 ? 'tbad' : ''}">${num(s.stock.demulg)} кг</b></div></div>`)}
        ${card('Требования к товарной нефти', `<div class="tscroll"><table class="tbl"><thead><tr><th>Группа</th><th>Вода, %</th><th>Соли, мг/дм³</th><th>Цена</th></tr></thead><tbody>
          <tr class="${k.quality.group === 1 ? 'hl' : ''}"><td>I</td><td>≤ 0,5</td><td>≤ 100</td><td>100%</td></tr>
          <tr class="${k.quality.group === 2 ? 'hl' : ''}"><td>II</td><td>≤ 0,5</td><td>≤ 300</td><td>−1,5%</td></tr>
          <tr class="${k.quality.group === 3 ? 'hl' : ''}"><td>III</td><td>≤ 1,0</td><td>≤ 900</td><td>−4%</td></tr>
          <tr class="${k.quality.group === 4 ? 'hl' : ''}"><td>Некондиция</td><td>&gt; 1,0</td><td>&gt; 900</td><td>не принимается</td></tr></tbody></table></div>
          <p class="hint">Качество растёт с температурой и реагентом, падает при перегрузке и износе.</p>`)}
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
      <p class="hint">Без ингибитора РВС ржавеют быстрее. Износ ниже 35% — риск разгерметизации и пожара.</p>`;
  }
  function vEquip() {
    const list = s.fac.filter(f => !D.BUILD[f.type].tank);
    return card('Оборудование и объекты', `<div class="eqlist">
      ${list.map(f => { const B = D.BUILD[f.type]; return `<div class="eq ${f.status}"><div class="eq-t"><b>${esc(f.name)}</b>${f.status === 'ok' ? pill('в работе', 'good') : f.status === 'fail' ? pill('авария', 'bad') : pill('обслуживание', 'warn')}</div>
        ${G.plate({ id: f.id, type: B.name, spec: B.kw ? B.kw + ' кВт' : '' })}${f.status !== 'ok' ? G.danger('НЕ ВКЛЮЧАТЬ! РАБОТАЮТ ЛЮДИ', f.status === 'fail' ? 'авария — нужен ремонт' : 'обслуживание') : ''}
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
      ${card('Спотовая продажа (автоналив)', `<p class="hint">Продажа без договора: дисконт 20%, до 400 т/сут.</p><div class="btnrow">${btn('Продать 100 т', 'spot', 100)}${btn('Продать 400 т', 'spot', 400)}${btn('Другой объём…', 'spotForm')}</div>`)}
      ${s.contracts.filter(c => c.status !== 'active').length ? card('Архив договоров', `<div class="tscroll"><table class="tbl"><thead><tr><th>№</th><th>Покупатель</th><th>Отгружено</th><th>Статус</th></tr></thead><tbody>${s.contracts.filter(c => c.status !== 'active').slice(-15).reverse().map(c => `<tr><td>${c.id}</td><td>${esc(c.buyer)}</td><td>${num(c.shippedTotal)} т</td><td>${c.status === 'done' ? 'исполнен' : 'расторгнут'}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
  }
  function vOffers() {
    const q = s.quality.group;
    return `${card('Предложения покупателей', `<p class="hint">Новые предложения — в начале месяца. Недопоставка больше 5% — неустойка.</p>
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
    return `<div class="kpis">${kpiTile('Brent сегодня', `$${num(s.market.brent, 2)}`, 'за баррель', '')}${kpiTile('Курс', `${num(s.market.fx, 2)} ₸/$`, '', '')}${kpiTile('Цена тонны (Brent)', `${num(E.oilPriceT(s, 0))} ₸`, `${E.BBL} барр./т`, '')}${kpiTile('Индекс цен (инфляция)', `×${num(s.priceIndex, 2)}`, 'к старту игры', '')}</div>
      <div class="grid2">${card('Brent за год, $/барр.', G.line({ labels: lab, series: [{ name: 'Brent', color: C.yellow, values: d.map(x => x.brent), area: true }], height: 190, zero: false, unit: '$' }))}
      ${card('Курс тенге за год, ₸/$', G.line({ labels: lab, series: [{ name: 'Курс', color: C.violet, values: d.map(x => x.fx) }], height: 190, zero: false, unit: '₸' }))}</div>
      ${card('История средних цен по месяцам', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Brent, $', color: C.yellow, values: h.map(x => x.brent) }], height: 170, unit: '$', empty: 'Появится после первого месяца' }))}
      <p class="hint">${s.market.mode === 'history' ? 'Режим «История»: цены повторяют реальную динамику рынка.' : 'Режим «Случайный рынок»: цены случайны.'}</p>`;
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
    const ppl = s.people.filter(isUp); const n = ppl.length || 1;
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
    return `${dsStaffNote()}<div class="kpis">
      ${kpiTile('Численность промысла', `${ppl.length} чел.`, `возраст ${num(ages.reduce((a, b) => a + b, 0) / n, 1)} · стаж ${ym2(ppl.reduce((a, p) => a + E.tenure(s, p), 0) / n)}`, '')}
      ${kpiTile('Средняя зарплата', money(ppl.reduce((a, p) => a + E.personSalary(s, p).total, 0) / n), `квалификация К ${num(ppl.reduce((a, p) => a + p.skill, 0) / n, 2)}`, '')}
      ${kpiTile('Предпенсионеры', `${pre} чел.`, `на пенсию в этом году: ${yearEnd}`, pre ? 'warn' : '')}
      ${kpiTile('Настроение', `${num(ppl.reduce((a, p) => a + p.mood, 0) / n)}%`, `недовольных: ${ppl.filter(p => p.mood < 40).length}`, ppl.filter(p => p.mood < 40).length ? 'warn' : '')}
    </div>
    ${card('Возрастная структура', `<div class="agerow">${groups.map(g => { const c = ages.filter(a => a >= g[1] && a < g[2]).length; return `<div><b>${c}</b><i style="height:${Math.max(3, Math.round(c / Math.max(1, ...groups.map(G2 => ages.filter(a => a >= G2[1] && a < G2[2]).length)) * 46))}px"></i><small>${g[0]}</small></div>`; }).join('')}</div>`)}
    <div class="toolbar"><div class="chips scroll">${[['all', 'Все'], ['pre', 'Предпенсионеры'], ['young', 'Молодёжь'], ['sad', 'Недовольные']].map(([id, nm]) => `<button class="fchip ${f === id ? 'on' : ''}" data-act="pf" data-arg="${id}">${nm}</button>`).join('')}</div>
      <div class="row"><label class="sel"><select data-change="pfd"><option value="">Подразделение…</option>${Object.entries(D.DEPTS).filter(([k]) => !DS_DEPTS.includes(k)).map(([k, v]) => `<option value="d:${k}" ${f === 'd:' + k ? 'selected' : ''}>${v}</option>`).join('')}${UP_ROLES().map(r => `<option value="r:${r.key}" ${f === 'r:' + r.key ? 'selected' : ''}>· ${r.name}</option>`).join('')}</select></label>
      <label class="sel"><select data-change="ps">${[['name', 'по ФИО'], ['age', 'по возрасту'], ['tenure', 'по стажу'], ['pension', 'до пенсии'], ['skill', 'по эффективности'], ['salary', 'по зарплате']].map(([v, nm]) => `<option value="${v}" ${srt === v ? 'selected' : ''}>${nm}</option>`).join('')}</select></label></div></div>
    ${(() => { const pRow = p => { const sal = E.personSalary(s, p); const c = p.cdng && s.cdngs.find(x => x.id === p.cdng); return `<button class="prow" data-act="personCard" data-arg="${p.id}">${pFace(p, 38)}
      <div class="pr-b"><div class="pr-t"><b>${esc(p.name)}</b><span class="pk ${p.skill >= 1 ? 'good' : p.skill >= 0.8 ? 'warn' : 'bad'}">К ${p.skill.toFixed(2)}</span></div>
        <small>${esc(ROLE(p.role).name)}${c ? ' · ' + esc(c.name) : ''}</small>
        <small class="pr-m">${yrs(E.personAge(s, p))} · стаж ${ym2(E.tenure(s, p))} · ${p.grade} разр. · ${money(sal.total)}${p.mood < 40 ? ' · <span class="tbad">недоволен</span>' : ''}${E.yearsToPension(s, p) < 2 ? ' · <span class="twarn">предпенсионер</span>' : ''}</small></div></button>`; };
      const deps = Object.keys(D.DEPTS).filter(d => list.some(p => ROLE(p.role).dept === d));
      if (!list.length) return '<div class="empty">Никого по фильтру</div>';
      return `<div class="grp-tools"><small>${list.length} чел. в ${deps.length} подразделениях</small>${btn(deps.every(d => grpOpen('p:' + d)) ? 'Свернуть все' : 'Раскрыть все', 'grpAll', deps.map(d => 'p:' + d).join(','), 'small ghost')}</div><div class="plist">${deps.map(d => { const ps = list.filter(p => ROLE(p.role).dept === d), sad = ps.filter(p => p.mood < 40).length, pre2 = ps.filter(p => E.yearsToPension(s, p) < 2).length, kk = ps.reduce((a, p) => a + p.skill, 0) / ps.length;
        return group('p:' + d, esc(D.DEPTS[d]), `${ps.length} чел · К ${kk.toFixed(2)}${sad ? ` · <span class="tbad">недовольных ${sad}</span>` : ''}${pre2 ? ` · <span class="twarn">предпенс. ${pre2}</span>` : ''}`, ps.map(pRow).join(''), sad); }).join('')}</div>`; })()}
    <p class="hint">Нажмите на сотрудника — откроется карточка. К растёт с опытом и обучением.</p>`;
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
  // общий «Персонал» — только промысел (добыча и службы); штат НПЗ и АЗС — в их вкладках «Обеспечение → Персонал»
  const DS_DEPTS = ['npz', 'retail'], UP_ROLES = () => D.ROLES.filter(r => !DS_DEPTS.includes(r.dept)), isUp = p => !DS_DEPTS.includes(ROLE(p.role).dept);
  function dsStaffNote() {
    const hn = E.facs(s, 'npz').length, ha = E.facs(s, 'azs').length; if (!hn && !ha) return '';
    const cnt = d => s.people.filter(p => ROLE(p.role).dept === d).length;
    return `<div class="dsnote">${hn ? `<button class="dsl" data-act="goStaffDs" data-arg="npz"><b>Персонал НПЗ</b><small>${cnt('npz')} чел. →</small></button>` : ''}${ha ? `<button class="dsl" data-act="goStaffDs" data-arg="azs"><b>Персонал АЗС</b><small>${cnt('retail')} чел. →</small></button>` : ''}</div>`;
  }
  function vStaff() {
    if (sub() === 'people') return vPeople();
    const k = E.kpi(s); const need = Object.fromEntries(Object.entries(k.cov.need).filter(([r]) => !DS_DEPTS.includes(ROLE(r).dept)));
    const payroll = UP_ROLES().reduce((a, r) => a + s.staff[r.key].n * r.salary * s.staff[r.key].pct / 100 * idx(), 0);
    const depts = Object.entries(D.DEPTS).filter(([dk]) => !DS_DEPTS.includes(dk)), upN = s.people.filter(isUp).length;
    return `
      <div class="kpis">
        <div class="kpi">${G.moodFace({ value: s.morale, min: 0, max: 100, bands: [{ to: 40, color: C.red }, { to: 60, color: C.yellow }, { to: 100, color: C.aqua }], text: num(s.morale) + '%', label: 'Мораль коллектива' })}</div>
        ${kpiTile('Численность промысла', `${upN} чел.`, `требуется ${Object.values(need).reduce((a, b) => a + b, 0)}`, '')}
        ${kpiTile('ФОТ в месяц', money(payroll), `+ соц. налог ${money(payroll * 0.11)}`, '')}
        ${kpiTile('В подборе', `${s.hires.filter(h => !DS_DEPTS.includes(ROLE(h.role).dept)).reduce((a, h) => a + h.n, 0)} чел.`, s.hires.length ? `ближайший выход через ${Math.min(...s.hires.map(h => h.days))} дн.` : 'нет заявок', '')}
      </div>
      ${dsStaffNote()}
      ${card('Укомплектованность подразделений', `<div class="depts">${depts.map(([dk, n]) => `<div class="dept"><span>${n}</span>${bar(k.cov.dept[dk], lvl(k.cov.dept[dk], 0.95, 0.75))}<b>${pct(k.cov.dept[dk])}</b></div>`).join('')}</div>
        <p class="hint">Нехватка людей снижает добычу, ремонты и качество, повышает риск штрафов.</p>`)}
      ${card('Штатное расписание', `<div class="btnrow s">${btn('Всем оклад 100%', 'salAll', 100, 'small')}${btn('Всем 110%', 'salAll', 110, 'small')}${btn('Всем 125%', 'salAll', 125, 'small')}${btn('Нанять по потребности', 'hireNeed', '', 'small primary')}</div>
        <div class="roles">${UP_ROLES().map(r => {
          const st = s.staff[r.key], nd = need[r.key], hire = s.hires.filter(h => h.role === r.key).reduce((a, h) => a + h.n, 0);
          const c = nd ? st.n / nd : 1;
          return `<div class="role"><div class="r-t"><b>${esc(r.name)}</b><small>${esc(D.DEPTS[r.dept])}</small></div>
            <div class="r-n"><b class="${c < 0.85 ? 'tbad' : c < 1 ? 'twarn' : 'tgood'}">${st.n}</b><small>/ ${nd}${hire ? ` (+${hire})` : ''}</small></div>
            <div class="r-s"><small>Оклад</small><b>${num(r.salary * st.pct / 100 * idx())} ₸</b><select data-change="sal" data-role="${r.key}">${[80, 90, 100, 110, 120, 135, 150].map(v => `<option value="${v}" ${st.pct === v ? 'selected' : ''}>${v}%</option>`).join('')}${[80, 90, 100, 110, 120, 135, 150].includes(st.pct) ? '' : `<option selected>${st.pct}%</option>`}</select></div>
            <div class="r-a">${btn('Люди', 'roleList', r.key, 'small')}${btn('+ Нанять', 'hire', r.key, 'small primary')}${btn('Уволить', 'fire', r.key, 'small ghost', st.n < 1)}</div></div>`;
        }).join('')}</div>`)}
      <p class="hint">Мораль зависит от зарплаты, нагрузки и СИЗ. Ниже 40% — риск забастовки.</p>`;
  }

  /* ===================== ПОДРЯД И СТРОЙКА ===================== */
  const CAT_GROUPS = [['Бурение', ['well_sk', 'well_ecn', 'well_inj', 'well_water']], ['Сбор и подготовка', ['agzu', 'upsv', 'ckppn', 'bkns', 'pump_ext', 'gascomp', 'gfu', 'lpg_tank', 'cdng']], ['Резервуары', ['tank1000', 'tank2000', 'tank5000', 'tank10000']], ['Энергетика', ['substation', 'dgu', 'gtes', 'ses']]];
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
      <p class="hint">Аванс 25%, остальное — при сдаче. Дешёвый подрядчик — риск задержек.</p>`;
  }
  function catIcon(key) {
    if (key === 'well_sk') return G.pumpjack({ running: true, w: 56, h: 40 });
    if (key === 'well_ecn') return G.ecnHead({ running: true, w: 56, h: 40 });
    if (key === 'well_inj' || key === 'well_water') return G.injHead({ running: true, w: 56, h: 40 });
    if (key.startsWith('tank')) return G.tank({ v: 60, c: 100, purpose: 'oil', w: 50, h: 46, id: 'c' + key });
    if (key === 'ckppn') return G.furnace({ w: 46, h: 46 });
    return `<div class="cico">${G.icon({ agzu: 'prod', upsv: 'ckppn', bkns: 'drop', pump_ext: 'sales', gascomp: 'gas', uppg: 'gas', well_gas: 'gas', npz: 'npz', npz_ref: 'npz', npz_rvs: 'ckppn', npz_rvs10: 'ckppn', dorm: 'dorm', canteen: 'dorm', banya: 'dorm', club: 'dorm', azs: 'azs', cdng: 'home', substation: 'energy', dgu: 'energy', gtes: 'energy', ses: 'energy' }[key] || 'build')}</div>`;
  }
  function vServices() {
    return card('Подрядные услуги', `<div class="catalog">${Object.entries(D.SERVICES).map(([key, S]) => {
      const locked = S.tech && !E.has(s, S.tech);
      const target = ['prs', 'krs', 'grp', 'opz'].includes(key) ? 'скважина' : ['anticor', 'clean'].includes(key) ? 'резервуар' : 'месторождение';
      return `<div class="cat ${locked ? 'locked' : ''}"><div class="cat-ic"><div class="cico">${G.icon(key === 'seismic' ? 'rating' : key === 'anticor' || key === 'clean' ? 'stock' : 'prod')}</div></div><div class="cat-b"><b>${esc(S.name)}</b><small>${esc(S.desc)}</small><div class="cat-m"><span>≈ ${money(S.cost * idx())}</span><span>${S.days} дн.</span><span>объект: ${target}</span></div></div>
        ${locked ? '<div class="lock">🔒 технология</div>' : key === 'seismic' ? btn('Тендер', 'tender', key, 'small primary') : btn('Выбрать', 'svcPick', key, 'small primary')}</div>`;
    }).join('')}</div><p class="hint">Аванс 50%. КРС, ОПЗ и ГРП повышают дебит; зачистка и антикор продлевают жизнь РВС.</p>`);
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
    const groups = [...new Set(D.MATERIALS.filter(m => m.group !== 'НПЗ и АЗС').map(m => m.group))];
    const val = D.MATERIALS.filter(m => m.group !== 'НПЗ и АЗС').reduce((a, m) => a + s.stock[m.key] * E.matPrice(s, m.key), 0);
    return `<div class="kpis">${kpiTile('Стоимость запасов', money(val), '', '')}${kpiTile('В пути', `${s.orders.length} поставок`, s.orders.length ? `ближайшая через ${Math.max(1, Math.ceil(Math.min(...s.orders.map(o => o.days))))} дн.` : '', '')}${kpiTile('Срок поставки', `${E.leadTime(s)} дн.`, 'зависит от службы МТС', '')}
      <div class="kpi"><div class="k-l">Автозакупка</div><div class="k-v">${btn(s.auto.buy ? 'Включена' : 'Выключена', 'toggle', 'buy', s.auto.buy ? 'on' : '')}</div><div class="k-s">по понедельникам до 2× минимума</div></div></div>
      ${E.facs(s, 'npz').length || E.facs(s, 'azs').length ? `<p class="hint">У НПЗ и АЗС свои склады: ${E.facs(s, 'npz').length ? btn('Склад НПЗ', 'goStock', 'npz', 'small') : ''} ${E.facs(s, 'azs').length ? btn('Склад АЗС', 'goStock', 'azs', 'small') : ''}</p>` : ''}
      ${groups.map(g => card(g, `<div class="stock">${D.MATERIALS.filter(m => m.group === g).map(m => {
        const locked = m.tech && !E.has(s, m.tech); const st = s.stock[m.key];
        const scale = ['demulg', 'inhib', 'diesel'].includes(m.key) ? Math.max(1, s.wells.length / 13) : Math.max(1, s.wells.length / 20);
        const min = Math.round(m.min * scale); const r = st / Math.max(1, min * 2);
        const tr = s.orders.filter(o => o.key === m.key).reduce((a, o) => a + o.qty, 0);
        return `<div class="mat ${locked ? 'locked' : ''}"><div class="m-t"><b>${esc(m.name)}</b><small>${num(E.matPrice(s, m.key))} ₸ / ${m.unit}</small></div>
          <div class="m-q"><b class="${st < min * 0.5 ? 'tbad' : st < min ? 'twarn' : 'tgood'}">${num(st)}</b><small>${m.unit} · мин. ${num(min)}${tr ? ` · в пути ${num(tr)}` : ''}</small>${bar(r, st < min * 0.5 ? 'bad' : st < min ? 'warn' : 'good')}</div>
          <div class="m-a">${locked ? '<small>🔒 нужна технология</small>' : btn(`+${num(min)}`, 'buy', `${m.key}:${min}`, 'small') + btn('Купить…', 'buyForm', m.key, 'small primary')}</div></div>`;
      }).join('')}</div>`)).join('')}
      ${s.orders.length ? card('Поставки в пути', `<table class="tbl"><tbody>${s.orders.map(o => `<tr><td>${esc(E.matName(o.key))}</td><td>${num(o.qty)}</td><td>${Math.max(1, Math.ceil(o.days))} дн.</td></tr>`).join('')}</tbody></table>`) : ''}
      <p class="hint">Деэмульгатор — подготовка нефти, ингибитор — защита РВС, ДЭГ — осушка газа, НКТ/штанги/насосы — ремонты.</p>`;
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
      ${card('Источники', G.donut({ items: src.map(([n, k, c]) => ({ name: n, value: en.used[k] || 0, color: c })), center: num(en.demand), sub: 'кВт', unit: 'кВт' }) + `<div class="brig tumrow">${tumbler(s.auto.dgu, 'toggle', 'dgu', 'Дизель-генераторы')}<div><b>Дизель-генераторы в работе</b><small>${s.auto.dgu ? 'включены — подхватят нагрузку при нехватке сети' : 'выключены'} · склад ГСМ: ${num(s.stock.diesel)} л</small></div></div>${ownFuelRow()}`)}</div>
      ${card('Мощность и потребление, кВт (90 дней)', G.line({ labels: d.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Доступная мощность', color: C.aqua, values: d.map(x => x.eS) }, { name: 'Потребление (при полной загрузке)', color: C.orange, values: d.map(x => x.eD) }], height: 180, unit: 'кВт' }))}
      ${card('Энергообъекты', `<div class="tscroll"><table class="tbl"><tbody>${pf.map(f => `<tr><td><b>${esc(f.name)}</b></td><td>${num(f.cap)} кВт</td><td style="min-width:100px">${bar(f.health / 100)}</td><td>${f.status === 'ok' ? pill('в работе', 'good') : pill('авария', 'bad')}</td><td>${btn('ТО', 'maintain', f.id, 'small')}</td></tr>`).join('')}</tbody></table></div>
        <div class="btnrow">${btn('Подстанция +2000 кВт', 'tender', 'substation')}${btn('ДГУ 500 кВт', 'tender', 'dgu')}${E.has(s, 'gtes') ? btn('ГТЭС 4 МВт', 'tender', 'gtes') : ''}${E.has(s, 'ses') ? btn('СЭС 1 МВт', 'tender', 'ses') : ''}</div>
        <p class="hint">При дефиците мощности добыча снижается. При аварии на ЛЭП выручат ДГУ или ГТЭС.</p>`)}`;
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
      ${card('Отчёт о прибылях и убытках — текущий месяц', `<div class="tscroll"><table class="tbl pnl"><tbody>
        ${E.PNL.revenue.filter(c => cur[c]).map(c => row(c, cur[c])).join('')}${row('Итого доходы', rev, 'sum')}
        ${E.PNL.opex.filter(c => cur[c]).map(c => row(c, cur[c])).join('')}${row('Операционные расходы', -opex, 'sum')}
        ${[...E.PNL.taxes, ...E.PNL.interest].filter(c => cur[c]).map(c => row(c, cur[c])).join('')}
        ${row('Результат (без амортизации и КПН)', rev - opex - tax - intr, 'total')}</tbody></table></div>
        <p class="hint">Зарплата, налоги и проценты начисляются в конце месяца.</p>`)}
      ${h.length ? card('Помесячная отчётность', `<div class="tscroll"><table class="tbl"><thead><tr><th>Месяц</th><th>Добыча, т</th><th>План, т</th><th>Выручка</th><th>Затраты</th><th>Налоги</th><th>Аморт. и %</th><th>Приб.</th><th>Brent</th></tr></thead><tbody>${h.slice().reverse().map(x => `<tr><td>${ymRu(x.m)}</td><td>${num(x.fact)}</td><td>${num(x.plan)}</td><td>${money(x.rev)}</td><td>${money(x.opex)}</td><td>${money(x.taxes)}</td><td>${money((x.dep || 0) + (x.interest || 0))}</td><td class="${x.net >= 0 ? 'tgood' : 'tbad'}">${money(x.net)}</td><td>$${num(x.brent, 1)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Прибыль = выручка − затраты − налоги (вкл. КПН) − амортизация и проценты по кредитам.</p>`) : ''}`;
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
      <div class="btnrow">${btn('Взять кредит…', 'loanForm', '', 'primary')}</div><p class="hint">Платёж в конце месяца. Ставка зависит от рынка и доверия совета.</p>`)}
    <div class="seg">${[12, 36, 120].map(n => `<button class="${ui.finRange === n ? 'on' : ''}" data-act="finRange" data-arg="${n}">${n === 120 ? 'Всё' : n + ' мес.'}</button>`).join('')}</div>
    <div class="grid2">${card('Ставки по месяцам, %', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Базовая', color: C.violet, values: h.map(x => x.rate != null ? x.rate * 100 : null) }, { name: 'Депозит 12 мес.', color: C.aqua, values: h.map(x => x.rate != null ? Math.max(1, (x.rate + D.DEPOSITS.t12.spread) * 100) : null), dash: true }], height: 180, unit: '%', zero: false, empty: 'Появится после первого месяца' }))}
      ${card('Депозиты и долг', G.line({ labels: h.map(x => ymRu(x.m)), series: [{ name: 'Депозиты', color: C.aqua, values: h.map(x => x.deps ?? x.dep ?? null), area: true }, { name: 'Долг', color: C.red, values: h.map(x => x.debt ?? null) }], height: 180, unit: '₸', empty: 'Появится после первого месяца' }))}</div>
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
        <p class="hint">Пять параметров по 20%. 1-е место = 100 баллов, последнее = 0.</p>`)}
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
    const risk = E.hseRisk(s);
    const drill = key => { const last = H.drills[key]; const ago = last == null ? null : s.day - last; const lim = key === 'fire' ? 183 : 365; return { last, ago, over: ago == null || ago > lim }; };
    return `<div class="kpis">
      ${(() => { const d = H.daysNoInj, ms = [30, 90, 180, 365, 730, 1000, 2000].find(x => x > d) || d + 1000, prev = [0, 30, 90, 180, 365, 730, 1000, 2000].filter(x => x <= d).pop();
        return `<div class="kpi ${d >= 365 ? 'good' : d >= 90 ? '' : 'warn'}"><div class="k-l">Дней без травм</div><div class="k-v">${num(d)}</div>${segBar((d - prev) / (ms - prev), d >= 365 ? 'good' : d >= 90 ? 'warn' : 'bad')}<div class="k-s">до рубежа ${num(ms)} дн · ${H.injuries.length ? 'последний случай ' + dateRu(H.injuries[H.injuries.length - 1].date) : 'с начала работы'}</div></div>`; })()}
      ${kpiTile('Травм за 12 мес.', inj12.length, `LTIFR ${num(E.ltifr(s), 2)} на 1 млн чел.-ч`, inj12.length ? 'bad' : 'good')}
      ${[['Готовность к ЧС', H.readiness, 'учения, пожарная охрана, техника'], ['Культура безопасности', H.culture, 'обучение, СИЗ, наряды-допуски']].map(([l, v, sub]) => { const c = v >= 65 ? 'good' : v >= 40 ? 'warn' : 'bad'; return `<div class="kpi ${c}"><div class="k-l">${l}</div><div class="k-v">${num(v)}%</div>${segBar(v / 100, c)}<div class="k-s">${sub}</div></div>`; }).join('')}
      ${kpiTile('Штрафы за 12 мес.', money(fines12.reduce((a, f) => a + f.amount, 0)), `${fines12.length} предписаний`, fines12.length ? 'bad' : 'good')}
      <button class="kpi lnk ${!s.today || !s.today.gas || s.today.gas.util >= 0.8 ? 'good' : s.today.gas.util >= 0.4 ? 'warn' : 'bad'}" data-go="gas:mks"><div class="k-l">Утилизация ПНГ</div><div class="k-v">${s.today && s.today.gas ? pct(s.today.gas.util) : '—'}</div><div class="k-s">схема газа: ЦДПиТГ ›</div></button>
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
    <p class="hint">Проверки госорганов внезапные. Повторное нарушение — штраф ×1,5, чистая проверка — доверие +1.</p>`;
  }

  /* ---------- схема попутного газа (анимация) ---------- */
  function gasScheme() {
    const t = s.today || {}; const g = t.gas || { prod: 0, heat: 0, gtes: 0, sale: 0, flare: 0, util: 1 };
    const capC = E.capOf(s, 'gascomp'), capG = E.capOf(s, 'gtes'), hasC = E.facs(s, 'gascomp').length > 0, hasG = E.facs(s, 'gtes').length > 0;
    const gtesKw = (t.energy && t.energy.used && t.energy.used.gtes) || 0;
    const dur = f => Math.max(0.5, Math.min(6, 6 / (f / 3000 + 0.25))).toFixed(2);
    const pipe = (d, flow, col) => `<path d="${d}" class="pipe"/><path d="${d}" class="flow ${flow > 1 ? 'on' : ''}" stroke="${col}" style="animation-duration:${dur(flow)}s"/>`;
    const lbl = (x, y, txt, cls = 'pl') => `<text x="${x}" y="${y}" class="${cls}">${txt}</text>`;
    const box = (x, y, w, h, title, val, sub, state) => `<g class="node ${state || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + 18}" class="nt">${title}</text><text x="${x + w / 2}" y="${y + 34}" class="nv">${val}</text>${sub ? `<text x="${x + w / 2}" y="${y + 48}" class="ns">${sub}</text>` : ''}</g>`;
    const flameH = Math.min(1.6, 0.35 + g.flare / 6000);
    const cY = '#9fb6c9', cHeat = C.orange, cGt = C.aqua, cSale = C.blue, cFl = C.red;
    return `<svg class="scheme gas" viewBox="0 0 900 330" role="img" aria-label="Схема попутного газа">
      ${pipe('M150 165 H260', g.prod, cY)}${lbl(205, 155, num(g.prod) + ' м³')}
      ${pipe('M300 165 V60 H520', g.heat, cHeat)}${lbl(440, 52, num(g.heat) + ' м³')}
      ${pipe('M300 165 V130 H520', g.gtes, cGt)}${lbl(440, 122, num(g.gtes) + ' м³')}
      ${pipe('M300 165 V200 H520', g.sale, cSale)}${lbl(440, 192, num(g.sale) + ' м³')}
      ${pipe('M300 165 V275 H520', g.flare, cFl)}${lbl(440, 267, num(g.flare) + ' м³')}
      ${pipe('M680 200 H820', g.sale, cSale)}
      ${box(20, 120, 130, 92, 'Сепараторы', 'УПСВ + ЦКППН', `нефть ${num(t.oil || 0)} т/сут`)}
      <g class="node res"><circle cx="300" cy="165" r="22"/><text x="300" y="169" class="nt">ПНГ</text></g>
      ${box(520, 30, 160, 58, 'Печи подогрева', `${num(g.heat)} м³/сут`, `${s.ckppnSet.temp}°C · экономия топлива`)}
      ${box(520, 100, 160, 58, hasG ? 'ГТЭС' : 'ГТЭС — нет', hasG ? `${num(gtesKw)} / ${num(capG)} кВт` : 'нужна технология', hasG ? 'дешёвая электроэнергия' : 'строится через тендер', hasG ? (gtesKw < capG * 0.6 && g.prod > 0 ? 'n-warn' : '') : 'off')}
      ${box(520, 170, 160, 58, hasC ? 'МКС' : 'МКС — нет', hasC ? `${num(g.sale)} / ${num(capC)} м³` : 'не построен', hasC ? (g.sale >= capC * 0.97 ? 'загружен на 100%' : 'есть резерв') : 'сдача газа невозможна', hasC ? (g.sale >= capC * 0.97 && g.flare > 1 ? 'n-warn' : '') : 'off')}
      ${box(820 - 20, 172, 96, 56, 'Газопровод', `+${money(g.sale * 4 * idx())}`, 'в сутки')}
      <g class="flare"><rect x="590" y="262" width="20" height="56" fill="#56687a"/><rect x="584" y="314" width="32" height="8" rx="2" fill="#2b3a4a"/>
        <g class="flame ${g.flare > 1 ? 'on' : ''}" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(${flameH.toFixed(2)})"><path d="M600 262 C584 246 594 226 600 210 C606 226 616 246 600 262Z" fill="${g.flare > 1 ? '#d95926' : '#3a4654'}"/><path d="M600 262 C592 252 597 240 600 230 C603 240 608 252 600 262Z" fill="${g.flare > 1 ? '#c98500' : '#2b3a4a'}"/></g></g>
      ${lbl(660, 255, 'Факел', 'nt')}${lbl(660, 271, g.flare > 1 ? `${num(g.flare)} м³/сут` : 'не горит', 'nv')}${lbl(660, 287, g.flare > 1 ? `плата ${money(g.flare * (E.parts(s.day).y >= 2006 ? 6 : 0.8) * idx())}/сут` : 'газ утилизирован', 'ns')}
      <g class="node"><rect x="740" y="250" width="150" height="64" rx="9"/><text x="815" y="270" class="nt">Утилизация</text><text x="815" y="292" class="nv" style="font-size:18px;font-weight:800;fill:${g.util >= 0.8 ? 'var(--good)' : g.util >= 0.4 ? 'var(--warn)' : 'var(--bad)'}">${pct(g.util)}</text><text x="815" y="307" class="ns">норматив 80%</text></g>
    </svg>`;
  }
  /* ===================== ПОПУТНЫЙ ГАЗ (производственная цепочка) ===================== */
  function vGas() {
    const g = (s.today && s.today.gas) || { prod: 0, heat: 0, gtes: 0, sale: 0, flare: 0, util: 1 };
    const y = E.parts(s.day).y;

      const hh = s.history.slice(-36);
      return `${card('Попутный газ — МКС (онлайн)', `<div class="swipe-hint">← листайте схему →</div><div class="scheme-wrap big">${gasScheme()}</div><p class="hint">Приоритет: печи → ГТЭС → МКС (в газопровод) → факел.</p>`)}
      <div class="kpis"><div class="kpi">${G.gauge({ value: g.util * 100, min: 0, max: 100, bands: [{ to: 50, color: C.red }, { to: 80, color: C.yellow }, { to: 100, color: C.aqua }], text: pct(g.util), label: 'Утилизация ПНГ' })}</div>
        ${kpiTile('Добыча ПНГ', num(g.prod) + ' м³/сут', 'газовый фактор ≈85 м³/т', '')}${kpiTile('На факел', num(g.flare) + ' м³/сут', 'плата за эмиссии', g.flare > g.prod * 0.2 ? 'bad' : 'good')}${kpiTile('Сдано через МКС', num(g.sale) + ' м³/сут', `доход ${money(g.sale * 4 * idx())}/сут`, g.sale > 0 ? 'good' : '')}</div>
        <div class="grid2">${card('Баланс попутного газа сегодня', G.donut({ items: [{ name: 'Подогрев печей ЦКППН', value: g.heat, color: C.orange }, { name: 'ГТЭС (электроэнергия)', value: g.gtes, color: C.aqua }, { name: 'МКС → газопровод', value: g.sale, color: C.blue }, { name: 'Факел', value: g.flare, color: C.red }], center: num(g.prod), sub: 'м³/сут', unit: 'м³' }))}
        ${card('Утилизация ПНГ по месяцам, %', G.line({ labels: hh.map(x => ymRu(x.m)), series: [{ name: 'Утилизация', color: C.aqua, values: hh.map(x => x.gas ? x.gasUsed / x.gas * 100 : null), area: true }, { name: 'Норматив 80%', color: C.plan, values: hh.map(() => 80), dash: true }], height: 190, unit: '%', min: 0, max: 100, empty: 'Появится после первого месяца' }))}</div>
        ${card('Утилизация ПНГ', `<p class="hint" style="margin-top:0">Факел — плата за эмиссии, при утилизации ниже 80% — штрафы экологов. МКС сжимает газ 0,2 → 0,9 МПа.</p>
          <div class="btnrow">${btn('Построить МКС', 'tender', 'gascomp', 'primary')}${E.has(s, 'gtes') ? btn('ГТЭС 4 МВт', 'tender', 'gtes') : btn('Технология ГТЭС', 'gotech', '', '')}</div>`)}`;
    
  }
  /* ===================== БЫТ: вахтовый посёлок, столовая, общежития ===================== */
  function campScene(st) {
    const dorms = E.facs(s, 'dorm'), cans = E.facs(s, 'canteen'), banya = E.facs(s, 'banya')[0], club = E.facs(s, 'club')[0];
    let left = st.housed;
    const dormSvg = (f, i) => {
      const x = 20 + i * 150, ok = f.status === 'ok', cap = f.cap, live = ok ? Math.min(cap, left) : 0; left -= live;
      const lit = Math.round(live / cap * 12);
      let win = ''; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { const k = r * 6 + c; win += `<rect x="${x + 10 + c * 19}" y="${118 + r * 32}" width="11" height="15" fill="${ok && k < lit ? '#ffd76a' : '#22303c'}" stroke="#14100c" stroke-width=".8"${ok && k < lit ? ' class="win"' : ''}/>`; }
      return `<g><rect x="${x}" y="98" width="130" height="92" fill="${ok ? '#b9714e' : '#6d5243'}" stroke="#4a2c1d"/><path d="M${x - 4} 98 L${x + 65} 78 L${x + 134} 98Z" fill="#5d6a73" stroke="#2f363b"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<line x1="${x}" y1="${104 + k * 10}" x2="${x + 130}" y2="${104 + k * 10}" stroke="#9c5b3c" stroke-width=".5"/>`).join('')}${win}
        <rect x="${x + 55}" y="168" width="20" height="22" fill="#4a3426"/><rect x="${x + 35}" y="100" width="60" height="11" rx="1" fill="#f1ead2" stroke="#4a2c1d"/><text x="${x + 65}" y="108.5" text-anchor="middle" font-size="6.5" font-weight="700" fill="#7a1a1a" font-family="Georgia,serif">ОБЩЕЖИТИЕ №${i + 1}</text>
        ${ok ? '' : `<path d="M${x} 190 L${x + 130} 98 M${x + 130} 190 L${x} 98" stroke="#c9a227" stroke-width="2" opacity=".6"/>`}</g>`;
    };
    const can = cans[0], cx = 20 + Math.min(3, dorms.length) * 150, cok = can && can.status === 'ok';
    return `<svg class="camp" viewBox="0 0 640 230" role="img" aria-label="Вахтовый посёлок">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b44"/><stop offset=".7" stop-color="#6b4a4a"/><stop offset="1" stop-color="#c47a4a"/></linearGradient></defs>
      <rect width="640" height="200" fill="url(#sky)"/><rect y="190" width="640" height="40" fill="#5c4b33"/><rect y="196" width="640" height="10" fill="#3a3a3a"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${i * 100 + 10}" y1="201" x2="${i * 100 + 40}" y2="201" stroke="#e6e0c8" stroke-width="1.5"/>`).join('')}
      <circle cx="590" cy="40" r="14" fill="#ffe9a8" opacity=".85"/>
      <g opacity=".5"><path d="M0 120 L40 100 L80 116 L130 92 L190 118 L250 104 L300 120 L640 120 L640 200 L0 200Z" fill="#2c2a2a"/></g>
      <g transform="translate(560 60)"><path d="M10 130 L18 40 L26 130Z M12 100 L24 100 M14 70 L22 70" stroke="#40464c" stroke-width="2" fill="none"/></g>
      ${dorms.slice(0, 3).map(dormSvg).join('')}
      ${can ? `<g><rect x="${cx}" y="128" width="120" height="62" fill="${cok ? '#d9cfae' : '#8d8670'}" stroke="#5c5440"/><rect x="${cx - 4}" y="122" width="128" height="8" fill="#6b7a82"/>
        ${[0, 1, 2, 3].map(k => `<rect x="${cx + 8 + k * 28}" y="140" width="20" height="24" fill="${cok ? '#ffe39a' : '#22303c'}" stroke="#5c5440"/>`).join('')}
        <rect x="${cx + 50}" y="168" width="20" height="22" fill="#5c4632"/><text x="${cx + 60}" y="118" text-anchor="middle" font-size="12" font-weight="900" fill="#d32f2f" font-family="Georgia,serif" letter-spacing="1">СТОЛОВАЯ</text>
        <rect x="${cx + 96}" y="100" width="8" height="24" fill="#6b4a3a"/>${cok ? `<g class="smoke-c"><circle cx="${cx + 100}" cy="96" r="5" fill="#cfd4d8" opacity=".5"/><circle cx="${cx + 104}" cy="86" r="7" fill="#cfd4d8" opacity=".35"/><circle cx="${cx + 98}" cy="74" r="9" fill="#cfd4d8" opacity=".2"/></g>` : ''}</g>` : ''}
      ${banya ? `<g><rect x="${cx + 135}" y="160" width="46" height="30" fill="#8a6440" stroke="#4a3220"/>${[0, 1, 2].map(k => `<line x1="${cx + 135}" y1="${166 + k * 8}" x2="${cx + 181}" y2="${166 + k * 8}" stroke="#6a4a2c"/>`).join('')}<path d="M${cx + 131} 160 L${cx + 158} 146 L${cx + 185} 160Z" fill="#4a3a2a"/><text x="${cx + 158}" y="184" text-anchor="middle" font-size="7" font-weight="700" fill="#f6e7b0">БАНЯ</text>${banya.status === 'ok' ? `<g class="smoke-c"><circle cx="${cx + 170}" cy="140" r="4" fill="#cfd4d8" opacity=".5"/><circle cx="${cx + 173}" cy="131" r="6" fill="#cfd4d8" opacity=".3"/></g>` : ''}</g>` : ''}
      ${club ? `<g><rect x="${cx + 200}" y="140" width="60" height="50" fill="#e3d6b0" stroke="#5c5440"/><path d="M${cx + 195} 140 L${cx + 230} 124 L${cx + 265} 140Z" fill="#7a1a1a"/><line x1="${cx + 230}" y1="124" x2="${cx + 230}" y2="104" stroke="#555"/><path class="flag" d="M${cx + 230} 104 h16 v9 h-16z" fill="#d32f2f"/><text x="${cx + 230}" y="170" text-anchor="middle" font-size="8" font-weight="900" fill="#7a1a1a" font-family="Georgia,serif">КЛУБ</text></g>` : ''}
      <g><line x1="40" y1="44" x2="40" y2="98" stroke="#555" stroke-width="2"/><line x1="300" y1="44" x2="300" y2="98" stroke="#555" stroke-width="2"/><rect x="40" y="36" width="260" height="14" fill="#c62828"/><text x="170" y="46.5" text-anchor="middle" font-size="9" font-weight="900" fill="#ffe082" font-family="Georgia,serif" letter-spacing="1">СЛАВА ТРУДУ НЕФТЯНИКОВ!</text></g>
      <g class="bus"><rect x="0" y="182" width="46" height="18" rx="4" fill="#e8892b" stroke="#7a4410"/><rect x="4" y="185" width="34" height="6" fill="#9ccbe8"/><rect x="40" y="185" width="4" height="10" fill="#9ccbe8"/><circle cx="10" cy="201" r="3.5" fill="#111"/><circle cx="36" cy="201" r="3.5" fill="#111"/><text x="22" y="198" text-anchor="middle" font-size="4.5" fill="#fff" font-weight="700">ВАХТА</text></g>
    </svg>`;
  }
  function chalkMenu(key, compact) {
    const M = E.MENU[key];
    return `<div class="chalk${compact ? ' sm' : ''}"><div class="ch-h">МЕНЮ · ${esc(M.name.toUpperCase())}</div>${M.dishes.map(d => `<div class="ch-r"><span>• ${esc(d)}</span></div>`).join('')}<div class="ch-f">в день на человека: ${num(M.cost * idx())} ₸</div></div>`;
  }
  function vSoc() {
    const sb = sub(), st = E.socStats(s), mor = st.morTotal;
    const kp = `<div class="kpis">
      ${kpiTile('Вахта в посёлке', `${num(st.N)} чел.`, `местные: ${num(st.local)} чел. — НПЗ, АЗС, офис живут дома`, '')}
      ${kpiTile('Проживают', `${num(st.housed)} / ${num(st.beds)}`, st.homeless ? `без места: ${st.homeless} чел. — съём жилья` : 'койко-мест хватает', st.homeless ? 'bad' : 'good')}
      ${kpiTile('Питаются в столовой', `${num(st.fed)} / ${num(st.N)}`, `${num(st.seats)} мест в 2 смены`, st.unfed ? 'warn' : 'good')}
      ${kpiTile('Влияние на мораль', (mor >= 0 ? '+' : '') + num(mor, 1), Object.entries(st.mor).filter(([, v]) => Math.abs(v) >= 0.5).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${num(v, 1)}`).join(' · ') || 'нейтрально', mor >= 2 ? 'good' : mor >= -2 ? '' : 'bad')}
      ${kpiTile('Расходы на быт', money(st.food + st.rent) + '/сут', `питание ${money(st.food)}${st.localFood ? ` (талоны местным ${money(st.localFood)})` : ''}${st.rent ? ' · аренда ' + money(st.rent) : ''}`)}
    </div>`;
    if (sb === 'food') {
      const cans = E.facs(s, 'canteen');
      return `${kp}<div class="grid2">
        ${card('Сегодня в столовой', chalkMenu(s.soc.menu))}
        ${card('Выбор питания', `<div class="menus">${Object.entries(E.MENU).map(([k, M]) => `<button class="menu-c ${s.soc.menu === k ? 'on' : ''}" data-act="menu" data-arg="${k}"><b>${M.name}</b><span>${num(M.cost * idx())} ₸/чел. в день</span><small>мораль ${M.mor >= 0 ? '+' : ''}${M.mor} · травмы ${M.hse < 1 ? '−' : M.hse > 1 ? '+' : ''}${Math.round(Math.abs(1 - M.hse) * 100)}% · отравления ×${M.sick}</small></button>`).join('')}</div>
          <p class="hint">Кто не поместился в столовую — получает сухой паёк. Сухпаёк на всех — замечание Санэпиднадзора.</p>`)}
      </div>
      ${card('Столовые', `<div class="gwells">${cans.map(f => `<div class="gwell ${f.status === 'ok' ? 'work' : 'fail'}"><div class="w-h"><b>${G.icon('dorm')} ${esc(f.name)}</b>${facPill(f)}</div>${G.plate({ id: f.id })}
        ${f.status !== 'ok' ? G.danger('НЕ ВКЛЮЧАТЬ! РАБОТАЮТ ЛЮДИ', 'столовая закрыта') : ''}<div class="kv3"><div><span>Мест</span><b>${f.cap} × 2 смены</b></div><div><span>Санитария</span><b class="${f.health < 50 ? 'tbad' : 'tgood'}">${f.health < 50 ? 'плохо' : 'норма'}</b></div></div>
        ${bar(f.health / 100, f.health < 40 ? 'bad' : f.health < 65 ? 'warn' : 'good')}<small>износ ${Math.round(100 - f.health)}%${f.health < 50 ? ' — риск отравлений и штрафа' : ''}</small><div class="btnrow">${fixBtns(f)}</div></div>`).join('')}</div>
        <div class="btnrow">${btn('Построить столовую · ' + money(D.BUILD.canteen.cost * idx()), 'tender', 'canteen', 'primary')}</div>`)}`;
    }
    if (sb === 'dorm') {
      let left = st.housed;
      const rows = E.facs(s, 'dorm').map(f => { const live = f.status === 'ok' ? Math.min(Math.floor(f.cap * (0.6 + 0.4 * f.health / 100)), left) : 0; left -= live;
        return `<div class="gwell ${f.status === 'ok' ? 'work' : 'fail'}"><div class="w-h"><b>${G.icon('dorm')} ${esc(f.name)}</b>${facPill(f)}</div>${G.plate({ id: f.id })}
          ${f.status !== 'ok' ? G.danger('НЕ ВКЛЮЧАТЬ! РАБОТАЮТ ЛЮДИ', 'жильцы выселены на время ремонта') : ''}
          <div class="kv3"><div><span>Живут</span><b>${live} / ${f.cap}</b></div><div><span>Условия</span><b class="${f.health < 50 ? 'tbad' : f.health < 70 ? 'twarn' : 'tgood'}">${f.health < 50 ? 'аварийные' : f.health < 70 ? 'удовл.' : 'хорошие'}</b></div></div>
          ${bar(live / f.cap, 'good')}<small>заселённость</small>${bar(f.health / 100, f.health < 40 ? 'bad' : f.health < 65 ? 'warn' : 'good')}<small>износ ${Math.round(100 - f.health)}% — изношенное общежитие теряет места и мораль</small><div class="btnrow">${fixBtns(f)}</div></div>`; }).join('');
      const extra = ['banya', 'club'].map(t => { const f = E.facs(s, t)[0]; return f ? `<div class="gwell work"><div class="w-h"><b>${G.icon('dorm')} ${esc(f.name)}</b>${facPill(f)}</div><small>${D.BUILD[t].desc}</small>${bar(f.health / 100)}<div class="btnrow">${fixBtns(f)}</div></div>` : `<div class="gwell"><div class="w-h"><b>${G.icon('dorm')} ${D.BUILD[t].name}</b>${pill('нет', '')}</div><small>${D.BUILD[t].desc}</small><div class="btnrow">${btn('Построить · ' + money(D.BUILD[t].cost * idx()), 'tender', t, 'small primary')}</div></div>`; }).join('');
      return `${kp}${card('Общежития', `<div class="gwells">${rows}</div><div class="btnrow">${btn('Общежитие 120 мест · ' + money(D.BUILD.dorm.cost * idx()), 'tender', 'dorm', 'primary')}</div>
        <p class="hint">Не хватает мест — люди снимают жильё за счёт компании (${money(1500 * idx())} в сутки), мораль падает, растёт риск травм.</p>`)}
        ${card('Отдых', `<div class="gwells">${extra}</div>`)}`;
    }
    return `${card('Посёлок', `<div class="ubar"><span>Койко-места</span>${bar(st.beds ? st.housed / st.beds : 0, st.homeless ? 'bad' : 'good')}<b>${pct(st.beds ? Math.min(1, st.N / st.beds) : 1)}</b></div><div class="ubar"><span>Места в столовой</span>${bar(st.seats ? Math.min(1, st.N / st.seats) : 1, st.unfed ? 'warn' : 'good')}<b>${pct(st.seats ? Math.min(1, st.N / st.seats) : 1)}</b></div><div class="ubar"><span>Спортзал / клуб</span><small>${st.banya ? 'спортзал есть' : 'спортзала нет'} · ${st.club ? 'клуб есть' : 'клуба нет'}</small><b></b></div>`)}${kp}
      <div class="grid2">${card('Сегодня в столовой', chalkMenu(s.soc.menu, true) + `<div class="btnrow">${btn('Изменить меню', 'gosub', 'soc:food', 'small')}</div>`)}
      ${card('Из чего складывается мораль', `<div class="tscroll"><table class="tbl"><tbody>${Object.entries(st.mor).map(([k, v]) => `<tr><td>${k}</td><td class="${v > 0 ? 'tgood' : v < 0 ? 'tbad' : ''}">${v >= 0 ? '+' : ''}${num(v, 1)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Плюс зарплата, нагрузка и СИЗ — на вкладке «Персонал».</p>`)}</div>`;
  }
  /* ===================== Автопарк ===================== */
  const vPlate = p => `<span class="lplate">${esc(p)}<i>KZ</i></span>`;
  function dueCell(label, day, warnD) {
    const d = day - s.day, cls = d < 0 ? 'tbad' : d <= warnD ? 'twarn' : 'tgood';
    return `<div><span>${label}</span><b class="${cls}">${d < 0 ? 'просрочено ' + (-d) + ' дн' : 'через ' + d + ' дн'}</b></div>`;
  }
  const VST = { ok: ['на линии', 'good'], repair: ['в мастерской', 'warn'], fail: ['неисправна', 'bad'], ban: ['запрет: нет ПТО', 'bad'] };
  function vFleet() {
    const sb = sub(), F = s.fleet, A = E.fleetAvail(s), FS = E.fleetSpeed(s), i = idx(), cars = F.cars, dslP = D.MATERIALS.find(m => m.key === 'diesel').price * i;
    const ktg = E.ktg(s), over = cars.filter(c => s.day > c.to || s.day > c.pto).length, rentD = sum(E.VT, t => A.rent[t] * D.VEH[t].cost * 0.0015) * i;
    const kp = `<div class="kpis">
      ${kpiTile('КТГ (готовность)', pct(ktg), `${cars.filter(c => c.status === 'ok').length} из ${cars.length} на линии`, ktg >= 0.9 ? 'good' : ktg >= 0.75 ? 'warn' : 'bad')}
      ${kpiTile('Просрочено ТО / ПТО', num(over), over ? 'износ ×2, риск поломок' : 'всё по графику', over ? 'bad' : 'good')}
      ${kpiTile('Наём у подрядчиков', money(rentD) + '/сут', !F.rent ? 'наём выключен' : rentD > 0 ? 'покрывает нехватку' : 'не требуется', rentD > 0 ? 'warn' : 'good')}
      ${kpiTile('Запчасти', `${num(s.stock.vparts)} компл`, `ТО — 1, ремонт — 2 компл`, s.stock.vparts < 2 ? 'bad' : s.stock.vparts < 6 ? 'warn' : 'good')}
    </div>`;
    if (sb === 'cars') {
      const list = cars.slice().sort((a, b) => (a.status === 'ok') - (b.status === 'ok') || a.health - b.health);
      const dueTxt = (lb, day, w) => { const x = day - s.day; return x <= w ? `<span class="vdue ${x < 0 ? 'bad' : 'warn'}">${lb} ${x < 0 ? 'просрочено' : 'через ' + x + ' дн'}</span>` : ''; };
      const vItem = c => { const V = D.VEH[c.type], [stT, stC] = VST[c.status], fl = (c.fl || 0) / V.tank;
        const dd = dueTxt('ЧТО', c.chto, 3) + dueTxt('ТО', c.to, 10) + dueTxt('ПТО', c.pto, 30);
        const acts = (c.status === 'fail' ? btn('Ремонт · ' + money(E.vehCost.repair * i), 'veh', 'repair:' + c.id, 'small primary') : '')
          + (c.status === 'ok' && c.chto - s.day <= 3 ? btn('ЧТО', 'veh', 'chto:' + c.id, 'small') : '')
          + (c.status !== 'fail' && c.to - s.day <= 10 ? btn('ТО', 'veh', 'to:' + c.id, 'small') : '')
          + (c.status !== 'fail' && c.pto - s.day <= 30 ? btn('ПТО', 'veh', 'pto:' + c.id, 'small') : '')
          + (c.status !== 'fail' && fl < 0.5 ? btn('Заправить', 'veh', 'fuel:' + c.id, 'small') : '')
          + (c.status === 'fail' || c.health < 30 ? btn('Списать', 'veh', 'sell:' + c.id, 'small ghost') : '');
        return `<div class="vitem ${c.status === 'ok' ? '' : 'off'}">
          <div class="vi-h"><b>${esc(c.name)}</b><span class="vst ${stC}">${stT}</span></div>
          <div class="vi-m"><span class="vfuel ${fl < 0.25 ? 'low' : ''}"><i style="width:${(fl * 100).toFixed(0)}%"></i></span><small>${Math.round(c.fl || 0)} л</small><small class="vsep">·</small><small class="${c.health < 30 ? 'tbad' : c.health < 60 ? 'twarn' : ''}">состояние ${Math.round(c.health)}%</small><small class="vsep">·</small><small>${num(Math.round(c.km))} км</small></div>
          ${dd ? `<div class="vi-d">${dd}</div>` : ''}${c.status === 'repair' ? `<small class="vrep">в мастерской ещё ${c.down} сут</small>` : ''}
          ${acts ? `<div class="btnrow">${acts}</div>` : ''}</div>`; };
      const types = E.VT.filter(tp => list.some(c => c.type === tp));
      return `${kp}<div class="grp-tools">${btn(types.every(tp => grpOpen('v:' + tp)) ? 'Свернуть все' : 'Раскрыть все', 'grpAll', types.map(tp => 'v:' + tp).join(','), 'small ghost')}</div><div class="vlist">${types.map(tp => { const cs = list.filter(c => c.type === tp), bad = cs.filter(c => c.status !== 'ok').length, low = cs.filter(c => (c.fl || 0) < D.VEH[tp].tank * 0.25).length, due = cs.filter(c => c.to - s.day <= 10 || c.pto - s.day <= 30 || c.chto - s.day <= 3).length;
        return group('v:' + tp, esc(D.VEH[tp].name), `${cs.length} шт${bad ? ` · <span class="tbad">${bad} не на линии</span>` : ''}${due ? ` · <span class="twarn">ТО: ${due}</span>` : ''}${low ? ` · <span class="twarn">мало топлива: ${low}</span>` : ''}`, cs.map(vItem).join(''), bad || due || low); }).join('')}</div>
        <p class="hint">Кнопки появляются, только когда нужны: срок ТО близко, бак меньше половины, поломка. Все сроки — на вкладке «ТО и запчасти».</p>`;
    }
    if (sb === 'to') {
      const rows = cars.slice().sort((a, b) => Math.min(a.chto, a.to, a.pto) - Math.min(b.chto, b.to, b.pto));
      const c = E.vehCost;
      return `${kp}<div class="grid2">${card('Режим обслуживания', `<label class="check"><input type="checkbox" data-change="fleetAuto" ${F.auto ? 'checked' : ''}> Автообслуживание</label><p class="hint">ЧТО, ТО и ПТО по графику, ремонт сломанных, автозаказ запчастей, </p>
          <label class="check"><input type="checkbox" data-change="fleetFuel" ${F.autoFuel !== false ? 'checked' : ''}> Автозаправка машин и спецтехники</label><p class="hint">Заправка до полного бака только когда стрелка уйдёт в красную зону (меньше ¼). Сначала со склада ГСМ, если дизеля нет — по топливной карте (+15%). Вручную заправить можно в любой момент. Выключено — пустая машина стоит.</p>
          <label class="check"><input type="checkbox" data-change="fleetRent" ${F.rent ? 'checked' : ''}> Наём техники у подрядчиков</label><p class="hint">Нехватку техники закрывают подрядчики. Без найма — простой бригад ПРС и транспортного цеха</p>${ownFuelRow()}<p class="hint">Порядок заправки: сначала свой ДТ — со своих АЗС, затем из товарного парка НПЗ; потом склад ГСМ; если пусто — топливная карта (+15%). Свой дизель не покупается, но и не продаётся.</p>`)}
        ${card('Регламент', `<div class="tscroll"><table class="tbl"><thead><tr><th>Вид</th><th>Период</th><th>Стоимость</th><th>Что даёт</th></tr></thead><tbody>
          <tr><td>ЧТО — ежемесячное</td><td>30 дн</td><td>${money(c.chto * i)}</td><td>+3% состояния</td></tr>
          <tr><td>ТО-2 — плановое</td><td>90 дн</td><td>${money(c.to * i)} + 1 компл</td><td>+15%, простой 1 сут</td></tr>
          <tr><td>ПТО — техосмотр</td><td>365 дн</td><td>${money(c.pto * i)}</td><td>допуск к эксплуатации</td></tr>
          <tr><td>Ремонт</td><td>по поломке</td><td>${money(c.repair * i)} + 2 компл</td><td>+25%, простой 3 сут</td></tr></tbody></table></div>
          <p class="hint">Просроченное ТО удваивает износ и в 2,5 раза повышает риск поломок. Без ПТО машину выпускать на линию запрещено. При состоянии ниже 30% техосмотр не пройти.</p>`)}</div>
        ${card('График обслуживания', `<div class="tscroll"><table class="tbl"><thead><tr><th>Машина</th><th>Номер</th><th>ЧТО</th><th>ТО-2</th><th>ПТО</th></tr></thead><tbody>${rows.map(v => { const f = (d, w) => { const x = d - s.day; return `<td class="${x < 0 ? 'tbad' : x <= w ? 'twarn' : ''}">${x < 0 ? 'просроч.' : x + ' дн'}</td>`; }; return `<tr><td>${esc(v.name)}</td><td>${esc(v.plate)}</td>${f(v.chto, 3)}${f(v.to, 10)}${f(v.pto, 30)}</tr>`; }).join('')}</tbody></table></div>`)}
        ${card('Склад запчастей', `<div class="ubar"><span>Запчасти автотехники</span>${bar(Math.min(1, s.stock.vparts / 12), s.stock.vparts < 2 ? 'bad' : s.stock.vparts < 6 ? 'warn' : 'good')}<b>${num(s.stock.vparts)}</b></div>
          <div class="btnrow">${btn('Купить 6 компл · ' + money(6 * D.MATERIALS.find(m => m.key === 'vparts').price * i), 'vparts', '6', 'small')}${btn('Купить 20 компл', 'vparts', '20', 'small')}</div>`)}`;
    }
    // парк: потребность и наличие по видам
    const rows = E.VT.map(t => { const V = D.VEH[t], n = cars.filter(c => c.type === t).length, ok = A.own[t], need = A.need[t], short = Math.max(0, need - ok);
      return `<div class="gwell ${short ? (A.rent[t] ? 'warn' : 'fail') : 'work'}"><div class="w-h"><b>${esc(V.name)}</b>${pill(`${ok} / ${need}`, short ? (A.rent[t] ? 'warn' : 'bad') : 'good')}${pill('КПД ' + Math.round(FS.q[t] * 100) + '%', FS.q[t] >= 0.9 ? 'good' : FS.q[t] >= 0.7 ? 'warn' : 'bad')}</div>
        <div class="vrow2"><small>${esc(V.desc)}. Бак ${V.tank} л, расход ${V.fuel} л/сут.${n > ok ? ` Не на линии: ${n - ok}.` : ''}${A.rent[t] ? ` Нанято: ${A.rent[t]}.` : ''}</small></div>
        <div class="btnrow">${btn('Купить · ' + money(V.cost * i), 'vbuy', t, 'small')}</div></div>`; }).join('');
    const fuelD = F.fuelD || 0;
    const sp = (v, l, id, sub) => G.panelMeter({ value: v, label: l, id, sub });
    const effRow = (n, v) => `<tr><td>${n}</td><td class="${v >= 0.95 ? 'tgood' : v < 0.8 ? 'tbad' : 'twarn'}">${Math.round(v * 100)}%</td></tr>`;
    const speedCard = card('Эффективность техники', `<div class="speedos">
        ${sp(FS.prs, 'ПРС', 'prs', 'подъёмники, агрегаты ЦА')}
        ${sp(FS.build, 'Стройка', 'bld', 'автокраны')}
        ${sp(FS.supply, 'Снабжение МТР', 'sup', 'краны, автоцистерны')}
        ${sp(FS.trans, 'Транспортный цех', 'trn', 'спецтехника')}</div>
      <div class="tscroll"><table class="tbl"><tbody>
        ${effRow('Ремонт скважин (ПРС)', FS.prs)}${effRow('Строительство объектов', FS.build)}${effRow('Доставка МТР на склад', FS.supply)}${effRow('Транспортный цех', FS.trans)}${effRow('Доставка смены (рабочее время)', FS.people)}
      </tbody></table></div>
      <p class="hint">Эффективность зависит от числа машин, их техсостояния и своевременного ТО. Наёмная техника работает на 20% хуже своей, просроченное ТО — −10%. Резервные машины сверх нормы дают до +15%. Ниже 100% — работы идут дольше, выше — раньше срока.</p>`);
    return `${kp}${speedCard}${card('Потребность промысла в технике', `<div class="gwells">${rows}</div><p class="hint">Подъёмники нужны бригадам ПРС, спецтехника — транспортному цеху (глушение, промывка, подвоз, монтаж), вахтовки и легковые — для доставки людей. Водители набираются автоматически по числу машин.</p>`)}
      <div class="grid2">${card('ГСМ автопарка', `<label class="check"><input type="checkbox" data-change="fleetFuel" ${F.autoFuel !== false ? 'checked' : ''}> Автозаправка (при красной зоне)</label><div class="fdrow"><div class="fdw big">${G.fuelDial({ id: 'fleet', level: sum(cars, c => c.fl || 0) / Math.max(1, sum(cars, c => D.VEH[c.type].tank)), text: `${num(sum(cars, c => c.fl || 0))} л в баках`, sub: 'весь автопарк' })}</div><div class="kv3 col"><div><span>Расход за сутки</span><b>${money(fuelD * dslP)}</b></div><div><span>За месяц</span><b>${money(F.costM || 0)}</b></div><div><span>Прошлый месяц</span><b>${F.lastM ? money(F.lastM.cost) : '—'}</b></div></div></div><div class="kv3"><div><span>Дизель в сутки</span><b>${num(fuelD)} л</b></div><div><span>Склад дизеля</span><b class="${s.stock.diesel < fuelD * 5 ? 'twarn' : ''}">${num(s.stock.diesel)} л</b></div><div><span>По топливным картам</span><b>${num(F.cardD || 0)} л</b></div><div><span>Свой ДТ (АЗС/НПЗ)</span><b class="tgood">${num(F.ownD || 0)} л</b></div></div>${ownFuelRow()}`)}
      ${card('Водители', `<div class="kv3"><div><span>В штате</span><b>${num(s.staff.drv.n)}</b></div><div><span>Нужно</span><b>${num(E.coverage(s).need.drv)}</b></div><div><span>Машин</span><b>${cars.length}</b></div></div>`)}</div>`;
  }
  /* ===================== НПЗ ===================== */
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  const FK = ['ai', 'a95', 'a98', 'dt', 'mz'], PK = FK, FCOL = { ai: '#3fbf6f', a95: '#2fb3a8', a98: '#9b7be0', dt: '#d8c13a', mz: '#8a6a4a' };
  // показатели НПЗ/АЗС за сутки с безопасными значениями по умолчанию (старые сохранения, первый день)
  const dsT = () => { const z = () => ({ ai: 0, a95: 0, a98: 0, dt: 0, mz: 0 }), d = (s.today && s.today.ds) || {};
    return Object.assign({ feed: 0, load: 0, bought: 0, lost: 0, azsRev: 0, shopRev: 0, cars: 0, queue: 0, dry: 0, deliv: 0, hired: 0, dem: null, calc: null }, d,
      { out: Object.assign(z(), d.out), whole: Object.assign(z(), d.whole), azs: Object.assign(z(), d.azs), side: Object.assign({ naf: 0, lpg: 0, vgo: 0, bit: 0 }, d.side) }); };
  const UNAME = { npz: 'ЭЛОУ-АТ', npz_vac: 'Вакуумный блок', npz_ref: 'Риформинг', npz_hdo: 'Гидроочистка', npz_fcc: 'Каткрекинг', npz_bit: 'Битумная' };
  const has = t => E.facs(s, t).length > 0;
  const uLoad = (R, u) => R && R.U[u] && R.U[u].cap > 0 ? R.U[u].in / R.U[u].cap : 0;
  const npzR = () => { const d = dsT(); return d.calc || (has('npz') ? E.npzCalc(s, Math.max(1, Math.min(s.ds.feed, E.unitCap(s, 'npz') || 1)), E.coverage(s)) : null); };
  function npzMargin() {
    const R = npzR(); if (!R || R.F <= 0) return { diff: 0, per: 0 };
    const i = idx(); let v = sum(FK, k => R.out[k] * E.fuelOwn(s, k)) + sum(Object.keys(R.side), k => R.side[k] * E.fuelMarket(s, k));
    v -= (R.out.ai + R.out.dt + R.out.mz + sum(Object.keys(R.side), k => R.side[k])) * 900 * i + R.opex * i;
    const crude = (E.oilPriceT(s, 3) - 1500 * i) * R.F;
    return { diff: (v - crude) / R.F, per: v / R.F };
  }
  // Советская клиновая задвижка: чугунный корпус, выдвижной шпиндель, красный маховик, табличка
  const valveMem = {};
  function valveSvg(x, y, key, open, label, act = 'valve', sc = 1.35) {
    const changed = valveMem[key] != null && valveMem[key] !== open; valveMem[key] = open;
    const wy = y - 40, stemTop = open ? wy - 13 : wy - 3;
    const spokes = [0, 60, 120].map(a => { const r = a * Math.PI / 180; return `<line x1="${(x - 10 * Math.cos(r)).toFixed(1)}" y1="${(wy - 10 * Math.sin(r)).toFixed(1)}" x2="${(x + 10 * Math.cos(r)).toFixed(1)}" y2="${(wy + 10 * Math.sin(r)).toFixed(1)}" stroke="#a51c1c" stroke-width="2"/>`; }).join('');
    const plate = open ? ['ОТКРЫТО', '#1e5e2a', '#cfe8c9'] : ['ЗАКРЫТО', '#7f1414', '#f6d4cf'];
    return `<g class="valve ${open ? 'v-open' : 'v-closed'}" data-act="${act}" data-arg="${key}" role="button" aria-label="${label}: ${open ? 'открыта' : 'закрыта'}" transform="translate(${x} ${y}) scale(${sc}) translate(${-x} ${-y})">
      <rect x="${x - 24}" y="${y - 58}" width="48" height="90" fill="transparent"/>
      <rect x="${x - 17}" y="${y - 12}" width="5" height="24" rx="1" fill="#3a4148" stroke="#151a1f"/><rect x="${x + 12}" y="${y - 12}" width="5" height="24" rx="1" fill="#3a4148" stroke="#151a1f"/>
      ${[-9, 0, 9].map(d => `<circle cx="${x - 14.5}" cy="${y + d}" r="1" fill="#8d969e"/><circle cx="${x + 14.5}" cy="${y + d}" r="1" fill="#8d969e"/>`).join('')}
      <path d="M${x - 12} ${y - 9} Q${x} ${y - 14} ${x + 12} ${y - 9} L${x + 12} ${y + 9} Q${x} ${y + 14} ${x - 12} ${y + 9}Z" fill="#2a2f34" stroke="#121518"/>
      ${open ? `<rect x="${x - 10}" y="${y - 2}" width="20" height="4" fill="#4b5560" opacity=".8"/>` : `<rect x="${x - 2.5}" y="${y - 9}" width="5" height="18" fill="#b71c1c"/>`}
      <path d="M${x - 7} ${y - 11} L${x - 4.5} ${y - 24} L${x + 4.5} ${y - 24} L${x + 7} ${y - 11}Z" fill="#30363c" stroke="#121518"/>
      <rect x="${x - 6}" y="${y - 27}" width="12" height="4" rx="1" fill="#3a4148" stroke="#121518"/>
      <line x1="${x - 4}" y1="${y - 27}" x2="${x - 3}" y2="${wy + 2}" stroke="#4b5560" stroke-width="2"/><line x1="${x + 4}" y1="${y - 27}" x2="${x + 3}" y2="${wy + 2}" stroke="#4b5560" stroke-width="2"/>
      <line class="v-stem" x1="${x}" y1="${y - 24}" x2="${x}" y2="${stemTop}" stroke="#c9ced3" stroke-width="2.4"/>
      ${open ? `<line x1="${x - 1.5}" y1="${wy - 6}" x2="${x + 1.5}" y2="${wy - 6}" stroke="#7f878e"/><line x1="${x - 1.5}" y1="${wy - 9}" x2="${x + 1.5}" y2="${wy - 9}" stroke="#7f878e"/>` : ''}
      <g class="v-wheel ${changed ? (open ? 'spin-open' : 'spin-close') : ''}" style="transform-origin:${x}px ${wy}px">
        <circle cx="${x}" cy="${wy}" r="11" fill="none" stroke="#c62828" stroke-width="3.4"/>
        <circle cx="${x}" cy="${wy}" r="11" fill="none" stroke="#ef5350" stroke-width="1" stroke-dasharray="4 5" opacity=".7"/>
        ${spokes}<circle cx="${x}" cy="${wy}" r="3" fill="#8e1616" stroke="#5c0d0d"/>
      </g>
      <rect x="${x - 19}" y="${y + 15}" width="38" height="10" rx="2" fill="${plate[2]}" stroke="${plate[1]}" stroke-width="1.2"/>
      <text x="${x}" y="${y + 22.5}" text-anchor="middle" font-size="6.6" font-weight="800" letter-spacing=".4" fill="${plate[1]}" font-family="Georgia,serif">${plate[0]}</text>
    </g>`;
  }
  const ownFuelRow = () => { const L = E.ownDieselL(s), hasOwn = E.facs(s, 'azs').length || E.facs(s, 'npz').length, d = s.ownFuelD && s.ownFuelD.day === s.day ? s.ownFuelD : null;
    return `<div class="brig tumrow">${tumbler(s.auto.ownFuel !== false, 'toggle', 'ownFuel', 'Своё топливо')}<div><b>Заправка своим дизелем (АЗС и НПЗ)</b><small>${!hasOwn ? 'нет своих АЗС и НПЗ — заправка со склада ГСМ' : s.auto.ownFuel === false ? 'выключено — заправка со склада ГСМ и по картам' : `доступно ${num(L)} л ДТ · сегодня взято: техника ${num(d ? d.fleet : 0)} л, ДГУ ${num(d ? d.dgu : 0)} л`}</small></div></div>`; };
  // советский тумблер на панели: рычаг вверх — ВКЛ, вниз — ВЫКЛ, сигнальная лампа
  const tumMem = {};
  function tumbler(on, act, arg, label) {
    const k = act + arg, ch = tumMem[k] != null && tumMem[k] !== on; tumMem[k] = on;
    return `<button class="tumbler ${on ? 'on' : 'off'}${ch ? ' flip' : ''}" data-act="${act}" data-arg="${esc(String(arg))}" aria-label="${esc(label)}: ${on ? 'включено' : 'выключено'}"><svg viewBox="0 0 64 84" width="54" height="71" aria-hidden="true">
      <rect x="2" y="2" width="60" height="80" rx="5" fill="#2b2f33" stroke="#0e1012"/><rect x="6" y="6" width="52" height="72" rx="3" fill="#3a4046"/>
      ${[[9, 9], [55, 9], [9, 75], [55, 75]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#9aa3ab" stroke="#1d2126" stroke-width=".6"/>`).join('')}
      <text x="32" y="17" text-anchor="middle" font-size="7.5" font-weight="800" fill="${on ? '#f4f1e6' : '#8d969e'}" font-family="Georgia,serif">ВКЛ</text>
      <text x="32" y="74" text-anchor="middle" font-size="7.5" font-weight="800" fill="${on ? '#8d969e' : '#f4f1e6'}" font-family="Georgia,serif">ВЫКЛ</text>
      <circle cx="32" cy="44" r="10" fill="#c9ced3" stroke="#5b636b" stroke-width="1.2"/><circle cx="32" cy="44" r="6.5" fill="#7f878e"/>
      <g class="tum-lever" style="transform-origin:32px 44px"><path d="M29 44 L28 22 Q32 19 36 22 L35 44Z" fill="#e3e6e9" stroke="#5b636b" stroke-width=".8"/><ellipse cx="32" cy="22" rx="4.2" ry="2.6" fill="#f4f6f8" stroke="#5b636b" stroke-width=".8"/></g>
      <circle cx="50" cy="28" r="3.6" class="tum-lamp" fill="${on ? '#ff3b2f' : '#4a1512'}" stroke="#111" stroke-width=".8"/>
    </svg></button>`;
  }
  const valveBtn = (open, act, arg, key, label) => `<button class="vbtn sm ${open ? 'on' : 'off'}" data-act="${act}" data-arg="${esc(String(arg))}" aria-label="${esc(label || 'Задвижка')}">${wheelIcon(open, key)}${label ? `<b>${esc(label)}</b>` : ''}<span class="vplate ${open ? 'po' : 'pc'}">${open ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</span></button>`;
  // мини-маховик для кнопок
  const wheelIcon = (open, key) => `<svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true"><g class="v-wheel ${valveMem['b' + key] != null && valveMem['b' + key] !== open ? (open ? 'spin-open' : 'spin-close') : ''}" style="transform-origin:20px 20px">${(valveMem['b' + key] = open, '')}<circle cx="20" cy="20" r="15" fill="none" stroke="#c62828" stroke-width="4.5"/>${[0, 60, 120].map(a => { const r = a * Math.PI / 180; return `<line x1="${(20 - 14 * Math.cos(r)).toFixed(1)}" y1="${(20 - 14 * Math.sin(r)).toFixed(1)}" x2="${(20 + 14 * Math.cos(r)).toFixed(1)}" y2="${(20 + 14 * Math.sin(r)).toFixed(1)}" stroke="#a51c1c" stroke-width="2.6"/>`; }).join('')}<circle cx="20" cy="20" r="4.5" fill="#8e1616"/></g></svg>`;
  // табло смен: 4 бригады, кто сегодня в день, кто в ночь, кто отдыхает
  function shiftBoard(dept, title) {
    const I = E.shiftInfo(s, dept), role = dept === 'npz' ? 'npzop' : 'azsop';
    const sun = '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="3.4" fill="#f0b429"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${(8 + 5 * Math.cos(r)).toFixed(1)}" y1="${(8 + 5 * Math.sin(r)).toFixed(1)}" x2="${(8 + 7 * Math.cos(r)).toFixed(1)}" y2="${(8 + 7 * Math.sin(r)).toFixed(1)}" stroke="#f0b429" stroke-width="1.3"/>`; }).join('') + '</svg>';
    const moon = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M10.5 2.5a5.5 5.5 0 1 0 3 9.5A6 6 0 0 1 10.5 2.5Z" fill="#9fb6e9"/></svg>';
    const cells = ['А', 'Б', 'В', 'Г'].map((b, i) => { const exists = i < I.brig; const st = !exists ? 'none' : b === I.dayB ? 'day' : b === I.nightB ? 'night' : 'rest';
      return `<div class="sh-b ${st}"><b>${b}</b><span>${st === 'day' ? sun + ' день' : st === 'night' ? moon + ' ночь' : st === 'rest' ? 'отдых' : 'нет людей'}</span><small>${exists ? I.crew + ' чел.' : '—'}</small></div>`; }).join('');
    const c = I.brig >= 4 ? 'good' : I.brig === 3 ? 'warn' : 'bad';
    return card(title, `<div class="shifts">${cells}</div>
      <div class="kv3"><div><span>Режим</span><b class="t${c}">${I.brig >= 2 ? 'круглосуточно' : I.brig === 1 ? 'только день' : 'стоит'}</b></div><div><span>Бригад</span><b class="t${c}">${I.brig} из 4 · ${I.mode}</b></div><div><span>Операторы</span><b>${num(I.work)} / ${num(I.need)}${I.sick ? ` <small>(болеют ${I.sick})</small>` : ''}</b></div></div>
      ${I.brig < 4 ? `<div class="btnrow">${btn(`Нанять до 4 бригад (+${Math.max(0, I.need - I.have)})`, 'hire', role, 'small primary', I.need <= I.have)}</div>` : ''}
      <p class="hint">Смены по 12 часов: 8:00–20:00 и 20:00–8:00, график 2 через 2. Ночные часы оплачиваются +50%. При 3 бригадах — сверхурочные (×1,5) и усталость, при 2 — работа 12/12 без выходных, при 1 бригаде ${dept === 'npz' ? 'непрерывный процесс НПЗ не удержать — завод останавливается' : `АЗС работает только днём и теряет ночные продажи (${pct(E.AZS_NIGHT.road)} на трассе, ${pct(E.AZS_NIGHT.city)} в городе)`}.</p>`);
  }
  // звук пуска / останова: маховик задвижки, затем розжиг горелок или сброс давления
  const npzRunSnd = start => { SND.play('valve'); setTimeout(() => SND.play(start ? 'fire' : 'hiss'), 700); if (start) setTimeout(() => SND.play('motor'), 1400); };
  /* ---------- Безопасность: одна на все опасные объекты (НПЗ, СУГ, газовые колонки) ---------- */
  function vSafety() {
    const H = s.hse, ob = E.hazObjs(s), i = idx();
    const due = ob.filter(f => s.day > (f.lpgExp ?? Infinity) - 90), over = ob.filter(f => s.day > (f.lpgExp ?? Infinity));
    const pbOk = ob.length ? (ob.length - over.length) / ob.length : 1;
    const tile = (l, v, c, sub) => `<div class="kpi ${c}"><div class="k-l">${l}</div><div class="k-v">${v}</div>${sub}</div>`;
    const lv = v => v >= 65 ? 'good' : v >= 40 ? 'warn' : 'bad';
    const fireOver = s.day - (H.drills.fire ?? -999) > 183;
    const kp = `<div class="kpis">
      ${tile('Промышленная безопасность', ob.length ? pct(pbOk) : '—', over.length ? 'bad' : due.length ? 'warn' : 'good', `${segBar(pbOk, over.length ? 'bad' : due.length ? 'warn' : 'good')}<div class="k-s">${ob.length ? `экспертиза: просрочено ${over.length}, скоро ${due.length - over.length}` : 'опасных объектов нет'}</div>`)}
      ${tile('Пожарная безопасность', num(H.readiness) + '%', lv(H.readiness), `${segBar(H.readiness / 100, lv(H.readiness))}<div class="k-s">${fireOver ? '<span class="tbad">пожарные учения просрочены</span>' : 'учения проведены вовремя'}</div>`)}
      ${tile('БиОТ (культура безопасности)', num(H.culture) + '%', lv(H.culture), `${segBar(H.culture / 100, lv(H.culture))}<div class="k-s">дней без травм: ${num(H.daysNoInj)}</div>`)}
    </div>`;
    const grp = (title, list) => !list.length ? '' : `<div class="vlist">${list.map(f => { const dd = (f.lpgExp ?? s.day + E.LPG_EXP) - s.day, off = (f.lpgOff || 0) > s.day;
      return `<div class="vitem ${dd < 0 || f.status !== 'ok' || off ? 'off' : ''}"><div class="vi-h"><b>${esc(f.name)}${f.type === 'azs' ? ' · газовая колонка' : ''}</b><span class="vst ${dd < 0 ? 'bad' : dd < 90 ? 'warn' : 'good'}">${dd < 0 ? 'экспертиза просрочена' : 'экспертиза через ' + dd + ' дн'}</span></div>
        <div class="vi-m"><small class="${f.health < 40 ? 'tbad' : ''}">износ ${Math.round(100 - f.health)}%</small>${f.status !== 'ok' ? '<small class="tbad">· не в работе</small>' : ''}${off ? '<small class="tbad">· закрыта после аварии</small>' : ''}</div></div>`; }).join('')}</div>`;
    const npzL = ob.filter(f => f.type !== 'azs' && f.type !== 'gfu' && f.type !== 'lpg_tank'), lpgL = ob.filter(f => f.type === 'gfu' || f.type === 'lpg_tank'), azsL = ob.filter(f => f.type === 'azs');
    const body = !ob.length ? '<p class="hint">Опасных производственных объектов пока нет: они появятся вместе с НПЗ, ГФУ, ёмкостями СУГ и газовыми колонками АЗС.</p>' :
      `${npzL.length ? group('sf:npz', 'Установки и парк НПЗ', `${npzL.length} об.`, grp('', npzL), npzL.some(f => s.day > (f.lpgExp ?? Infinity) - 90)) : ''}
       ${lpgL.length ? group('sf:lpg', 'ГФУ и ёмкости СУГ', `${lpgL.length} об.`, grp('', lpgL), lpgL.some(f => s.day > (f.lpgExp ?? Infinity) - 90)) : ''}
       ${azsL.length ? group('sf:azs', 'Газовые колонки АЗС', `${azsL.length} шт`, grp('', azsL), azsL.some(f => s.day > (f.lpgExp ?? Infinity) - 90)) : ''}`;
    return `${kp}${card('Опасные производственные объекты', `<div class="btnrow" style="margin-bottom:8px">${btn(due.length ? `Провести экспертизу ПБ (${due.length}) · ${money(due.length * 3e6 * i)}` : 'Экспертиза не требуется', 'lpgExp', '', due.length ? 'small primary' : 'small', !due.length)}</div>${body}
      <p class="hint">Экспертиза промышленной безопасности — раз в 4 года на каждый объект (можно за 90 дней до срока). Просрочка — штраф Комитета промбезопасности 8 млн ₸ за объект и выше риск аварий. Утечки и пожары на объектах СУГ чаще при износе и низкой готовности к ЧС.</p>`)}
      ${(() => { const k = E.secK(s), need = E.staffNeed(s).sec || 0, have = s.staff.sec ? s.staff.sec.n : 0, G0 = s.guard || {}, nA = E.facs(s, 'azs').length, hasN = E.facs(s, 'npz').length;
        return card('Охрана: СБ и охранная фирма', `<div class="kv3"><div><span>Служба безопасности (вахта)</span><b class="${k >= 0.9 ? 'tgood' : k >= 0.6 ? 'twarn' : 'tbad'}">${num(have)} / ${num(need)} чел.</b></div><div><span>Охват промысла</span><b>${pct(k)}</b></div><div><span>Охрана НПЗ / АЗС</span><b>${G0.npz ? 'есть' : 'нет'} / ${G0.azs ? 'есть' : 'нет'}</b></div></div>
          ${have < need ? `<div class="btnrow">${btn(`Нанять в СБ (+${need - have})`, 'hire', 'sec', 'small primary')}</div>` : ''}
          <div class="brig tumrow">${tumbler(!!G0.npz, 'guardT', 'npz', 'Охрана НПЗ')}<div><b>Охранная фирма на НПЗ</b><small>${hasN ? `${money(E.GUARD_FEE.npz * idx())}/мес · без охраны — хищения с товарного парка` : 'НПЗ пока нет'}</small></div></div>
          <div class="brig tumrow">${tumbler(!!G0.azs, 'guardT', 'azs', 'Охрана АЗС')}<div><b>Охранная фирма на АЗС</b><small>${nA ? `${money(E.GUARD_FEE.azs * idx() * nA)}/мес за ${nA} ст. · без охраны — ночные ограбления` : 'АЗС пока нет'}</small></div></div>
          <p class="hint">СБ живёт на вахте и охраняет промысел: скважины, кабели, трубопроводы. Чем меньше людей в СБ, тем чаще кражи кабеля (скважина встаёт) и врезки в нефтепровод. НПЗ и АЗС охраняет нанятая охранная фирма — по договору с ежемесячной оплатой.</p>`); })()}
      ${card('Пожарная безопасность и БиОТ', `<p>Учения, медосмотры и обучение проводятся в разделе «ОТ, ПБ и экология».</p><div class="btnrow">${btn('Пожарные учения', 'hseOp', 'drill:fire', 'small')}${btn('Обучение по ОТ', 'hseOp', 'training', 'small')}${btn('Открыть ОТ и ПБ', 'goHse', '', 'small ghost')}</div>`)}`;
  }
  // пульт пуска / останова НПЗ
  function npzPult() {
    if (!E.facs(s, 'npz').length) return '';
    const N = s.np, run = N.run || 'on', rk = E.npzRunK(s), d = dsT();
    const tF = run === 'off' ? 40 : Math.round(40 + (N.t1 - 40) * (run === 'stop' ? 0.45 : rk));
    const lamp = (on, col, txt, blink) => `<div class="plamp ${on ? 'on' : ''} ${blink && on ? 'blink' : ''}" style="--lc:${col}"><i></i><span>${txt}</span></div>`;
    const stTxt = run === 'on' ? 'Технологический режим' : run === 'start' ? `Пуск: сутки ${Math.min(3, (N.runD || 0) + 1)} из 3 · загрузка ${pct(rk)}` : run === 'stop' ? 'Останов: освобождение колонн · загрузка 40%' : 'Завод остановлен · печи погашены';
    const isOpen = run === 'on' || run === 'start';
    return card('Пульт НПЗ: задвижка сырья', `<div class="pult">
      <div class="pult-l">${G.gauge({ value: tF, min: 0, max: 450, bands: [{ to: 300, color: C.blue }, { to: 380, color: C.aqua }, { to: 450, color: C.red }], text: tF + '°C', label: 'Печь П-1', face: 'ТЕРМОМЕТР °C', fmt: v => Math.round(v) })}</div>
      <div class="pult-r">
        <div class="plamps">${lamp(run === 'on', '#3fae4a', 'РАБОТА')}${lamp(run === 'start', '#f0b429', 'ПУСК', true)}${lamp(run === 'stop', '#f0b429', 'ОСТАНОВ', true)}${lamp(run === 'off', '#e5534b', 'СТОП')}</div>
        <b class="pult-st">${stTxt}</b>
        <small>Сырьё на ЭЛОУ-АТ: ${num(d.feed, 1)} т/сут из ${num(s.ds.feed)} заданных</small>
        <div class="btnrow">${isOpen ? btn('Закрыть задвижку — останов', 'npzRun', 'stop', 'small danger', run === 'stop') : btn(`Открыть задвижку — пуск · ${money(4e6 * idx())}`, 'npzRun', 'start', 'small primary', run === 'start')}</div>
      </div></div>
      <p class="hint">Пуск занимает 3 суток (загрузка 30 → 60 → 90%, затем режим), останов — 1 сутки. Каждый останов изнашивает установки (термоциклирование, −1,5%), пуск стоит денег на разогрев печей. Пока завод стоит, нефть копится в РВС, а отгрузка продуктов из парка продолжается. Задвижку можно крутить и на схеме — на линии сырья.</p>`);
  }
  function npzScheme() {
    const d = dsT(), R = npzR(), on = d.feed > 0.5, P = s.prodStock, N = s.np, Cc = s.cat;
    const dur = f => Math.max(0.6, Math.min(5, 5 / ((f || 0) / 40 + 0.25))).toFixed(2);
    const pipe = (dd, flow, col, thin) => `<path d="${dd}" class="pipe"${thin ? ' style="stroke-width:5"' : ''}/><path d="${dd}" class="flow ${flow > 0.3 ? 'on' : ''}" stroke="${col}" style="animation-duration:${dur(flow)}s"/>`;
    const lbl = (x, y, txt, cls = 'pl') => `<text x="${x}" y="${y}" class="${cls}">${txt}</text>`;
    const box = (x, y, w, h, title, v1, v2, st, v3) => `<g class="node ${st || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + 17}" class="nt">${title}</text><text x="${x + w / 2}" y="${y + 33}" class="nv">${v1}</text>${v2 ? `<text x="${x + w / 2}" y="${y + 48}" class="ns">${v2}</text>` : ''}${v3 ? `<text x="${x + w / 2}" y="${y + 62}" class="ns">${v3}</text>` : ''}</g>`;
    const nest = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `);
    const st = (u, warn) => !has(u) ? 'off' : E.facs(s, u).some(f => f.regen > 0 || f.status !== 'ok') ? 'n-bad' : warn ? 'n-warn' : '';
    const U = R ? R.U : {}, t = x => num(x || 0, (x || 0) < 10 ? 1 : 0) + ' т';
    const naf = R ? R.F * (E.CRUDE.naf + (s.ds.mode === 'ai' ? 0.03 : s.ds.mode === 'dt' ? -0.03 : 0)) : 0;
    const vo = k => s.np.v[k] !== false;
    const gasOut = d.whole.ai + d.whole.a95 + d.whole.a98, gasPool = d.out.ai + d.out.a95 + d.out.a98;
    const fccIn = U.npz_fcc ? U.npz_fcc.in : 0;
    const TK = { ai: 40, a95: 132, a98: 224, dt: 320, mz: 588 };
    return `<svg class="scheme npz" viewBox="0 0 1700 760" role="img" aria-label="Технологическая схема НПЗ">
      ${nest(G.tank({ v: E.kpi(s).oilTank.v, c: E.kpi(s).oilTank.c, purpose: 'oil', w: 100, h: 92, id: 'nz0' }), 10, 300)}${lbl(60, 412, 'Нефть, РВС')}
      ${pipe('M110 346 H150', d.feed, C.orange)}${has('npz') ? valveSvg(130, 346, 'crude', N.run === 'on' || N.run === 'start', 'Задвижка сырья', 'valve', 0.85) : ''}${lbl(130, 384, t(d.feed))}
      ${box(150, 300, 140, 92, 'ЭЛОУ', R ? `соли ${num(R.saltIn)} → ${num(R.saltOut, 1)}` : '—', `мг/л · ${N.elT}°C`, st('npz', R && R.saltOut > 3), R ? `вода ${num(R.waterOut, 2)}%` : '')}
      ${pipe('M290 346 H320', d.feed, C.orange)}
      ${box(320, 300, 130, 92, 'Печь П-1', on ? `${N.t1}°C` : '—', R ? `топливо ${num(R.fuel, 1)} т` : '', st('npz', R && R.coke > 0), R && R.coke > 0 ? 'КОКСОВАНИЕ' : 'отбор ' + (R ? pct(R.rec) : '—'))}
      <g class="flame ${on ? 'on' : ''}" style="transform-box:fill-box;transform-origin:50% 100%"><path d="M385 420 C375 412 380 400 385 392 C390 400 395 412 385 420Z" fill="${on ? (R && R.coke > 0 ? '#e66767' : '#d95926') : '#3a4654'}"/></g>
      ${pipe('M450 346 H490', d.feed, C.orange)}
      <g class="node ${has('npz') ? '' : 'off'}"><rect x="490" y="60" width="80" height="580" rx="34"/>
        ${[100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600].map(y => `<line x1="498" x2="562" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.16)"/>`).join('')}
        <text x="530" y="665" class="nt">К-1 / К-2</text><text x="530" y="682" class="ns">атм. колонна</text>
        ${on ? [0, 1, 2, 3].map(i => `<circle class="bubble" cx="${508 + i * 14}" cy="610" r="3" fill="rgba(255,255,255,.35)" style="animation-delay:${i * 0.45}s"/>`).join('') : ''}</g>
      ${pipe('M570 90 H610', R ? 1 : 0, '#9fb6c9', 1)}${lbl(660, 94, R ? `газ ${num(R.F * E.CRUDE.gas, 1)} т → печи` : 'газ → печи', 'ns')}
      ${pipe('M570 200 H640', naf, '#7fb4ff')}${lbl(605, 190, 'нафта')}
      ${box(640, 160, 160, 80, 'Риформинг', has('npz_ref') ? t(U.npz_ref && U.npz_ref.in) : 'не построен', has('npz_ref') ? `${N.tr}°C · ОЧ ${num(R && R.ronR, 1)}` : 'нафта → опт', st('npz_ref', Cc.rf < 0.6), has('npz_ref') ? `катализатор ${pct(Cc.rf)}` : '')}
      ${pipe('M800 200 H1080', R ? R.out.ai + R.out.a95 + R.out.a98 - (fccIn * (R.conv || 0) * 0.62) : 0, FCOL.ai)}${R && R.side.naf > 0.5 ? lbl(860, 190, `нафта → опт ${t(R.side.naf)}`, 'ns') : ''}
      ${pipe('M720 240 V290', has('npz_ref') && R ? R.h2p || 0 : 0, '#e6edf3', 1)}${has('npz_ref') ? lbl(760, 268, 'ВСГ (H₂)', 'ns') : ''}
      ${pipe('M570 330 H640', R ? R.F * 0.3 : 0, FCOL.dt)}${lbl(605, 320, 'дизель')}
      ${box(640, 290, 160, 80, 'Гидроочистка', has('npz_hdo') ? t(U.npz_hdo && U.npz_hdo.in) : 'не построена', has('npz_hdo') ? `${N.th}°C · S ${num(R && R.sOutH)} ppm` : `S ${num(R ? R.sIn : 2500)} ppm`, st('npz_hdo', Cc.hdo < 0.6), has('npz_hdo') ? `катализатор ${pct(Cc.hdo)}` : '')}
      ${pipe('M800 330 H1080', d.out.dt, FCOL.dt)}
      ${pipe('M570 470 H640', R ? R.F * 0.5 : 0, FCOL.mz)}${lbl(605, 460, 'мазут')}
      ${box(640, 430, 160, 80, 'Вакуумный блок', has('npz_vac') ? t(U.npz_vac && U.npz_vac.in) : 'не построен', has('npz_vac') ? 'ВГО + гудрон' : 'мазут → парк', st('npz_vac'))}
      ${pipe('M800 470 H860', U.npz_vac ? U.npz_vac.in * 0.48 : 0, '#c9a46b')}${lbl(830, 461, 'ВГО', 'ns')}
      ${box(860, 430, 150, 80, 'Каткрекинг', has('npz_fcc') ? t(fccIn) : 'не построен', has('npz_fcc') ? `${N.tf}°C · конв. ${pct(R && R.conv)}` : (has('npz_vac') ? 'ВГО → опт' : ''), st('npz_fcc'), has('npz_fcc') && R ? `СУГ ${t(R.side.lpg)}` : '')}
      ${pipe('M890 430 V392 H760 V370', has('npz_fcc') ? fccIn * 0.15 : 0, FCOL.dt, 1)}${has('npz_fcc') ? lbl(825, 386, 'лёгкий газойль', 'ns') : ''}
      ${pipe('M985 430 V336 a6 6 0 0 0 0 -12 V245 H1080', has('npz_fcc') ? fccIn * 0.45 : 0, FCOL.ai)}${has('npz_fcc') ? lbl(1035, 238, 'бензин КК', 'ns') : ''}
      ${pipe('M720 510 V590', U.npz_vac ? U.npz_vac.in * 0.5 : 0, '#5a4a3a')}${lbl(752, 555, 'гудрон', 'ns')}
      ${box(640, 590, 160, 70, 'Битумная', has('npz_bit') ? (N.bit ? t(U.npz_bit && U.npz_bit.in) : 'выключена') : 'не построена', has('npz_bit') && R ? `битум ${t(R.side.bit)}` : 'гудрон → мазут', st('npz_bit', has('npz_bit') && !N.bit))}
      ${pipe('M935 510 V622', has('npz_fcc') ? fccIn * 0.1 : 0, FCOL.mz, 1)}
      ${pipe('M800 622 H1290', d.out.mz, FCOL.mz)}${lbl(1050, 612, 'мазут ' + t(d.out.mz))}
      ${pipe('M720 660 V715 H860', R ? R.side.bit : 0, '#6b5a48')}${valveSvg(800, 715, 'bit', N.bit, 'Битум')}
      ${box(860, 690, 150, 50, 'Битум — опт', t(R && R.side.bit), '', has('npz_bit') ? '' : 'off')}
      ${box(1080, 40, 150, 260, 'Компаундирование', R && gasPool > 0 ? `пул ОЧ ${num(R.ron, 1)}` : 'нет бензина', gasPool > 0 ? `АИ-98: ${t(d.out.a98)}` : '', gasPool > 0 && R.ron < 92 ? 'n-warn' : (gasPool > 0 ? '' : 'off'), gasPool > 0 ? `АИ-95: ${t(d.out.a95)}` : '')}
      ${gasPool > 0 ? `${lbl(1155, 117, `АИ-92: ${t(d.out.ai)}`, 'ns')}${lbl(1155, 135, `ОЧ АИ-92: ${num(R.r92, 1)}`, 'ns')}${lbl(1155, 160, `план 95/98: ${N.g95}% / ${N.g98}%`, 'ns')}` : ''}
      ${box(1080, 310, 150, 80, 'Дизель', R ? `S ${num(R.sul)} ppm` : '—', R ? `класс ${E.sulClass(R.sul)}` : '', R && R.sul > 50 ? 'n-warn' : '', t(d.out.dt))}
      ${['ai', 'a95', 'a98'].map(k => `${pipe(`M1230 ${TK[k] + 35} H1290`, d.out[k], FCOL[k])}`).join('')}${pipe('M1230 353 H1290', d.out.dt, FCOL.dt)}
      ${PK.map(k => `${nest(G.tank({ v: P[k], c: E.prodCapK(s, k) || 1, purpose: k, w: 80, h: 70, id: 'nzt' + k }), 1290, TK[k])}${lbl(1330, TK[k] + 84, `${E.PNAME[k]} ${num(P[k])}/${num(E.prodCapK(s, k))}`, 'ns')}`).join('')}
      ${['ai', 'a95', 'a98'].map(k => pipe(`M1370 ${TK[k] + 35} H1392`, d.whole[k] + d.azs[k], FCOL[k])).join('')}
      ${pipe('M1392 75 V259', gasOut, FCOL.ai, 1)}
      ${pipe('M1392 167 H1440', gasOut, FCOL.ai)}${valveSvg(1416, 167, 'gas', vo('gas'), 'Бензин')}
      ${pipe('M1370 355 H1440', d.whole.dt, FCOL.dt)}${valveSvg(1405, 355, 'dt', vo('dt'), 'Дизель')}
      ${pipe('M1370 623 H1440', d.whole.mz, FCOL.mz)}${valveSvg(1405, 623, 'mz', vo('mz'), 'Мазут')}
      ${box(1440, 120, 250, 90, 'Ж/д эстакада — бензин', `${t(gasOut)}/сут`, `92: ${num(d.whole.ai)} · 95: ${num(d.whole.a95)} · 98: ${num(d.whole.a98)}`, vo('gas') ? '' : 'n-bad', vo('gas') ? money(sum(['ai', 'a95', 'a98'], k => d.whole[k] * E.fuelOwn(s, k))) : 'ЗАДВИЖКА ЗАКРЫТА')}
      ${box(1440, 310, 250, 90, 'Ж/д эстакада — дизель', `${t(d.whole.dt)}/сут`, money(d.whole.dt * E.fuelOwn(s, 'dt')), vo('dt') ? '' : 'n-bad', vo('dt') ? 'ДТ ' + E.sulClass(s.prodQ.sul) : 'ЗАДВИЖКА ЗАКРЫТА')}
      ${box(1440, 440, 250, 90, 'Бензовозы → АЗС', `${num(d.deliv)} т/сут`, `${E.facs(s, 'azs').length} АЗС · своих машин ${s.ds.trucks}`, '', `с НПЗ ${num(Math.max(0, d.deliv - d.bought))} т · рынок ${num(d.bought)} т`)}
      ${box(1440, 588, 250, 70, 'Мазут — опт', `${t(d.whole.mz)}/сут`, vo('mz') ? (s.ds.sell === 'season' ? 'по сезону' : 'ежедневно') : 'ЗАДВИЖКА ЗАКРЫТА', vo('mz') ? '' : 'n-bad')}
      ${box(1080, 430, 150, 110, 'Попутные', R ? `${t(R.side.naf + R.side.lpg + R.side.vgo)}/сут` : '—', R ? `нафта ${num(R.side.naf)}` : '', '', R ? `СУГ ${num(R.side.lpg)} · ВГО ${num(R.side.vgo)}` : '')}
      ${!has('npz') ? `<text x="850" y="30" class="nt" style="fill:var(--warn)">НПЗ не построен</text>` : ''}
    </svg>`;
  }
  const ronName2 = () => E.ronName(s.prodQ.ron) + ' в парке';
  function npzGauges(R) {
    const g = (value, min, max, bands, text, label, fmt) => `<div class="kpi">${G.gauge({ value, min, max, bands, text, label, fmt })}</div>`;
    const sul = R ? R.sul : 2500;
    return `<div class="kpis gauges">
      ${g(R ? R.depth * 100 : 0, 0, 100, [{ to: 50, color: C.red }, { to: 75, color: C.yellow }, { to: 100, color: C.aqua }], R ? pct(R.depth, 1) : '—', 'Глубина переработки')}
      ${g(R ? R.light * 100 : 0, 0, 80, [{ to: 35, color: C.red }, { to: 55, color: C.yellow }, { to: 80, color: C.aqua }], R ? pct(R.light, 1) : '—', 'Выход светлых')}
      ${g(E.nelson(s), 1, 10, [{ to: 3, color: C.red }, { to: 6, color: C.yellow }, { to: 10, color: C.aqua }], num(E.nelson(s), 1), 'Индекс Нельсона')}
      ${g(R && R.out.ai > 0 ? R.ron : 70, 70, 100, [{ to: 80, color: C.red }, { to: 92, color: C.yellow }, { to: 100, color: C.aqua }], R && R.out.ai > 0 ? num(R.ron, 1) : '—', 'ОЧ бензина')}
      ${g(Math.log10(Math.max(1, sul)), 0, 3.6, [{ to: 1, color: C.aqua }, { to: 2.55, color: C.yellow }, { to: 3.6, color: C.red }], num(sul) + ' ppm', 'Сера в ДТ', v => { const x = Math.pow(10, v); return x >= 1000 ? String(Math.round(x / 100) * 100) : x >= 100 ? String(Math.round(x / 10) * 10) : String(Math.round(x)); })}
      ${g(R ? R.saltOut : 0, 0, 15, [{ to: 3, color: C.aqua }, { to: 6, color: C.yellow }, { to: 15, color: C.red }], R ? num(R.saltOut, 1) + ' мг/л' : '—', 'Соли после ЭЛОУ')}
    </div>`;
  }
  /* ===== НПЗ и АЗС как отдельные объекты: персонал, энергия, снабжение ===== */
  const DS_ROLE_FX = { npzdir: 'управление НПЗ: план, бюджет, люди', npzce: 'отвечает за ОПО; нет — штраф и аварии', npztech: 'режимы установок, отбор', npzglmech: 'ППР, ремонты, запчасти', npzglen: 'энергослужба НПЗ', npzmetr: 'КИПиА, поверка приборов', npzpto: 'проекты, документация, ППР', npzhse: 'допуски, наряды; нет — штраф', npzlabhead: 'ОТК, паспорта качества', npzshift: '1 на бригаду: руководит сменой', npzemaster: 'подстанция и сети НПЗ',
    npzop: 'ведут установки, 4 бригады', npzlab: 'анализы каждые 2 ч', npzmech: 'ремонт насосов, теплообменников', npzelec: 'дежурство 24/7 на подстанции', npzkip: 'датчики, клапаны, ПАЗ',
    azsnet: 'цены, закупка, маркетинг сети', azseng: 'ремонты и поверка ТРК', azsmgr: '1 на станцию: касса и резервуары', azsop: 'отпуск топлива, смены', azstech: 'профилактика колонок', azselec: 'электрика, освещение, навес' };
  const NPZ_SVC = [['mgmt', 'Управление', 'Директор, главный инженер', '−6% мощности'], ['tech', 'Технология', 'Гл. технолог, начальники смен', '−4% мощности'], ['mech', 'Механика', 'Гл. механик, слесари', 'износ ↑, ремонт ×1,5'], ['en', 'Энергетика', 'Гл. энергетик, мастер, электромонтёры', 'отключения, перерасход до 8%'], ['kip', 'КИПиА', 'Гл. метролог, слесари КИПиА', '−5% мощности, штраф'], ['lab', 'Лаборатория', 'Нач. лаборатории, лаборанты', '< 50% — опт −5%'], ['safe', 'Промбезопасность', 'Инженеры ПБ и ОТ, ПТО, гл. инженер', 'аварии при износе']];
  const AZS_SVC = [['net', 'Управление сетью', 'Начальник сети', '−5% клиентов'], ['mgr', 'Управляющие', '1 на станцию', 'недостачи, −15% магазина'], ['tech', 'Сервис ТРК', 'Инженер-механик, техники', 'износ колонок ×1,6'], ['en', 'Электрика', 'Электромонтёры', 'простои, перерасход']];
  function dsUnit(dept, sb) {
    const isN = dept === 'npz', i = idx(), has = isN ? E.facs(s, 'npz').length > 0 : E.facs(s, 'azs').length > 0;
    const nm = isN ? 'НПЗ' : 'АЗС';
    if (!has) return card(nm, `<p class="hint">Объект ещё не построен. Здесь появятся его ${sb === 'staff' ? 'штат и сотрудники' : sb === 'energy' ? 'энергопотребление' : sb === 'repair' ? 'оборудование и авторемонт' : 'склад и транспорт'}.</p>`);
    if (sb === 'staff') {
      const roles = D.ROLES.filter(r => r.dept === dept), need = E.staffNeed(s), ppl = s.people.filter(p => ROLE(p.role).dept === dept);
      const payroll = sum(roles, r => s.staff[r.key].n * r.salary * s.staff[r.key].pct / 100 * i), haveT = ppl.length, needT = sum(roles, r => need[r.key] || 0);
      const SI = E.shiftInfo(s, dept), n = Math.max(1, ppl.length);
      const pRow = p => { const sal = E.personSalary(s, p); return `<button class="prow" data-act="personCard" data-arg="${p.id}">${pFace(p, 38)}
        <div class="pr-b"><div class="pr-t"><b>${esc(p.name)}</b><span class="pk ${p.skill >= 1 ? 'good' : p.skill >= 0.8 ? 'warn' : 'bad'}">К ${p.skill.toFixed(2)}</span></div>
          <small class="pr-m">${yrs(E.personAge(s, p))} · стаж ${ym2(E.tenure(s, p))} · ${p.grade} разр. · ${money(sal.total)}${p.mood < 40 ? ' · <span class="tbad">недоволен</span>' : ''}</small></div></button>`; };
      return `<div class="kpis">
        ${kpiTile('Штат ' + nm, `${haveT} / ${needT}`, `укомплектованность ${pct(needT ? haveT / needT : 1)}`, lvl(needT ? haveT / needT : 1, 0.95, 0.75))}
        ${kpiTile('Бригад в смене', `${SI.brig} из 4`, SI.brig >= 4 ? 'график 24/7 полный' : SI.brig >= 2 ? 'переработки' : 'круглосуточно не работают', SI.brig >= 4 ? 'good' : SI.brig >= 2 ? 'warn' : 'bad')}
        ${kpiTile('ФОТ в месяц', money(payroll), `+ соц. налог ${money(payroll * 0.11)}`, '')}
        ${kpiTile('Настроение', `${num(sum(ppl, p => p.mood) / n)}%`, `К ср. ${num(sum(ppl, p => p.skill) / n, 2)}`, sum(ppl, p => p.mood) / n < 45 ? 'warn' : '')}
      </div>
      ${(() => { const O = isN ? E.npzOrg(s) : E.azsOrg(s), SV = isN ? NPZ_SVC : AZS_SVC, cv = r => { const nd = need[r] || 0; return nd ? Math.min(1, s.staff[r].n / nd) : 1; }, lamp = r => `<i class="ol ${cv(r) >= 1 ? 'g' : cv(r) >= 0.5 ? 'y' : 'r'}"></i>`;
        const node = (r, sh) => `<div class="onode">${lamp(r)}<b>${esc(sh || ROLE(r).name)}</b><small>${s.staff[r].n}/${need[r] || 0}</small></div>`;
        const tree = isN ? `<div class="org"><div class="orow">${node('npzdir')}</div><div class="orow">${node('npzce')}</div>
            <div class="orow o3">${node('npztech', 'Гл. технолог')}${node('npzglmech', 'Гл. механик')}${node('npzglen', 'Гл. энергетик')}${node('npzmetr', 'Гл. метролог')}${node('npzlabhead', 'Нач. лаборатории')}${node('npzhse', 'Инж. ПБ и ОТ')}${node('npzpto', 'Инж. ПТО')}</div>
            <div class="orow o3">${node('npzshift', 'Нач. смен')}${node('npzmech', 'Слесари')}${node('npzemaster', 'Мастер энерг.')}${node('npzkip', 'КИПиА')}${node('npzlab', 'Лаборанты')}</div>
            <div class="orow o3">${node('npzop', 'Операторы')}${node('npzelec', 'Электромонтёры')}</div></div>`
          : `<div class="org"><div class="orow">${node('azsnet')}</div><div class="orow o3">${node('azseng', 'Инж.-механик')}${node('azsmgr', 'Управляющие')}</div><div class="orow o3">${node('azstech', 'Техники ТРК')}${node('azselec', 'Электромонтёры')}${node('azsop', 'Операторы')}</div></div>`;
        return card('Структура ' + nm + ' и службы', `${tree}<div class="svc">${SV.map(([k, n2, who, fx]) => `<div class="sv"><div><b>${n2}</b><small>${who}</small></div>${segBar(O[k], O[k] >= 0.95 ? 'good' : O[k] >= 0.5 ? 'warn' : 'bad')}<small class="${O[k] >= 0.95 ? 'tgood' : 'twarn'}">${O[k] >= 0.95 ? 'норма' : fx}</small></div>`).join('')}</div>
          <p class="hint">Лампа: зелёная — укомплектовано, жёлтая — частично, красная — пусто. ${isN ? 'Цепочка как на реальном НПЗ: директор → главный инженер → главные специалисты → начальники смен → рабочие.' : 'Начальник сети → инженер-механик и управляющие станций → техники, электромонтёры, операторы.'}</p>`); })()}
      ${card('Штатное расписание ' + nm, [['itr', 'ИТР (руководство)', roles.filter(r => r.itr)], ['wrk', 'Рабочие', roles.filter(r => !r.itr)]].map(([gk, gt, rl]) => { const h = sum(rl, r => s.staff[r.key].n), nd2 = sum(rl, r => need[r.key] || 0); return group('dsr:' + dept + gk, gt, `${h} / ${nd2} чел`, `<div class="roles">${rl.map(r => { const st = s.staff[r.key], nd = need[r.key] || 0, hire = s.hires.filter(h => h.role === r.key).reduce((a, h) => a + h.n, 0), c = nd ? st.n / nd : 1;
        return `<div class="role"><div class="r-t"><b>${esc(r.name)}</b><small>${esc(DS_ROLE_FX[r.key] || '')}</small></div>
          <div class="r-n"><b class="${c < 0.85 ? 'tbad' : c < 1 ? 'twarn' : 'tgood'}">${st.n}</b><small>/ ${nd}${hire ? ` (+${hire})` : ''}</small></div>
          <div class="r-s"><small>Оклад</small><b>${num(r.salary * st.pct / 100 * i)} ₸</b></div>
          <div class="r-a">${btn('+ Нанять', 'hire', r.key, 'small primary')}${btn('Уволить', 'fire', r.key, 'small ghost', st.n < 1)}</div></div>`; }).join('')}</div>`, h < nd2); }).join('') + `<div class="btnrow" style="margin-top:8px">${btn('Нанять весь штат по потребности', 'hireDept', dept, 'small primary')}</div>
        <p class="hint">Персонал ${nm} — местный: живёт дома, в вахтовый посёлок не входит. Работает по сменам 4 бригадами.</p>`)}
      ${card('Сотрудники ' + nm, ppl.length ? `<div class="plist">${roles.filter(r => ppl.some(p => p.role === r.key)).map(r => { const ps = ppl.filter(p => p.role === r.key).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return group('ds:' + r.key, esc(r.name), `${ps.length} чел · К ${(sum(ps, p => p.skill) / ps.length).toFixed(2)}`, ps.map(pRow).join(''), ps.some(p => p.mood < 40)); }).join('')}</div>` : '<div class="empty">Сотрудников пока нет</div>')}`;
    }
    const DE = E.dsEnergy(s)[isN ? 'npz' : 'azs'];
    if (sb === 'energy') {
      const items = Object.entries(DE.items).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...items.map(x => x[1]));
      return `<div class="kpis">
        ${kpiTile('Нагрузка', num(DE.total) + ' кВт', isN ? 'отдельный фидер 10 кВ' : 'городская / районная сеть', '')}
        ${kpiTile('За сутки', num(DE.kwh) + ' кВт·ч', `в месяц ≈ ${num(DE.kwh * 30 / 1000)} МВт·ч`, '')}
        ${kpiTile('Оплата в сутки', money(DE.cost), `${num(2.6 * i, 2)} ₸/кВт·ч`, '')}
        ${kpiTile('В месяц', money(DE.cost * 30), DE.loss > 0.5 ? `<span class="twarn">перерасход ${num(DE.loss)} кВт — неполная энергослужба</span>` : isN ? 'не зависит от энергетики промысла' : 'на все станции сети', DE.loss > 0.5 ? 'warn' : '')}
      </div>
      ${card('Потребители ' + nm, `<div class="depts">${items.map(([k, v]) => `<div class="dept"><span>${esc(k)}</span>${bar(v / mx, 'good')}<b>${num(v)} кВт</b></div>`).join('')}</div>
        <p class="hint">${isN ? 'Установки берут 25% мощности на холостом ходу и до 100% при полной загрузке. При останове НПЗ — только дежурное освещение и КИПиА.' : 'ТРК, освещение навеса, касса; кафе +8 кВт, мойка +12 кВт. Летом кондиционеры, зимой обогрев.'}</p>`)}`;
    }
    const g = isN ? 'npz' : 'azs', S = E.dsCfg(s), objs = s.fac.filter(f => E.dsGroup(f) === g), lack = s.dsLack || {};
    const opt = (k, val, list, suf) => `<label class="sel"><select data-change="dsset" data-g="${g}" data-k="${k}">${list.map(v => `<option value="${v}" ${val === v ? 'selected' : ''}>${v}${suf}</option>`).join('')}</select></label>`;
    if (sb === 'repair') {
      const C = S.fix[g], list = objs.slice().sort((a, b) => (b.status === 'fail') - (a.status === 'fail') || a.health - b.health), svc = objs.filter(f => f.status === 'service').length, low = objs.filter(f => f.status === 'fail' || f.health < C.at).length;
      const pk = isN ? 'npzparts' : 'trkparts', avgH = objs.length ? sum(objs, f => f.health) / objs.length : 100;
      return `<div class="kpis">
        ${kpiTile('Средний износ', pct(1 - avgH / 100), `${objs.length} ед. оборудования`, avgH < 50 ? 'bad' : avgH < 70 ? 'warn' : 'good')}
        ${kpiTile('В ремонте', `${svc}`, `ниже порога: ${low}`, low ? 'warn' : 'good')}
        ${kpiTile('ЗИП на складе', `${num(s.stock[pk])} компл`, `ТР — 1, КР — ${isN ? 3 : 2} компл`, s.stock[pk] < 1 ? 'bad' : s.stock[pk] < 3 ? 'warn' : 'good')}
        ${kpiTile('Слесари / техники', pct(isN ? E.npzOrg(s).mech : E.azsOrg(s).tech), isN ? 'служба механика' : 'сервис ТРК', (isN ? E.npzOrg(s).mech : E.azsOrg(s).tech) < 0.5 ? 'bad' : '')}
      </div>
      ${card('Авторемонт ' + nm, `<div class="brig tumrow">${tumbler(C.on, 'dsFixT', g, 'Авторемонт ' + nm)}<div><b>${C.on ? 'Включён' : 'Выключен'}</b><small>каждый день проверяет износ и ставит в ремонт самое изношенное оборудование</small></div></div>
        <div class="form row3"><label>Ремонт при износе<br>${opt('at', 100 - C.at, [20, 30, 40, 50, 60, 70], '%+')}</label><label>Капремонт при износе<br>${opt('kr', 100 - C.kr, [60, 70, 80, 90, 100], '%+')}</label><label>Одновременно<br>${opt('max', C.max, [1, 2, 3, 4, 5], ' об.')}</label></div>
        <p class="hint">Текущий ремонт: +30% ресурса, ${isN ? '4' : '2'} сут. Капитальный: ресурс 100%, ${isN ? '20' : '7'} сут. Нужны деньги (≥ 3× стоимости) и ЗИП со склада ${nm}. ${isN ? 'Установка в ремонте не работает — для НПЗ держите «одновременно 1».' : 'Станция в ремонте закрыта.'}</p>`)}
      ${card('Оборудование ' + nm, `<div class="gwells">${list.map(f => `<div class="gwell ${f.status === 'ok' ? 'work' : 'fail'}"><div class="w-h"><b>${esc(f.name)}</b>${facPill(f)}</div>
        ${bar(f.health / 100, f.health < 25 ? 'bad' : f.health < C.at + 10 ? 'warn' : 'good')}<small>ресурс ${Math.round(f.health)}% · ${f.status === 'service' ? `в ремонте ещё ${f.serviceDays} сут` : f.health < C.kr ? 'нужен капремонт' : f.health < C.at ? 'нужен текущий ремонт' : 'исправно'}</small>
        <div class="btnrow">${fixBtns(f)}</div></div>`).join('')}</div>`)}`;
    }
    // склад и транспорт
    const W = S.wh[g], U = E.dsUse(s), mats = E.DS_MAT[g].map(k => D.MATERIALS.find(m => m.key === k));
    const fire = s.fleet ? s.fleet.cars.filter(c => c.type === 'fire') : [];
    const trans = isN
      ? `<div class="vlist">${fire.length ? fire.map(c => `<div class="vitem"><b>${G.icon('truck')} ${esc(D.VEH.fire.name)}</b><small>${c.status === 'ok' ? '<span class="tgood">на дежурстве</span>' : '<span class="tbad">неисправна</span>'} · износ ${Math.round(100 - c.health)}% · топливо ${pct((c.fl || 0) / D.VEH.fire.tank)}</small></div>`).join('') : (s.fleet && s.fleet.rent ? `<p class="twarn">Своей пожарной машины нет — дежурит наёмная по договору (дороже). Без неё — штраф Промбезопасности.</p>` : `<p class="tbad">Пожарной машины нет, наём выключен — инспекция Промбезопасности выпишет штраф.</p>`)}</div>
         <div class="btnrow">${btn('Купить пожарную · ' + money(D.VEH.fire.cost * i), 'vbuy', 'fire', 'small primary')}${btn('Весь автопарк', 'goFleet', '', 'small')}</div>`
      : `<div class="kpis">${kpiTile('Свои бензовозы', `${s.ds.trucks} шт`, `${num(E.truckCap(s))} т/сут`, '')}${kpiTile('Наём перевозчика', num(dsT().hired, 1) + ' т/сут', 'дороже своих', dsT().hired > 0 ? 'warn' : 'good')}</div>
         <div class="btnrow">${btn('Купить бензовоз · ' + money(25e6 * i), 'trucks', s.ds.trucks + 1, 'small primary')}${s.ds.trucks > 0 ? btn('Продать один', 'trucks', s.ds.trucks - 1, 'small') : ''}</div>`;
    const FX = { npzparts: 'ремонты установок и РВС', npzreag: 'ЭЛОУ; нет — обессоливание хуже, коррозия', npzadd: 'бензин и ДТ; нет — опт −3%', trkparts: 'ремонт колонок', trkcons: 'нет — износ ТРК ×1,5, −5% клиентов' };
    const val = sum(mats, m => (s.stock[m.key] || 0) * E.matPrice(s, m.key));
    return `<div class="kpis">
      ${kpiTile('Склад ' + nm, money(val), `${mats.length} позиций`, mats.some(m => lack[m.key]) ? 'bad' : '')}
      ${kpiTile('В пути', `${s.orders.filter(o => E.DS_MAT[g].includes(o.key)).length} заказ.`, `поставка ${E.leadTime(s)} дн`, '')}
    </div>
    ${card('Автозакупка склада ' + nm, `<div class="brig tumrow">${tumbler(W.auto, 'dsWhT', g, 'Автозакупка ' + nm)}<div><b>${W.auto ? 'Включена' : 'Выключена'}</b><small>заказывает, когда остатка хватит меньше чем на срок поставки + неделю</small></div></div>
      <div class="form"><label>Пополнять до запаса на ${opt('days', W.days, [15, 30, 60, 90], ' сут')}</label></div>`)}
    ${card('Склад ' + nm, `<div class="whl">${mats.map(m => { const st = s.stock[m.key] || 0, u = U[m.key] || 0, dl = u > 0 ? st / u : null, tr = sum(s.orders.filter(o => o.key === m.key), o => o.qty);
      return `<div class="wh ${lack[m.key] ? 'bad' : ''}"><div class="wh-t"><b>${esc(m.name)}</b><small>${FX[m.key]}</small></div>
        <div class="wh-n"><b class="${lack[m.key] || (dl != null && dl < 5) ? 'tbad' : dl != null && dl < 15 ? 'twarn' : 'tgood'}">${num(st, st < 10 ? 2 : 0)} ${m.unit}</b><small>${u > 0 && m.key !== 'npzparts' && m.key !== 'trkparts' ? `расход ${num(u, u < 1 ? 3 : 1)}/сут · ${dl == null ? '—' : num(dl) + ' сут'}` : 'по ремонтам'}${tr ? ` · в пути ${num(tr, 1)}` : ''}</small></div>
        <div class="wh-a">${btn(`+${m.min}`, 'buy', `${m.key}:${m.min}`, 'small')}${btn('Купить…', 'buyForm', m.key, 'small primary')}</div></div>`; }).join('')}</div>`)}
    ${card(isN ? 'Транспорт НПЗ' : 'Транспорт АЗС', trans)}`;
  }
  function vNpz() {
    const sb = sub(), d = dsT(), hasN = has('npz'), R = npzR(), mg = npzMargin(), N = s.np;
    const capN = E.capOf(s, 'npz');
    if (sb === 'kpi') {
      const dd = s.daily.slice(-90), L = dd.map(x => x.d.slice(5).split('-').reverse().join('.'));
      const rows = R ? [['Нефть (сырьё)', R.F, 1], ['АИ-98', R.out.a98], ['АИ-95', R.out.a95], [R.r92 >= 92 ? 'АИ-92' : 'АИ-80 (некондиция)', R.out.ai], ['Дизель', R.out.dt], ['Мазут', R.out.mz], ['Нафта — опт', R.side.naf], ['СУГ', R.side.lpg], ['Вакуумный газойль', R.side.vgo], ['Битум', R.side.bit], ['Топливо, газ, кокс, потери', R.loss]] : [];
      const q = [
        ['Бензин', 'Октановое число (ИМ)', '≥ 92', R && R.out.ai > 0 ? num(R.ron, 1) : '—', R && R.out.ai > 0 && R.ron >= 92],
        ['АИ-92', 'ОЧ после компаундирования', '≥ 92', R && R.gas > 0 ? num(R.r92, 1) : '—', R && R.gas > 0 && R.r92 >= 92],
        ['АИ-95 / АИ-98', 'Выпуск по плану', `${N.g95}% / ${N.g98}%`, R && R.gas > 0 ? `${pct(R.out.a95 / R.gas)} / ${pct(R.out.a98 / R.gas)}` : '—', R && R.gas > 0 && R.out.a95 >= R.gas * N.g95 / 100 - 0.01 && R.out.a98 >= R.gas * N.g98 / 100 - 0.01],
        ['Дизель', 'Сера, ppm', '≤ 10 (К5)', R ? num(R.sul) : '—', R && R.sul <= 10],
        ['Дизель', 'Экологический класс', 'К5', R ? E.sulClass(R.sul) : '—', R && R.sul <= 10],
        ['Нефть после ЭЛОУ', 'Соли, мг/л', '≤ 3', R ? num(R.saltOut, 1) : '—', R && R.saltOut <= 3],
        ['Нефть после ЭЛОУ', 'Вода, %', '≤ 0,2', R ? num(R.waterOut, 2) : '—', R && R.waterOut <= 0.2]];
      return `${npzGauges(R)}
        <div class="kpis">
          ${kpiTile('Загрузка ЭЛОУ-АТ', pct(d.load), `${num(d.feed)} / ${num(capN)} т/сут`, lvl(d.load, 0.7, 0.4))}
          ${kpiTile('Маржа переработки', (mg.diff >= 0 ? '+' : '') + num(mg.diff) + ' ₸/т', 'к продаже сырой нефти', mg.diff >= 0 ? 'good' : 'bad')}
          ${kpiTile('Катализатор риформинга', has('npz_ref') ? pct(s.cat.rf) : '—', 'активность', has('npz_ref') ? lvl(s.cat.rf, 0.8, 0.6) : '')}
          ${kpiTile('Катализатор ГО', has('npz_hdo') ? pct(s.cat.hdo) : '—', 'активность', has('npz_hdo') ? lvl(s.cat.hdo, 0.8, 0.6) : '')}
        </div>
        <div class="grid2">
          ${card('Материальный баланс, сутки', R ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Поток</th><th>т/сут</th><th>%</th></tr></thead><tbody>${rows.map(([n, v, b]) => `<tr${b ? ' class="hl"' : ''}><td>${n}</td><td>${num(v, 1)}</td><td>${pct(v / R.F, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Нет переработки</p>')}
          ${card('Паспорт качества', `<div class="tscroll"><table class="tbl"><thead><tr><th>Показатель</th><th>Норма</th><th>Факт</th></tr></thead><tbody>${q.map(r => `<tr><td>${r[1]}<br><small class="muted">${r[0]}</small></td><td>${r[2]}</td><td class="${r[3] === '—' ? '' : r[4] ? 'tgood' : 'tbad'}">${r[3]}</td></tr>`).join('')}</tbody></table></div>`)}
        </div>
        ${card('Загрузка установок', NPZ_LIST().map(u => `<div class="ubar"><span>${UNAME[u]}</span>${has(u) ? bar(uLoad(R, u), uLoad(R, u) > 0.95 ? 'warn' : 'good') : '<small>не построена</small>'}<b>${has(u) ? pct(uLoad(R, u)) : ''}</b></div>`).join(''))}
        <div class="grid2">
          ${card('ОЧ бензина и глубина, 90 дней', G.line({ labels: L, series: [{ name: 'ОЧ', color: FCOL.ai, values: dd.map(x => x.ron != null ? x.ron : null) }, { name: 'Глубина, %', color: C.aqua, values: dd.map(x => x.dep != null ? x.dep * 100 : null) }], height: 180, empty: 'Появится после запуска НПЗ' }))}
          ${card('Сера в ДТ и соли, 90 дней', G.line({ labels: L, series: [{ name: 'Сера, ppm', color: FCOL.dt, values: dd.map(x => x.sul != null ? x.sul : null) }], height: 180, unit: 'ppm', empty: 'Появится после запуска НПЗ' }))}
        </div>`;
    }
    if (sb === 'mode') {
      const sl = (k, label, v, min, max, unit, norm, dis) => `<div class="slider${dis ? ' dis' : ''}"><label>${label}: <b id="${k}v">${v}${unit}</b> <small>${norm}</small></label><input type="range" min="${min}" max="${max}" step="1" value="${v}" data-input="${k}" data-change="${k}"${dis ? ' disabled' : ''}></div>`;
      return `<div class="grid2">
        ${card('Сырьё и отбор', `
          ${sl('feed', 'Загрузка НПЗ', s.ds.feed, 0, Math.max(400, Math.round(capN / 10) * 10), ' т/сут', `мощность ${num(capN)} т`)}
          <label class="sub-l">Профиль отбора (конец кипения бензина)</label><div class="seg seg3">${[['ai', 'Бензин 200°C'], ['bal', '180°C'], ['dt', 'Дизель 160°C']].map(([k, n]) => btn(n, 'dsMode', k, s.ds.mode === k ? 'on' : '')).join('')}</div>
          ${sl('elT', 'ЭЛОУ: температура', N.elT, 90, 150, '°C', 'норма 120–140')}
          ${sl('wash', 'ЭЛОУ: промывочная вода', N.wash, 0, 12, '%', 'норма 5–10')}
          ${sl('t1', 'Печь П-1: выход', N.t1, 330, 380, '°C', 'норма 350–362, выше — кокс')}`)}
        ${card('Вторичные процессы', `
          ${sl('tr', 'Риформинг: реакторы', N.tr, 470, 525, '°C', 'выше — ОЧ, ниже выход', !has('npz_ref'))}
          ${sl('th', 'Гидроочистка: реактор', N.th, 320, 390, '°C', 'выше — меньше серы', !has('npz_hdo'))}
          ${sl('tf', 'Каткрекинг: реактор', N.tf, 490, 540, '°C', 'выше — конверсия и кокс', !has('npz_fcc'))}
          <label class="check"><input type="checkbox" data-change="npbit" ${N.bit ? 'checked' : ''} ${has('npz_bit') ? '' : 'disabled'}> Битумная установка в работе (зимой битум дешевле мазута)</label>`)}
        ${card('Компаундирование бензина', `
          ${sl('g95', 'Доля АИ-95', N.g95, 0, 70, '%', 'спрос 30–40%', !has('npz_ref'))}
          ${sl('g98', 'Доля АИ-98', N.g98, 0, 30, '%', 'спрос 5–10%', !has('npz_ref'))}
          ${R && R.gas > 0 ? `<div class="kv3"><div><span>ОЧ пула</span><b class="${R.ron >= 92 ? 'tgood' : 'tbad'}">${num(R.ron, 1)}</b></div><div><span>АИ-98 / 95 / 92</span><b>${num(R.out.a98, 1)} / ${num(R.out.a95, 1)} / ${num(R.out.ai, 1)} т</b></div><div><span>ОЧ остатка АИ-92</span><b class="${R.r92 >= 92 ? 'tgood' : 'tbad'}">${num(R.r92, 1)}</b></div></div>
          ${R.out.a98 < R.gas * N.g98 / 100 - 0.01 || R.out.a95 < R.gas * N.g95 / 100 - 0.01 ? '<p class="hint twarn">Октана не хватает на план — поднимите температуру риформинга</p>' : ''}` : '<p class="hint">Нужен риформинг: без него бензина нет.</p>'}
          <p class="hint">АИ-98 и АИ-95 дороже, но требуют высокого ОЧ пула.</p>`)}
        ${card('Задвижки отгрузки', `<div class="valves">${[['gas', 'Бензин'], ['dt', 'Дизель'], ['mz', 'Мазут'], ['bit', 'Битум']].map(([k, n]) => { const o = k === 'bit' ? N.bit : N.v[k] !== false; return `<button class="vbtn ${o ? 'on' : 'off'}" data-act="valve" data-arg="${k}">${wheelIcon(o, k)}<b>${n}</b><span class="vplate ${o ? 'po' : 'pc'}">${o ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</span></button>`; }).join('')}</div>
          <p class="hint">Закрытая задвижка — продукт копится в парке. Битум: закрыто — гудрон уходит в мазут.</p>`)}
        ${card('Прогноз при этом режиме', R ? `<div class="kv3"><div><span>Бензин 92/95/98</span><b>${num(R.gas, 1)} т · ОЧ ${R.gas > 0 ? num(R.ron, 1) : '—'}</b></div><div><span>Дизель</span><b>${num(R.out.dt, 1)} т · ${E.sulClass(R.sul)}</b></div><div><span>Мазут</span><b>${num(R.out.mz, 1)} т</b></div>
          <div><span>Глубина</span><b>${pct(R.depth, 1)}</b></div><div><span>Соли</span><b class="${R.saltOut <= 3 ? 'tgood' : 'tbad'}">${num(R.saltOut, 1)} мг/л</b></div><div><span>Маржа</span><b class="${mg.diff >= 0 ? 'tgood' : 'tbad'}">${num(mg.diff)} ₸/т</b></div></div>` : '<p class="hint">Постройте НПЗ</p>')}
        ${card('Продажа и запас', `<label class="sub-l">Продажа оптом</label><div class="seg seg3">${[['daily', 'Ежедневно'], ['season', 'По сезону']].map(([k, n]) => btn(n, 'dsSell', k, s.ds.sell === k ? 'on' : '')).join('')}</div>
          ${sl('res', 'Запас для АЗС', s.ds.res, 0, 30, ' сут', '')}
          <p class="hint">«По сезону»: бензин копится до лета, дизель и мазут — до зимы.</p>`)}
      </div>`;
    }
    if (sb === 'units') {
      return `<div class="kpis">${kpiTile('Индекс Нельсона', num(E.nelson(s), 1), 'сложность НПЗ')}${kpiTile('Глубина', R ? pct(R.depth, 1) : '—', 'переработки')}${kpiTile('Средний износ', pct(1 - avgH(NPZ_LIST()) / 100), 'установок НПЗ', avgH(NPZ_LIST()) < 50 ? 'bad' : avgH(NPZ_LIST()) < 70 ? 'warn' : 'good')}</div>
        ${card('Ремонты', `<p>Авторемонт НПЗ: <b class="${E.dsCfg(s).fix.npz.on ? 'tgood' : 'twarn'}">${E.dsCfg(s).fix.npz.on ? 'включён' : 'выключен'}</b> ${btn('Настроить', 'goRepair', 'npz', 'small')}</p><p class="hint">Текущий ремонт: +30% ресурса, остановка 4 сут. Капитальный: ресурс 100%, остановка 20 сут. Износ выше 75% — аварийные остановки.</p>`)}
        <div class="gwells">${NPZ_LIST().map(u => { const B = D.BUILD[u], f = E.facs(s, u)[0], req = B.req && !has(B.req);
          const cat = u === 'npz_ref' ? s.cat.rf : u === 'npz_hdo' ? s.cat.hdo : null;
          return `<div class="gwell ${f ? 'work' : ''}"><div class="w-h"><b>${G.icon('npz')} ${B.name}</b>${f ? facPill(f) : pill('нет', '')}</div>
            <small>${B.desc}</small>${f && (f.status !== 'ok' || f.regen > 0) ? G.danger('НЕ ВКЛЮЧАТЬ! РАБОТАЮТ ЛЮДИ', f.regen > 0 ? 'регенерация катализатора' : f.status === 'fail' ? 'авария' : 'ремонт') : ''}
            <div class="kv3"><div><span>Мощность</span><b>${num(B.cap)} т/сут</b></div><div><span>Загрузка</span><b>${f ? pct(uLoad(R, u)) : '—'}</b></div><div><span>Нельсон</span><b>×${E.NELSON[u]}</b></div></div>
            ${f ? `${bar(f.health / 100, f.health < 40 ? 'bad' : f.health < 65 ? 'warn' : 'good')}<small>износ ${Math.round(100 - f.health)}%${f.health < 25 ? ' — риск аварии' : ''}${cat != null ? ` · катализатор ${pct(cat)}` : ''}</small>` : ''}
            <div class="btnrow">${f ? (cat != null ? btn(`Регенерация · ${money((u === 'npz_ref' ? 30e6 : 25e6) * idx())}`, 'npzRegen', f.id, 'small', f.regen > 0 || f.status !== 'ok') : '') + fixBtns(f) : btn(`Построить · ${money(B.cost * idx())}`, 'tender', u, 'small primary', req)}${req ? `<small>нужен ${D.BUILD[B.req].name}</small>` : ''}</div></div>`; }).join('')}</div>`;
    }
    if (sb === 'prod') return vNpzProd();
    if (sb === 'contracts') return vNpzContracts();
    if (sb === 'safety') return vSafety();
    if (sb === 'staff' || sb === 'energy' || sb === 'repair' || sb === 'stock') return dsUnit('npz', sb);
    return `${npzPult()}${E.facs(s, 'npz').length ? shiftBoard('npz', 'Смены НПЗ: работа 24 часа') : ''}${card('Технологическая схема НПЗ (онлайн)', `<div class="swipe-hint">← листайте схему →</div><div class="scheme-wrap big">${npzScheme()}</div>
      <p class="hint">Серые блоки — не построены. Жёлтые — режим вне нормы.</p>`)}
      ${npzGauges(R)}
      <div class="kpis">
        ${kpiTile('Переработка', num(d.feed) + ' т/сут', hasN ? `загрузка ${pct(d.load)}` : 'нет НПЗ', hasN ? lvl(d.load, 0.7, 0.3) : '')}
        ${kpiTile('Маржа НПЗ', (mg.diff >= 0 ? '+' : '') + num(mg.diff) + ' ₸/т', 'к продаже сырой нефти', mg.diff >= 0 ? 'good' : 'bad')}
      </div>
      ${!hasN ? card('Свой НПЗ', `<p class="hint" style="margin-top:0">Начните с ЭЛОУ-АТ, затем риформинг, гидроочистка, вакуум и крекинг — каждая установка углубляет переработку.</p><div class="btnrow">${btn('Построить НПЗ · ' + money(D.BUILD.npz.cost * idx()), 'tender', 'npz', 'primary')}</div>`) : ''}`;
  }
  const NPZ_LIST = () => E.NPZ_UNITS;
  const avgH = types => { const fs = s.fac.filter(f => types.includes(f.type)); return fs.length ? fs.reduce((a, f) => a + f.health, 0) / fs.length : 100; };
  const facPill = f => f.regen > 0 ? pill('регенерация ' + f.regen + ' сут', 'warn') : f.status === 'service' ? pill(`${f.fixKind === 'kr' ? 'капремонт' : 'ремонт'} ${f.serviceDays} сут`, 'warn') : f.status === 'fail' ? pill('авария', 'bad') : f.status === 'ok' ? pill('в работе', 'good') : pill('стройка', '');
  const fixBtns = f => f.status === 'service' || f.regen > 0 ? '' : btn(`Текущий · ${money(E.fixCost(s, f, 'tr'))}`, 'fixfac', f.id + ':tr', 'small' + (f.health < 50 || f.status === 'fail' ? ' primary' : '')) + btn(`Капремонт · ${money(E.fixCost(s, f, 'kr'))}`, 'fixfac', f.id + ':kr', 'small');
  /* ===== Договоры на нефтепродукты: СНГ, госконтракты, внутренние покупатели ===== */
  const FLAG = {
    KZ: '<rect width="30" height="20" fill="#00AFCA"/><rect x="1.5" width="1.6" height="20" fill="#FEC50C" opacity=".9"/><circle cx="16" cy="9" r="3.6" fill="#FEC50C"/><path d="M11 13.5q5 2.5 10 0" stroke="#FEC50C" stroke-width="1.1" fill="none"/>',
    RU: '<rect width="30" height="20" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039A6"/><rect y="13.33" width="30" height="6.67" fill="#D52B1E"/>',
    UZ: '<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.4" fill="#0099B5"/><rect y="13.6" width="30" height="6.4" fill="#1EB53A"/><rect y="6.4" width="30" height=".6" fill="#CE1126"/><rect y="13" width="30" height=".6" fill="#CE1126"/><circle cx="5" cy="3.2" r="2.1" fill="#fff"/><circle cx="5.9" cy="3.2" r="1.8" fill="#0099B5"/>',
    KG: '<rect width="30" height="20" fill="#E8112D"/><circle cx="15" cy="10" r="5" fill="#FFEF00"/><circle cx="15" cy="10" r="2.6" fill="#E8112D"/><path d="M12.6 10h4.8M15 7.6v4.8" stroke="#FFEF00" stroke-width=".7"/>',
    TJ: '<rect width="30" height="20" fill="#fff"/><rect width="30" height="5.7" fill="#CC0000"/><rect y="14.3" width="30" height="5.7" fill="#006600"/><path d="M12.5 11.3h5l-.6-2-1.2 1-0.7-1.6-.7 1.6-1.2-1z" fill="#F8C300"/>',
    AZ: '<rect width="30" height="20" fill="#00B5E2"/><rect y="6.67" width="30" height="6.67" fill="#EF3340"/><rect y="13.33" width="30" height="6.67" fill="#509E2F"/><circle cx="14.2" cy="10" r="2.3" fill="#fff"/><circle cx="14.9" cy="10" r="1.9" fill="#EF3340"/><circle cx="17.3" cy="10" r=".9" fill="#fff"/>',
    AM: '<rect width="30" height="20" fill="#D90012"/><rect y="6.67" width="30" height="6.67" fill="#0033A0"/><rect y="13.33" width="30" height="6.67" fill="#F2A800"/>',
    BY: '<rect width="30" height="20" fill="#C8313E"/><rect y="13.33" width="30" height="6.67" fill="#4AA657"/><rect width="4" height="20" fill="#fff"/><path d="M2 1l1.3 2L2 5 .7 3zM2 7l1.3 2L2 11 .7 9zM2 13l1.3 2L2 17 .7 15z" fill="#C8313E"/>',
    MD: '<rect width="30" height="20" fill="#FFD200"/><rect width="10" height="20" fill="#0046AE"/><rect x="20" width="10" height="20" fill="#CC092F"/><path d="M13.3 8h3.4v3.2q0 1.6-1.7 2.2-1.7-.6-1.7-2.2z" fill="#B07E3A"/>'
  };
  const flag = cc => `<svg class="flag" viewBox="0 0 30 20" width="27" height="18" aria-label="${esc((D.PC_COUNTRIES[cc] || {}).name || '')}">${FLAG[cc] || ''}<rect width="30" height="20" fill="none" stroke="#0006" stroke-width=".8"/></svg>`;
  const PCN = { ai: 'АИ-92', a95: 'АИ-95', dt: 'ДТ', mz: 'Мазут' }, PCC = { ai: '#e5a50a', a95: '#e66100', dt: '#3584e4', mz: '#6b4f3a' };
  function vNpzContracts() {
    if (!E.facs(s, 'npz').length) return card('Договоры на нефтепродукты', '<p class="hint">Постройте НПЗ — появятся покупатели бензина, дизеля и мазута: внутренние, из стран СНГ и госконтракты.</p>');
    const P = s.pc || { offers: [], list: [] }, act = P.list.filter(c => c.status === 'active'), done = P.list.filter(c => c.status !== 'active').slice(-6).reverse();
    const pd = E.parts(s.day), dim = new Date(Date.UTC(pd.y, pd.m, 0)).getUTCDate(), d = dsT(), feed = Math.max(1, s.ds.feed) * 30, Y = E.npzYield(s);
    const outM = { ai: (d.out ? d.out.ai : 0) * 30, a95: (d.out ? d.out.a95 : 0) * 30, dt: (d.out ? d.out.dt : 0) * 30, mz: (d.out ? d.out.mz : 0) * 30 };
    const contr = k => sum(act.filter(c => c.prod === k), c => c.monthly);
    const spot = k => E.spotNet(s, k);
    const kindPill = k => `<span class="pck ${k}">${E.PC_KIND[k]}</span>`;
    const qLamp = c => `<i class="ol ${E.pcOk(s, c) ? 'g' : 'r'}"></i>`;
    const cRow = c => { const plan = c.monthly * pd.d / dim, f = c.shippedMonth, net = E.pcNet(s, c), sp = spot(c.prod), C = D.PC_COUNTRIES[c.cc];
      return `<div class="pcc"><div class="pc-h">${flag(c.cc)}<div class="pc-t"><b>${esc(c.buyer)}</b><small>${esc(C.name)} · №${c.id} · ${kindPill(c.kind)}</small></div><span class="pcp" style="--c:${PCC[c.prod]}">${PCN[c.prod]}</span></div>
        <div class="pc-bar"><i style="width:${Math.min(100, f / c.monthly * 100)}%"></i><em style="left:${Math.min(100, plan / c.monthly * 100)}%"></em></div>
        <div class="pc-n"><span>отгружено <b class="${f >= plan * 0.95 ? 'tgood' : f >= plan * 0.7 ? 'twarn' : 'tbad'}">${num(f)}</b> из ${num(c.monthly)} т</span><span>осталось ${c.monthsLeft} мес</span></div>
        <div class="pc-g"><div><small>Цена</small><b>${num(E.pcPrice(s, c))} ₸/т</b><small>рынок ${c.prem >= 0 ? '+' : ''}${num(c.prem, 1)}%${E.qualF(s, c.prod) < 1 ? ' · скидка за качество' : ''}</small></div>
          <div><small>Нетбэк</small><b class="${net >= sp ? 'tgood' : 'twarn'}">${num(net)} ₸/т</b><small>${net >= sp ? '+' : ''}${num(net - sp)} к спот-опту</small></div>
          <div><small>Качество</small><b>${qLamp(c)} ${E.pcOk(s, c) ? 'норма' : 'брак'}</b><small>${esc(E.pcReqText(c))}</small></div></div>
        ${c.why ? `<p class="pc-w">⚠ ${esc(c.why)}</p>` : ''}
        <div class="btnrow">${btn('Расторгнуть', 'pcCancel', c.id, 'small ghost')}</div></div>`; };
    const oRow = o => { const net = E.pcNet(s, o), sp = spot(o.prod), ok = E.pcOk(s, o), C = D.PC_COUNTRIES[o.cc], fr = E.pcFreight(s, o), du = E.pcDuty(s, o);
      return `<div class="pcc offer"><div class="pc-h">${flag(o.cc)}<div class="pc-t"><b>${esc(o.buyer)}</b><small>${esc(C.name)} · ${kindPill(o.kind)}</small></div><span class="pcp" style="--c:${PCC[o.prod]}">${PCN[o.prod]}</span></div>
        <div class="pc-g"><div><small>Объём</small><b>${num(o.monthly)} т/мес</b><small>${o.months} мес · всего ${num(o.monthly * o.months)} т</small></div>
          <div><small>Нетбэк</small><b class="${net >= sp ? 'tgood' : 'twarn'}">${num(net)} ₸/т</b><small>${net >= sp ? '+' : ''}${num(net - sp)} к спот-опту</small></div>
          <div><small>Качество</small><b>${ok ? '<i class="ol g"></i> проходит' : '<i class="ol r"></i> нет'}</b><small>${esc(E.pcReqText(o))}</small></div></div>
        <p class="pc-f">Цена: рынок${E.qualF(s, o.prod) < 1 ? ` ×${num(E.qualF(s, o.prod), 2)} (качество)` : ''} ${o.prem >= 0 ? '+' : ''}${num(o.prem, 1)}% = ${num(E.pcPrice(s, o))} ₸/т${fr ? ` − ж/д ${num(fr)}` : ' · самовывоз'}${du ? ` − пошлина ${num(du)}` : ''} · штраф ${Math.round(o.penalty * 100)}% за недопоставку${o.kind === 'gov' ? ' · банковская гарантия 1% при подписании' : ''}</p>
        <div class="btnrow">${btn(ok ? 'Заключить договор' : 'Не проходит по качеству', 'pcAccept', o.id, 'small primary', !ok)}</div></div>`; };
    const bal = ['ai', 'a95', 'dt', 'mz'].filter(k => outM[k] > 1 || contr(k) > 0);
    const rev = sum(act, c => c.shippedMonth * E.pcNet(s, c));
    return `<div class="kpis">
      ${kpiTile('Действующих договоров', `${act.length}`, `СНГ ${act.filter(c => c.cc !== 'KZ').length} · внутр. ${act.filter(c => c.cc === 'KZ').length}`, '')}
      ${kpiTile('Отгружено за месяц', `${num(sum(act, c => c.shippedMonth))} т`, `план на сегодня ${num(sum(act, c => c.monthly * pd.d / dim))} т`, sum(act, c => c.shippedMonth) >= sum(act, c => c.monthly * pd.d / dim) * 0.95 ? 'good' : 'warn')}
      ${kpiTile('Выручка (нетбэк)', money(rev), 'по договорам в этом месяце', '')}
      ${kpiTile('Штрафы', money(sum(P.list, c => c.fines || 0)), 'за недопоставку, всего', sum(P.list, c => c.fines || 0) > 0 ? 'bad' : 'good')}
    </div>
    ${card('Баланс: выпуск и обязательства', bal.length ? `<div class="pcbal">${bal.map(k => { const o = outM[k], c = contr(k), r = o > 0 ? c / o : (c > 0 ? 9 : 0);
      return `<div class="pcb"><span class="pcp" style="--c:${PCC[k]}">${PCN[k]}</span>${segBar(Math.min(1, r), r > 1 ? 'bad' : r > 0.85 ? 'warn' : 'good')}<small>${num(c)} из ${num(o)} т/мес${r > 1 ? ' — <b class="tbad">перебор</b>' : ''}</small></div>`; }).join('')}</div>
      <p class="hint">Договоры отгружаются раньше спотового опта и запаса для АЗС. Законтрактуйте не больше 85% выпуска — при остановке установки будут штрафы.</p>` : '<p class="hint">НПЗ пока не выпускает продуктов.</p>')}
    ${card('Действующие договоры', act.length ? act.map(cRow).join('') : '<div class="empty">Нет договоров — выберите покупателя ниже</div>')}
    ${card('Предложения покупателей', (P.offers.length ? P.offers.map(oRow).join('') : '<div class="empty">Новые предложения — в начале месяца</div>') + `<p class="hint">Внутренние покупатели — самовывоз, цена около рынка. Экспорт в СНГ — премия к рынку, но ж/д тариф до границы покупателя и экспортная пошлина (с 2008 г.). Госконтракты — большие объёмы и сроки, строгие штрафы, срыв снижает доверие.</p>`)}
    ${done.length ? card('Завершённые', done.map(c => `<div class="prow"><span>${flag(c.cc)} №${c.id} ${esc(c.buyer)} · ${PCN[c.prod]}</span><b class="${c.status === 'done' ? 'tgood' : 'tbad'}">${c.status === 'done' ? 'исполнен' : 'расторгнут'}</b></div>`).join('')) : ''}`;
  }
  function vNpzProd() {
    const d = dsT(), has = E.facs(s, 'npz').length > 0;
      const h = s.history.slice(-24), L = h.map(x => ymRu(x.m));
      const pt = E.ptanks(s);
      const trows = pt.map(f => `<div class="gwell work"><div class="w-h"><b>${G.icon('ckppn')} ${esc(f.name)}</b>${facPill(f)}</div>
        ${bar(f.health / 100, f.health < 40 ? 'bad' : f.health < 65 ? 'warn' : 'good')}<small>износ ${Math.round(100 - f.health)}%</small>
        <div class="btnrow">${fixBtns(f)}</div><div class="btnrow">${FK.filter(k => k !== f.prod).map(k => btn('Под ' + E.PNAME[k], 'npzTank', f.id + ':' + k, 'small')).join('')}${btn('Снести', 'demolish', f.id, 'small ghost')}</div></div>`).join('');
      return `${card('Товарный парк НПЗ', `<div class="tanks">${FK.map(k => `<div class="tankc">${G.tank({ v: s.prodStock[k], c: E.prodCapK(s, k) || 1, purpose: k, w: 110, h: 100, id: 'pp' + k })}<b>${E.FUEL[k].name}</b><small>${num(s.prodStock[k])} / ${num(E.prodCapK(s, k))} т${!E.valveOpen(s, k) ? ' · задвижка закрыта' : E.holdK(s, k) ? ' · копим до сезона' : ''}</small></div>`).join('')}</div>
        ${dsT().full ? '<p class="hint tbad">Парк заполнен — НПЗ снижает загрузку</p>' : ''}
        <p class="hint">Встроенный парк НПЗ — 8 000 т. Новые РВС увеличивают объём для запаса АЗС и сезонного хранения.</p>`)}
      ${card('Построить РВС НПЗ', has ? FK.map(k => `<div class="prow"><span><span class="dot" style="background:${FCOL[k]}"></span>${E.FUEL[k].name}</span><div class="btnrow">${btn('3 000 т · ' + money(D.BUILD.npz_rvs.cost * idx()), 'tender', 'npz_rvs:' + k, 'small')}${btn('10 000 т · ' + money(D.BUILD.npz_rvs10.cost * idx()), 'tender', 'npz_rvs10:' + k, 'small')}</div></div>`).join('') : '<p class="hint" style="margin-top:0">Сначала постройте НПЗ.</p>')}
      ${pt.length ? card('РВС НПЗ', `<div class="gwells">${trows}</div><p class="hint">Перевод под другой продукт — зачистка ${money(2e6 * idx())}, резервуар должен быть свободен.</p>`) : ''}
      <div class="grid2">
        ${card('Переработка по месяцам, тыс. т', G.bars({ labels: L, series: [{ name: 'АИ-92', color: FCOL.ai, values: h.map(x => ((x.ds && x.ds.ai) || 0) / 1e3) }, { name: 'АИ-95', color: FCOL.a95, values: h.map(x => ((x.ds && x.ds.a95) || 0) / 1e3) }, { name: 'АИ-98', color: FCOL.a98, values: h.map(x => ((x.ds && x.ds.a98) || 0) / 1e3) }, { name: 'Дизель', color: FCOL.dt, values: h.map(x => ((x.ds && x.ds.dt) || 0) / 1e3) }, { name: 'Мазут', color: FCOL.mz, values: h.map(x => ((x.ds && x.ds.mz) || 0) / 1e3) }], stacked: true, height: 190, unit: 'тыс. т', empty: 'Появится после первого месяца работы НПЗ' }))}
        ${card('Выручка от нефтепродуктов', G.bars({ labels: L, series: [{ name: 'Опт', color: C.blue, values: h.map(x => (x.cats && x.cats['Продажа нефтепродуктов']) || 0) }, { name: 'АЗС', color: C.aqua, values: h.map(x => (x.cats && x.cats['Розница АЗС']) || 0) }], height: 190, unit: '₸', empty: 'Появится после первого месяца' }))}
      </div>`;
      }
  /* ===================== АЗС ===================== */
  const RK = ['ai', 'a95', 'a98', 'dt'], RN = { ai: 'АИ-92', a95: 'АИ-95', a98: 'АИ-98', dt: 'ДТ' };
  const PCOL = { ai: '#2e8b57', a95: '#1f7f9a', a98: '#6d4bb3', dt: '#c98a14' };
  const DENS = { ai: 0.745, a95: 0.75, a98: 0.755, dt: 0.84 };
  function azsPic(f) {
    const st = f.st || {}, cars = f.status === 'ok' ? Math.min(6, Math.round((st.served || 0) / 40)) : 0;
    const brand = esc((s.company.name.replace(/^(АО|ТОО|ООО|ПАО|ОАО|ЗАО|AO|LLP)\s+/i, '').replace(/[«»"']/g, '').split(' ')[0] || s.company.name).toUpperCase().slice(0, 14));
    const lv = k => Math.max(0, Math.min(1, (f.tk[k] || 0) / (f.tkCap[k] || 1)));
    const pumps = Array.from({ length: f.trk }, (_, i) => { const x = f.trk === 1 ? 140 : 70 + i * (160 / (f.trk - 1)); return `<rect x="${x - 5}" y="64" width="10" height="20" rx="2" fill="#2f4a73"/><rect x="${x - 3}" y="67" width="6" height="4" fill="#7fd1ff"/>`; }).join('');
    const car = (col, d) => `<g class="car" style="animation-delay:${d}s"><rect x="-30" y="77" width="24" height="8" rx="3" fill="${col}"/><rect x="-26" y="72" width="13" height="6" rx="2" fill="#9fb6c9"/><circle cx="-25" cy="86" r="2.6" fill="#111"/><circle cx="-11" cy="86" r="2.6" fill="#111"/></g>`;
    const cols = ['#e6edf3', '#d84a3a', '#3987e5', '#c98500', '#3fbf6f', '#9b7be0'];
    return `<svg class="azspic big" viewBox="0 0 320 110" aria-hidden="true">
      <rect x="40" y="30" width="200" height="12" rx="2" fill="${f.status === 'ok' ? '#d84a3a' : '#56687a'}"/><text x="140" y="39.5" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">${brand}</text>
      <rect x="48" y="42" width="5" height="44" fill="#56687a"/><rect x="227" y="42" width="5" height="44" fill="#56687a"/>
      ${pumps}
      <rect x="250" y="50" width="62" height="36" rx="3" fill="#24384c"/><text x="281" y="64" text-anchor="middle" font-size="7" fill="#cfe0ef">МАГАЗИН</text>${f.cafe ? '<text x="281" y="76" text-anchor="middle" font-size="7" fill="#c98500">КАФЕ</text>' : ''}
      ${f.wash ? '<rect x="2" y="56" width="34" height="30" rx="3" fill="#1d4f7a"/><text x="19" y="74" text-anchor="middle" font-size="6.5" fill="#cfe0ef">МОЙКА</text>' : ''}
      <rect x="0" y="88" width="320" height="4" fill="#2b3a4a"/>
      ${Array.from({ length: cars }, (_, i) => car(cols[i % cols.length], i * 1.1)).join('')}
      ${f.status === 'service' ? '<text x="140" y="60" text-anchor="middle" font-size="11" font-weight="800" fill="#e6a23c">РЕМОНТ</text>' : ''}
      ${(st.queue || 0) > 1 ? `<text x="6" y="104" font-size="8" fill="#e66767">очередь ~${num(st.queue)} маш.</text>` : ''}
      ${(st.deliv || 0) > 0 ? '<g class="truck"><rect x="250" y="94" width="34" height="11" rx="3" fill="#c98500"/><rect x="284" y="96" width="12" height="9" rx="2" fill="#e6edf3"/></g>' : ''}
    </svg>`;
  }
  function azsLogistics() {
    const d = dsT(), az = E.facs(s, 'azs').filter(f => f.status === 'ok');
    const pipe = (dd, flow, col) => `<path d="${dd}" class="pipe"/><path d="${dd}" class="flow ${flow > 0.3 ? 'on' : ''}" stroke="${col}" style="animation-duration:${Math.max(0.7, 4 / ((flow || 0) / 20 + 0.3)).toFixed(2)}s"/>`;
    const box = (x, y, w, h, t1, v, v2, st) => `<g class="node ${st || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + 18}" class="nt">${t1}</text><text x="${x + w / 2}" y="${y + 34}" class="nv">${v}</text>${v2 ? `<text x="${x + w / 2}" y="${y + 49}" class="ns">${v2}</text>` : ''}</g>`;
    const own = E.facs(s, 'npz').length > 0;
    const sold = RK.reduce((a, k) => a + d.azs[k] / DENS[k] * 1000, 0);
    return `<svg class="scheme" viewBox="0 0 900 260" role="img" aria-label="Логистика АЗС">
      ${box(20, 30, 180, 64, 'Парк НПЗ', own ? `${num(s.prodStock.ai + s.prodStock.a95 + s.prodStock.a98)} т бенз. · ${num(s.prodStock.dt)} т ДТ` : 'нет НПЗ', own ? `АИ-92 ${E.retailOK(s, 'ai') ? '✓' : '✗'} · ДТ ${E.retailOK(s, 'dt') ? '✓' : '✗ класс'}` : '', own ? '' : 'off')}
      ${box(20, 160, 180, 64, 'Оптовый рынок', s.ds.buy ? `${num(d.bought, 1)} т/сут` : 'закупка выкл.', 'докупка', s.ds.buy ? '' : 'off')}
      ${pipe('M200 62 H330 V110 H360', d.deliv - d.bought, FCOL.ai)}${pipe('M200 192 H330 V150 H360', d.bought, '#7fb4ff')}
      ${box(360, 95, 200, 70, 'Бензовозы', `${num(d.deliv, 1)} т/сут`, `своих ${s.ds.trucks} (${num(E.truckCap(s))} т) · наём ${num(d.hired, 1)} т`, d.hired > 0 ? 'n-warn' : '')}
      ${pipe('M560 130 H640', d.deliv, FCOL.dt)}
      ${box(640, 80, 240, 100, `АЗС: ${az.length}`, `${num(d.cars)} машин/сут`, `${num(sold)} л · очередь ${num(d.queue)}`, d.dry > 0.5 ? 'n-warn' : '')}
      <text x="760" y="196" class="ns">${d.dry > 0.5 ? 'сухие резервуары: −' + num(d.dry, 1) + ' т' : 'резервуары в норме'}</text>
    </svg>`;
  }
  const azsE = m => m.rev - m.cogs - m.exc + m.shop - m.opex - m.staff - m.deliv;
  const tone = (v, good, warn) => v >= good ? 'good' : v >= warn ? 'warn' : 'bad';
  function vAzsFin() {
    const F = s.azsFin || {}, H = (s.azsHist || []).slice(-24), last = H[H.length - 1];
    const ebitda = F.days ? azsE(F) : 0, gross = (F.rev || 0) - (F.cogs || 0) - (F.exc || 0) + (F.shop || 0);
    const L = F.l ? RK.reduce((a, k) => a + F.l[k], 0) : 0, marg = (F.rev || 0) > 0 ? ebitda / F.rev : 0;
    const row = (n, v, p, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td>${n}</td><td class="${v < 0 ? 'tbad' : ''}">${money(v)}</td><td class="${p != null && p < 0 ? 'tbad' : ''}">${p == null ? '—' : money(p)}</td></tr>`;
    const P = last || null;
    const az = E.facs(s, 'azs').map(f => { E.facs; const m = f.fin && f.fin.m; const e = m && m.days ? azsE(m) : 0; return { f, m, e, mg: m && m.rev > 0 ? e / m.rev : 0, l: m ? RK.reduce((a, k) => a + m.l[k], 0) : 0 }; }).sort((a, b) => b.e - a.e);
    const dn = RK.map(k => ({ name: RN[k], value: F.l ? F.l[k] : 0, color: FCOL[k] }));
    return `<div class="kpis">
        ${kpiTile('Выручка за месяц', money(F.rev || 0), `топливо · ${num(F.days || 0)} дн.`, (F.rev || 0) > 0 ? 'good' : '')}
        ${kpiTile('Валовая маржа', money(gross), (F.rev || 0) > 0 ? pct(gross / F.rev, 1) + ' от выручки' : '—', tone(gross, 1, 0))}
        ${kpiTile('EBITDA', money(ebitda), last ? `прошлый месяц ${money(last.ebitda)}` : 'после всех затрат', tone(ebitda, 1, 0))}
        ${kpiTile('Рентабельность', pct(marg, 1), 'EBITDA / выручка', tone(marg, 0.06, 0.02))}
        ${kpiTile('Маржа на литр', L > 0 ? num(ebitda / L, 1) + ' ₸/л' : '—', 'чистыми', L > 0 ? tone(ebitda / L, 4, 0) : '')}
        ${kpiTile('Продано', num(L) + ' л', `${num(F.cars || 0)} машин`)}
      </div>
      <div class="grid2">
        ${card('Отчёт о прибыли АЗС', `<div class="tscroll"><table class="tbl"><thead><tr><th>Статья</th><th>Месяц</th><th>Прошлый</th></tr></thead><tbody>
          ${row('Выручка: топливо', F.rev || 0, P && P.rev)}
          ${row('Себестоимость топлива', -(F.cogs || 0), P && -P.cogs)}
          ${row('Акциз', -(F.exc || 0), P && -P.exc)}
          ${row('Магазин, кафе, мойка (маржа)', F.shop || 0, P && P.shop)}
          ${row('Валовая маржа', gross, P && (P.rev - P.cogs - P.exc + P.shop), 'hl')}
          ${row('Персонал сети (с налогами)', -(F.staff || 0), null)}
          ${row('Содержание: аренда, электроэнергия, охрана', -(F.opex || 0), P && -P.opex)}
          ${row('Доставка бензовозами', -(F.deliv || 0), P && -P.deliv)}
          ${row('EBITDA', ebitda, P && P.ebitda, 'hl')}
        </tbody></table></div><p class="hint">Себестоимость — по оптовой цене (своё топливо тоже).</p>`)}
        ${card('Продажи по видам топлива, л', G.donut({ items: dn, center: num(L), sub: 'литров', unit: 'л' }))}
      </div>
      ${card('Выручка и EBITDA по месяцам', G.bars({ labels: H.map(x => ymRu(x.m)), series: [{ name: 'Выручка', color: C.blue, values: H.map(x => x.rev) }, { name: 'EBITDA', color: C.aqua, values: H.map(x => x.ebitda) }], height: 200, unit: '₸', empty: 'Появится после первого месяца' }))}
      ${card('Рейтинг станций (месяц)', az.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Станция</th><th>Литров</th><th>EBITDA</th><th>Рент.</th></tr></thead><tbody>
        ${az.map((x, i) => `<tr><td>${i + 1}. ${esc(x.f.name)}</td><td>${num(x.l)}</td><td class="t${tone(x.e, 1, 0)}">${money(x.e)}</td><td class="t${tone(x.mg, 0.06, 0.02)}">${pct(x.mg, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Нет АЗС</p>')}`;
  }
  function vAzs() {
    const sb = sub(), d = dsT(), az = E.facs(s, 'azs').filter(f => f.status === 'ok'), all = E.facs(s, 'azs');
    const litres = RK.reduce((a, k) => a + d.azs[k] / DENS[k] * 1000, 0), rev = d.azsRev;
    const check = d.cars > 0 ? (rev + d.shopRev / 0.35) / d.cars : 0;
    const margin = litres > 0 ? sum(RK, k => d.azs[k] * (E.retailPrice(s, k) - E.EXCISE[k] * idx() - E.fuelMarket(s, k))) / litres : 0;
    if (sb === 'fin') return vAzsFin();
    if (sb === 'price') {
      const h = s.history.slice(-24), L = h.map(x => ymRu(x.m));
      return `<div class="grid2">
        ${card('Цены на АЗС', `
          <div class="slider"><label>Наценка к рынку: <b id="mkpv">${s.ds.mkp > 0 ? '+' : ''}${s.ds.mkp}%</b></label><input type="range" min="-10" max="15" step="1" value="${s.ds.mkp}" data-input="mkp" data-change="mkp"></div>
          <div class="tscroll"><table class="tbl"><thead><tr><th>Топливо</th><th>Рынок</th><th>Наша</th><th>Маржа</th></tr></thead><tbody>
            ${RK.map(k => { const m = E.perLitre(s, k, E.retailPrice(s, k) - E.EXCISE[k] * idx() - E.fuelMarket(s, k)); return `<tr><td><span class="dot" style="background:${FCOL[k]}"></span>${RN[k]}</td><td>${num(E.perLitre(s, k, E.retailMarket(s, k)), 1)} ₸/л</td><td><b>${num(E.perLitre(s, k, E.retailPrice(s, k)), 1)} ₸/л</b></td><td class="${m > 0 ? 'tgood' : 'tbad'}">${num(m, 1)} ₸/л</td></tr>`; }).join('')}</tbody></table></div>
          <div class="tscroll"><table class="tbl"><thead><tr><th>Наценка</th>${[-10, -5, 0, 5, 10, 15].map(m => `<th>${m > 0 ? '+' : ''}${m}%</th>`).join('')}</tr></thead><tbody><tr><td>Клиенты</td>${[-10, -5, 0, 5, 10, 15].map(m => `<td class="${m === s.ds.mkp ? 'tgood' : ''}">${pct(Math.min(1.4, Math.exp(-m * 0.05)))}</td>`).join('')}</tr></tbody></table></div>
          <label class="check"><input type="checkbox" data-change="dsbuy" ${s.ds.buy ? 'checked' : ''}> Докупать топливо оптом, если своего нет или оно не по классу</label>
          <p class="hint">В рознице только АИ-92 и выше, дизель не ниже К4.</p>`)}
        ${card('Продажи АЗС по месяцам, т', G.bars({ labels: L, series: [{ name: 'Продано', color: C.aqua, values: h.map(x => (x.ds && x.ds.azs) || 0) }], height: 200, unit: 'т', empty: 'Появится после первого месяца' }))}
      </div>`;
    }
    if (sb === 'staff' || sb === 'energy' || sb === 'repair' || sb === 'stock') return dsUnit('retail', sb);
    if (sb === 'st') {
      if (!all.length) return card('Станции', '<p class="hint">Пока нет АЗС. Постройте на вкладке «Сеть».</p>');
      return `<div class="gwells">${all.map(f => { const st = f.st || {}, T = E.AZS_TRAF[f.loc] || E.AZS_TRAF.road, mx = E.azsMix(f), m = f.fin && f.fin.m;
        const days = k => st.served > 0 && mx[k] > 0 ? f.tk[k] / (st.served * mx[k]) : null;
        const eM = m && m.days ? azsE(m) : 0;
        return `<div class="gwell ${f.status === 'ok' ? 'work' : 'fail'}"><div class="w-h"><b>${G.icon('azs')} ${esc(f.name)}</b>${f.status !== 'ok' ? facPill(f) : pill(st.queue > 1 ? 'очередь' : st.dry > 0.1 ? 'нет топлива' : 'работает', st.queue > 1 || st.dry > 0.1 ? 'warn' : 'good')}</div>
          ${azsPic(f)}${f.status !== 'ok' ? G.danger('НЕ ВКЛЮЧАТЬ! РАБОТАЮТ ЛЮДИ', 'АЗС закрыта на ремонт') : ''}
          <div class="kv3"><div><span>Машин/сут</span><b>${num(st.served)}</b></div><div><span>Литров/сут</span><b>${num(st.l)}</b></div><div><span>Налив</span><b>${num(T.l)} л</b></div>
            <div><span>Загрузка ТРК</span><b class="t${tone(-(st.cars / (f.trk * 110)), -0.85, -1)}">${pct(Math.min(1.5, st.cars / (f.trk * 110)))}</b></div><div><span>Выручка/сут</span><b>${money(st.rev + st.shop)}</b></div><div><span>EBITDA/сут</span><b class="t${tone(st.ebitda || 0, 1, 0)}">${money(st.ebitda || 0)}</b></div></div>
          <div class="pumps">${RK.map(k => { const dd = days(k), l = st.l && f.fin ? (st.lk ? st.lk[k] : null) : null; return G.fuelPump({ label: RN[k], color: PCOL[k], liters: (st.lk || {})[k] || 0, level: f.tk[k] / f.tkCap[k], price: num(E.perLitre(s, k, E.retailPrice(s, k)), 1) + ' ₸/л', on: ((st.lk || {})[k] || 0) > 0, dry: f.tk[k] < 0.05 && f.status === 'ok' && mx[k] > 0, sub: dd == null ? 'запас —' : 'запас ' + num(dd, 1) + ' сут', daysCls: dd == null ? '' : dd < 2 ? 'tbad' : dd < 4 ? 'twarn' : 'tgood' }); }).join('')}</div>
          <div class="kv3"><div><span>Выручка месяца</span><b>${money(m ? m.rev + m.shop : 0)}</b></div><div><span>EBITDA месяца</span><b class="t${tone(eM, 1, 0)}">${money(eM)}</b></div><div><span>Рентабельность</span><b class="t${tone(m && m.rev ? eM / m.rev : 0, 0.06, 0.02)}">${m && m.rev ? pct(eM / m.rev, 1) : '—'}</b></div></div>
          ${bar(f.health / 100, f.health < 40 ? 'bad' : f.health < 65 ? 'warn' : 'good')}<small>износ ${Math.round(100 - f.health)}%${f.health < 50 ? ' — клиенты уходят' : ''} · колонок ${f.trk} · резервуары ${num(RK.reduce((a, k) => a + f.tkCap[k], 0))} т</small>
          <div class="btnrow">${fixBtns(f)}</div>
          <div class="btnrow">${!f.lpg ? btn('Газовая колонка · ' + money(18e6 * idx()), 'azsUp', f.id + ':lpg', 'small') : ''}${f.trk < 8 ? btn('+2 колонки · ' + money(10e6 * idx()), 'azsUp', f.id + ':trk', 'small') : ''}${!f.cafe ? btn('Кафе · ' + money(20e6 * idx()), 'azsUp', f.id + ':cafe', 'small') : ''}${!f.wash ? btn('Мойка · ' + money(30e6 * idx()), 'azsUp', f.id + ':wash', 'small') : ''}${f.tkCap.dt < 80 ? btn('Резервуары ×2 · ' + money(15e6 * idx()), 'azsUp', f.id + ':tank', 'small') : ''}</div></div>`; }).join('')}</div>`;
    }
    const F = s.azsFin || {}, eM = F.days ? azsE(F) : 0;
    return `${all.length ? shiftBoard('retail', 'Смены АЗС: работа 24 часа') : ''}<div class="kpis">
        ${kpiTile('Сеть АЗС', all.length, `${az.length} работают · ${num(d.cars)} машин/сут`, all.length > az.length ? 'warn' : '')}
        ${kpiTile('Продано за сутки', num(litres) + ' л', RK.map(k => `${RN[k].replace('АИ-', '')}: ${num(d.azs[k] / DENS[k] * 1000)}`).join(' · '), litres > 0 ? 'good' : '')}
        ${kpiTile('Выручка за сутки', money(rev + d.shopRev), 'топливо + магазин', rev > 0 ? 'good' : '')}
        ${kpiTile('EBITDA за месяц', money(eM), 'сеть АЗС', tone(eM, 1, 0))}
        ${kpiTile('Средний чек', num(check) + ' ₸', 'топливо + магазин')}
        ${kpiTile('Маржа', num(margin, 1) + ' ₸/л', 'после акциза и топлива', tone(margin, 3, 0))}
        ${kpiTile('Потери', num(d.queue) + ' маш.', d.dry > 0.1 ? `нет топлива: ${num(d.dry, 1)} т` : 'очереди у колонок', d.queue > 1 || d.dry > 0.1 ? 'warn' : 'good')}
        ${kpiTile('Износ сети', pct(1 - avgH(['azs']) / 100), 'средний', avgH(['azs']) < 50 ? 'bad' : avgH(['azs']) < 70 ? 'warn' : 'good')}
      </div>
      ${all.length ? card('Колонки сети за сутки', `<div class="pumps">${RK.map(k => { const tk = sum(all, f => f.tk[k] || 0), cp = sum(all, f => f.tkCap[k] || 0), dl = d.azs[k] > 0 ? tk / d.azs[k] : null; return G.fuelPump({ label: RN[k], color: PCOL[k], liters: d.azs[k] / DENS[k] * 1000, level: cp ? tk / cp : 0, price: num(E.perLitre(s, k, E.retailPrice(s, k)), 1) + ' ₸/л', on: d.azs[k] > 0, dry: cp > 0 && tk < 0.05, sub: dl == null ? 'запас —' : 'запас ' + num(dl, 1) + ' сут', daysCls: dl == null ? '' : dl < 2 ? 'tbad' : dl < 4 ? 'twarn' : 'tgood' }); }).join('')}</div>`) : ''}
      ${card('Логистика топлива (онлайн)', `<div class="swipe-hint">← листайте схему →</div><div class="scheme-wrap">${azsLogistics()}</div>`)}
      <div class="grid2">
        ${card('Бензовозы', `<p class="hint" style="margin-top:0">Свой бензовоз — 44 т/сут за ${money(20000 * idx())} в день. Наём — ${money(2500 * idx())} за тонну.</p>
          <div class="btnrow">${btn('Купить · ' + money(25e6 * idx()), 'trucks', s.ds.trucks + 1)}${s.ds.trucks > 0 ? btn('Продать один', 'trucks', s.ds.trucks - 1) : ''}</div>
          <p>Авторемонт АЗС: <b class="${E.dsCfg(s).fix.azs.on ? 'tgood' : 'twarn'}">${E.dsCfg(s).fix.azs.on ? 'включён' : 'выключен'}</b> ${btn('Настроить', 'goRepair', 'azs', 'small')}</p>`)}
        ${card('Построить АЗС', `${Object.entries(D.AZS_LOC).map(([k, L]) => { const T = E.AZS_TRAF[k]; return `<div class="prow"><span>${L.name[0].toUpperCase() + L.name.slice(1)} — ~${T.cars} машин/сут, налив ${T.l} л, дизель ${pct(T.dt)}</span><div class="btnrow">${btn(money(D.BUILD.azs.cost * L.cost * idx()), 'tender', 'azs:' + k, 'small')}</div></div>`; }).join('')}`)}
      </div>`;
  }
  /* ===================== Акции ===================== */
  function vShares() {
    const sb = sub(), S = s.sh, h12 = s.history.slice(-12), profit = sum(h12, x => x.net) * (h12.length ? 12 / h12.length : 0);
    if (sb === 'market') {
      const list = s.companies.slice().sort((a, b) => b.cap - a.cap).slice(0, 40);
      const pv = E.portValue(s), cost = sum(Object.values(s.port), p => p.qty * p.avg);
      const rowsP = Object.entries(s.port).map(([n, p]) => { const c = s.companies.find(x => x.name === n); const pr = c ? E.compPrice(c) : p.last; const i = s.companies.indexOf(c);
        return `<tr><td>${esc(n)}</td><td>${num(p.qty)}</td><td>${num(pr, 1)}</td><td class="${pr >= p.avg ? 'tgood' : 'tbad'}">${pr >= p.avg ? '+' : ''}${pct(pr / p.avg - 1, 1)}</td><td>${btn('Продать', 'shSell', i, 'small')}</td></tr>`; }).join('');
      return `<div class="kpis">${kpiTile('Портфель', money(pv), Object.keys(s.port).length + ' компаний')}${kpiTile('Результат', (pv - cost >= 0 ? '+' : '') + money(pv - cost), 'дивиденды ≈4% годовых', pv >= cost ? 'good' : 'bad')}</div>
        ${rowsP ? card('Мой портфель', `<div class="tscroll"><table class="tbl"><thead><tr><th>Компания</th><th>Акций</th><th>Цена</th><th>Доход</th><th></th></tr></thead><tbody>${rowsP}</tbody></table></div>`) : ''}
        ${card(esc(D.EXCHANGE), `<div class="tscroll"><table class="tbl"><thead><tr><th>Компания</th><th>Цена, ₸</th><th></th></tr></thead><tbody>
          ${list.map(c => `<tr><td>${esc(c.name)}<br><small class="muted">${money(c.cap)}</small></td><td>${num(E.compPrice(c), 1)}</td><td>${btn('Купить', 'shBuy', s.companies.indexOf(c), 'small')}</td></tr>`).join('')}</tbody></table></div>
          <p class="hint">Покупка — на ${money(100e6 * idx())}. Цены меняются раз в месяц вместе с рынком нефти.</p>`)}`;
    }
    if (!S.listed) {
      const cap = E.capitalization(s), need = E.ipoMin(s);
      return `<div class="kpis">${kpiTile('Оценка компании', money(cap), 'по активам и добыче')}${kpiTile('Цена акции (оценка)', num(E.fairPrice(s), 1) + ' ₸', `${num(S.total / 1e6)} млн акций`)}</div>
        ${card('Выход на биржу (IPO)', `${bar(Math.min(1, cap / need), cap >= need ? 'good' : 'warn')}<small>${money(cap)} из ${money(need)} для IPO</small>
          <p class="hint">IPO: компания выпускает новые акции и получает деньги. Скидка инвесторам 10%, комиссия 4%.</p>
          <div class="btnrow">${[10, 20, 30].map(p => btn(`IPO ${p}% · ≈${money(S.total * p / 100 * E.fairPrice(s) * 0.9)}`, 'shOp', 'ipo:' + p, p === 20 ? 'primary' : '', cap < need)).join('')}</div>`)}
        ${divCard(profit)}`;
    }
    const hist = S.hist.slice(-36), mc = E.marketCap(s), first = hist.length > 1 ? hist[hist.length - 2].p : S.price;
    return `<div class="kpis">
        ${kpiTile('Цена акции', num(S.price, 1) + ' ₸', `${S.price >= first ? '▲' : '▼'} ${pct(S.price / first - 1, 1)} за месяц`, S.price >= first ? 'good' : 'bad')}
        ${kpiTile('Капитализация', money(mc), 'P/E ' + (profit > 0 ? num(mc / profit, 1) : '—'))}
        ${kpiTile('В свободном обращении', pct(S.float, 1), `казначейских ${pct(S.treasury / S.total, 1)}`)}
        ${kpiTile('Настроение рынка', pct(S.sent), S.sent >= 1 ? 'выше оценки' : 'ниже оценки', S.sent >= 1 ? 'good' : 'warn')}
      </div>
      ${card('Котировки', G.line({ labels: hist.map(x => x.d.slice(5).split('-').reverse().join('.') + '.' + x.d.slice(2, 4)), series: [{ name: 'Цена', color: C.aqua, values: hist.map(x => x.p) }], height: 200, unit: '₸', empty: 'Котировки появятся через месяц' }))}
      <div class="grid2">
        ${divCard(profit)}
        ${card('Операции с акциями', `<div class="btnrow">${btn(`Выкуп 1% · ${money(S.total * 0.01 * S.price * 1.02)}`, 'shOp', 'buyback:' + Math.round(S.total * 0.01))}${btn('Допэмиссия 10%', 'shOp', 'spo:10', '', s.day - S.lastIssue < 365)}</div>
          <p class="hint">Выкуп поддерживает цену. Допэмиссия даёт деньги, но снижает доверие совета (−3).</p>`)}
      </div>`;
  }
  function divCard(profit) {
    const S = s.sh, ok = s.day - S.lastDiv >= 80;
    return card('Дивиденды', `<div class="kv3"><div><span>Прибыль за 12 мес.</span><b>${money(profit)}</b></div><div><span>Выплачено всего</span><b>${money(S.divTotal)}</b></div></div>
      <div class="btnrow">${[0.1, 0.25, 0.5].map(r => btn(`${pct(r)} прибыли · ${money(Math.max(0, profit * r))}`, 'shOp', 'dividend:' + Math.round(Math.max(0, profit * r)), '', !ok || profit <= 0)).join('')}</div>
      <p class="hint">Дивиденды повышают доверие совета${S.listed ? ' и цену акций' : ''}. Не чаще раза в квартал.</p>`);
  }
  /* ===================== ЦДПиТГ — цех добычи, подготовки и транспортировки газа ===================== */
  const tq = v => num((v || 0) / 1000, 1) + ' тыс.';
  const GW_ST = { work: ['в работе', 'good'], idle: ['консервация', ''], prep: ['расконсервация', 'warn'], repair: ['ремонт', 'warn'], fail: ['авария', 'bad'], stop: ['остановлена', 'warn'] };
  // показатели газа за сутки; поля, которых нет в старых сохранениях, — по умолчанию
  const gasT = () => Object.assign({ prod: 0, heat: 0, gtes: 0, sale: 0, flare: 0, util: 1, nat: 0, natSale: 0, gtesN: 0, boiler: 0, dew: null, norm: E.dewNorm(s), ok: true, load: 0 }, (s.today && s.today.gas) || {});
  function cdpitgScheme() {
    const g = gasT(), t = s.today || {};
    const hasU = E.facs(s, 'uppg').length > 0, hasC = E.facs(s, 'gascomp').length > 0, hasG = E.facs(s, 'gtes').length > 0;
    const gw = s.gwells.filter(w => w.status === 'work').length;
    const dur = f => Math.max(0.5, Math.min(6, 6 / (f / 20000 + 0.25))).toFixed(2);
    const pipe = (d, flow, col, dash) => `<path d="${d}" class="pipe"${dash ? ' style="stroke-width:6"' : ''}/><path d="${d}" class="flow ${flow > 1 ? 'on' : ''}" stroke="${col}" style="animation-duration:${dur(flow)}s"/>`;
    const lbl = (x, y, txt, cls = 'pl') => `<text x="${x}" y="${y}" class="${cls}">${txt}</text>`;
    const box = (x, y, w, h, title, val, sub, state) => `<g class="node ${state || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + 18}" class="nt">${title}</text><text x="${x + w / 2}" y="${y + 34}" class="nv">${val}</text>${sub ? `<text x="${x + w / 2}" y="${y + 49}" class="ns">${sub}</text>` : ''}</g>`;
    const nOff = hasU ? '' : 'off', N = g.nat || 0, cN = '#7fb4ff', cD = C.violet, cP = '#9fb6c9';
    const dewC = g.dew == null ? '' : g.dew <= g.norm ? 'q1' : 'q4';
    const chain = [['Газовые скв.', `${gw} в работе`, tq(N) + ' м³'], ['М-100', 'манифольд', '22 подкл.'], ['ВС', 'сепаратор', 'капли, примеси'], ['ТО', 'газ-газ', '+8…+10°C'], ['ТГР', 'расширитель', 'отбой жидкости'], ['Редуцирование', '5,9 → 1,5 МПа', 'охлаждение газа'], ['НС', 'низкотемп. сеп.', g.hyd ? 'ГИДРАТЫ!' : '−20°C'], ['БИР', 'учёт газа', tq(N - (g.boiler || 0)) + ' м³']];
    const flameH = Math.min(1.6, 0.35 + g.flare / 6000);
    return `<svg class="scheme gas" viewBox="0 0 1100 520" role="img" aria-label="Схема ЦДПиТГ">
      ${lbl(20, 24, 'ПРИРОДНЫЙ ГАЗ — УППГ', 'nt" style="text-anchor:start;fill:var(--muted)')}
      ${chain.slice(0, -1).map((c, i) => pipe(`M${120 + 130 * i} 72 H${150 + 130 * i}`, N, cN)).join('')}
      ${pipe('M440 150 V104', N ? 1e4 : 0, cD, 1)}${pipe('M430 178 H600 V104', N ? 1e4 : 0, cD, 1)}
      ${pipe('M850 104 V178 H770', N ? 1e4 : 0, cD, 1)}${pipe('M640 206 V228 H365 V206', N ? 1e4 : 0, cD, 1)}
      ${pipe('M590 178 H620', N ? 1e4 : 0, C.orange, 1)}
      ${pipe('M990 104 V270', g.natSale, cN)}${lbl(1030, 200, tq(g.natSale) + ' м³', 'pl')}
      ${pipe('M960 104 V250 H630 V270', g.gtesN, C.aqua)}${g.gtesN > 1 ? lbl(800, 244, 'в ГТЭС ' + tq(g.gtesN) + ' м³') : ''}
      ${chain.map((c, i) => box(20 + 130 * i, 40, 100, 64, c[0], c[1], c[2], !hasU ? 'off' : i === 6 && g.hyd ? 'n-bad' : i === 6 && !g.ok ? 'n-warn' : i === 0 && s.gwells.some(w => w.status === 'fail') ? 'n-warn' : '')).join('')}
      ${box(300, 150, 130, 56, 'БРД — ДЭГ', `${s.gasSet.deg} л/ч × 8 т.`, `склад ${num(s.stock.deg)} кг`, nOff || (s.stock.deg < (g.deg || 0) * 5 ? 'n-warn' : ''))}
      ${box(470, 150, 120, 56, 'Котёл КТ-100', `${tq(g.boiler)} м³`, 'масло +165°C', nOff)}
      ${box(620, 150, 150, 56, 'Регенерация ДЭГ', `${s.gasSet.reg}°C`, `концентрация ${num(E.degConc(s), 1)}%`, nOff || (E.degConc(s) < 87 ? 'n-warn' : ''))}
      <g class="node ${nOff}"><rect x="20" y="140" width="150" height="70" rx="9"/><text x="95" y="158" class="nt">Точка росы</text><text x="95" y="182" class="nv ${dewC}" style="font-size:18px;font-weight:800">${g.dew == null ? '—' : num(g.dew, 0) + '°C'}</text><text x="95" y="200" class="ns">норма ≤ ${g.norm}°C</text></g>
      ${box(330, 270, 140, 64, 'Печи ЦКППН', `${num(g.heat)} м³`, `нагрев до ${s.ckppnSet.temp}°C`)}
      ${box(560, 270, 140, 64, hasG ? 'ГТЭС' : 'ГТЭС — нет', hasG ? `${num(((t.energy && t.energy.used && t.energy.used.gtes) || 0))} кВт` : 'не построена', hasG ? 'газ → электроэнергия' : '', hasG ? '' : 'off')}
      ${box(880, 270, 180, 64, 'Газопровод', `+${money((g.natSale * E.GAS_PRICE_N * (g.ok ? 1 : 0.7) + g.sale * E.GAS_PRICE_P) * idx())}`, 'в сутки потребителям')}
      ${lbl(20, 372, 'ПОПУТНЫЙ ГАЗ — МКС', 'nt" style="text-anchor:start;fill:var(--muted)')}
      ${pipe('M160 422 H208', g.prod, cP)}${lbl(90, 474, 'ПНГ ' + num(g.prod) + ' м³')}
      ${pipe('M230 400 V302 H330', g.heat, C.orange)}
      ${pipe('M246 410 V356 H630 V334', g.gtes, C.aqua)}
      ${pipe('M252 422 H330', g.sale, C.blue)}${pipe('M490 400 H1000 V334', g.sale, C.blue)}${lbl(740, 392, num(g.sale) + ' м³ ПНГ')}
      ${pipe('M230 444 V486 H1030', g.flare, C.red)}${lbl(640, 480, g.flare > 1 ? 'на факел ' + num(g.flare) + ' м³' : '')}
      ${box(20, 390, 140, 64, 'ЦКППН', 'КСУ, ОГ-200', '0,2 МПа')}
      <g class="node res"><circle cx="230" cy="422" r="22"/><text x="230" y="426" class="nt">ПНГ</text></g>
      ${box(330, 390, 160, 64, hasC ? 'С-2 → МКС' : 'МКС — нет', hasC ? (g.trip ? 'аварийный останов' : '0,2 → 0,9 МПа') : 'не построена', hasC ? `${num(g.sale)} / ${num(E.capOf(s, 'gascomp'))} м³` : 'газ на факел', hasC ? (g.trip ? 'n-bad' : g.sale >= (g.mksCap || 1) * 0.97 && g.flare > 1 ? 'n-warn' : '') : 'off')}
      <g class="flare"><rect x="1030" y="438" width="18" height="50" fill="#56687a"/><rect x="1024" y="486" width="30" height="8" rx="2" fill="#2b3a4a"/>
        <g class="flame ${g.flare > 1 ? 'on' : ''}" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(${flameH.toFixed(2)})"><path d="M1039 438 C1023 422 1033 402 1039 386 C1045 402 1055 422 1039 438Z" fill="${g.flare > 1 ? '#d95926' : '#3a4654'}"/><path d="M1039 438 C1031 428 1036 416 1039 406 C1042 416 1047 428 1039 438Z" fill="${g.flare > 1 ? '#c98500' : '#2b3a4a'}"/></g></g>
      ${lbl(1039, 512, 'Факел', 'ns')}
    </svg>`;
  }
  /* ---------- СУГ: ёмкости, поставки на АЗС, опт ---------- */
  // мнемосхема СУГ: источники → задвижки → ёмкости → задвижки → потребители
  function lpgMnemo(L, d, cap) {
    const hasG = E.facs(s, 'gfu').length > 0, hasN = E.facs(s, 'npz').length > 0;
    const oG = L.inGfu !== false, oN = L.inNpz !== false, oA = L.toAzs !== false, oS = !!L.sell;
    const dur = f => Math.max(0.6, Math.min(5, 5 / ((f || 0) / 2 + 0.25))).toFixed(2);
    const pipe = (dd, flow, col) => `<path d="${dd}" class="pipe" style="stroke-width:6"/><path d="${dd}" class="flow ${flow > 0.01 ? 'on' : ''}" stroke="${col}" style="stroke-width:3;animation-duration:${dur(flow)}s"/>`;
    const box = (x, y, w, h, t1, t2, st) => `<g class="node ${st}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + w / 2}" y="${y + 20}" class="nt">${t1}</text><text x="${x + w / 2}" y="${y + 37}" class="ns">${t2}</text></g>`;
    const tl = (x, y, txt, cls = 'pl') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${txt}</text>`;
    const lv = cap ? Math.min(1, L.st / cap) : 0, inT = (d.gfu || 0) + (d.npz || 0), outT = (d.toAzs || 0) + (d.sold || 0) + (d.fuelNet || 0), net = inT - outT;
    const tx = 158, ty = 90, tw = 144, th = 66, ly = ty + th * (1 - lv);
    const tank = `<g><clipPath id="lpgmc"><rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${th * 0.36}"/></clipPath>
      ${[0.24, 0.76].map(p => `<path d="M${tx + tw * p - 13} ${ty + th + 14} L${tx + tw * p - 8} ${ty + th - 6} L${tx + tw * p + 8} ${ty + th - 6} L${tx + tw * p + 13} ${ty + th + 14}Z" fill="#5b636b" stroke="#2a2f34"/>`).join('')}<rect x="${tx - 4}" y="${ty + th + 14}" width="${tw + 8}" height="4" fill="#3a4148"/>
      <rect x="${tx + tw / 2 - 8}" y="${ty - 7}" width="16" height="8" fill="#8d969e" stroke="#2a2f34"/>
      <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${th * 0.36}" fill="#e6e9ec" stroke="#5b636b"/>
      <g clip-path="url(#lpgmc)"><rect x="${tx}" y="${ly.toFixed(1)}" width="${tw}" height="${(ty + th - ly + 1).toFixed(1)}" fill="#2f6db5" opacity=".55"/><rect x="${tx}" y="${ty + th * 0.42}" width="${tw}" height="${th * 0.16}" fill="#c62828"/></g>
      <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${th * 0.36}" fill="none" stroke="#5b636b" stroke-width="1.2"/>${[th * 0.36, tw - th * 0.36].map(x => `<line x1="${tx + x}" y1="${ty + 1}" x2="${tx + x}" y2="${ty + th - 1}" stroke="#9aa3ab" stroke-width=".8"/>`).join('')}
      <g transform="translate(${tx + tw - 34} ${ty + 10})"><rect width="9" height="${th - 20}" rx="2" fill="#1a1d20" stroke="#2a2f34"/><rect x="1.2" y="${((th - 20) * (1 - lv)).toFixed(1)}" width="6.6" height="${Math.max(0, (th - 20) * lv - 1).toFixed(1)}" fill="${lv > 0.85 ? '#e53935' : lv < 0.1 ? '#ffb300' : '#43a047'}"/></g>
      <text x="${tx + tw / 2 - 8}" y="${ty + th / 2 + 22}" text-anchor="middle" font-size="11" font-weight="900" fill="#1d2126">${pct(lv)}</text>
      <text x="${tx + tw / 2 - 8}" y="${ty + th / 2 + 5}" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" letter-spacing="2">ПРОПАН</text>
      ${tl(tx + tw / 2, ty - 12, `${num(L.st, 1)} / ${num(cap)} т · ${pct(lv)}`, 'pl strong')}</g>`;
    const dd = x => x > 365 ? 'больше года' : num(x) + ' сут';
    const fill = net > 0.05 && cap ? `копится +${num(net, 1)} т/сут · полны через ${dd(Math.max(0, (cap - L.st) / net))}` : net < -0.05 ? `убывает −${num(-net, 1)} т/сут · запаса на ${dd(L.st / -net)}` : 'приход = расход';
    return `<svg class="scheme lpgm" viewBox="0 0 460 250" role="img" aria-label="Мнемосхема СУГ">
      ${box(4, 26, 100, 52, 'ГФУ', hasG ? `${num(d.gfu || 0, 2)} т/сут` : 'не построена', !hasG ? 'off' : oG ? '' : 'n-warn')}
      ${box(4, 168, 100, 52, 'НПЗ', hasN ? (oN ? `${num(d.npz || 0, 2)} т/сут` : `→ топл. сеть ${num(d.npzFuel || 0, 1)}`) : 'нет НПЗ', !hasN ? 'off' : oN ? '' : 'n-warn')}
      ${pipe('M104 52 H140 V108 H158', oG ? d.gfu : 0, '#7fb4e6')}${hasG ? valveSvg(128, 52, 'gfu', oG, 'Задвижка с ГФУ', 'lpgValve', 0.75) : ''}
      ${pipe('M104 194 H140 V138 H158', oN ? d.npz : 0, '#7fb4e6')}${hasN ? valveSvg(128, 194, 'npz', oN, 'Задвижка с НПЗ', 'lpgValve', 0.75) : ''}
      ${tank}${tl(tx + tw / 2, 236, fill, net > 0.01 && cap && (cap - L.st) / net < 7 ? 'pl warn' : 'pl')}
      ${pipe('M302 108 H318 V52 H356', oA ? d.toAzs : 0, '#7fb4e6')}${valveSvg(333, 52, 'azs', oA, 'Задвижка на АЗС', 'lpgValve', 0.75)}
      ${pipe('M302 138 H318 V194 H356', oS ? d.sold : 0, '#7fb4e6')}${valveSvg(333, 194, 'sell', oS, 'Задвижка в опт', 'lpgValve', 0.75)}
      ${box(356, 26, 100, 52, 'АЗС', `${num(d.toAzs || 0, 2)} т газовоз.`, oA ? '' : 'n-warn')}
      ${box(356, 168, 100, 52, 'Опт (ж/д)', `${num(d.sold || 0, 2)} т/сут`, oS ? '' : 'n-warn')}
      ${d.gfuPot - d.gfu > 0.05 ? tl(tx + tw / 2, 214, `ГФУ разгружена: −${num(d.gfuPot - d.gfu, 1)} т/сут — нет места`, 'pl warn') : d.fuelNet > 0 ? tl(tx + tw / 2, 214, `газ НПЗ в топл. сеть: ${num(d.fuelNet, 1)} т — нет места`, 'pl warn') : !cap ? tl(tx + tw / 2, 214, 'ёмкостей нет — постройте', 'pl bad') : ''}
    </svg>`;
  }
  // индикаторы накопления СУГ: уровень, приход / расход, баланс, срок до заполнения
  function lpgInd(L, d, cap) {
    const lv = cap ? L.st / cap : 0, inT = (d.gfu || 0) + (d.npz || 0), outT = (d.toAzs || 0) + (d.sold || 0) + (d.fuelNet || 0) + (d.npzFuel || 0), net = inT - outT;
    const days = net > 0.05 && cap ? (cap - L.st) / net : net < -0.05 ? L.st / -net : null;
    const c = lv > 0.85 ? 'bad' : lv > 0.6 ? 'warn' : 'good';
    return `<div class="lpgind"><div class="lpgind-l"><span>Уровень</span><b>${pct(lv)}</b>${segBar(lv, c)}</div>
      <div class="kv3"><div><span>Приход</span><b class="tgood">+${num(inT, 2)} т</b></div><div><span>Расход</span><b>−${num(outT, 2)} т</b></div><div><span>Баланс</span><b class="${net > 0.05 ? 'twarn' : net < -0.05 ? '' : 'tgood'}">${net >= 0 ? '+' : '−'}${num(Math.abs(net), 2)} т/сут</b></div></div>
      <small>${days == null ? 'приход равен расходу — уровень стоит' : net > 0 ? `ёмкости заполнятся через ${days > 365 ? 'больше года' : num(days) + ' сут'}` : `запаса хватит на ${days > 365 ? 'больше года' : num(days) + ' сут'}`} · свободно ${num(Math.max(0, cap - L.st), 1)} т</small></div>`;
  }
  function vLpg() {
    const L = s.lpg || { st: 0, sell: true, res: 5, toAzs: true, hist: [] }, d = (s.today && s.today.lpg) || {}, cap = E.lpgCap(s), i = idx();
    const st = E.facs(s, 'azs'), withG = st.filter(f => f.lpg), g = gasT();
    const hasSrc = E.facs(s, 'gfu').length || E.facs(s, 'npz_fcc').length;
    const inD = (d.gfu || 0) + (d.npz || 0);
    const kp = `<div class="kpis">
      ${kpiTile('Запас СУГ', `${num(L.st, 1)} / ${num(cap)} т`, cap ? pct(L.st / cap) + ' ёмкостей' : 'нет ёмкостей', cap && L.st / cap > 0.9 ? 'bad' : '')}
      ${kpiTile('Получено за сутки', num(inD, 1) + ' т', `ГФУ ${num(d.gfu || 0, 1)} · НПЗ ${num(d.npz || 0, 1)}`, inD > 0 ? 'good' : '')}
      ${kpiTile('На АЗС', num((d.azsL || 0)) + ' л', `продано автогаза · ${money(d.azsRev || 0)}`, d.azsL > 0 ? 'good' : '')}
      ${kpiTile('В опт', num(d.sold || 0, 1) + ' т', d.sold ? money(d.soldRev) : L.sell ? 'сверх резерва' : 'отгрузка закрыта', d.sold > 0 ? 'good' : '')}
    </div>`;
    const tank = G.lpgTank({ id: 'main', level: cap ? L.st / cap : 0, text: `${num(L.st, 1)} т из ${num(cap)} т`, sub: !cap ? 'ёмкостей нет — постройте подземные ёмкости' : d.gfuPot - d.gfu > 0.05 ? 'ёмкости полны — ГФУ разгружена' : 'парк ёмкостей СУГ' });
    const flows = `<div class="tscroll"><table class="tbl"><tbody>
      <tr><td>ГФУ: ПНГ</td><td>${num((g.gfuIn || 0) / 1000, 1)} тыс. м³</td></tr>
      <tr><td>СУГ с ГФУ</td><td>${num(d.gfu || 0, 2)} т</td></tr>
      ${d.gfuPot - d.gfu > 0.05 ? `<tr><td class="twarn">ГФУ: нет места</td><td class="twarn">−${num(d.gfuPot - d.gfu, 2)} т</td></tr>` : ''}
      <tr><td>СУГ с НПЗ (АТ / крекинг)</td><td>${num(dsT().calc ? dsT().calc.lpgAT || 0 : 0, 2)} / ${num(Math.max(0, (d.npz || 0) - (dsT().calc ? dsT().calc.lpgAT || 0 : 0)), 2)} т</td></tr>
      <tr><td>На АЗС газовозами</td><td>${num(d.toAzs || 0, 2)} т${d.bought ? ` + покупной ${num(d.bought, 2)} т` : ''}</td></tr>
      <tr><td>В опт</td><td>${num(d.sold || 0, 2)} т</td></tr>
      ${d.fuelNet ? `<tr><td class="twarn">НПЗ → топл. сеть</td><td class="twarn">${num(d.fuelNet, 2)} т</td></tr>` : ''}
    </tbody></table></div>`;
    const ctrl = `<div class="vrow">${valveBtn(L.toAzs !== false, 'lpgValve', 'azs', 'lpgazs', 'На АЗС')}<small>Газовозы вывозят СУГ на станции с газовой колонкой, когда газа в резервуаре станции меньше половины. Доставка ${num(1500 * i)} ₸/т.</small></div>
      <div class="vrow">${valveBtn(L.sell, 'lpgValve', 'sell', 'lpgsell', 'В опт')}<small>Всё сверх резерва для АЗС уходит в ж/д цистерны по оптовой цене. Закрыто — СУГ копится в ёмкостях; когда они полны, ГФУ разгружается, а газ НПЗ идёт в топливную сеть завода вместо мазута.</small></div>
      <div class="slider"><label>Резерв СУГ для АЗС: <b>${L.res} сут</b></label><input type="range" min="0" max="30" step="1" value="${L.res}" data-change="lpgRes"></div>
      <div class="kv3"><div><span>Опт</span><b>${money(E.lpgWholesale(s))}/т</b></div><div><span>Колонка</span><b>${num(E.lpgRetailL(s), 1)} ₸/л</b></div><div><span>Спрос АЗС</span><b>${num(d.dem || 0, 2)} т/сут</b></div></div>`;
    const stations = st.length ? `<div class="gwells">${st.map(f => { const lv = f.lpg ? (f.tk.lpg || 0) / (f.tkCap.lpg || 1) : 0, ls = f.lpgSt || {};
      return `<div class="gwell ${f.lpg ? (ls.dry > 0.01 ? 'fail' : 'work') : ''}"><div class="w-h"><b>${esc(f.name)}</b>${f.lpg ? pill(ls.dry > 0.01 ? 'газа нет' : 'газ есть', ls.dry > 0.01 ? 'bad' : 'good') : pill('без газа', '')}</div>
        ${f.lpg ? `${G.lpgTank({ id: 'z' + f.id, level: lv, small: true, text: `${num(f.tk.lpg || 0, 1)} / ${num(f.tkCap.lpg)} т` })}<small>продано за сутки: ${num(ls.l || 0)} л · ${money(ls.rev || 0)}</small>` : `<small>Газовая колонка: ~${Math.round(14)}% машин ездят на газу. Резервуар СУГ 10 т.</small><div class="btnrow">${btn('Газовая колонка · ' + money(18e6 * i), 'azsUp', f.id + ':lpg', 'small')}</div>`}</div>`; }).join('')}</div>` : '<p class="hint">Своих АЗС нет — весь СУГ уходит в опт.</p>';
    const hist = (L.hist || []).slice(-12);
    return `${kp}${card('Мнемосхема СУГ: откуда приходит и куда уходит газ', `<div class="scheme-wrap">${lpgMnemo(L, d, cap)}</div><p class="hint">Нажмите на задвижку, чтобы открыть или закрыть линию. Закрыта ГФУ — газ идёт в газопровод без извлечения пропана; при полных ёмкостях и закрытом опте ГФУ разгружается сама. Закрыта линия НПЗ — СУГ сжигается в печах завода вместо мазута. Закрыты АЗС и опт — газ копится в ёмкостях.</p>`)}<div class="grid2">${card('Парк ёмкостей СУГ', tank + lpgInd(L, d, cap) + flows)}${card('Направление СУГ', ctrl)}</div>
      ${card('Газовые колонки АЗС', stations + `<p class="hint">Станции с колонкой продают автогаз (пропан-бутан). Нет своего газа — при включённой закупке на АЗС газ покупается по рынку +5%.</p>`)}
      ${hist.length ? card('СУГ по месяцам', `<div class="tscroll"><table class="tbl"><thead><tr><th>Месяц</th><th>Получено, т</th><th>АЗС, т</th><th>Опт, т</th><th>В топл. сеть, т</th></tr></thead><tbody>${hist.slice().reverse().map(h => `<tr><td>${ymRu(h.m)}</td><td>${num(h.prod, 1)}</td><td>${num(h.azs, 1)}</td><td>${num(h.sold, 1)}</td><td class="${h.lost > 0 ? 'tbad' : ''}">${num(h.lost, 1)}</td></tr>`).join('')}</tbody></table></div>`) : ''}
      ${card('Источники и хранение', `<p>${hasSrc ? '' : 'Пока нет источника СУГ. '}ГФУ стоит после МКС: из сжатого попутного газа извлекает пропан-бутан (≈0,28 кг с м³), сухой газ уходит в газопровод. Без МКС и ёмкостей ГФУ не построить. На НПЗ СУГ даёт ЭЛОУ-АТ (головка стабилизации ≈1,1% нефти) и каткрекинг.</p>
        <div class="btnrow">${btn('Ёмкости СУГ +100 т · ' + money(D.BUILD.lpg_tank.cost * i), 'tender', 'lpg_tank', 'small')}${btn('ГФУ · ' + money(D.BUILD.gfu.cost * i), 'tender', 'gfu', 'small', !E.facs(s, 'gascomp').length || !E.facs(s, 'lpg_tank').length)}</div>
        ${!E.facs(s, 'gascomp').length ? '<p class="hint">Для ГФУ сначала нужна МКС (вкладка «МКС и ПНГ»).</p>' : ''}`)}
      ${E.lpgObjs(s).length ? card('Безопасность объектов СУГ', `<p>Экспертиза промбезопасности, утечки и пожары — в общем разделе.</p><div class="btnrow">${btn('Открыть «НПЗ → Безопасность»', 'goSafety', '', 'small')}</div>`) : ''}`;
  }
  function vGasTab() {
    const sb = sub();
    if (sb === 'uppg') return vUppg();
    if (sb === 'mks') return vGas();
    if (sb === 'gwells') return vGwells();
    if (sb === 'balance') return vGasBal();
    if (sb === 'lpg') return vLpg();
    const g = gasT(); const hasU = E.facs(s, 'uppg').length > 0;
    const rev = (g.natSale * E.GAS_PRICE_N * (g.ok ? 1 : 0.7) + g.sale * E.GAS_PRICE_P) * idx();
    return `${card('Схема ЦДПиТГ (онлайн)', `<div class="swipe-hint">← листайте схему →</div><div class="scheme-wrap big">${cdpitgScheme()}</div>
      <p class="hint">Природный газ: скважины → УППГ (сепарация, охлаждение, ДЭГ) → газопровод. Попутный газ: ЦКППН → МКС → газопровод; излишки — на факел.</p>`)}
      <div class="kpis">
        ${kpiTile('Природный газ', num((g.nat || 0) / 1000, 1), hasU ? `тыс. м³/сут · УППГ ${pct(g.load || 0)}` : 'нет УППГ', g.nat > 0 ? 'good' : '')}
        ${kpiTile('Точка росы', g.dew == null ? '—' : num(g.dew, 0) + '°C', `норма ≤ ${g.norm}°C`, g.dew == null ? '' : g.ok ? 'good' : 'bad')}
        ${kpiTile('Утилизация ПНГ', pct(g.util), `факел ${num(g.flare)} м³/сут`, g.util >= 0.8 ? 'good' : g.util >= 0.4 ? 'warn' : 'bad')}
        ${kpiTile('Выручка за газ', money(rev), 'в сутки', rev > 0 ? 'good' : '')}
      </div>
      ${!hasU ? card('С чего начать', `<p class="hint" style="margin-top:0">На месторождении ${s.gwells.filter(w => w.status === 'idle').length} законсервированных газовых скважин. Постройте УППГ и расконсервируйте их.</p><div class="btnrow">${btn('Построить УППГ', 'tender', 'uppg', 'primary')}${btn('Скважины →', 'gosub', 'gas:gwells')}</div>`) : ''}`;
  }
  function vUppg() {
    const g = gasT(), d = s.daily.slice(-90), hasU = E.facs(s, 'uppg').length > 0;
    const degDay = g.deg || 0, daysLeft = degDay > 0 ? s.stock.deg / degDay : null;
    const nrm = x => { const m = Number(x.d.slice(5, 7)); return m >= 11 || m <= 3 ? -20 : -10; };
    return `<div class="grid2">
      ${card('Режим УППГ', `
        <div class="slider"><label>Подача ДЭГ на точку: <b id="degv">${s.gasSet.deg} л/ч</b> <small>норма 30–35</small></label><input type="range" min="15" max="50" step="1" value="${s.gasSet.deg}" data-input="deg" data-change="deg"></div>
        <div class="slider"><label>Регенерация ДЭГ: <b id="regv">${s.gasSet.reg}°C</b> <small>норма 155–165</small></label><input type="range" min="140" max="175" step="1" value="${s.gasSet.reg}" data-input="reg" data-change="reg"></div>
        <div class="kv3"><div><span>Концентрация ДЭГ</span><b id="concv" class="${E.degConc(s) < 87 ? 'tbad' : 'tgood'}">${num(E.degConc(s), 1)}%</b></div><div><span>Расход ДЭГ</span><b>${num(degDay)} кг/сут</b></div><div><span>ДЭГ на складе</span><b class="${daysLeft != null && daysLeft < 15 ? 'tbad' : ''}">${num(s.stock.deg)} кг${daysLeft != null ? ` · ${num(daysLeft)} сут` : ''}</b></div></div>
        <p class="hint">Больше ДЭГ — ниже точка росы, но выше расход. Выше 166°C ДЭГ разлагается. Зимой норма строже.</p>
        ${hasU ? '' : `<div class="btnrow">${btn('Построить УППГ', 'tender', 'uppg', 'primary')}</div>`}`)}
      <div>${card('Качество газа', `<div class="kpis" style="margin:0">${`<div class="kpi">${G.gauge({ value: g.dew == null ? -30 : g.dew, min: -35, max: 10, bands: [{ to: g.norm, color: C.aqua }, { to: g.norm + 5, color: C.yellow }, { to: 10, color: C.red }], text: g.dew == null ? '—' : num(g.dew, 0) + '°C', label: 'Точка росы' })}</div>`}
        ${kpiTile('Загрузка УППГ', pct(g.load || 0), `${tq(g.nat)} / ${tq(E.capOf(s, 'uppg'))} м³`, lvl(g.load || 0, 0.9, 1, true))}
        ${kpiTile('Цена газа', g.ok ? '100%' : '−30%', g.ok ? 'газ по ГОСТ' : 'не по ГОСТ', g.ok ? 'good' : 'bad')}</div>
        ${g.hyd ? `<p class="hint tbad">Гидратная пробка в НС — производительность снижена</p>` : ''}`)}
      ${card('Нормы режима', `<div class="tscroll"><table class="tbl"><thead><tr><th>Параметр</th><th>Норма</th></tr></thead><tbody>
        <tr><td>Вход: давление / температура</td><td>5,8–6,1 МПа · +15…+24°C</td></tr>
        <tr><td>После редуцирования</td><td>1,5 МПа · −20°C</td></tr>
        <tr><td>ДЭГ: концентрация / подача</td><td>87–91% · 30–35 л/ч</td></tr>
        <tr><td>Регенерация ДЭГ</td><td>+155…+165°C</td></tr>
        <tr class="${g.norm === -20 ? 'hl' : ''}"><td>Точка росы зимой</td><td>≤ −20°C</td></tr>
        <tr class="${g.norm === -10 ? 'hl' : ''}"><td>Точка росы летом</td><td>≤ −10°C</td></tr>
        <tr><td>Выход потребителям</td><td>+1…+3°C · 0,6–1,2 МПа</td></tr></tbody></table></div>`)}</div>
    </div>
    ${card('Точка росы, °C (90 дней)', G.line({ labels: d.map(x => x.d.slice(5).split('-').reverse().join('.')), series: [{ name: 'Точка росы', color: C.aqua, values: d.map(x => x.dew != null ? x.dew : null) }, { name: 'Норма', color: C.red, values: d.map(nrm), dash: true }], height: 190, unit: '°C', empty: 'Появится после запуска УППГ' }))}`;
  }
  function vGwells() {
    const G0 = s.gasRes, hasU = E.facs(s, 'uppg').length > 0;
    const rows = s.gwells.map(w => {
      const st = GW_ST[w.status] || [w.status, ''];
      const acts = w.status === 'idle' ? btn('Расконсервировать · ' + money(12e6 * idx()), 'gwell', w.id + ':open', 'small primary', !hasU)
        : w.status === 'fail' ? btn('Ремонт · ' + money(6e6 * idx()), 'gwell', w.id + ':repair', 'small primary')
        : w.status === 'work' ? valveBtn(true, 'gwell', w.id + ':stop', 'g' + w.id, 'Устье') : w.status === 'stop' ? valveBtn(false, 'gwell', w.id + ':start', 'g' + w.id, 'Устье') : `<small>${w.down} сут</small>`;
      return `<div class="gwell ${w.status}"><div class="w-h"><b>${G.icon('gas')} ${esc(w.name)}</b>${pill(st[0], st[1])}</div>
        <div class="kv3"><div><span>Дебит</span><b>${tq(w.today)} м³</b></div><div><span>Потенциал</span><b>${tq(E.gwellPot(s, w))} м³</b></div><div><span>Накоплено</span><b>${num(w.cum / 1e6, 1)} млн м³</b></div></div>
        ${bar(w.health / 100)}<small>износ ${Math.round(100 - w.health)}%${w.failName && w.status === 'fail' ? ' · ' + esc(w.failName) : ''}</small><div class="btnrow">${acts}</div></div>`;
    }).join('');
    return `<div class="kpis">
        ${kpiTile('Фонд газовых скважин', s.gwells.length, `в работе ${s.gwells.filter(w => w.status === 'work').length} · консервация ${s.gwells.filter(w => w.status === 'idle').length}`)}
        ${kpiTile('Запасы газа', num(G0.remaining / 1e9, 2) + ' млрд м³', `выработано ${pct(1 - G0.remaining / G0.total, 1)}`)}
        ${kpiTile('Подключения УППГ', `${Math.min(s.gwells.filter(w => w.status === 'work').length, E.facs(s, 'uppg').length * 22)} / ${E.facs(s, 'uppg').length * 22}`, '22 скважины на УППГ')}
      </div>
      ${card('Газовые скважины', `${hasU ? '' : '<p class="hint tbad" style="margin-top:0">Без УППГ скважины не работают</p>'}<div class="gwells">${rows}</div>
        <div class="btnrow">${btn('Пробурить газовую скважину', 'tender', 'well_gas', 'primary')}${btn('Построить УППГ', 'tender', 'uppg')}</div>
        <p class="hint">Дебит падает по мере выработки. Аварии: порыв шлейфа, пропуск арматуры. При «Авто-ПРС» ремонт заказывается сам.</p>`)}`;
  }
  function vGasBal() {
    const g = gasT(), h = s.history.slice(-24), L = h.map(x => ymRu(x.m));
    return `<div class="grid2">
      ${card('Куда идёт газ сегодня', G.donut({ items: [{ name: 'Природный → газопровод', value: g.natSale, color: '#7fb4ff' }, { name: 'ПНГ → газопровод (МКС)', value: g.sale, color: C.blue }, { name: 'ГТЭС', value: g.gtes + (g.gtesN || 0), color: C.aqua }, { name: 'Печи ЦКППН', value: g.heat, color: C.orange }, { name: 'Котёл УППГ', value: g.boiler || 0, color: C.violet }, { name: 'Факел', value: g.flare, color: C.red }], center: tq(g.nat + g.prod), sub: 'м³/сут', unit: 'м³' }))}
      ${card('Природный газ по месяцам, млн м³', G.bars({ labels: L, series: [{ name: 'Добыча', color: '#7fb4ff', values: h.map(x => (x.gasN || 0) / 1e6) }, { name: 'Сдача', color: C.blue, values: h.map(x => (x.gasNS || 0) / 1e6) }], height: 190, unit: 'млн м³', empty: 'Появится после первого месяца' }))}
    </div>
    <div class="grid2">
      ${card('Попутный газ по месяцам, млн м³', G.bars({ labels: L, series: [{ name: 'Добыча ПНГ', color: '#9fb6c9', values: h.map(x => (x.gas || 0) / 1e6) }, { name: 'Использовано', color: C.aqua, values: h.map(x => (x.gasUsed || 0) / 1e6) }], height: 190, unit: 'млн м³', empty: 'Появится после первого месяца' }))}
      ${card('Выручка от газа по месяцам', G.bars({ labels: L, series: [{ name: 'Продажа газа', color: C.blue, values: h.map(x => (x.cats && x.cats['Продажа газа']) || 0) }], height: 190, unit: '₸', empty: 'Появится после первого месяца' }))}
    </div>`;
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
    <p class="hint">Себестоимость — затраты на баррель. МРП — сутки между отказами. Ориентир: Кэкспл > 95%.</p>`;
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
  function savesCard() {
    const m = meta(); const slots = [1, 2, 3].map(n => ({ n, info: m['slot' + n] }));
    const exportOld = !m.exportedAt || Date.now() - m.exportedAt > 7 * 864e5;
    const row = (title, info, acts) => `<div class="slot"><div><b>${title}</b>${info ? `<small>${esc(info.company)} · ${dateRu(info.date)} · ${money(info.cash)} · №${info.rank}</small><small class="muted">сохранено ${ago(info.savedAt)}</small>` : '<small class="muted">пусто</small>'}</div><div class="slot-a">${acts}</div></div>`;
    return card('Сохранения', `
      <div class="slots">
        ${row('Автосохранение', m.autoInfo, `<span class="pill good">✓ ${ago(ui.lastSave || (m.autoInfo && m.autoInfo.savedAt))}</span>`)}
        ${row('Резервная копия <small class="muted">(раз в игровой месяц)</small>', m.backupInfo, m.backupInfo ? btn('Загрузить', 'loadBackup', '', 'small') : '')}
        ${slots.map(x => row(`Слот ${x.n}`, x.info, btn('Сохранить', 'slotSave', x.n, 'small primary') + (x.info ? btn('Загрузить', 'slotLoad', x.n, 'small') + btn('✕', 'slotDel', x.n, 'small ghost') : ''))).join('')}
      </div>
      <p class="hint">Игра сохраняется автоматически и продолжится при следующем открытии.</p>
      <div class="banner ${exportOld ? 'bad' : 'info'}">${G.icon(exportOld ? 'warn' : 'ok')}<span>Резервный файл: ${m.exportedAt ? 'последний экспорт ' + ago(m.exportedAt) : 'ещё не делали'}. Файл защищает от удаления приложения и позволяет перенести игру на другое устройство.</span></div>
      <div class="btnrow">${btn('Экспорт в файл', 'export', '', 'primary')}${btn('Импорт из файла', 'import')}<input type="file" id="importFile" accept=".json,application/json" hidden></div>
      <p class="hint">Размер: ${num((m.size || 0) / 1024)} КБ. Safari и иконка «Домой» хранят сохранения отдельно.</p>`);
  }
  function animMode() { return LS.get('om2_anim') || 'on'; }
  function applyAnim() { let off = animMode() === 'off'; if (animMode() === 'sys') { try { off = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { } } document.documentElement.classList.toggle('no-anim', off); }
  function vSettings() {
    return `${card('Компания', `<div class="kv3"><div><span>Название</span><b>${esc(s.company.name)}</b></div><div><span>Месторождение</span><b>${esc(s.company.field)}</b></div><div><span>Сложность</span><b>${{ easy: 'Лёгкая', normal: 'Нормальная', hard: 'Сложная' }[s.company.difficulty]}</b></div></div><div class="btnrow">${btn('Изменить названия', 'renameForm')}</div>`)}
      ${savesCard()}
      ${card('Звук и анимации', `<label class="check"><input type="checkbox" data-change="sndOn" ${SND.settings.on ? 'checked' : ''}> Звуковые эффекты</label>
        <div class="slider"><label>Громкость: <b id="volv">${Math.round(SND.settings.vol * 100)}%</b></label><input type="range" min="0" max="100" step="5" value="${Math.round(SND.settings.vol * 100)}" data-input="vol" data-change="vol"></div>
        <label class="check"><input type="checkbox" data-change="sndAmb" ${SND.settings.amb ? 'checked' : ''}> Фоновый шум промысла (гул насосов, скрип станков-качалок)</label>
        <div class="btnrow">${btn('Проверить звук', 'sndTest', '', 'small')}</div>
        <label class="check"><input type="checkbox" data-change="sndTouch" ${SND.settings.touch !== false ? 'checked' : ''}> Звуки касаний и оборудования (скрип качалки, стук по резервуару, стекло манометра)</label>
        <label class="sub-l">Анимация оборудования</label><div class="seg seg3">${[['on', 'Всегда'], ['sys', 'Как в системе'], ['off', 'Выключить']].map(([k, n]) => btn(n, 'anim', k, animMode() === k ? 'on' : '')).join('')}</div>
        <p class="hint">Нет звука на iPhone — выключите беззвучный режим. «Как в системе» отключает анимацию, если на телефоне включено «Уменьшение движения».</p>`)}
      ${card('Игровой процесс', `<label class="check"><input type="checkbox" data-change="repSetting" ${s.settings.monthReport !== false ? 'checked' : ''}> Показывать итоги по цехам после каждого месяца (время останавливается до решения)</label>`)}
      ${card('Помощь', `<div class="btnrow">${btn('Как играть', 'help', '', 'primary')}</div>`)}
      ${card('Новая игра', `<p class="hint">Текущий прогресс будет потерян (если не экспортирован).</p><div class="btnrow">${btn('Начать заново', 'newGame', '', 'danger')}</div>`)}
      <p class="hint center">Oil Management 2.0 · компании и люди вымышлены</p>`;
  }

  /* ===================== СТАРТОВЫЙ ЭКРАН ===================== */
  function startScreen() {
    const has = !!(LS.get(E.SAVE_KEY) || LS.get(BACKUP_KEY));
    return `<div class="start"><div class="start-card">
      <img src="assets/logo.png" alt="Oil Management">
      <h1>OIL MANAGEMENT 2.0</h1><p class="sub">Экономический симулятор нефтедобывающей компании · 2000 — …</p>
      ${has ? `<button class="primary big" data-act="continue">Продолжить карьеру</button>` : ''}
      <div class="form">
        <label>Название компании<input id="ng-name" value="АО «AJT»" maxlength="40"></label>
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
  // одно и то же окно при перерисовке не анимируется заново и сохраняет прокрутку — без дрожания
  function modalHtml() {
    const h = modalInner(), sig = h ? ((h.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || 'modal') : '';
    const stay = !!sig && sig === ui.modalSig; ui.modalSig = sig; ui.modalStay = stay;
    return stay ? h.replace('class="modal-bg', 'class="modal-bg stay').replace(/class="modal(?=[ "])/, 'class="modal stay') : h;
  }
  function modalInner() {
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
    const B = D.BUILD[T.type] || {};
    const popts = B.tank ? Object.entries(D.TANK_PURPOSE).map(([k, v]) => [k, v]) : B.ptank ? Object.entries(E.PNAME).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)]) : T.type === 'azs' ? Object.entries(D.AZS_LOC).map(([k, L]) => [k, `${L.name[0].toUpperCase() + L.name.slice(1)} — ${money(D.BUILD.azs.cost * L.cost * idx())}`]) : null;
    const plabel = B.tank ? 'Назначение резервуара' : B.ptank ? 'Продукт' : 'Место АЗС';
    const html = `${T.purpose != null && popts ? `<div class="form"><label>${plabel}<select id="f-purpose"${T.type === 'azs' ? ' data-change="tenderLoc"' : ''}>${popts.map(([k, v]) => `<option value="${k}" ${T.purpose === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>` : ''}
      ${isWell ? `<div class="form"><label>Цех добычи<select id="f-cdng">${s.cdngs.map(c => { const n = s.wells.filter(w => w.cdng === c.id).length; return `<option value="${c.id}" ${n >= 40 ? 'disabled' : ''}>${esc(c.name)} — ${n}/40</option>`; }).join('')}</select></label></div>` : ''}
      <div class="offers2">${T.offers.map((o, i) => `<div class="tof"><b>${esc(o.name)}</b>
        <div class="kv3"><div><span>Цена</span><b>${money(o.price)}</b></div><div><span>Срок</span><b>${o.days} дн.</b></div><div><span>Качество</span><b>${'★'.repeat(Math.round(o.quality * 5))}${'☆'.repeat(5 - Math.round(o.quality * 5))}</b></div></div>
        <small class="muted">Аванс ${T.kind === 'build' ? '25' : '50'}%: ${money(o.price * (T.kind === 'build' ? 0.25 : 0.5))}</small>
        ${btn('Выбрать подрядчика', 'award', i, 'primary small', s.cash < o.price * (T.kind === 'build' ? 0.25 : 0.5))}</div>`).join('')}</div>`;
    ui.modal = { title: 'Тендер: ' + T.title, desc: esc((D.BUILD[T.type] || D.SERVICES[T.type]).desc), html, wide: true, onClose: () => E.act(s, 'cancelTender') };
    render();
  }

  /* ===================== действия ===================== */
  /* ---------- сохранения: автосохранение + резервная копия + 3 слота ---------- */
  const BACKUP_KEY = E.SAVE_KEY + '_backup', SLOT_KEY = n => E.SAVE_KEY + '_slot' + n, META_KEY = 'om2_save_meta', UI_KEY = 'om2_ui';
  const meta = () => { try { return JSON.parse(LS.get(META_KEY) || '{}'); } catch (e) { return {}; } };
  const setMeta = m => LS.set(META_KEY, JSON.stringify(m));
  function slotInfo(st) { return { company: st.company.name, field: st.company.field, date: E.iso(st.day), cash: Math.round(st.cash), rank: st.rank, savedAt: Date.now() }; }
  function save(force) {
    if (!s) return false;
    const txt = E.serialize(s);
    const m = meta(); const monthKey = E.iso(s.day).slice(0, 7);
    // резервная копия — раз в игровой месяц (предыдущая версия автосохранения)
    if (m.backupMonth !== monthKey) { const prev = LS.get(E.SAVE_KEY); if (prev) { LS.set(BACKUP_KEY, prev); m.backupMonth = monthKey; m.backupInfo = m.autoInfo; } }
    const ok = LS.set(E.SAVE_KEY, txt);
    if (ok) { m.autoInfo = slotInfo(s); m.size = txt.length; setMeta(m); ui.lastSave = Date.now(); }
    else if (!ui.saveWarned) { ui.saveWarned = true; flash('Не удалось сохранить в память браузера — сделайте экспорт в файл (Настройки)', 'warn'); }
    return ok;
  }
  function saveUi() { LS.set(UI_KEY, JSON.stringify({ tab: ui.tab, sub: ui.sub })); }
  function loadFrom(key) { const raw = LS.get(key); if (!raw) return null; try { return E.deserialize(raw); } catch (e) { return null; } }
  // загрузка при открытии: автосохранение → резервная копия
  function autoLoad() {
    let st = loadFrom(E.SAVE_KEY), from = 'auto';
    if (!st) { st = loadFrom(BACKUP_KEY); from = 'backup'; }
    if (!st) return false;
    s = st;
    try { const u = JSON.parse(LS.get(UI_KEY) || '{}'); if (u.tab && NAV.some(n => n[0] === u.tab)) { ui.tab = u.tab; ui.sub = u.sub || {}; } } catch (e) { }
    if (from === 'backup') { flash('Основное сохранение повреждено — загружена резервная копия', 'warn'); save(); }
    else flash(`С возвращением! Игра продолжена: ${dateRu(E.iso(s.day))}`, 'good');
    return true;
  }
  async function exportSave() {
    const name = `oil-management-${s.company.name.replace(/[^\wа-яё]+/gi, '_')}-${E.iso(s.day)}.json`;
    const txt = E.serialize(s);
    const m = meta(); m.exportedAt = Date.now(); setMeta(m);
    try {
      const file = new File([txt], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Сохранение Oil Management' }); flash('Файл сохранения передан', 'good'); render(); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    flash('Файл сохранения скачан', 'good'); render();
  }
  const ago = t => { if (!t) return 'никогда'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : Math.round(m / 1440) + ' дн. назад'; };
  function flash(text, type = 'info') { if (s) s.flash.push({ text, type }); else alert(text); }
  const ACT_SND = { menu: 'stamp', fixfac: 'clank', regen: 'hiss', azsUp: 'build', shares: 'cash', accept: 'cash', spot: 'cash', hire: 'pop', buy: 'spend', award: 'stamp', tech: 'good', loan: 'coin', deposit: 'coin', withdraw: 'coin', repay: 'spend', maintain: 'hiss', repair: 'hiss', planCustom: 'stamp', cancelContract: 'leave', cancelProject: 'leave', fire: 'leave', salaryAll: 'coin', tankPurpose: 'hiss', demolish: 'build' };
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
      E.advance(s, 1); left--; SND.play('day'); save();
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
    toggle: a => { if (doAct('toggle', { key: a }) && (a === 'dgu' || a === 'ownFuel')) SND.play('toggle'); render(); },
    repair: a => { doAct('repair', { id: a }, 'Бригада ПРС выехала на скважину'); render(); },
    repairAll: () => { let n = 0; for (const w of s.wells.filter(w => w.status === 'fail')) { try { E.act(s, 'repair', { id: w.id }); n++; } catch (e) { } } flash(n ? `Назначено ремонтов: ${n}` : 'Нет свободных бригад или материалов', n ? 'good' : 'warn'); save(); render(); },
    ckwash: () => { doAct('ckppn', { wash: !s.ckppnSet.wash }); SND.play('valve'); render(); },
    wtoggle: a => { doAct('wellToggle', { id: a }); render(); },
    svc: a => { const [type, id] = a.split(':'); const r = doAct('tender', { type, target: Number(id) }); if (r) tenderModal(); else render(); },
    svcPick: a => {
      if (['anticor', 'clean'].includes(a)) { const ts = s.fac.filter(f => D.BUILD[f.type].tank && f.status === 'ok'); form(D.SERVICES[a].name, 'Выберите резервуар', [{ name: 't', label: 'Резервуар', type: 'select', options: ts.map(t => [t.id, `${t.name} — ${D.TANK_PURPOSE[t.purpose].split(' ')[0]}, износ ${Math.round(t.health)}%`]) }], v => { ui.modal = null; handlers.svc(`${a}:${v.t}`); return false; }, 'К тендеру'); return; }
      const ws = s.wells.filter(w => (w.type === 'sk' || w.type === 'ecn') && w.status !== 'repair' && (a !== 'prs' || w.status === 'fail'));
      if (!ws.length) { flash('Нет подходящих скважин', 'warn'); render(); return; }
      form(D.SERVICES[a].name, 'Выберите скважину', [{ name: 'w', label: 'Скважина', type: 'select', options: ws.sort((x, y) => x.health - y.health).map(w => [w.id, `${w.name} — ${E.wellTypeName(w.type)}, потенциал ${num(w.potential, 1)}, обводн. ${pct(w.wc)}, износ ${Math.round(w.health)}%`]) }], v => { ui.modal = null; handlers.svc(`${a}:${v.w}`); return false; }, 'К тендеру');
    },
    anim: a => { LS.set('om2_anim', a); applyAnim(); flash(a === 'off' ? 'Анимация выключена' : 'Анимация включена', 'good'); render(); },
    veh: a => { const [op, id] = String(a).split(':'); const c = s.fleet.cars.find(x => x.id === Number(id)); if (!c) return;
      const go = () => { if (doAct('veh', { op, id }, { chto: 'ЧТО проведено', to: 'Машина на ТО', pto: 'Техосмотр пройден', repair: 'Машина в ремонте', sell: 'Машина списана', fuel: 'Бак заправлен' }[op])) { SND.play(op === 'sell' ? 'leave' : op === 'fuel' ? 'hiss' : 'ratchet'); } render(); };
      if (op === 'sell') confirmBox(`Списать ${c.name} (${c.plate})?`, 'Машина будет продана по остаточной стоимости.', go); else go(); },
    vbuy: a => { const V = D.VEH[a]; confirmBox(`Купить: ${V.name}?`, money(V.cost * idx()), () => { if (doAct('veh', { op: 'buy', type: a }, 'Техника получена')) SND.play('motor'); render(); }); },
    fleetSet: a => { doAct('veh', { op: a, on: !s.fleet[a] }); SND.play('valve'); render(); },
    vparts: a => { doAct('buy', { key: 'vparts', qty: Number(a) }, 'Заказ оформлен'); render(); },
    menu: a => { doAct('menu', { menu: a }, 'Меню изменено: ' + E.MENU[a].name); render(); },
    valve: a => { if (a === 'crude') { const op = s.np.run === 'off' || s.np.run === 'stop'; confirmBox(op ? 'Открыть задвижку сырья — пуск НПЗ?' : 'Закрыть задвижку сырья — останов НПЗ?', op ? `Выход на режим 3 суток · ${money(4e6 * idx())}` : 'Останов 1 сутки, износ установок −1,5%', () => { if (doAct('np', { valve: 'crude' })) npzRunSnd(op); render(); }); return; } doAct('np', { valve: a }); SND.play('valve'); render(); },
    npzRun: a => confirmBox(a === 'start' ? 'Открыть задвижку сырья — пуск НПЗ?' : 'Закрыть задвижку сырья — останов НПЗ?', a === 'start' ? `Выход на режим 3 суток · ${money(4e6 * idx())}` : 'Останов 1 сутки, износ установок −1,5%', () => { if (doAct('np', { run: a })) npzRunSnd(a === 'start'); render(); }),
    fixfac: a => { const [id, kind] = String(a).split(':'); const f = s.fac.find(x => x.id === Number(id)); if (!f) return; confirmBox(`${kind === 'kr' ? 'Капитальный' : 'Текущий'} ремонт: ${f.name}?`, `${money(E.fixCost(s, f, kind))}, остановка на ${E.fixDays(f, kind)} сут.`, () => { doAct('fixfac', { id, kind }); render(); }); },
    npzRegen: a => confirmBox('Регенерация катализатора?', 'Установка остановится на 8 суток.', () => { doAct('regen', { id: a }); }),
    grp: a => { ui.grp = ui.grp || {}; ui.grp[a] = !ui.grp[a]; render(); },
    grpAll: a => { ui.grp = ui.grp || {}; const ks = String(a).split(','), on = !ks.every(k => ui.grp[k]); for (const k of ks) ui.grp[k] = on; render(); },
    worksOpen: () => { ui.worksOpen = !ui.worksOpen; render(); },
    lpgExp: () => { if (doAct('lpgSet', { exp: true }, 'Освидетельствование проведено')) SND.play('stamp'); render(); },
    goSafety: () => { go('npz:safety'); },
    goFleet: () => { go('fleet:cars'); },
    goStaffDs: a => { go(a + ':staff'); },
    pcAccept: a => { const o = (s.pc.offers || []).find(x => x.id === Number(a)); if (!o) return; confirmBox(`Договор с ${o.buyer}?`, `${PCN[o.prod]} ${num(o.monthly)} т/мес на ${o.months} мес. Штраф за недопоставку ${Math.round(o.penalty * 100)}% стоимости.${o.kind === 'gov' ? ' Банковская гарантия: ' + money(o.monthly * o.months * E.pcPrice(s, o) * 0.01) + '.' : ''}`, () => { if (doAct('pcAccept', { id: o.id }, 'Договор заключён')) SND.play('stamp'); render(); }, 'Подписать'); },
    pcCancel: a => { const c = s.pc.list.find(x => x.id === Number(a)); if (!c) return; confirmBox('Расторгнуть договор?', `Неустойка ${money(c.monthly * E.pcPrice(s, c) * (c.kind === 'gov' ? 0.2 : 0.1))}${c.kind === 'gov' ? ', доверие −3' : ', доверие −1'}.`, () => { doAct('pcCancel', { id: c.id }, 'Договор расторгнут'); render(); }, 'Расторгнуть'); },
    goRepair: a => { go(a + ':repair'); },
    goStock: a => { go(a + ':stock'); },
    dsFixT: a => { if (doAct('ds', { fix: { g: a, on: !E.dsCfg(s).fix[a].on } })) SND.play('toggle'); render(); },
    dsWhT: a => { if (doAct('ds', { wh: { g: a, auto: !E.dsCfg(s).wh[a].auto } })) SND.play('toggle'); render(); },
    hireDept: a => { const need = E.staffNeed(s); let n = 0, cost = 0; const rl = D.ROLES.filter(r => r.dept === a), dd = r => need[r.key] - s.staff[r.key].n - s.hires.filter(h => h.role === r.key).reduce((x, h) => x + h.n, 0);
      for (const r of rl) { const d = dd(r); if (d > 0) { n += d; cost += d * r.salary * idx() * 0.3; } }
      if (!n) { flash('Штат укомплектован', 'good'); render(); return; }
      confirmBox('Нанять весь штат?', `${n} чел. Стоимость подбора ${money(cost)}.`, () => { for (const r of rl) { const d = dd(r); if (d > 0) doAct('hire', { role: r.key, n: d }); } flash(`Подбор ${n} чел. начат`, 'good'); render(); }, 'Нанять'); },
    guardT: a => { if (doAct('guard', { obj: a })) SND.play('toggle'); render(); },
    goHse: () => { go('hse'); },
    lpgValve: a => { if (doAct('lpgSet', { valve: a })) { SND.play('valve'); setTimeout(() => SND.play('hiss'), 600); } render(); },
    azsUp: a => { const [id, up] = String(a).split(':'); doAct('azsUp', { id, up }, 'Готово'); render(); },
    trucks: a => { doAct('ds', { trucks: Number(a) }, 'Парк бензовозов обновлён'); render(); },
    dsMode: a => { doAct('ds', { mode: a }); render(); },
    dsSell: a => { doAct('ds', { sell: a }, a === 'season' ? 'Копим продукты до сезона высоких цен' : 'Продажа оптом ежедневно'); render(); },
    npzTank: a => { const [id, k] = String(a).split(':'); doAct('ds', { tank: id, prod: k }, 'Резервуар переведён'); render(); },
    shOp: a => { const [op, v] = String(a).split(':'); const pay = { op, pct: v, n: v, amount: v };
      const txt = { ipo: 'Разместить акции на бирже?', spo: 'Выпустить новые акции? Доверие совета −3.', buyback: 'Выкупить акции с рынка?', dividend: `Выплатить дивиденды ${money(Number(v))}?` }[op];
      confirmBox(txt, '', () => { if (doAct('shares', pay, op === 'ipo' ? 'Акции размещены!' : 'Готово')) { if (op === 'ipo') { SND.play('fanfare'); confetti(); } } render(); }); },
    shBuy: a => { const c = s.companies[Number(a)]; if (!c) return; const n = Math.floor(100e6 * idx() / E.compPrice(c)); doAct('shares', { op: 'trade', name: c.name, n }, `Куплено ${num(n)} акций`); render(); },
    shSell: a => { const c = s.companies[Number(a)]; if (!c || !s.port[c.name]) return; doAct('shares', { op: 'trade', name: c.name, n: -s.port[c.name].qty }, 'Акции проданы'); render(); },
    gwell: a => { const [id, op] = String(a).split(':'); if (op === 'stop' || op === 'start') SND.play('valve'); doAct('gwell', { id, op }, { open: 'Расконсервация начата (10 сут)', repair: 'Ремонтная бригада выехала', stop: 'Скважина остановлена', start: 'Скважина пущена' }[op]); render(); },
    tender: a => { const [ty, pu] = String(a).split(':'); const r = doAct('tender', { type: ty, purpose: pu }); if (r) tenderModal(); else render(); },
    award: a => {
      const pur = document.getElementById('f-purpose'), cd = document.getElementById('f-cdng');
      if (pur && s.tender.type !== 'azs') s.tender.purpose = pur.value;
      const r = doAct('award', { i: Number(a), cdng: cd ? cd.value : null });
      if (r) { ui.modal = null; flash('Договор подряда заключён', 'good'); } render();
    },
    cancelProject: a => confirmBox('Отменить проект?', 'Вернётся 40% уплаченного аванса.', () => { doAct('cancelProject', { id: a }); }),
    maintain: a => { doAct('maintain', { id: a }, 'ТО выполнено'); render(); },
    demolish: a => confirmBox('Снести резервуар?', `Стоимость демонтажа ${money(3e6 * idx())}. Резервуар должен быть пустым.`, () => { doAct('demolish', { id: a }); }),
    purpose: a => form('Перепрофилировать РВС', `Только пустой резервуар. Стоимость ${money(2e6 * idx())}.`, [{ name: 'p', label: 'Назначение', type: 'select', options: Object.entries(D.TANK_PURPOSE), value: s.fac.find(f => f.id === Number(a)).purpose }], v => doAct('tankPurpose', { id: a, purpose: v.p }) ? true : false),
    hire: a => { const r = D.ROLES.find(x => x.key === a); const need = Math.max(1, E.staffNeed(s)[a] - s.staff[a].n - s.hires.filter(h => h.role === a).reduce((x, h) => x + h.n, 0)); form('Подбор персонала', `${esc(r.name)}. Подбор: 30% месячного оклада за человека.`, [{ name: 'n', label: 'Количество', type: 'number', value: need, min: 1, hint: `Стоимость подбора: ${money(r.salary * idx() * 0.3)} за чел.` }], v => doAct('hire', { role: a, n: v.n }, 'Заявка на подбор размещена') ? true : false, 'Нанять'); },
    fire: a => form('Увольнение', 'Выходное пособие — месячный оклад. Мораль снизится.', [{ name: 'n', label: 'Количество', type: 'number', value: 1, min: 1 }], v => doAct('fire', { role: a, n: v.n }) ? true : false, 'Уволить'),
    hireNeed: () => { const need = E.staffNeed(s); let n = 0, cost = 0; for (const r of UP_ROLES()) { const d = need[r.key] - s.staff[r.key].n - s.hires.filter(h => h.role === r.key).reduce((x, h) => x + h.n, 0); if (d > 0) { n += d; cost += d * r.salary * idx() * 0.3; } } if (!n) { flash('Штат укомплектован', 'good'); render(); return; } confirmBox('Нанять по потребности?', `Будет нанято ${n} чел. Стоимость подбора ${money(cost)}.`, () => { for (const r of UP_ROLES()) { const d = need[r.key] - s.staff[r.key].n - s.hires.filter(h => h.role === r.key).reduce((x, h) => x + h.n, 0); if (d > 0) doAct('hire', { role: r.key, n: d }); } flash(`Подбор ${n} чел. начат`, 'good'); }, 'Нанять'); },
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
    slotSave: n => { const m = meta(); const doIt = () => { if (LS.set(SLOT_KEY(n), E.serialize(s))) { m['slot' + n] = slotInfo(s); setMeta(m); flash(`Сохранено в слот ${n}`, 'good'); SND.play('stamp'); } else flash('Не хватает памяти для слота', 'bad'); render(); };
      if (m['slot' + n]) confirmBox(`Перезаписать слот ${n}?`, `Там: ${esc(m['slot' + n].company)}, ${dateRu(m['slot' + n].date)}.`, () => { doIt(); }, 'Перезаписать'); else doIt(); },
    slotLoad: n => confirmBox(`Загрузить слот ${n}?`, 'Текущая игра будет заменена (её автосохранение перезапишется). Если она нужна — сначала сохраните её в другой слот.', () => { const st = loadFrom(SLOT_KEY(n)); if (!st) { flash('Слот повреждён или пуст', 'bad'); return; } s = st; save(); ui.tab = 'home'; flash(`Загружен слот ${n}: ${dateRu(E.iso(s.day))}`, 'good'); }, 'Загрузить'),
    slotDel: n => confirmBox(`Очистить слот ${n}?`, 'Сохранение в слоте будет удалено.', () => { LS.del(SLOT_KEY(n)); const m = meta(); delete m['slot' + n]; setMeta(m); }, 'Удалить'),
    loadBackup: () => confirmBox('Загрузить резервную копию?', 'Это состояние игры на начало прошлого игрового месяца. Текущая игра будет заменена.', () => { const st = loadFrom(BACKUP_KEY); if (!st) { flash('Резервная копия повреждена', 'bad'); return; } s = st; save(); ui.tab = 'home'; flash('Резервная копия загружена', 'good'); }, 'Загрузить'),
    export: () => { exportSave(); },
    import: () => document.getElementById('importFile')?.click(),
    newGame: () => { if (s && !s.gameOver) { confirmBox('Начать новую игру?', 'Текущая игра и её автосохранение будут удалены. Слоты сохранения останутся.', () => { LS.del(E.SAVE_KEY); LS.del(BACKUP_KEY); { const m = meta(); delete m.autoInfo; delete m.backupInfo; delete m.backupMonth; setMeta(m); } s = null; ui.modal = null; }); } else { LS.del(E.SAVE_KEY); LS.del(BACKUP_KEY); { const m = meta(); delete m.autoInfo; delete m.backupInfo; delete m.backupMonth; setMeta(m); } s = null; ui.modal = null; render(); } },
    continue: () => { if (!autoLoad()) alert('Сохранение не найдено или повреждено'); render(); },
    startNew: () => {
      s = E.newGame({ name: document.getElementById('ng-name').value.trim() || 'АО «AJT»', field: document.getElementById('ng-field').value.trim() || D.FIELD_NAMES[0], difficulty: document.getElementById('ng-diff').value, market: document.getElementById('ng-market').value });
      ui.tab = 'home'; ui.sub = {}; { const m = meta(); m.backupMonth = E.iso(s.day).slice(0, 7); delete m.backupInfo; setMeta(m); LS.del(BACKUP_KEY); } save(); saveUi(); render();
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
      ui.modal = { title: `Кандидаты на должность начальника ${c.name}`, desc: 'К — опыт и деловые качества. Сильный кандидат дороже, выход через 10 дней.', wide: true,
        html: `<div class="offers2">${(c.candidates || []).map((k, i) => `<div class="tof"><div class="row">${G.face({ face: k.face, g: k.g, age: k.by ? E.parts(s.day).y - k.by : 40, mood: 70, dept: 'chief', size: 48, id: 'cd' + i })}<b>${esc(k.name)}${k.by ? `<small class="muted"> · ${yrs(E.parts(s.day).y - k.by)}</small>` : ''}</b></div><div class="kv3"><div><span>Коэффициент К</span><b class="${effCls(k.eff)}">${k.eff.toFixed(2)}</b></div><div><span>Стаж</span><b>${Math.round(k.exp)} лет</b></div><div><span>Оклад</span><b>${money(k.salary * idx())}</b></div></div>${btn('Назначить', 'chiefHire', c.id + ':' + i, 'primary small')}</div>`).join('')}</div>
          <div class="btnrow">${btn(`Новый поиск (${money(D.CHIEF_SALARY * idx() * 0.5)})`, 'chiefSearch', c.id, 'small')}</div>` };
      render();
    },
    chiefHire: a => { const [id, i] = a.split(':'); if (doAct('chief', { cdng: Number(id), op: 'hire', i: Number(i) }, 'Начальник цеха назначен')) ui.modal = null; render(); },
    chiefSearch: id => { if (doAct('chief', { cdng: Number(id), op: 'search' })) handlers.chiefCand(id); else render(); },
    help: () => { ui.modal = { title: 'Как играть', html: HELP, wide: true }; render(); }
  };
  const HELP = `<div class="help">
    <p><b>Вы — генеральный директор</b> молодой нефтяной компании: 11 скважин, небольшой ЦКППН и 3 млрд ₸. Цель — выполнять план и войти в ТОП-10.</p>
    <ol>
      <li><b>Время.</b> +1 день, +7 дней, +Месяц. В конце месяца — зарплата, налоги, план/факт.</li>
      <li><b>Подготовка нефти.</b> Скважины → АГЗУ → УПСВ → РВС → печи → товарные РВС. Узкое место ограничивает добычу.</li>
      <li><b>ЦДПиТГ.</b> Газ: УППГ для газовых скважин, МКС для попутного газа. Факел — штрафы.</li>
      <li><b>Сбыт.</b> Нефть продаётся по договорам — заключите первый в первые недели.</li>
      <li><b>НПЗ и АЗС.</b> Свой НПЗ перерабатывает нефть в бензин, дизель и мазут, АЗС продают топливо в розницу.</li>
      <li><b>Акции.</b> IPO приносит деньги, дивиденды — доверие совета. Можно покупать акции других компаний.</li>
      <li><b>Качество.</b> Температура печей и деэмульгатор: I группа — полная цена.</li>
      <li><b>Ремонты.</b> ПРС чинят скважины при наличии материалов. Включите автозакупку.</li>
      <li><b>Пласт.</b> Закачивайте воду, иначе падают давление и дебиты.</li>
      <li><b>Рост.</b> Бурите и стройте через тендеры. 8 скважин — АГЗУ, 40 — новый ЦДНГ.</li>
      <li><b>Цеха.</b> После месяца — итоги по ЦДНГ и решения по начальникам.</li>
      <li><b>ОТ и ПБ.</b> Учения, медосмотры, СИЗ — меньше травм и штрафов.</li>
      <li><b>Банк.</b> Лишние деньги — на депозит, нехватку — кредитом.</li>
      <li><b>План.</b> Доверие совета 0 — отставка. Три месяца в минусе — банкротство.</li>
    </ol>
    <p class="muted">Красные пункты на «Сводке» подскажут, что сейчас мешает больше всего.</p></div>`;
  function go(spec) { const [tab, sb, extra] = spec.split(':'); ui.tab = tab; if (sb) ui.sub[tab] = sb; if (extra) { ui.wellFilter = extra; ui.page = 0; } ui.sheet = false; ui.resetScroll = true; render(); const p = document.querySelector('.page'); if (p) p.scrollTop = 0; window.scrollTo(0, 0); }

  document.addEventListener('visibilitychange', () => { if (document.hidden) { SND.ambient(false); if (s) { save(); saveUi(); } } else if (s) afterFx(); });
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  window.addEventListener('pagehide', () => { if (s) { save(); saveUi(); } });
  /* ===================== события DOM ===================== */
  // звуки касания оборудования
  const EQ_SND = [['.valve,.vbtn', null], ['.gauge.mano', 'glass'], ['.pj', 'creak'], ['.azspic', 'beep'], ['.furn,.flame', 'fire'], ['.ecn,.impeller,.inj,.fdial', 'motor'], ['.pmeter', 'toggle'], ['svg.tank,.tank,.tankc', 'knock'], ['.scheme .node', 'clank']];
  root.addEventListener('pointerdown', e => {
    SND.init();
    if (SND.settings.touch === false) return;
    const el = e.target;
    if (el.closest('input[type=checkbox]') || (el.tagName === 'LABEL' && el.querySelector('input[type=checkbox]'))) { SND.play('toggle'); return; }
    for (const [sel, snd] of EQ_SND) { const hit = el.closest(sel); if (hit) { if (snd) SND.play(snd); if (snd === 'glass') { hit.classList.remove('tapped'); void hit.offsetWidth; hit.classList.add('tapped'); } if (snd === 'creak' || snd === 'clank' || snd === 'knock' || snd === 'motor') { hit.classList.remove('poke'); void hit.getBoundingClientRect(); hit.classList.add('poke'); } return; } }
    if (!el.closest('button,[data-act],[data-tab],[data-sub],[data-go],input,select,a')) SND.play('touch');
  }, { passive: true });
  root.addEventListener('input', e => { if (e.target.type === 'range' && SND.settings.touch !== false) SND.play('ratchet'); }, { passive: true });
  root.addEventListener('click', e => {
    SND.init();
    const t = e.target.closest('[data-tab],[data-sub],[data-act],[data-go]'); if (!t || t.disabled) return;
    if (t.dataset.tab || t.dataset.sub || t.dataset.go) SND.play('tab');
    else if (!['adv', 'sndTest'].includes(t.dataset.act) && !ACT_SND[t.dataset.act]) SND.play('click');
    if (t.dataset.tab) { ui.tab = t.dataset.tab; setTimeout(saveUi, 0); ui.sheet = false; ui.page = 0; ui.resetScroll = true; render(); const p = document.querySelector('.page'); if (p) p.scrollTop = 0; window.scrollTo(0, 0); return; }
    if (t.dataset.sub) { ui.sub[ui.tab] = t.dataset.sub; { const g = subGroup(); if (g) ui.subMem[ui.tab + ':' + g[0]] = t.dataset.sub; } ui.page = 0; ui.resetScroll = true; render(); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    const h = handlers[t.dataset.act]; if (h) h(t.dataset.arg);
    if (ui.showHelpAfter && s && !s.pending && t.dataset.act === 'resolve') { ui.showHelpAfter = false; handlers.help(); }
  });
  root.addEventListener('input', e => {
    const k = e.target.dataset.input; if (!k) return; const v = Number(e.target.value);
    if (k === 'temp') { document.getElementById('tv').textContent = v + '°C'; previewQ(v, s.ckppnSet.dose); }
    if (k === 'dose') { document.getElementById('dv').textContent = v + '%'; previewQ(s.ckppnSet.temp, v / 100); }
    if (k === 'comp') document.getElementById('compv').textContent = v + '%';
    if (k === 'deg') document.getElementById('degv').textContent = v + ' л/ч';
    if (k === 'feed') document.getElementById('feedv').textContent = v + ' т/сут';
    if (['elT', 't1', 'tr', 'th', 'tf'].includes(k)) document.getElementById(k + 'v').textContent = v + '°C';
    if (k === 'wash') document.getElementById('washv').textContent = v + '%';
    if (k === 'g95' || k === 'g98') document.getElementById(k + 'v').textContent = v + '%';
    if (k === 'res') document.getElementById('resv').textContent = v + ' сут';
    if (k === 'mkp') document.getElementById('mkpv').textContent = (v > 0 ? '+' : '') + v + '%';
    if (k === 'reg') { document.getElementById('regv').textContent = v + '°C'; const c = Math.max(70, Math.min(96, 87 + (v - 155) * 0.45)); const el = document.getElementById('concv'); if (el) { el.textContent = num(c, 1) + '%'; el.className = c < 87 ? 'tbad' : 'tgood'; } }
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
    else if (k === 'deg') doAct('gasSet', { deg: el.value });
    else if (k === 'tenderLoc') { if (doAct('tender', { type: 'azs', purpose: el.value })) tenderModal(); else render(); }
    else if (k === 'feed') doAct('ds', { feed: el.value });
    else if (['elT', 't1', 'tr', 'th', 'tf', 'wash'].includes(k)) { doAct('np', { [k]: el.value }); render(); }
    else if (k === 'npbit') { doAct('np', { bit: el.checked }); render(); }
    else if (k === 'g95' || k === 'g98') { doAct('np', { [k]: el.value }); render(); }
    else if (k === 'fleetAuto' || k === 'fleetRent' || k === 'fleetFuel') { doAct('veh', { op: k === 'fleetAuto' ? 'auto' : k === 'fleetFuel' ? 'autoFuel' : 'rent', on: el.checked }); SND.play('toggle'); render(); }
    else if (k === 'lpgRes') { doAct('lpgSet', { res: el.value }); render(); }
    else if (k === 'yA' || k === 'yB') { ui[k] = Number(el.value); render(); }
    else if (k === 'autofix') { doAct('ds', { autoFix: el.checked }); render(); }
    else if (k === 'dsset') { const g = el.dataset.g, kk = el.dataset.k, v = Number(el.value); if (kk === 'days') doAct('ds', { wh: { g, days: v } }); else doAct('ds', { fix: { g, [kk]: kk === 'max' ? v : 100 - v } }); render(); }
    else if (k === 'res') doAct('ds', { res: el.value });
    else if (k === 'mkp') doAct('ds', { mkp: el.value });
    else if (k === 'dsbuy') doAct('ds', { buy: el.checked });
    else if (k === 'reg') doAct('gasSet', { reg: el.value });
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
    else if (k === 'sndTouch') { SND.setTouch && SND.setTouch(el.checked); }
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
  applyAnim(); autoLoad();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }
  if (s) { const m = meta(); if (s.day > 365 && (!m.exportedAt || Date.now() - m.exportedAt > 14 * 864e5) && (!m.remindAt || Date.now() - m.remindAt > 3 * 864e5)) { m.remindAt = Date.now(); setMeta(m); setTimeout(() => flash('Совет: сделайте резервный файл игры — Настройки → Экспорт в файл', 'info'), 2500); } }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  window.OMApp = { get state() { return s; }, render, advance, ui };
})();
