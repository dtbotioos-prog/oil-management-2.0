/* Oil Management 2.0 — SVG-графики и 2D-сцены оборудования (без внешних библиотек). */
(function (root) {
  'use strict';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', yellow: '#c98500', magenta: '#d55181', green: '#2a9d3a', violet: '#9085e9', red: '#e66767', grid: 'rgba(160,180,200,.14)', axis: '#7f91a3', plan: '#b9c3cd' };

  function niceTicks(min, max, n = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min; const step0 = span / n; const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => span / x <= n) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const t = []; for (let v = lo; v <= hi + step * 0.001; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function short(n) {
    const a = Math.abs(n) >= 9995 && Math.abs(n) < 1e4 ? 1e4 : Math.abs(n) >= 999500 && Math.abs(n) < 1e6 ? 1e6 : Math.abs(n) >= 999.5e6 && Math.abs(n) < 1e9 ? 1e9 : Math.abs(n) >= 999.5e9 && Math.abs(n) < 1e12 ? 1e12 : Math.abs(n);
    if (a !== Math.abs(n)) n = Math.sign(n) * a;
    if (a >= 1e12) return (n / 1e12).toFixed(a >= 1e13 ? 0 : 1) + ' трлн';
    if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + ' млрд';
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + ' млн';
    if (a >= 1e4) return (n / 1e3).toFixed(0) + ' тыс';
    return Math.round(n * 10) / 10 + '';
  }

  /* ---------- Линейный график (одна ось Y) ---------- */
  function line(o) {
    const W = o.width || 640, H = o.height || 200, pl = 46, pr = 12, pt = 12, pb = 24;
    const n = o.labels.length;
    if (!n) return `<div class="empty">${o.empty || 'Данные появятся после первых игровых дней'}</div>`;
    const all = o.series.flatMap(s => s.values.filter(v => v != null));
    let mn = o.min ?? Math.min(0, ...all), mx = o.max ?? Math.max(...all, 1);
    if (o.min == null && Math.min(...all) > 0 && o.zero === false) mn = Math.min(...all) * 0.95;
    const ticks = niceTicks(mn, mx); mn = ticks[0]; mx = ticks[ticks.length - 1];
    const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1));
    const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn || 1));
    const f = o.fmt || short;
    let g = '';
    for (const t of ticks) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${f(t)}</text>`;
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(o.labels[i])}</text>`;
    let paths = '';
    for (const s of o.series) {
      let d = '', started = false;
      s.values.forEach((v, i) => { if (v == null) { started = false; return; } d += (started ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); started = true; });
      if (s.area) { let i0 = s.values.findIndex(v => v != null), i1 = s.values.length - 1; while (i1 > 0 && s.values[i1] == null) i1--; if (i0 >= 0) paths += `<path d="${d} L${x(i1)} ${y(Math.max(mn, 0))} L${x(i0)} ${y(Math.max(mn, 0))}Z" fill="${s.color}" opacity=".14"/>`; }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    // крестовина и подсказки
    let hit = '';
    const bw = (W - pl - pr) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const tip = esc(o.labels[i]) + '|' + o.series.map(s => `${esc(s.name)}: ${s.values[i] == null ? '—' : f(s.values[i])}${o.unit ? ' ' + o.unit : ''}`).join('|');
      hit += `<rect class="hit" x="${x(i) - bw / 2}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-tip="${tip}" data-x="${x(i)}"/>`;
    }
    const legend = o.series.length > 1 ? `<div class="legend">${o.series.map(s => `<span><i style="background:${s.color};${s.dash ? 'background:repeating-linear-gradient(90deg,' + s.color + ' 0 4px,transparent 4px 7px)' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}${paths}<line class="xhair" x1="0" x2="0" y1="${pt}" y2="${H - pb}"/>${hit}</svg>`;
  }

  /* ---------- Столбчатая (сгруппированная) ---------- */
  function bars(o) {
    const W = o.width || 640, H = o.height || 200, pl = 46, pr = 10, pt = 12, pb = 24;
    const n = o.labels.length; if (!n) return `<div class="empty">${o.empty || 'Нет данных'}</div>`;
    const all = o.series.flatMap(s => s.values);
    const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all)); const mn = ticks[0], mx = ticks[ticks.length - 1];
    const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn || 1));
    const f = o.fmt || short;
    const gw = (W - pl - pr) / n, k = o.series.length, bw = Math.max(2, Math.min(22, (gw - 6) / k - 2));
    let g = '';
    for (const t of ticks) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${f(t)}</text>`;
    const step = Math.max(1, Math.ceil(n / 12));
    let b = '';
    for (let i = 0; i < n; i++) {
      const cx = pl + gw * i + gw / 2;
      if (i % step === 0) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="ax">${esc(o.labels[i])}</text>`;
      o.series.forEach((s, j) => {
        const v = s.values[i] || 0; const x0 = cx - (k * (bw + 2)) / 2 + j * (bw + 2);
        const y0 = y(Math.max(0, v)), h = Math.abs(y(v) - y(0));
        const col = typeof s.color === 'function' ? s.color(v, i) : s.color;
        b += `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="3" fill="${s.outline ? 'none' : col}" ${s.outline ? `stroke="${col}" stroke-width="1.5" stroke-dasharray="3 2"` : ''}/>`;
      });
      const tip = esc(o.labels[i]) + '|' + o.series.map(s => `${esc(s.name)}: ${f(s.values[i] || 0)}${o.unit ? ' ' + o.unit : ''}`).join('|') + (o.extraTip ? '|' + esc(o.extraTip(i)) : '');
      b += `<rect class="hit" x="${pl + gw * i}" y="${pt}" width="${gw}" height="${H - pt - pb}" data-tip="${tip}"/>`;
    }
    const legend = o.series.length > 1 ? `<div class="legend">${o.series.map(s => `<span><i style="${s.outline ? `border:1.5px dashed ${typeof s.color === 'string' ? s.color : C.blue};background:none` : `background:${typeof s.color === 'string' ? s.color : C.blue}`}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="${C.axis}" stroke-width="1"/>${b}</svg>`;
  }

  /* ---------- Кольцевая диаграмма ---------- */
  function donut(o) {
    const items = o.items.filter(i => i.value > 0); const tot = items.reduce((a, b) => a + b.value, 0);
    if (!tot) return '<div class="empty">Нет данных</div>';
    const R = 54, r = 34, cx = 64, cy = 64; let a0 = -Math.PI / 2, paths = '';
    for (const it of items) {
      const a1 = a0 + it.value / tot * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
      const d = items.length === 1 ? `M${cx - R} ${cy}A${R} ${R} 0 1 1 ${cx + R} ${cy}A${R} ${R} 0 1 1 ${cx - R} ${cy}M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`
        : `M${p(a0, R)}A${R} ${R} 0 ${large} 1 ${p(a1, R)}L${p(a1, r)}A${r} ${r} 0 ${large} 0 ${p(a0, r)}Z`;
      paths += `<path d="${d}" fill="${it.color}" stroke="var(--panel)" stroke-width="2" data-tip="${esc(it.name)}|${short(it.value)} ${o.unit || ''} (${Math.round(it.value / tot * 100)}%)"/>`;
      a0 = a1;
    }
    const leg = items.map(it => `<div class="dl"><i style="background:${it.color}"></i><span>${esc(it.name)}</span><b>${Math.round(it.value / tot * 100)}%</b></div>`).join('');
    return `<div class="donut"><svg viewBox="0 0 128 128" width="128" height="128">${paths}<text x="64" y="62" text-anchor="middle" class="dc1">${esc(o.center || '')}</text><text x="64" y="78" text-anchor="middle" class="dc2">${esc(o.sub || '')}</text></svg><div class="dlegend">${leg}</div></div>`;
  }

  /* ---------- Полукруглый индикатор ---------- */
  function gauge(o) {
    const v = Math.max(o.min, Math.min(o.max, o.value)); const t = (v - o.min) / (o.max - o.min);
    const R = 46, cx = 60, cy = 56; const ang = Math.PI * (1 - t);
    const arc = (a0, a1, col) => { const p = a => `${(cx + R * Math.cos(a)).toFixed(2)} ${(cy - R * Math.sin(a)).toFixed(2)}`; return `<path d="M${p(a0)}A${R} ${R} 0 0 1 ${p(a1)}" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="butt"/>`; };
    let bands = '', prev = o.min;
    for (const b of o.bands) { bands += arc(Math.PI * (1 - (prev - o.min) / (o.max - o.min)), Math.PI * (1 - (Math.min(b.to, o.max) - o.min) / (o.max - o.min)), b.color); prev = b.to; }
    const nx = cx + (R - 4) * Math.cos(ang), ny = cy - (R - 4) * Math.sin(ang);
    return `<div class="gauge"><svg viewBox="0 0 120 70" width="100%"><g opacity=".9">${bands}</g><line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" class="needle"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--text)"/></svg><div class="gv">${esc(o.text)}</div><div class="gl">${esc(o.label)}</div></div>`;
  }

  /* ---------- Мини-спарклайн ---------- */
  function spark(values, color = C.blue, w = 90, h = 26) {
    const v = values.filter(x => x != null); if (v.length < 2) return '';
    const mn = Math.min(...v), mx = Math.max(...v); const sp = mx - mn || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - (x - mn) / sp * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  }

  /* ===================== 2D-сцены оборудования ===================== */
  // Станок-качалка. running=true — анимация качания
  function pumpjack(o = {}) {
    const run = o.running ? 'run' : '', col = o.color || '#c9d4de', w = o.w || 92, h = o.h || 64;
    return `<svg class="pj ${run}" viewBox="0 0 92 64" width="${w}" height="${h}" aria-hidden="true">
      <rect x="2" y="58" width="88" height="5" rx="1.5" fill="#2b3a4a"/>
      <path d="M38 58 L47 22 L56 58" stroke="${col}" stroke-width="3" fill="none"/><path d="M41 46 H53 M43 36 H51" stroke="${col}" stroke-width="1.5"/>
      <g class="pj-beam" style="transform-origin:47px 21px">
        <rect x="14" y="18" width="62" height="5" rx="2" fill="${o.accent || '#e53935'}"/>
        <path d="M76 14 Q86 20.5 76 27 Z" fill="${col}"/>
        <line class="pj-rod" x1="83" y1="25" x2="83" y2="57" stroke="#9fb0bf" stroke-width="1.2"/>
        <line x1="18" y1="23" x2="20" y2="44" stroke="${col}" stroke-width="2.4"/>
      </g>
      <g class="pj-crank" style="transform-origin:20px 48px"><rect x="10" y="45" width="20" height="6" rx="3" fill="#56687a"/><circle cx="12" cy="48" r="4" fill="#3c4b5a"/></g>
      <circle cx="20" cy="48" r="2.5" fill="${col}"/>
      <rect x="78" y="54" width="10" height="5" fill="#56687a"/>
      ${o.fail ? '<g class="pj-alert"><circle cx="70" cy="9" r="7" fill="#e66767"/><text x="70" y="12.5" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">!</text></g>' : ''}
    </svg>`;
  }
  // Погружной насос (ЭЦН) — устье с индикатором
  function ecnHead(o = {}) {
    return `<svg class="ecn ${o.running ? 'run' : ''}" viewBox="0 0 92 64" width="${o.w || 92}" height="${o.h || 64}" aria-hidden="true">
      <rect x="2" y="58" width="88" height="5" rx="1.5" fill="#2b3a4a"/>
      <rect x="40" y="26" width="12" height="32" fill="#7d8e9f"/><rect x="34" y="22" width="24" height="8" rx="2" fill="#a8b6c3"/>
      <rect x="30" y="36" width="32" height="5" fill="#5d6f81"/><circle cx="46" cy="16" r="6" fill="none" stroke="#a8b6c3" stroke-width="2"/>
      <rect x="64" y="34" width="20" height="24" rx="2" fill="#33475a"/><circle class="ecn-led" cx="74" cy="42" r="3" fill="${o.running ? '#33c46b' : '#e66767'}"/>
      <path class="ecn-flow" d="M58 38 H64" stroke="#d6a24a" stroke-width="2"/>
      ${o.fail ? '<circle cx="18" cy="12" r="7" fill="#e66767"/><text x="18" y="15.5" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">!</text>' : ''}
    </svg>`;
  }
  function injHead(o = {}) {
    return `<svg viewBox="0 0 92 64" width="${o.w || 92}" height="${o.h || 64}" aria-hidden="true">
      <rect x="2" y="58" width="88" height="5" rx="1.5" fill="#2b3a4a"/>
      <rect x="40" y="24" width="12" height="34" fill="#5f7d96"/><rect x="34" y="20" width="24" height="7" rx="2" fill="#8fb2cf"/><circle cx="46" cy="14" r="6" fill="none" stroke="#8fb2cf" stroke-width="2"/>
      <path class="${o.running ? 'flow-in' : ''}" d="M8 40 H40" stroke="${o.water ? '#3987e5' : '#3987e5'}" stroke-width="4" stroke-dasharray="6 5"/>
      <path d="M46 58 V63" stroke="#3987e5" stroke-width="3"/>
      ${o.fail ? '<circle cx="76" cy="12" r="7" fill="#e66767"/><text x="76" y="15.5" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">!</text>' : ''}
    </svg>`;
  }
  const TANK_COL = { oil: ['#3a2a16', '#c98500'], tech: ['#5a3a1e', '#d95926'], water: ['#123a63', '#3987e5'] };
  // Резервуар РВС с уровнем и волной
  function tank(o) {
    const pct = Math.max(0, Math.min(1, o.v / Math.max(1, o.c)));
    const [fill, top] = TANK_COL[o.purpose] || TANK_COL.oil;
    const W = o.w || 120, H = o.h || 110; const bodyY = 18, bodyH = 80; const lvl = bodyY + bodyH * (1 - pct);
    const id = 'tk' + (o.id || Math.random().toString(36).slice(2, 7));
    const warn = pct > 0.9 ? '#e66767' : pct > 0.75 ? '#c98500' : '#7f91a3';
    return `<svg class="tank" viewBox="0 0 120 110" width="${W}" height="${H}" aria-hidden="true">
      <defs><clipPath id="${id}"><rect x="16" y="${bodyY}" width="88" height="${bodyH}" rx="3"/></clipPath>
      <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#8a9aab"/><stop offset=".5" stop-color="#d7e0e8"/><stop offset="1" stop-color="#7a8a9b"/></linearGradient></defs>
      <path d="M14 ${bodyY} Q60 2 106 ${bodyY}" fill="url(#${id}g)" opacity=".9"/>
      <rect x="14" y="${bodyY}" width="92" height="${bodyH}" rx="4" fill="url(#${id}g)" opacity="${o.status === 'service' ? .45 : .95}"/>
      <g clip-path="url(#${id})">
        <rect x="10" y="${lvl}" width="100" height="${bodyH + 4}" fill="${fill}"/>
        <path class="wave" d="M-40 ${lvl} q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${bodyY + bodyH} H-40Z" fill="${top}" opacity=".85"/>
      </g>
      <rect x="16" y="${bodyY}" width="88" height="${bodyH}" rx="3" fill="none" stroke="rgba(0,0,0,.25)"/>
      ${[0.25, 0.5, 0.75].map(t => `<line x1="104" x2="110" y1="${bodyY + bodyH * (1 - t)}" y2="${bodyY + bodyH * (1 - t)}" stroke="#7f91a3"/>`).join('')}
      <path d="M108 ${bodyY} V${bodyY + bodyH}" stroke="#56687a" stroke-width="1.5"/>
      <polygon points="104,${lvl} 112,${lvl - 4} 112,${lvl + 4}" fill="${warn}"/>
      <rect x="6" y="${bodyY + bodyH}" width="108" height="6" rx="2" fill="#2b3a4a"/>
      <path d="M22 ${bodyY + 6} L30 ${bodyY - 4}" stroke="#56687a" stroke-width="2"/>
      ${o.status === 'service' ? `<text x="60" y="62" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">РЕМОНТ</text>` : ''}
    </svg>`;
  }
  // Печь подогрева с пламенем
  function furnace(o = {}) {
    const on = o.on !== false; const temp = o.temp || 55;
    const sc = 0.6 + (temp - 30) / 60;
    return `<svg class="furn ${on ? 'on' : ''}" viewBox="0 0 80 80" width="${o.w || 80}" height="${o.h || 80}" aria-hidden="true">
      <rect x="14" y="20" width="52" height="46" rx="5" fill="#4b5a69"/><rect x="18" y="24" width="44" height="38" rx="3" fill="#1a232d"/>
      <g class="flame" style="transform-box:view-box;transform-origin:40px 60px;--fs:${sc.toFixed(2)};transform:scale(${sc.toFixed(2)})"><path d="M40 60 C28 52 34 40 40 32 C46 40 52 52 40 60Z" fill="#d95926"/><path d="M40 60 C34 55 37 47 40 42 C43 47 46 55 40 60Z" fill="#c98500"/></g>
      <rect x="34" y="4" width="12" height="16" fill="#5d6f81"/><path class="smoke" d="M40 4 q-4 -3 0 -6 t0 -6" stroke="rgba(200,210,220,.35)" stroke-width="3" fill="none"/>
      <rect x="10" y="66" width="60" height="6" rx="2" fill="#2b3a4a"/>
    </svg>`;
  }
  function icon(name) {
    const P = {
      home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', prod: 'M4 21h16M7 21V9l5-5 5 5v12M10 13h4M9 17h6',
      ckppn: 'M4 20V9h5v11M11 20V5h5v15M18 20v-7h3v7M2 21h20', sales: 'M3 17l6-6 4 4 8-8M14 7h7v7', staff: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 21v-1a6 6 0 0 1 12 0v1M16 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-5',
      build: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6', stock: 'M3 8l9-5 9 5v10l-9 5-9-5zM3 8l9 5 9-5M12 13v10', energy: 'M13 2L4 14h7l-1 8 9-12h-7z',
      fin: 'M4 20V10M10 20V4M16 20v-8M22 20H2', rating: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3', tech: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
      events: 'M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18', hse: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', kpi: 'M4 19V5M4 19h16M7 15l4-5 3 3 5-7', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 9H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
      more: 'M4 6h16M4 12h16M4 18h16', play: 'M7 4l13 8-13 8z', close: 'M6 6l12 12M18 6L6 18', drop: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z', warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', ok: 'M4 12l5 5L20 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6'
    };
    return `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || P.more}"/></svg>`;
  }


  /* ---------- Анимированное лицо работника ---------- */
  const SKIN = ['#f1c9a5', '#e2b48c', '#cc9c72', '#a87852', '#86593a'];
  const HAIR = ['#1d1a18', '#3a2a1e', '#5b3c22', '#7a5c3c'];
  const HELMET = { cdng: '#e8892b', prs: '#e8892b', repair: '#e8892b', trans: '#e8892b', ckppn: '#e3c33a', ppd: '#3a7bd5', energy: '#3a7bd5', hse: '#f2f2f2', geo: '#f2f2f2', chief: '#f2f2f2' };
  function face(o) {
    const f = o.face || { skin: 1, hair: 0, hs: 0, eye: 0, d: 0 };
    const sz = o.size || 64, age = o.age || 35, female = o.g === 'f', mood = o.mood == null ? 65 : o.mood;
    const skin = SKIN[f.skin % 5];
    const hair = age >= 60 ? '#d9d9d9' : age >= 52 ? '#8f8f8f' : HAIR[f.hair % 4];
    const helm = o.dept ? HELMET[o.dept] : null;
    const office = !helm;
    const cloth = office ? (female ? '#7b4a6b' : '#3c4f66') : '#2f4a73';
    const d = (f.d || 0).toFixed(2);
    const mouth = mood > 65 ? 'M42 70 Q50 77 58 70' : mood < 35 ? 'M42 73 Q50 67 58 73' : 'M43 71 Q50 73 57 71';
    const brow = mood < 35 ? ['M35 44 L44 46', 'M56 46 L65 44'] : ['M35 45 Q39.5 42.5 44 45', 'M56 45 Q60.5 42.5 65 45'];
    const bald = !female && age > 48 && f.hs === 0;
    let hairBack = '', hairTop = '';
    if (female) {
      hairBack = `<path d="M26 50 Q24 22 50 20 Q76 22 74 50 L76 78 Q66 84 62 76 L62 56 L38 56 L38 76 Q34 84 24 78Z" fill="${hair}"/>`;
      hairTop = helm ? '' : `<path d="M30 42 Q32 22 50 22 Q68 22 70 42 Q60 32 48 33 Q38 34 30 42Z" fill="${hair}"/>`;
    } else if (!bald) {
      hairTop = helm ? `<path d="M30 46 L30 39 L35 39 L35 47Z M70 46 L70 39 L65 39 L65 47Z" fill="${hair}"/>` :
        f.hs === 1 ? `<path d="M30 44 Q29 24 50 23 Q71 24 70 44 Q66 34 56 33 Q44 31 34 37Z" fill="${hair}"/>` : `<path d="M31 42 Q32 25 50 24 Q68 25 69 42 Q58 30 31 42Z" fill="${hair}"/>`;
    } else hairTop = helm ? '' : `<path d="M30 46 Q29 38 33 36 L34 48Z M70 46 Q71 38 67 36 L66 48Z" fill="${hair}"/>`;
    const wr = age > 45 ? `<path d="M40 36 Q50 34 60 36 M42 39 Q50 37.5 58 39" stroke="rgba(0,0,0,.18)" stroke-width="1" fill="none"/><path d="M31 53 l-3 1.5 M31 55 l-3 0.5 M69 53 l3 1.5 M69 55 l3 0.5" stroke="rgba(0,0,0,.2)" stroke-width=".9"/>` : '';
    const mus = f.mus ? `<path d="M41 67 Q50 62 59 67 Q50 65.5 41 67Z" fill="${hair}"/>` : '';
    const beard = f.beard ? `<path d="M33 60 Q35 82 50 84 Q65 82 67 60 Q62 74 50 76 Q38 74 33 60Z" fill="${hair}" opacity=".9"/>` : '';
    const gls = f.gls ? `<g fill="none" stroke="#1f2a33" stroke-width="1.6"><rect x="33.5" y="46" width="13" height="10" rx="3.5"/><rect x="53.5" y="46" width="13" height="10" rx="3.5"/><path d="M46.5 50 L53.5 50"/></g>` : '';
    const eyeC = ['#3b2a1e', '#2d4a6b', '#3d5a35'][f.eye % 3];
    const helmet = helm ? `<path d="M28 37 Q28 13 50 12 Q72 13 72 37 Z" fill="${helm}"/><path d="M24 37 L76 37 Q77 41 73 41 L27 41 Q23 41 24 37Z" fill="${helm}"/><path d="M50 12 L50 37" stroke="rgba(0,0,0,.15)" stroke-width="3"/><rect x="44" y="22" width="12" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>` : '';
    const vest = office ? `<path d="M44 90 L50 98 L56 90" fill="#e9eef3"/>${female ? '' : '<path d="M50 92 L48 100 L52 100Z" fill="#b23a3a"/>'}` : `<path d="M30 92 L30 100 M70 92 L70 100" stroke="#cfe23a" stroke-width="4"/>`;
    return `<svg class="face" viewBox="0 0 100 100" width="${sz}" height="${sz}" style="--d:-${d}s" aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="${o.bg || 'var(--panel3)'}"/>
      <clipPath id="fc${o.id || 0}"><circle cx="50" cy="50" r="49"/></clipPath>
      <g clip-path="url(#fc${o.id || 0})"><g transform="translate(-7 -3) scale(1.14)"><g class="f-body">
        <path d="M14 104 Q16 84 38 80 L62 80 Q84 84 86 104Z" fill="${cloth}"/>${vest}
        <rect x="43" y="70" width="14" height="14" rx="5" fill="${skin}"/>
        <g class="f-head">${hairBack}
          <ellipse cx="29" cy="52" rx="4" ry="6" fill="${skin}"/><ellipse cx="71" cy="52" rx="4" ry="6" fill="${skin}"/>
          <ellipse cx="50" cy="51" rx="20" ry="24" fill="${skin}"/>${hairTop}${wr}${beard}
          <g fill="none" stroke="${age >= 52 ? '#7c7c7c' : HAIR[f.hair % 4]}" stroke-width="2" stroke-linecap="round"><path d="${brow[0]}"/><path d="${brow[1]}"/></g>
          <g class="f-eyes"><ellipse cx="40" cy="51" rx="3.6" ry="3" fill="#fff"/><ellipse cx="60" cy="51" rx="3.6" ry="3" fill="#fff"/><circle class="f-pupil" cx="40" cy="51" r="1.9" fill="${eyeC}"/><circle class="f-pupil" cx="60" cy="51" r="1.9" fill="${eyeC}"/></g>
          ${gls}<path d="M50 54 Q47.5 61 50 62.5" stroke="rgba(0,0,0,.25)" stroke-width="1.4" fill="none"/>
          ${mus}<path d="${mouth}" stroke="#8c3b32" stroke-width="2" fill="none" stroke-linecap="round"/>
          ${female ? `<circle cx="29" cy="59" r="1.5" fill="#e3c33a"/><circle cx="71" cy="59" r="1.5" fill="#e3c33a"/>` : ''}
          ${helmet}</g></g></g></g></svg>`;
  }

  root.OMCharts = { face, C, line, bars, donut, gauge, spark, pumpjack, ecnHead, injHead, tank, furnace, icon, short, esc };
})(typeof window !== 'undefined' ? window : globalThis);
