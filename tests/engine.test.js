/* Тесты движка Oil Management 2.0. Запуск: node tests/engine.test.js */
'use strict';
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '../js/data.js'));
require(path.join(__dirname, '../js/engine.js'));
const E = globalThis.OMEngine;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { console.error('  ✗ ' + name + '\n    ' + e.stack); process.exitCode = 1; } }
const fresh = (o = {}) => { const s = E.newGame(Object.assign({ seed: 12345 }, o)); E.act(s, 'resolve', { i: 1 }); E.act(s, 'setting', { key: 'monthReport', value: false }); return s; };
const runDays = (s, n) => { for (let i = 0; i < n; i++) { while (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); } };

console.log('Oil Management 2.0 — тесты движка');

test('новая игра стартует 1 января 2000 и требует выбора плана', () => {
  const s = E.newGame({ seed: 1 });
  assert.strictEqual(E.iso(s.day), '2000-01-01');
  assert.ok(s.pending && s.pending.key === 'plan');
  assert.strictEqual(E.advance(s, 5), 0, 'время не идёт, пока не выбран план');
  E.act(s, 'resolve', { i: 1 });
  assert.ok(E.kpi(s).planYear > 0);
});

test('детерминированность: одинаковый seed — одинаковый результат', () => {
  const a = fresh(), b = fresh();
  runDays(a, 200); runDays(b, 200);
  assert.strictEqual(Math.round(a.cash), Math.round(b.cash));
  assert.strictEqual(a.log.length, b.log.length);
});

test('нефть без договора не продаётся, копится в РВС, затем добыча ограничивается', () => {
  const s = fresh();
  runDays(s, 90);
  assert.strictEqual(s.ledger.filter(l => l.cat === 'Продажа нефти').length, 0);
  const k = E.kpi(s);
  assert.ok(k.oilTank.v >= k.oilTank.c * 0.99, 'товарные РВС заполнены');
  assert.ok(s.today.k < 0.5 && /РВС/.test(s.today.limit), 'добыча ограничена переполнением РВС');
});

test('отгрузка по договору списывает нефть из РВС и даёт выручку', () => {
  const s = fresh();
  E.act(s, 'ckppn', { temp: 68, dose: 1.2 });
  const o = s.offers.find(x => x.minGroup >= 3) || s.offers[0];
  E.act(s, 'accept', { id: o.id });
  const c = s.contracts[0];
  for (let i = 0; i < 5; i++) {
    const before = E.tankVol(s, 'oil'), shipped0 = c.shippedTotal;
    runDays(s, 1);
    const after = E.tankVol(s, 'oil');
    assert.ok(Math.abs(before + s.today.product - (c.shippedTotal - shipped0) - after) < 1e-6, `баланс товарных РВС, день ${i}`);
  }
  assert.ok(c.shippedTotal > 0, 'есть отгрузка');
  assert.ok(s.ledger.some(l => l.cat === 'Продажа нефти' && l.a > 0));
});

test('баланс денег: сумма журнала равна изменению кассы', () => {
  const s = fresh(); const start = s.cash;
  E.act(s, 'accept', { id: s.offers[0].id });
  runDays(s, 45);
  const sum = s.ledger.reduce((a, l) => a + l.a, 0);
  assert.ok(Math.abs(start + sum - s.cash) < 5, `касса ${s.cash} vs ${start + sum}`);
});

test('качество: выше температура и дозировка — меньше воды', () => {
  const s = fresh();
  const lo = E.qualityOf(s, 0.5, 0.5, 1); s.ckppnSet.temp = 75; const hi = E.qualityOf(s, 0.5, 1.5, 1);
  assert.ok(hi.water < lo.water); assert.strictEqual(hi.group, 1);
  s.ckppnSet.temp = 35; assert.strictEqual(E.qualityOf(s, 1.2, 0.2, 0.5).group, 4);
});

test('некондиция блокирует договоры', () => {
  const s = fresh(); s.quality = { water: 2, salt: 900, group: 4 };
  assert.throws(() => E.act(s, 'accept', { id: s.offers[0].id }), /качество/i);
});

test('найм занимает время, увольнение мгновенно', () => {
  const s = fresh(); const n = s.staff.op.n;
  E.act(s, 'hire', { role: 'op', n: 2 });
  assert.strictEqual(s.staff.op.n, n);
  runDays(s, 12);
  assert.strictEqual(s.staff.op.n, n + 2);
  E.act(s, 'fire', { role: 'op', n: 1 });
  assert.strictEqual(s.staff.op.n, n + 1);
});

