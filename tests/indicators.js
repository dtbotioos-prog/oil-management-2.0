/* Проверка индикаторов: «живые» ли значения (меняются, не застряли на 0/100%), в допустимых пределах, сходятся с пересчётом.
   Запуск: node tests/indicators.js */
'use strict';
const path = require('path');
require(path.join(__dirname, '../js/data.js'));
require(path.join(__dirname, '../js/engine.js'));
const E = globalThis.OMEngine, D = globalThis.OMData;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const series = {}, issues = [];
const rec = (k, v) => { (series[k] = series[k] || []).push(v); };
const pick2 = d => ['demand', 't6', 't12', 't24'][Math.floor(d / 15) % 4];
const T = (s, t, a) => { try { return E.act(s, t, a); } catch (e) { return null; } };

const s = E.newGame({ seed: 77 }); E.act(s, 'resolve', { i: 1 }); E.act(s, 'setting', { key: 'monthReport', value: false });
E.act(s, 'ckppn', { temp: 70, dose: 1.3 }); E.act(s, 'toggle', { key: 'buy' }); E.act(s, 'toggle', { key: 'to' });
for (let d = 0; d < 365 * 5; d++) {
  while (s.pending) E.act(s, 'resolve', { i: s.pending.key === 'plan' ? 1 : 0 });
  if (d % 15 === 0) {
    const need = E.staffNeed(s); for (const k in need) { const x = need[k] - s.staff[k].n - sum(s.hires.filter(h => h.role === k), h => h.n); if (x > 0) T(s, 'hire', { role: k, n: x }); }
    const cv = sum(s.contracts.filter(c => c.status === 'active'), c => c.monthly); if (cv < (s.today.potOil || 0) * 26 && s.offers.length) T(s, 'accept', { id: s.offers[0].id });
    const sk = s.wells.filter(w => w.type === 'sk').length + s.projects.filter(p => p.type === 'well_sk').length;
    const busy = t => s.projects.some(p => p.type === t);
    if (sk >= E.facs(s, 'agzu').length * 8 - 1 && !busy('agzu')) T(s, 'tender', { type: 'agzu' }) && T(s, 'award', { i: 0 });
    else if (s.cash > 800e6 * s.priceIndex && s.projects.filter(p => p.type === 'well_sk').length < 2) T(s, 'tender', { type: 'well_sk' }) && T(s, 'award', { i: 1 });
    const k = E.kpi(s);
    if (k.oilTank.v > k.oilTank.c * 0.8 && !busy('tank5000')) T(s, 'tender', { type: 'tank5000', purpose: 'oil' }) && T(s, 'award', { i: 0 });
    if (s.today.cap.ckppn < s.today.liquid * 0.9 && !busy('ckppn')) T(s, 'tender', { type: 'ckppn' }) && T(s, 'award', { i: 0 });
    if (s.today.liquid > s.today.cap.upsv * 0.85 && !busy('upsv')) T(s, 'tender', { type: 'upsv' }) && T(s, 'award', { i: 0 });
    if (s.today.energy.demand > s.today.energy.supply.total * 0.85 && !busy('substation')) T(s, 'tender', { type: 'substation' }) && T(s, 'award', { i: 0 });
    if (s.reservoir.pressure < 90 && !busy('well_inj')) T(s, 'tender', { type: 'well_inj' }) && T(s, 'award', { i: 0 });
    if (s.reservoir.pressure < 90 && !busy('well_water')) T(s, 'tender', { type: 'well_water' }) && T(s, 'award', { i: 0 });
    if (d % 120 === 0) { for (const kd of ['fire', 'spill', 'gas']) T(s, 'hse', { op: 'drill', kind: kd }); T(s, 'hse', { op: 'medical' }); }
    if (d % 180 === 0) T(s, 'hse', { op: 'training' });
    if (k.oilTank.v > k.oilTank.c * 0.6 && s.offers.length) T(s, 'accept', { id: s.offers[0].id });
    if (k.oilTank.v > k.oilTank.c * 0.85) T(s, 'spot', { qty: 400 });
    if (s.cash < 0) T(s, 'loan', { amount: 500e6, months: 36 });
    if (s.cash > 2e9 * s.priceIndex) T(s, 'deposit', { amount: 5e8, type: pick2(d) });
    for (const t of ['ecn', 'tele', 'edeh', 'grp']) if (s.cash > 2e9) T(s, 'tech', { key: t });
  }
  E.advance(s, 1);
  if (s.gameOver) { console.log('ОКОНЧАНИЕ ИГРЫ:', E.iso(s.day), s.gameOver.reason, 'доверие', s.trust.toFixed(1), 'деньги', Math.round(s.cash / 1e6) + 'M'); for (const h of s.history.slice(-4)) console.log(h.m, 'rev', Math.round(h.rev/1e6), 'opex', Math.round(h.opex/1e6), 'tax', Math.round(h.taxes/1e6), 'net', Math.round(h.net/1e6), JSON.stringify(Object.fromEntries(Object.entries(h.cats).filter(([k,v])=>Math.abs(v)>3e6).map(([k,v])=>[k,Math.round(v/1e6)])))); break; }
  const k = E.kpi(s), t = s.today;
  // ---- индикаторы сводки и вкладок ----
  rec('Добыча нефти, т/сут', k.oil); rec('Жидкость, т/сут', k.liquid); rec('Обводнённость', k.wc);
  rec('Факт месяца', k.factMonth); rec('План месяца', k.planMonth); rec('Факт года', k.factYear);
  rec('Фонд в работе', k.wellsWork); rec('Отказы (скв.)', k.failed);
  rec('Товарные РВС %', k.oilTank.v / k.oilTank.c); rec('Технол. РВС %', k.techTank.v / k.techTank.c); rec('Водяные РВС %', k.waterTank.v / k.waterTank.c);
  rec('Качество: вода %', k.quality.water); rec('Энергобаланс', k.energyF); rec('Потребление, кВт', t.energy.demand); rec('Пласт. давление', k.pressure);
  rec('Компенсация', t.liquid ? t.inj / t.liquid : 0); rec('Закачка', t.inj); rec('Водозабор', t.injSource);
  rec('Загрузка УПСВ', t.cap.upsv ? t.liquid / E.capOf(s, 'upsv') : 0); rec('Загрузка ЦКППН', t.P / Math.max(1, E.capOf(s, 'ckppn'))); rec('Отгрузка, т/сут', t.ship);
  rec('Капитализация', k.cap); rec('Рейтинг', s.rank); rec('Балл рейтинга', s.score || 0); rec('Доверие', s.trust); rec('Мораль', s.morale);
  rec('Деньги', s.cash); rec('Brent', s.market.brent); rec('Курс', s.market.fx);
  rec('ПНГ: утилизация', t.gas.util); rec('ПНГ: факел', t.gas.flare); rec('Готовность к ЧС', s.hse.readiness); rec('Культура безопасности', s.hse.culture);
  rec('Дней без травм', s.hse.daysNoInj); rec('Индекс ОТ', E.hseIndex(s)); rec('Депозиты', sum(s.deposits, x => x.amount));
  rec('Укомплектованность ЦДНГ', k.cov.dept.cdng); rec('Укомплектованность ЦКППН', k.cov.dept.ckppn);
  rec('Склад: деэмульгатор', s.stock.demulg); rec('Склад: СИЗ', s.stock.ppe);
  // ---- сверки ----
  const wellsOil = sum(s.wells, w => w.today || 0);
  if (Math.abs(wellsOil - t.oil) > 0.01 + t.oil * 1e-6) issues.push(`${E.iso(s.day)}: добыча по скважинам ${wellsOil.toFixed(2)} ≠ итог ${t.oil.toFixed(2)}`);
  const PF = s.pf[E.parts(s.day).y]; const fm = sum(Object.values(PF.fact[E.parts(s.day).m - 1]), x => x);
  if (Math.abs(fm - k.factMonth) > 0.01) issues.push(`факт месяца не сходится`);
  if (Math.abs(sum(t.shipped, x => x.q) - t.ship) > 0.01) issues.push('отгрузка по договорам ≠ итог');
  for (const [n, v] of [['товарные', k.oilTank], ['технол.', k.techTank], ['водяные', k.waterTank]]) if (v.v > v.c + 0.5) issues.push(`${E.iso(s.day)}: ${n} РВС переполнены ${v.v}/${v.c}`);
  if (t.gas.util < -1e-9 || t.gas.util > 1 + 1e-9) issues.push('утилизация ПНГ вне 0..1');
  if (k.energyF > 1 + 1e-9) issues.push('энергобаланс > 100%');
}
// помесячные
for (const h of s.history) {
  rec('[мес] Себестоимость $/барр', h.fact > 0 ? h.opex / (h.fact * E.BBL) / h.fx : null); rec('[мес] EBITDA', h.ebitda); rec('[мес] Чистая прибыль', h.net);
  rec('[мес] Кэкспл', h.wd ? h.wk / h.wd : null); rec('[мес] Отказы', h.fails); rec('[мес] Травмы', h.inj2); rec('[мес] Выручка', h.rev);
  const taxes0 = -((h.cats['НДПИ'] || 0) + (h.cats['Рентный налог'] || 0) + (h.cats['Налог на имущество'] || 0));
  if (Math.abs(h.ebitda - (h.rev - h.opex - taxes0)) > 2) issues.push(`${h.m}: EBITDA не сходится`);
  if (Math.abs(h.plan - Math.round(sum(Object.values(s.pf[+h.m.slice(0, 4)].plan[+h.m.slice(5) - 1]), x => x))) > 1) issues.push(`${h.m}: план в истории ≠ плану`);
}
// анализ «живости»
console.log('Индикатор'.padEnd(34), 'мин'.padStart(12), 'макс'.padStart(12), 'уник.', 'статус');
let dead = 0;
for (const [k, arr0] of Object.entries(series)) {
  const arr = arr0.filter(v => v != null);
  const bad = arr.some(v => !Number.isFinite(v));
  const mn = Math.min(...arr), mx = Math.max(...arr); const uniq = new Set(arr.map(v => Math.round(v * 1000) / 1000)).size;
  const tail = arr.slice(-365); const stuck = new Set(tail.map(v => Math.round(v * 1000) / 1000)).size <= 1;
  let st = 'ok';
  if (bad) st = 'NaN!'; else if (uniq <= 1) st = 'НЕ МЕНЯЕТСЯ'; else if (stuck && !/Отказы|Травмы|Рейтинг|ЦДНГ|ЦКППН|Энергобаланс|Депозиты/.test(k)) st = 'застыл в последний год';
  if (st !== 'ok') dead++;
  const f = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (Math.round(v * 100) / 100).toString();
  console.log(k.padEnd(34), f(mn).padStart(12), f(mx).padStart(12), String(uniq).padStart(5), st);
}
console.log(`\nСверки: ${issues.length ? '✗ ' + issues.length + ' расхождений' : '✓ всё сходится'}`);
for (const i of [...new Set(issues)].slice(0, 15)) console.log('  ' + i);
console.log(dead ? `✗ подозрительных индикаторов: ${dead}` : '✓ все индикаторы живые');
if (dead || issues.length) process.exitCode = 1;
