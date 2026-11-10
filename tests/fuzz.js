/* Стресс-бот: случайная игра с проверкой инвариантов. Запуск: node tests/fuzz.js [игр] [лет] */
'use strict';
const path = require('path');
require(path.join(__dirname, '../js/data.js'));
require(path.join(__dirname, '../js/engine.js'));
const E = globalThis.OMEngine, D = globalThis.OMData;
const GAMES = Number(process.argv[2] || 12), YEARS = Number(process.argv[3] || 8);
const problems = new Map();
function bad(key, msg) { if (!problems.has(key)) problems.set(key, { n: 0, msg }); problems.get(key).n++; }
let rs = 1; const r = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const pick = a => a[Math.floor(r() * a.length)];
const tryA = (s, t, a) => { try { return E.act(s, t, a); } catch (e) { if (!/недостат|нет |Не хват|уже|только|занят|лимит|не найден|не требует|Выберите|Все бригады|Требуется|доступно|заполнены|Нельзя|пуст|Некуда|качество|столько|не ниже|Сначала|полгода|квалификац|Высший|раз в|ЦДНГ|Неизвест|план|от |Неверн|Покупатель|Спот|Автоналив|Некондиц|В товарных|Цех|решение|Вакансия|Должность|кандидат|Новый начальник|выходит|Для РВС|в ремонте|на обслуживании|запчаст|слесар|дни|последн|учения|медосмотр|обучение|Скважина не|Ремонт не нужен|УППГ|Сначала|IPO|акци|дивиденд|казначейск|не чаще|Укажите|Компания не|50%|допэмисс|Наценка|Загрузка НПЗ|Запас для АЗС|режим|освободите|Неверн|Резервуар|Регенерация|Максимум|Уже есть|Установка|Бензовоз|АЗС не|Температура|Промывочная|улучшение|не более 90|ремонт|Доля|задвижка/i.test(e.message)) bad('act:' + t + ':' + e.message.slice(0, 50), e.stack.split('\n').slice(0, 3).join(' ')); return null; } };