test('ПРС своими силами: материалы списываются, скважина запускается', () => {
  const s = fresh(); s.auto.prs = false;
  const w = s.wells.find(x => x.status === 'fail');
  const gnu = s.stock.gnu;
  E.act(s, 'repair', { id: w.id });
  assert.strictEqual(s.stock.gnu, gnu - 1);
  assert.strictEqual(w.status, 'repair');
  runDays(s, 6);
  assert.strictEqual(w.status === 'work' || w.status === 'fail', true);
  assert.ok(s.log.some(l => l.text.includes('ПРС завершён')));
});

test('тендер и стройка: аванс 25%, остаток при сдаче, объект появляется', () => {
  const s = fresh();
  const tanks = s.fac.filter(f => f.type === 'tank5000').length;
  E.act(s, 'tender', { type: 'tank5000', purpose: 'oil' });
  const offer = s.tender.offers[0]; const cash = s.cash;
  E.act(s, 'award', { i: 0 });
  assert.ok(Math.abs(cash - s.cash - offer.price * 0.25) < 2);
  runDays(s, offer.days + 40);
  assert.strictEqual(s.fac.filter(f => f.type === 'tank5000').length, tanks + 1);
  assert.ok(s.ledger.some(l => l.note.startsWith('Окончательный расчёт')));
});

test('бурение скважины добавляет её в ЦДНГ и корректирует план', () => {
  const s = fresh(); const n = s.wells.length; const plan0 = E.kpi(s).planYear;
  E.act(s, 'tender', { type: 'well_sk' }); E.act(s, 'award', { i: 1 });
  runDays(s, 80);
  assert.ok(s.wells.length >= n + 1 && s.log.some(l => /введена в эксплуатацию/.test(l.text)));
  assert.ok(E.kpi(s).planYear > plan0);
});

test('технология недоступна раньше года внедрения', () => {
  const s = fresh();
  assert.throws(() => E.act(s, 'tech', { key: 'smart' }), /2016/);
  assert.throws(() => E.act(s, 'tender', { type: 'well_ecn' }), /технолог/i);
});

test('кредит: лимит, аннуитет, досрочное погашение', () => {
  const s = fresh(); const c = s.cash;
  E.act(s, 'loan', { amount: 500e6, months: 12 });
  assert.strictEqual(Math.round(s.cash - c), 500e6);
  assert.throws(() => E.act(s, 'loan', { amount: 1e13, months: 12 }), /лимит/);
  runDays(s, 35);
  assert.ok(s.loans[0].principal < 500e6);
  E.act(s, 'repay', { id: s.loans[0].id });
  assert.strictEqual(s.loans.length, 0);
});

test('депозит: проценты начисляются ежемесячно', () => {
  const s = fresh(); E.act(s, 'deposit', { amount: 100e6 });
  runDays(s, 40);
  assert.ok(s.ledger.some(l => l.cat === 'Проценты по депозитам' && l.a > 0));
});

test('закрытие месяца: зарплата, налоги, план/факт, история, рейтинг', () => {
  const s = fresh(); E.act(s, 'accept', { id: s.offers[0].id });
  runDays(s, E.daysToNextMonth(s) + 1);
  const h = s.history[0];
  assert.ok(h && h.m === '2000-01');
  for (const c of ['ФОТ', 'НДПИ', 'Налог на имущество']) assert.ok(s.ledger.some(l => l.cat === c), c);
  assert.ok(h.plan > 0 && h.fact > 0);
  assert.ok(s.rank >= 1 && s.rank <= 100);
  assert.strictEqual(E.leaderboard(s).length, 100);
});

test('пласт: без закачки давление падает, с закачкой держится', () => {
  const mk = comp => { const s = fresh(); s.ppd.comp = comp; E.act(s, 'ckppn', { temp: 68, dose: 1.2 }); for (const o of s.offers.slice()) try { E.act(s, 'accept', { id: o.id }); } catch (e) { } runDays(s, 365); return s; };
  const a = mk(0), b = mk(100);
  assert.ok(a.reservoir.pressure < b.reservoir.pressure - 2, `${a.reservoir.pressure} vs ${b.reservoir.pressure}`);
});

test('дефицит энергии ограничивает добычу', () => {
  const s = fresh(); E.act(s, 'accept', { id: s.offers[0].id });
  s.fac.find(f => f.type === 'substation').cap = 200;
  runDays(s, 2);
  assert.ok(s.today.energyF < 1 && /электро/i.test(s.today.limit));
});

test('новый год: итоги года и выбор нового плана', () => {
  const s = fresh(); E.act(s, 'accept', { id: s.offers[0].id });
  for (let i = 0; i < 400 && !(s.pending && s.pending.key === 'plan'); i++) { if (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); }
  assert.ok(s.pending && s.pending.key === 'plan' && s.pending.data.y === 2001);
  assert.strictEqual(s.yearReports.length, 1);
  E.act(s, 'resolve', { i: 2 });
  assert.strictEqual(s.pf[2001].level, 'amb');
});

test('исторический рынок: кризис 2008 (обвал Brent к концу года)', () => {
  const s = fresh(); s.cash = 1e13; // чтобы не обанкротиться
  const toDay = Math.round((Date.UTC(2008, 6, 15) - Date.UTC(2000, 0, 1)) / 864e5);
  const step = () => { s.trust = 80; s.cash = 1e13; while (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); };
  while (s.day < toDay) step();
  const jul = s.market.brent;
  while (E.iso(s.day) < '2008-12-20') step();
  assert.ok(jul > 110 && s.market.brent < 60, `июль ${jul}, декабрь ${s.market.brent}`);
});

test('сохранение и загрузка', () => {
  const s = fresh(); runDays(s, 20);
  const t = E.deserialize(E.serialize(s));
  assert.strictEqual(t.day, s.day); assert.strictEqual(Math.round(t.cash), Math.round(s.cash));
  assert.throws(() => E.deserialize('{"v":1}'), /формат/);
});

test('банкротство после 3 месяцев отрицательного баланса', () => {
  const s = fresh(); s.cash = -5e9;
  for (let i = 0; i < 130 && !s.gameOver; i++) { while (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); }
  assert.ok(s.gameOver && /Банкротство/.test(s.gameOver.reason));
});

test('стресс: 10 лет без действий игрока — без исключений и NaN', () => {
  const s = fresh({ seed: 777 }); E.act(s, 'toggle', { key: 'buy' });
  for (let i = 0; i < 3660 && !s.gameOver; i++) { while (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); }
  assert.ok(Number.isFinite(s.cash) && Number.isFinite(s.reservoir.pressure));
  for (const w of s.wells) assert.ok(Number.isFinite(w.potential) && Number.isFinite(w.wc));
});

test('своё название месторождения при старте и смена в игре', () => {
  const s = E.newGame({ seed: 3, field: 'Жанатурмыс Северный' });
  assert.strictEqual(s.company.field, 'Жанатурмыс Северный');
  E.act(s, 'resolve', { i: 1 });
  E.act(s, 'rename', { field: 'Новое поле' });
  assert.strictEqual(s.company.field, 'Новое поле');
  assert.throws(() => E.act(s, 'rename', { field: '  ' }), /месторождения/);
});

test('свой годовой план при старте года', () => {
  const s = E.newGame({ seed: 4 });
  assert.ok(s.pending.options.some(o => o.custom));
  assert.throws(() => E.act(s, 'resolve', { i: s.pending.options.length - 1 }), /форм/);
  assert.ok(s.pending, 'событие плана осталось открытым');
  const by = {}; s.cdngs.forEach((c, i) => by[c.id] = 11000 + i * 1000);
  const r = E.act(s, 'planCustom', { y: 2000, byCdng: by });
  assert.strictEqual(s.pending, null);
  assert.ok(Math.abs(r.total - 50000) < 1, 'годовой план = сумме по цехам');
  const c = s.cdngs[1].id;
  const months = s.pf[2000].plan.reduce((a, m) => a + (m[c] || 0), 0);
  assert.ok(Math.abs(months - 12000) < 1, 'сумма по месяцам = годовому плану цеха');
  const tiny = {}; s.cdngs.forEach(x => tiny[x.id] = 1);
  assert.throws(() => E.act(s, 'planCustom', { byCdng: tiny }), /50%/);
});