function check(s, ctx) {
  const fin = (v, n) => { if (!Number.isFinite(v)) bad('nan:' + n, `${n}=${v} @${ctx}`); };
  fin(s.cash, 'cash'); fin(s.reservoir.pressure, 'pressure'); fin(s.reservoir.remaining, 'reserves'); fin(s.trust, 'trust'); fin(s.morale, 'morale'); fin(s.priceIndex, 'idx');
  fin(s.market.brent, 'brent'); fin(s.market.fx, 'fx');
  if (s.trust < -1e-9 || s.trust > 100 + 1e-9) bad('trust-range', `trust ${s.trust} @${ctx}`);
  if (s.morale < -1e-9 || s.morale > 100 + 1e-9) bad('morale-range', `morale ${s.morale} @${ctx}`);
  for (const t of s.fac.filter(f => D.BUILD[f.type].tank)) {
    if (t.volume < -1e-6) bad('tank-neg', `${t.name} ${t.volume} @${ctx}`);
    if (t.volume > t.cap * (t.clean || 1) + 0.5) bad('tank-over', `${t.name} ${t.volume}/${t.cap} ${t.status} @${ctx}`);
    if (t.status === 'service' && t.volume > 1) bad('tank-service-vol', `${t.name} в ремонте с ${t.volume} @${ctx}`);
    fin(t.volume, 'tankvol');
  }
  for (const k in s.stock) { if (s.stock[k] < -1e-6) bad('stock-neg:' + k, `${k} ${s.stock[k]} @${ctx}`); fin(s.stock[k], 'stock:' + k); }
  for (const rr of D.ROLES) if (s.staff[rr.key].n !== s.people.filter(p => p.role === rr.key).length) bad('staff-sync:' + rr.key, `@${ctx}`);
  for (const w of s.wells) {
    fin(w.potential, 'pot'); fin(w.wc, 'wc'); fin(w.health, 'whealth'); fin(w.cumOil, 'cum');
    if (w.type !== 'water' && (w.wc < 0 || w.wc > 0.98 + 1e-9)) bad('wc-range', `${w.wc}`);
    if (!s.cdngs.some(c => c.id === w.cdng)) bad('well-cdng', `скважина ${w.name} без цеха`);
    if (w.status === 'repair' && !s.repairs.some(x => x.well === w.id) && !s.projects.some(p => p.target === w.id)) bad('well-stuck-repair', `${w.name} в ремонте без работ @${ctx}`);
  }
  for (const f of s.fac) { fin(f.health, 'fhealth'); if (f.status === 'service' && !D.BUILD[f.type].tank && !(E.DS_TYPES(f.type) && f.serviceDays > 0)) bad('fac-service', f.name); if (f.status === 'service' && D.BUILD[f.type].tank && !s.projects.some(p => p.target === f.id) && !(f.serviceDays > 0)) bad('tank-stuck-service', `${f.name} @${ctx}`); }
  for (const c of s.contracts) if (c.status === 'active' && c.shippedMonth > c.monthly + 1e-6) bad('overship', `#${c.id}`);
  const ids = new Set(); for (const x of [...s.wells, ...s.fac, ...s.people]) { if (ids.has(x.id)) bad('dup-id', String(x.id)); ids.add(x.id); }
  if (s.rank < 1 || s.rank > 100) bad('rank', String(s.rank));
  for (const d of s.deposits) { fin(d.amount, 'dep'); if (d.amount < d.principal - 1) bad('dep-amount', `${d.id}`); }
  fin(s.hse.readiness, 'ready'); fin(s.hse.culture, 'culture'); if (s.today && s.today.gas) { fin(s.today.gas.flare, 'flare'); if (s.today.gas.flare < -1e-6) bad('flare-neg', String(s.today.gas.flare)); }
  if (s.today && s.today.gas) { const g = s.today.gas; fin(g.nat, 'nat'); if (g.natSale < -1e-6 || Math.abs(g.nat - g.boiler - g.gtesN - g.natSale) > 1e-3) bad('natgas-balance', `${g.nat} ${g.boiler} ${g.gtesN} ${g.natSale} @${ctx}`); if (Math.abs(g.prod - g.heat - g.gtes - g.sale - g.flare) > 1e-3) bad('png-balance', `@${ctx}`); }
  for (const w of s.gwells) { fin(w.q, 'gq'); fin(w.health, 'gh'); fin(w.cum, 'gcum'); if (!['work', 'idle', 'prep', 'repair', 'fail', 'stop'].includes(w.status)) bad('gw-status', w.status); }
  fin(s.gasRes.remaining, 'gasres');
  for (const k of ['ai', 'dt', 'mz']) { fin(s.prodStock[k], 'prod' + k); if (s.prodStock[k] < -1e-6) bad('prod-neg', k + ' ' + s.prodStock[k]); }
  for (const k of ['ai', 'dt', 'mz']) if (s.prodStock[k] > E.prodCapK(s, k) + Math.max(1, (s.today && s.today.ds && s.today.ds.dem ? s.today.ds.dem[k] || 0 : 0) * 31) + 1) bad('prod-cap', k + ' ' + s.prodStock[k] + ' / ' + E.prodCapK(s, k));
  for (const f of s.fac) if (f.type === 'azs' && f.tk) for (const k of ['ai', 'dt']) { fin(f.tk[k], 'aztk'); if (f.tk[k] < -1e-6 || f.tk[k] > f.tkCap[k] + 1e-6) bad('azs-tank', k + ' ' + f.tk[k] + '/' + f.tkCap[k]); }
  fin(s.prodQ.ron, 'ron'); fin(s.prodQ.sul, 'sul'); fin(s.cat.rf, 'catrf'); fin(s.cat.hdo, 'cathdo');
  if (s.today && s.today.ds && s.today.ds.calc) { const R = s.today.ds.calc; const b = Object.values(R.out).reduce((x, y) => x + y, 0) + R.side.naf + R.side.lpg + R.side.vgo + R.side.bit + R.loss; if (Math.abs(b - R.F) > 1e-6 * Math.max(1, R.F)) bad('npz-balance', b + ' vs ' + R.F); }
  fin(s.sh.price, 'shprice'); fin(s.sh.sent, 'sent'); if (s.sh.float < 0 || s.sh.float > 1 || s.sh.treasury < 0) bad('shares', JSON.stringify(s.sh).slice(0, 200));
  for (const n in s.port) if (!(s.port[n].qty > 0)) bad('port', n);
  for (const p of s.people) if (p.sickUntil != null && !Number.isFinite(p.sickUntil)) bad('sick-nan', p.name);
  const y = E.parts(s.day).y, PF = s.pf[y];
  if (PF) for (const c of s.cdngs) { const m = PF.plan.reduce((a, mo) => a + (mo[c.id] || 0), 0); if (PF.annual[c.id] != null && Math.abs(m - PF.annual[c.id]) > 1 + PF.annual[c.id] * 1e-6) bad('plan-sum', `${c.name} ${m} vs ${PF.annual[c.id]} @${ctx}`); }
  const surn = s.people.map(p => E.baseLast(p.name)); if (s.people.length < 250 && new Set(surn).size !== surn.length) { const seen = {}; const d = surn.filter(x => (seen[x] = (seen[x] || 0) + 1) === 2); bad('dup-surname', `@${ctx} people=${s.people.length} пул=${D.LAST.length} повтор: ${d.slice(0,3).join(',')}`); }
  for (const p of s.people) if (p.g === 'f' && !['hse', 'geo', 'aup'].includes(D.ROLES.find(x => x.key === p.role).dept)) bad('female-role', p.role);
  for (const c of s.cdngs) if (c.chief && c.chief.g === 'f') bad('female-chief', c.name);
}