test('корректировка плана в середине года: прошлые месяцы не меняются, доверие −3', () => {
  const s = fresh(); E.act(s, 'accept', { id: s.offers[0].id });
  runDays(s, 140);
  const c = s.cdngs[0].id; const PF = s.pf[2000];
  const jan = PF.plan[0][c], tr = s.trust;
  const target = Math.round(PF.annual[c] * 0.9);
  E.act(s, 'planCustom', { byCdng: { [c]: target } });
  assert.strictEqual(PF.plan[0][c], jan, 'январь не изменился');
  assert.ok(Math.abs(PF.annual[c] - target) < 1);
  assert.ok(Math.abs(s.trust - (tr - 3)) < 1e-9);
});

test('старт: 4 цеха ЦДНГ, скважины распределены, у каждого начальник', () => {
  const s = fresh();
  assert.deepStrictEqual(s.cdngs.map(c => c.name), ['ЦДНГ-1', 'ЦДНГ-2', 'ЦДНГ-3', 'ЦДНГ-4']);
  for (const c of s.cdngs) {
    assert.ok(c.chief && c.chief.eff > 0.5 && c.chief.eff < 1.5, 'начальник с коэффициентом');
    assert.ok(s.wells.some(w => w.cdng === c.id && w.type === 'sk'), 'в каждом цехе есть добывающие скважины');
  }
  assert.ok(Object.keys(s.pf[2000].annual).length === 4, 'план по каждому цеху');
});

test('отчёт месяца по цехам останавливает время до решения', () => {
  const s = E.newGame({ seed: 9 }); E.act(s, 'resolve', { i: 1 });
  for (let i = 0; i < 60 && !(s.report && s.report.open); i++) { while (s.pending) E.act(s, 'resolve', { i: 0 }); E.advance(s, 1); }
  assert.strictEqual(E.iso(s.day), '2000-01-31', 'время остановилось на закрытии месяца');
  assert.strictEqual(E.advance(s, 3), 0, 'пока отчёт открыт, время стоит');
  assert.ok(s.report && s.report.open && s.report.m === '2000-01');
  const rows = s.cdReports[0].rows;
  assert.strictEqual(rows.length, 4);
  assert.ok(rows.every(r => r.plan > 0 && r.chief && r.wells > 0));
  E.act(s, 'closeReport');
  runDays(s, 5);
  assert.ok(E.iso(s.day) >= '2000-02-05', 'после решения время снова идёт');
});

test('эффективность начальника влияет на добычу цеха', () => {
  const base = fresh({ seed: 21 }); runDays(base, 3);
  const run = eff => { const s = E.deserialize(E.serialize(base)); for (const c of s.cdngs) c.chief.eff = eff; E.tick(s); return s.today.potOil; };
  const lo = run(0.6), hi = run(1.3);
  assert.ok(hi > lo * 1.05, `сильные начальники дают больше нефти: ${hi} vs ${lo}`);
});

test('замечание/выговор при провале плана мотивируют, без оснований — снижают лояльность', () => {
  const s = fresh(); const c = s.cdngs[0];
  s.cdReports.push({ m: '2000-01', rows: s.cdngs.map(x => ({ id: x.id, ratio: x === c ? 0.8 : 1.1 })) });
  const l0 = c.chief.loyalty, e0 = E.chiefEff(s, c);
  E.act(s, 'chief', { cdng: c.id, op: 'reprimand' });
  assert.strictEqual(c.chief.reprimands, 1);
  assert.ok(E.chiefEff(s, c) > e0, 'выговор за провал даёт мотивацию');
  assert.ok(c.chief.loyalty < l0);
  assert.throws(() => E.act(s, 'chief', { cdng: c.id, op: 'remark' }), /уже принято/);
  const c2 = s.cdngs[1]; const l2 = c2.chief.loyalty, e2 = E.chiefEff(s, c2);
  E.act(s, 'chief', { cdng: c2.id, op: 'remark' });
  assert.ok(c2.chief.loyalty <= l2 - 12 + 1e-9 && E.chiefEff(s, c2) === e2, 'необоснованное замечание: только минус лояльность');
});

test('увольнение и найм начальника: и.о., кандидаты, выход через 10 дней', () => {
  const s = fresh(); const c = s.cdngs[2]; const cash = s.cash;
  c.chief.reprimands = 2;
  E.act(s, 'chief', { cdng: c.id, op: 'fire' });
  assert.strictEqual(c.chief, null);
  assert.strictEqual(Math.round(s.cash), Math.round(cash), '2 выговора — без выходного пособия');
  assert.strictEqual(E.chiefEff(s, c), 0.7, 'работает и.о.');
  assert.strictEqual(c.candidates.length, 3);
  const best = c.candidates.reduce((a, b, i) => b.eff > c.candidates[a].eff ? i : a, 0); const effBest = c.candidates[best].eff;
  E.act(s, 'chief', { cdng: c.id, op: 'hire', i: best });
  assert.ok(c.incoming && c.chief === null);
  runDays(s, 11);
  assert.ok(c.chief && c.chief.eff === effBest);
});

test('премия повышает лояльность; низкая лояльность ведёт к уходу', () => {
  const s = fresh(); const c = s.cdngs[3]; const l = c.chief.loyalty;
  E.act(s, 'chief', { cdng: c.id, op: 'bonus' });
  assert.ok(c.chief.loyalty > l);
  for (const x of s.cdngs) if (x.chief) x.chief.loyalty = 0;
  for (let i = 0; i < 6; i++) runDays(s, E.daysToNextMonth(s));
  assert.ok(s.cdngs.some(x => !x.chief), 'кто-то из нелояльных начальников уволился');
});

test('кадровый реестр: каждый работник — человек с возрастом, стажем и зарплатой', () => {
  const s = fresh();
  const total = Object.values(s.staff).reduce((a, x) => a + x.n, 0);
  assert.strictEqual(s.people.length, total, 'численность = числу карточек');
  for (const p of s.people) {
    const age = E.personAge(s, p);
    assert.ok(age >= 20 && age <= 64, 'возраст ' + age);
    assert.ok(p.name.split(' ').length === 2 && !/[ӘәҒғҚқҢңӨөҰұҮүІі]/.test(p.name), 'Фамилия Имя, без казахских букв');
    assert.ok(E.personSalary(s, p).total > 0 && p.grade >= 2 && p.grade <= 6);
    assert.ok(E.yearsToPension(s, p) >= 0);
  }
  assert.ok(s.people.some(p => p.cdng), 'операторы закреплены за цехами');
});

test('ФОТ месяца = сумме зарплат работников и начальников', () => {
  const s = fresh();
  runDays(s, E.daysToNextMonth(s) - 1);
  const exp = s.people.reduce((a, p) => a + E.personSalary(s, p).total, 0) + s.cdngs.reduce((a, c) => a + (c.chief ? c.chief.salary * s.priceIndex : 0), 0);
  runDays(s, 1);
  const fot = s.ledger.find(l => l.cat === 'ФОТ' && /Заработная плата/.test(l.note));
  assert.ok(Math.abs(-fot.a - exp) / exp < 0.02, `${-fot.a} vs ${exp}`);
});

test('найм создаёт карточки, увольнение по должности убирает самых слабых', () => {
  const s = fresh(); const n = s.people.length;
  E.act(s, 'hire', { role: 'op', n: 3 }); runDays(s, 12);
  assert.strictEqual(s.people.length, n + 3);
  const ops = s.people.filter(p => p.role === 'op'); const weakest = ops.reduce((a, b) => a.skill < b.skill ? a : b);
  E.act(s, 'fire', { role: 'op', n: 1 });
  assert.ok(!s.people.includes(weakest));
  assert.strictEqual(s.staff.op.n, ops.length - 1);
});

test('карточка: разряд, премия, обучение, увольнение', () => {
  const s = fresh(); const p = s.people.find(x => x.grade < 6); p.skill = 1.2;
  const g = p.grade, sal = E.personSalary(s, p).total;
  E.act(s, 'person', { id: p.id, op: 'grade' });
  assert.strictEqual(p.grade, g + 1); assert.ok(E.personSalary(s, p).total > sal);
  const m = p.mood; E.act(s, 'person', { id: p.id, op: 'bonus' }); assert.ok(p.mood > m || p.mood === 100);
  const sk = p.skill; E.act(s, 'person', { id: p.id, op: 'train' }); assert.ok(p.skill > sk || p.skill === 1.35);
  assert.throws(() => E.act(s, 'person', { id: p.id, op: 'train' }), /полгода/);
  const role = p.role, cnt = s.staff[role].n;
  E.act(s, 'person', { id: p.id, op: 'fire' });
  assert.strictEqual(s.staff[role].n, cnt - 1);
});