const t0 = Date.now(); let days = 0, overs = 0; const reasons = {};
for (let g = 0; g < GAMES; g++) {
  rs = 1000 + g;
  const s = E.newGame({ seed: 500 + g, difficulty: pick(['easy', 'normal', 'hard']), market: g % 3 === 2 ? 'random' : 'history' });
  E.act(s, 'resolve', { i: Math.floor(r() * 3) });
  if (r() < 0.5) E.act(s, 'setting', { key: 'monthReport', value: false });
  let cash0 = s.cash, ledN = s.ledger.length;
  for (let d = 0; d < YEARS * 365 && !s.gameOver; d++) {
    // разблокировать время
    let guard = 0;
    while ((s.pending || (s.report && s.report.open)) && guard++ < 5) {
      if (s.pending) { const o = s.pending.options; let i = Math.floor(r() * o.length); if (o[i].custom) { const by = {}; for (const c of s.cdngs) by[c.id] = null; tryA(s, 'planCustom', { y: s.pending.data.y, total: E.yearOutlook(s, s.pending.data.y) && null, byCdng: by }); if (s.pending) i = 1; } if (s.pending) tryA(s, 'resolve', { i }); }
      if (s.report && s.report.open) { for (const c of s.cdngs) if (r() < 0.3) tryA(s, 'chief', { cdng: c.id, op: pick(['bonus', 'remark', 'reprimand', 'fire']) }); for (const c of s.cdngs) if (!c.chief && !c.incoming && c.candidates.length) tryA(s, 'chief', { cdng: c.id, op: 'hire', i: Math.floor(r() * c.candidates.length) }); tryA(s, 'closeReport'); }
    }
    if (d % 7 === 0) {
      s.trust = Math.max(s.trust, 25); // бот не должен вылетать слишком рано
      if (s.cash < 0) tryA(s, 'loan', { amount: Math.round(Math.max(1e8, -s.cash * 1.5)), months: 36 });
      if (s.cash < 0) { s.cash += 3e9 * s.priceIndex; s.negMonths = 0; } // бот не банкротится — нужно покрыть все годы
      const n = Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const a = Math.floor(r() * 22);
        if (a === 0) { const t = pick(Object.keys(D.BUILD)); if (tryA(s, 'tender', { type: t, purpose: pick(['oil', 'tech', 'water']) })) tryA(s, 'award', { i: Math.floor(r() * s.tender.offers.length), cdng: pick(s.cdngs).id }); }
        else if (a === 1) { const w = pick(s.wells); const t = pick(['prs', 'krs', 'grp', 'opz']); if (tryA(s, 'tender', { type: t, target: w.id })) tryA(s, 'award', { i: 0 }); }
        else if (a === 2) { const t = pick(s.fac.filter(f => D.BUILD[f.type].tank)); if (t && tryA(s, 'tender', { type: pick(['anticor', 'clean']), target: t.id })) tryA(s, 'award', { i: 0 }); }
        else if (a === 3) tryA(s, 'hire', { role: pick(D.ROLES).key, n: 1 + Math.floor(r() * 5) });
        else if (a === 4) tryA(s, 'fire', { role: pick(D.ROLES).key, n: 1 });
        else if (a === 5) tryA(s, 'buy', { key: pick(D.MATERIALS).key, qty: 1 + Math.floor(r() * 200) });
        else if (a === 6 && s.offers.length) tryA(s, 'accept', { id: pick(s.offers).id });
        else if (a === 7) tryA(s, 'ckppn', { temp: 40 + Math.floor(r() * 40), dose: r() * 2, wash: r() < 0.3 });
        else if (a === 8 && r() < 0.5) tryA(s, 'ppd', { comp: Math.floor(r() * 150), reserve: Math.floor(r() * 80) });
        else if (a === 8) { tryA(s, 'gasSet', { deg: 15 + Math.floor(r() * 35), reg: 140 + Math.floor(r() * 35) }); const gw = pick(s.gwells); if (gw) tryA(s, 'gwell', { id: gw.id, op: pick(['open', 'repair', 'stop', 'start']) }); }
        else if (a === 9 && r() < 0.5) { tryA(s, 'ds', { feed: Math.floor(r() * 600), sell: pick(['daily', 'season']), mode: pick(['ai', 'dt', 'bal']), mkp: Math.floor(r() * 25) - 10, res: Math.floor(r() * 20), buy: r() < 0.7 }); if (r() < 0.2) tryA(s, 'tender', { type: pick(['npz', 'npz_rvs', 'npz_rvs10']), purpose: pick(['ai', 'dt', 'mz']) }) && tryA(s, 'award', { i: 0 }); { const pt = E.ptanks(s); if (pt.length && r() < 0.2) tryA(s, 'ds', { tank: pick(pt).id, prod: pick(['ai', 'dt', 'mz']) }); }
          if (r() < 0.3) tryA(s, 'tender', { type: 'azs', purpose: pick(['city', 'road', 'village']) }) && tryA(s, 'award', { i: 0 }); }
        else if (a === 9 && r() < 0.4) { tryA(s, 'np', { elT: 90 + Math.floor(r() * 60), wash: Math.floor(r() * 12), t1: 330 + Math.floor(r() * 50), tr: 470 + Math.floor(r() * 55), th: 320 + Math.floor(r() * 70), tf: 490 + Math.floor(r() * 50), bit: r() < 0.5 }); if (r() < 0.3) tryA(s, 'tender', { type: pick(['npz_vac', 'npz_ref', 'npz_hdo', 'npz_fcc', 'npz_bit']) }) && tryA(s, 'award', { i: 0 }); const u = pick(s.fac.filter(f => f.type === 'npz_ref' || f.type === 'npz_hdo')); if (u && r() < 0.2) tryA(s, 'regen', { id: u.id }); const z = pick(s.fac.filter(f => f.type === 'azs')); if (z) tryA(s, 'azsUp', { id: z.id, up: pick(['trk', 'cafe', 'wash', 'tank']) }); if (r() < 0.2) tryA(s, 'ds', { trucks: Math.floor(r() * 5), autoFix: r() < 0.7 }); tryA(s, 'np', { g95: Math.floor(r() * 70), g98: Math.floor(r() * 30) }); if (r() < 0.2) tryA(s, 'np', { valve: pick(['gas', 'dt', 'mz', 'bit']) }); const df = pick(s.fac.filter(f => E.DS_TYPES(f.type))); if (df && r() < 0.1) tryA(s, 'fixfac', { id: df.id, kind: pick(['tr', 'kr']) }); }
        else if (a === 9 && r() < 0.5) { const op = pick(['ipo', 'spo', 'buyback', 'dividend', 'trade']); const c = pick(s.companies); tryA(s, 'shares', { op, pct: 5 + Math.floor(r() * 35), n: Math.floor((r() - 0.4) * 1e6), amount: Math.floor(r() * 1e9), name: c && c.name }); }
        else if (a === 9) tryA(s, 'deposit', { amount: 1e7 });
        else if (a === 10 && s.deposits.length) tryA(s, 'withdraw', { id: pick(s.deposits).id });
        else if (a === 11 && s.people.length) tryA(s, 'person', { id: pick(s.people).id, op: pick(['grade', 'bonus', 'train', 'fire']) });
        else if (a === 12) { const f = pick(s.fac); tryA(s, 'maintain', { id: f.id }); }
        else if (a === 13) tryA(s, 'spot', { qty: 1 + Math.floor(r() * 300) });
        else if (a === 14) { const w = pick(s.wells); w.status === 'fail' ? tryA(s, 'repair', { id: w.id }) : tryA(s, 'wellToggle', { id: w.id }); }
        else if (a === 15) tryA(s, 'toggle', { key: pick(['buy', 'prs', 'to', 'dgu', 'util']) });
        else if (a === 16) tryA(s, 'tech', { key: pick(D.TECH).key });
        else if (a === 17 && s.projects.length && r() < 0.2) tryA(s, 'cancelProject', { id: pick(s.projects).id });
        else if (a === 18 && s.contracts.some(c => c.status === 'active') && r() < 0.2) tryA(s, 'cancelContract', { id: pick(s.contracts.filter(c => c.status === 'active')).id });
        else if (a === 19) { const t = pick(s.fac.filter(f => D.BUILD[f.type].tank)); if (t) tryA(s, 'tankPurpose', { id: t.id, purpose: pick(['oil', 'tech', 'water']) }); }
        else if (a === 20 && r() < 0.1) { const by = {}; for (const c of s.cdngs) by[c.id] = (s.pf[E.parts(s.day).y].annual[c.id] || 1000) * (0.8 + r() * 0.4); tryA(s, 'planCustom', { byCdng: by }); }
        else if (a === 21) { const op = pick(['drill', 'medical', 'training']); tryA(s, 'hse', { op, kind: pick(['fire', 'spill', 'gas']) }); if (r() < 0.3) tryA(s, 'deposit', { amount: 5e7, type: pick(['demand', 't6', 't12', 't24']) }); }
      }
    }
    if (s.cash < 2e8) { s.cash += 3e9 * s.priceIndex; s.negMonths = 0; }
    const c0 = s.cash, l0 = s.ledger.length;
    try { E.advance(s, 1); days++; } catch (e) { bad('tick-crash:' + e.message.slice(0, 60), e.stack.split('\n').slice(0, 4).join(' | ')); break; }
    check(s, `g${g} ${E.iso(s.day)}`);
    if (s.gameOver && process.env.DBG) { const h = s.history.slice(-3); console.log('GO', E.iso(s.day), 'cash', Math.round(s.cash/1e9)+'B', 'staff', s.people.length, 'wells', s.wells.length, 'loans', s.loans.length, Math.round(s.loans.reduce((a,l)=>a+l.principal,0)/1e9)+'B'); for (const x of h) console.log('  ', x.m, 'rev', Math.round(x.rev/1e6), 'opex', Math.round(x.opex/1e6), 'net', Math.round(x.net/1e6), JSON.stringify(Object.fromEntries(Object.entries(x.cats).filter(([k,v])=>Math.abs(v)>2e8).map(([k,v])=>[k,Math.round(v/1e6)])))); }
    if (s.gameOver) { overs++; reasons[s.gameOver.reason] = (reasons[s.gameOver.reason] || 0) + 1; }
  }
  // журнал = касса (журнал ограничен 500 записями — проверяем на короткой игре отдельно в тестах)
}
console.log('Причины окончания:', JSON.stringify(reasons));
console.log(`Стресс-бот: ${GAMES} игр, ${days} игровых дней (${(days / 365).toFixed(0)} лет), окончаний игры: ${overs}, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
if (!problems.size) console.log('✓ Нарушений инвариантов не найдено');
else { console.log(`✗ Найдено проблем: ${problems.size}`); for (const [k, v] of problems) console.log(`  [${v.n}] ${k} — ${v.msg}`); process.exitCode = 1; }