test('пенсия: работник уходит при достижении пенсионного возраста', () => {
  const s = fresh(); const p = s.people[0]; p.g = 'm'; p.by = 2000 - 63; p.bm = 1;
  const role = p.role, cnt = s.staff[role].n;
  runDays(s, E.daysToNextMonth(s));
  assert.ok(!s.people.includes(p)); assert.strictEqual(s.staff[role].n, cnt - 1);
  assert.ok(s.log.some(l => /заслуженный отдых/.test(l.text)));
});

test('квалификация влияет на эффективность подразделения', () => {
  const s = fresh();
  for (const p of s.people) p.skill = 0.6; const lo = E.coverage(s).dept.ckppn;
  for (const p of s.people) p.skill = 1.3; const hi = E.coverage(s).dept.ckppn;
  assert.ok(hi > lo, `${hi} > ${lo}`);
});

test('начальники — мужчины; женщины ≈1% и только в экологии, геологии, бухгалтерии', () => {
  let fem = 0, ppl = 0, femP = 0, wrong = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = E.newGame({ seed });
    E.act(s, 'resolve', { i: 1 }); E.act(s, 'setting', { key: 'monthReport', value: false });
    const c = s.cdngs[0]; E.act(s, 'chief', { cdng: c.id, op: 'fire' });
    for (const x of s.cdngs) if (x.chief && x.chief.g !== 'm') fem++;
    for (const k of c.candidates) if (k.g !== 'm') fem++;
    // естественный штат: на каждые ~12 рабочих добывающих служб — 1 человек из экологии/геологии/бухгалтерии
    for (const r of ['op', 'prs', 'mech', 'drv']) E.act(s, 'hire', { role: r, n: 9 });
    for (const r of ['hse', 'geo', 'aup']) E.act(s, 'hire', { role: r, n: 1 });
    runDays(s, 25);
    ppl += s.people.length; femP += s.people.filter(p => p.g === 'f').length;
    wrong += s.people.filter(p => p.g === 'f' && !['hse', 'geo', 'aup'].includes(p.role)).length;
  }
  assert.strictEqual(fem, 0, 'женщин среди начальников и кандидатов нет');
  assert.strictEqual(wrong, 0, 'женщины только в экологии, геологии и бухгалтерии');
  const share = femP / ppl; assert.ok(share > 0.002 && share < 0.04, `доля женщин ${share}`);
});
test('фамилии не повторяются', () => {
  const s = fresh();
  for (const r of ['op', 'prs', 'mech', 'drv', 'elec']) E.act(s, 'hire', { role: r, n: 30 });
  runDays(s, 25);
  const names = s.people.map(p => E.baseLast(p.name)).concat(s.cdngs.map(c => E.baseLast(c.chief.name)));
  assert.ok(names.length > 150);
  assert.strictEqual(new Set(names).size, names.length, 'все фамилии разные');
});
test('миграция сохранения: начальники-мужчины, женщины ≤1%, фамилии без повторов', () => {
  const s = fresh(); const o = JSON.parse(E.serialize(s));
  delete o.genderV; o.cdngs[0].chief.g = 'f'; o.cdngs[0].chief.name = 'Сарсенова Гульнара';
  for (const p of o.people) { p.g = 'f'; p.name = 'Ахметова Айгуль'; }
  const m = E.deserialize(JSON.stringify(o));
  assert.strictEqual(m.cdngs[0].chief.g, 'm');
  assert.ok(m.people.filter(p => p.g === 'f').length <= Math.max(1, Math.round(m.people.length * 0.01)));
  const names = m.people.map(p => E.baseLast(p.name)).concat(m.cdngs.map(c => E.baseLast(c.chief.name)));
  assert.strictEqual(new Set(names).size, names.length);
});

test('банк: срочный депозит капитализируется и возвращается в срок с доходом', () => {
  const s = fresh(); const cash0 = s.cash;
  const d = E.act(s, 'deposit', { amount: 500e6, type: 't6' });
  assert.ok(d.end > s.day && d.rate > E.depositRate(s, 'demand'));
  runDays(s, 200);
  assert.ok(!s.deposits.includes(d), 'депозит закрыт по сроку');
  const inc = s.ledger.filter(l => l.cat === 'Проценты по депозитам' && /депозит №/.test(l.note)).reduce((a, l) => a + l.a, 0);
  assert.ok(inc > 500e6 * d.rate * 0.4, 'получен доход ' + inc);
});
test('банк: досрочное снятие срочного — проценты по ставке «до востребования»', () => {
  const s = fresh(); const d = E.act(s, 'deposit', { amount: 300e6, type: 't24' });
  runDays(s, 100); const r = E.act(s, 'withdraw', { id: d.id });
  assert.ok(r.returned > 300e6 && r.returned < d.amount + 1);
});
test('ОТ: учения повышают готовность, медосмотр и обучение — культуру и сроки', () => {
  const s = fresh(); const r0 = s.hse.readiness;
  E.act(s, 'hse', { op: 'drill', kind: 'fire' }); assert.ok(s.hse.readiness > r0);
  assert.throws(() => E.act(s, 'hse', { op: 'drill', kind: 'fire' }), /30 дней/);
  E.act(s, 'hse', { op: 'medical' }); assert.strictEqual(s.hse.lastMed, s.day);
  const c0 = s.hse.culture; E.act(s, 'hse', { op: 'training' }); assert.ok(s.hse.culture > c0);
});
test('ОТ: риск травм выше без СИЗ, при износе и без медосмотра', () => {
  const s = fresh(); E.act(s, 'hse', { op: 'medical' });
  const k1 = E.hseRisk(s).k;
  s.stock.ppe = 0; s.hse.lastMed = s.day - 400; for (const f of s.fac) f.health = 20;
  assert.ok(E.hseRisk(s).k > k1 * 2);
});
test('ОТ: несчастные случаи происходят, пострадавший на больничном и не работает', () => {
  const s = fresh(); s.stock.ppe = 0; s.hse.culture = 0; s.hse.lastMed = -999;
  for (let i = 0; i < 1500 && !s.hse.injuries.length; i++) { while (s.pending) E.act(s, 'resolve', { i: 0 }); s.stock.ppe = 0; E.advance(s, 1); }
  assert.ok(s.hse.injuries.length > 0, 'травма случилась');
  const inj = s.hse.injuries[0]; const p = s.people.find(x => x.name === inj.name);
  if (p && p.sickUntil > s.day) { const cov = E.coverage(s); assert.ok(cov.role[p.role] <= s.staff[p.role].n / Math.max(1, cov.need[p.role]) + 1e-9); }
  assert.ok(s.ledger.some(l => l.cat === 'Возмещение вреда'));
});
test('проверки госорганов: при нарушениях — штраф с перечнем, при порядке — без штрафа', () => {
  const s = fresh(); s.hse.lastMed = -999; s.hse.lastTraining = -999; s.stock.ppe = 0;
  const has = () => s.hse.fines.find(f => /труда/.test(f.org) && f.reasons.some(r => /медосмотр/.test(r)));
  for (let m = 0; m < 60 && !has() && !s.gameOver; m++) { s.trust = 60; runDays(s, E.daysToNextMonth(s)); }
  const f = has();
  assert.ok(f && f.reasons.some(r => /медосмотр/.test(r)) && f.amount > 0);
});
test('ПНГ: без утилизации газ горит на факеле и начисляется плата за эмиссии', () => {
  const s = fresh(); for (const o of s.offers.slice()) try { E.act(s, 'accept', { id: o.id }); } catch (e) { }
  runDays(s, E.daysToNextMonth(s));
  assert.ok(s.today.gas.prod > 0 && s.today.gas.flare > 0);
  assert.ok(s.ledger.some(l => l.cat === 'Плата за эмиссии'));
});
test('рейтинг по 5 параметрам: у каждого места в каждом параметре, балл 0–100', () => {
  const s = fresh(); runDays(s, 40);
  const lb = E.leaderboard(s); const me = lb.find(x => x.me);
  assert.strictEqual(lb.length, 100);
  assert.deepStrictEqual(Object.keys(me.pr).sort(), ['cap', 'cost', 'hse', 'prod', 'profit']);
  assert.ok(me.score >= 0 && me.score <= 100 && me.rank >= 1 && me.rank <= 100);
  for (let i = 1; i < lb.length; i++) assert.ok(lb[i - 1].score >= lb[i].score);
});

console.log(`\n${passed} тестов пройдено${process.exitCode ? ', есть ошибки' : ''}`);
