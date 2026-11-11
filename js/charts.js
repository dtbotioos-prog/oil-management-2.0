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
  // Винтажный манометр: шкала 270°, красная черта, стрелка с подскоком и дрожанием
  const gaugeMem = {};
  function gauge(o) {
    const span = o.max - o.min || 1, raw = (o.value - o.min) / span;
    const t = Math.max(-0.02, Math.min(1.03, raw));
    const cx = 70, cy = 70, A0 = -135, SW = 270;
    const ang = A0 + SW * Math.max(0, Math.min(1, t)) + (raw > 1 ? 4 : raw < 0 ? -3 : 0);
    const key = o.id || o.label || 'g';
    const from = gaugeMem[key] != null ? gaugeMem[key] : A0 - 3; gaugeMem[key] = ang;
    const P = (deg, r) => { const a = deg * Math.PI / 180; return [(cx + r * Math.sin(a)).toFixed(2), (cy - r * Math.cos(a)).toFixed(2)]; };
    const arc = (d0, d1, r, col, w) => { const [x0, y0] = P(d0, r), [x1, y1] = P(d1, r); return `<path d="M${x0} ${y0}A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1} ${y1}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
    const kind = c => { c = String(c).toLowerCase(); return /e66767|b71c1c|bad|d84a3a|red/.test(c) ? 'r' : /c98500|d8c13a|yellow|warn|e6a23c|d95926|orange/.test(c) ? 'y' : 'g'; };
    let bands = '', prev = o.min, redStart = null, zone = 'g';
    for (const b of o.bands || []) {
      const d0 = A0 + SW * Math.max(0, (prev - o.min) / span), d1 = A0 + SW * Math.min(1, (Math.min(b.to, o.max) - o.min) / span), k = kind(b.color);
      if (d1 > d0) bands += k === 'r' ? arc(d0, d1, 44, '#b3261e', 7) : k === 'y' ? arc(d0, d1, 44, '#c98a14', 5) : arc(d0, d1, 45.5, '#3f7d3a', 2.5);
      if (k === 'r' && redStart == null && d0 > A0 + 1) redStart = d0;
      if (o.value >= prev && o.value <= b.to) zone = k;
      prev = b.to;
    }
    if (o.value > prev) zone = kind((o.bands || []).slice(-1)[0] ? o.bands.slice(-1)[0].color : '');
    let ticks = '', nums = '';
    for (let i = 0; i <= 25; i++) { const d = A0 + SW * i / 25, maj = i % 5 === 0; const [x0, y0] = P(d, maj ? 39 : 42), [x1, y1] = P(d, 48); ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#1d1a14" stroke-width="${maj ? 1.6 : 0.7}"/>`; }
    for (let i = 0; i <= 5; i++) {
      const v = o.min + span * i / 5, [x, y] = P(A0 + SW * i / 5, 31);
      const tx = o.fmt ? o.fmt(v) : Math.abs(span) >= 50 ? short(v) : Math.abs(span) >= 5 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString().replace('.', ',');
      nums += `<text x="${x}" y="${(+y + 3).toFixed(2)}" text-anchor="middle" font-size="${tx.length > 4 ? 6.5 : 8}" font-weight="700" fill="#1d1a14" font-family="Georgia,'Times New Roman',serif">${esc(tx)}</text>`;
    }
    const red = redStart != null ? (() => { const [x0, y0] = P(redStart, 36), [x1, y1] = P(redStart, 50); return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#c62828" stroke-width="2.6"/>`; })() : '';
    const uid = 'mg' + Math.random().toString(36).slice(2, 8);
    return `<div class="gauge mano ${zone === 'r' ? 'danger' : zone === 'y' ? 'caution' : ''}"><svg viewBox="0 0 140 140" width="100%" aria-label="${esc(o.label)}: ${esc(o.text)}" role="img">
      <defs>
        <radialGradient id="${uid}f" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#f6efd9"/><stop offset=".75" stop-color="#e6d9b4"/><stop offset="1" stop-color="#c9b88c"/></radialGradient>
        <linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".35" stop-color="#9aa3ab"/><stop offset=".6" stop-color="#d9dde1"/><stop offset="1" stop-color="#5b636b"/></linearGradient>
        <linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <rect x="62" y="122" width="16" height="16" rx="2" fill="#8d7a4a" stroke="#5b4d2b"/><rect x="58" y="118" width="24" height="7" rx="1.5" fill="#b59a5a" stroke="#5b4d2b"/>
      <circle cx="${cx}" cy="${cy}" r="62" fill="#1b1f24"/>
      <circle cx="${cx}" cy="${cy}" r="60" fill="url(#${uid}b)"/>
      <circle cx="${cx}" cy="${cy}" r="53.5" fill="#3b3f44"/>
      <circle cx="${cx}" cy="${cy}" r="52" fill="url(#${uid}f)"/>
      ${bands}${ticks}${nums}${red}
      <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-size="5.2" letter-spacing=".8" fill="#4a4232" font-family="Georgia,serif">МАНОМЕТР</text>
      <text x="${cx}" y="${cy + 41}" text-anchor="middle" font-size="4.4" fill="#5a5040" font-family="Georgia,serif">кл. 1,5 ★</text>
      <circle class="mlamp" cx="${cx}" cy="${cy - 17}" r="3" fill="${zone === 'r' ? '#e53935' : '#5a1d1a'}" stroke="#2a2420" stroke-width=".8"/>
      <circle cx="${P(A0 - 6, 44)[0]}" cy="${P(A0 - 6, 44)[1]}" r="1.6" fill="#3a332a"/>
      <g class="ndl-s" style="--a0:${from.toFixed(1)}deg;--a1:${ang.toFixed(1)}deg;transform-origin:${cx}px ${cy}px"><g class="ndl-j" style="transform-origin:${cx}px ${cy}px">
        <path d="M${cx - 1.8} ${cy + 12} L${cx - 1.1} ${cy} L${cx - 0.35} ${cy - 45} L${cx + 0.35} ${cy - 45} L${cx + 1.1} ${cy} L${cx + 1.8} ${cy + 12}Z" fill="#141414"/>
        <circle cx="${cx}" cy="${cy + 10}" r="3.2" fill="#141414"/></g></g>
      <circle cx="${cx}" cy="${cy}" r="5" fill="#b59a5a" stroke="#5b4d2b" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="1.6" fill="#5b4d2b"/>
      <ellipse cx="${cx - 12}" cy="${cy - 26}" rx="34" ry="18" transform="rotate(-25 ${cx - 12} ${cy - 26})" fill="url(#${uid}g)" opacity=".55"/>
      <circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    </svg><div class="gv">${esc(o.text)}</div><div class="gl">${esc(o.label)}</div></div>`;
  }


  /* ---------- Щитовой стрелочный прибор КПД (бакелитовый корпус, СССР) ---------- */
  function panelMeter(o) {
    const v = Math.max(0, Math.min(1.2, o.value || 0)), cx = 70, cy = 92, R = 62, A0 = -50, SW = 100;
    const ang = A0 + SW * v / 1.2, key = 'pm' + (o.id || o.label || '');
    const from = gaugeMem[key] != null ? gaugeMem[key] : A0 - 3; gaugeMem[key] = ang;
    const P = (deg, r) => { const a = deg * Math.PI / 180; return [(cx + r * Math.sin(a)).toFixed(2), (cy - r * Math.cos(a)).toFixed(2)]; };
    const arc = (d0, d1, r, col, w) => { const [x0, y0] = P(d0, r), [x1, y1] = P(d1, r); return `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
    let ticks = '', nums = '';
    for (let i = 0; i <= 24; i++) { const d = A0 + SW * i / 24, maj = i % 4 === 0; const [x0, y0] = P(d, R - (maj ? 9 : 5)), [x1, y1] = P(d, R); ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#1d1a14" stroke-width="${maj ? 1.4 : 0.6}"/>`; }
    for (let i = 0; i <= 6; i++) { const [x, y] = P(A0 + SW * i / 6, R - 16); nums += `<text x="${x}" y="${(+y + 3).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#1d1a14" font-family="Georgia,serif">${i * 20}</text>`; }
    const zone = v < 0.6 ? 'r' : v < 0.85 ? 'y' : 'g', uid = 'pm' + Math.random().toString(36).slice(2, 8);
    return `<div class="pmeter ${zone === 'r' ? 'danger' : ''}"><svg viewBox="0 0 140 108" width="100%" role="img" aria-label="${esc(o.label)}: ${Math.round(v * 100)}%">
      <defs><linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2c22"/><stop offset="1" stop-color="#16100c"/></linearGradient>
      <linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efd9"/><stop offset="1" stop-color="#ddd0a8"/></linearGradient></defs>
      <rect x="1" y="1" width="138" height="106" rx="7" fill="url(#${uid}b)" stroke="#0b0806"/>
      ${[[8, 8], [132, 8], [8, 100], [132, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#8d969e" stroke="#2a2f34"/><line x1="${x - 1.6}" y1="${y}" x2="${x + 1.6}" y2="${y}" stroke="#2a2f34" stroke-width=".8"/>`).join('')}
      <rect x="14" y="10" width="112" height="86" rx="3" fill="url(#${uid}f)" stroke="#0b0806" stroke-width="1.5"/>
      ${arc(A0, A0 + SW * 0.5, R + 3, '#b3261e', 4)}${arc(A0 + SW * 0.5, A0 + SW * 0.708, R + 3, '#c98a14', 4)}${arc(A0 + SW * 0.708, A0 + SW, R + 3, '#3f7d3a', 4)}
      ${ticks}${nums}
      <text x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="9" font-weight="800" fill="#1d1a14" font-family="Georgia,serif">КПД %</text>
      <text x="${cx}" y="${cy - 16}" text-anchor="middle" font-size="4.6" fill="#5a5040" font-family="Georgia,serif">кл. 2,5 ⊥</text>
      <g class="ndl-s" style="--a0:${from.toFixed(1)}deg;--a1:${ang.toFixed(1)}deg;transform-origin:${cx}px ${cy}px"><g class="ndl-j" style="transform-origin:${cx}px ${cy}px">
        <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R + 2}" stroke="#111" stroke-width="1.3"/><path d="M${cx - 2} ${cy - R + 12} L${cx} ${cy - R + 1} L${cx + 2} ${cy - R + 12}Z" fill="#111"/></g></g>
      <rect x="14" y="${cy - 6}" width="112" height="10" fill="#2a2018"/>
      <circle cx="${cx}" cy="${cy - 1}" r="4" fill="#111" stroke="#555"/>
      <circle cx="${cx + 42}" cy="${cy - 1}" r="2.6" fill="${zone === 'r' ? '#e53935' : zone === 'y' ? '#ffb300' : '#43a047'}" stroke="#000" stroke-width=".6"/>
      <rect x="14" y="10" width="112" height="40" rx="3" fill="#fff" opacity=".08"/>
    </svg><div class="gl">${esc(o.label)}</div>${o.sub ? `<div class="gs">${esc(o.sub)}</div>` : ''}</div>`;
  }
  /* ---------- Ёмкость СУГ (горизонтальная цистерна пропан-бутана, СССР) ---------- */
  const lpgMem = {};
  function lpgTank(o) {
    const lv = Math.max(0, Math.min(1, o.level || 0)), W = o.small ? 150 : 300, H = o.small ? 66 : 120, key = 'lt' + (o.id || '');
    const from = lpgMem[key] != null ? lpgMem[key] : lv; lpgMem[key] = lv;
    const bx = W * 0.07, bw = W * 0.86, by = H * 0.08, bh = H * 0.62, r = bh / 2, uid = 'lt' + Math.random().toString(36).slice(2, 8);
    const ly = by + bh * (1 - lv), ly0 = by + bh * (1 - from);
    const zone = lv > 0.85 ? '#e53935' : lv < 0.1 ? '#ffb300' : '#43a047';
    return `<div class="lpgtank${o.small ? ' sm' : ''}"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label || 'Ёмкость СУГ')}: ${Math.round(lv * 100)}%">
      <defs><linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e6e9ec"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient>
      <linearGradient id="${uid}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4e6" stop-opacity=".85"/><stop offset="1" stop-color="#2f6db5" stop-opacity=".9"/></linearGradient>
      <clipPath id="${uid}c"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}"/></clipPath></defs>
      ${[0.22, 0.78].map(p => `<path d="M${bx + bw * p - W * 0.06} ${by + bh + H * 0.2} L${bx + bw * p - W * 0.04} ${by + bh - 2} L${bx + bw * p + W * 0.04} ${by + bh - 2} L${bx + bw * p + W * 0.06} ${by + bh + H * 0.2}Z" fill="#5b636b" stroke="#2a2f34"/>`).join('')}
      <rect x="${bx - W * 0.02}" y="${by + bh + H * 0.2}" width="${bw + W * 0.04}" height="${H * 0.05}" fill="#3a4148"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}" fill="url(#${uid}b)" stroke="#5b636b" stroke-width="1.2"/>
      <g clip-path="url(#${uid}c)"><rect class="lpg-liq" x="${bx}" y="${ly.toFixed(1)}" width="${bw}" height="${(by + bh - ly + 1).toFixed(1)}" fill="url(#${uid}l)" opacity=".6" style="--y0:${(ly0 - ly).toFixed(1)}px"/>
        <rect x="${bx}" y="${by + bh * 0.42}" width="${bw}" height="${bh * 0.16}" fill="#c62828"/></g>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}" fill="none" stroke="#5b636b" stroke-width="1.2"/>
      <text x="${bx + bw * 0.42}" y="${(by + bh * 0.5 + (o.small ? 3 : 5)).toFixed(1)}" text-anchor="middle" font-size="${o.small ? 7.5 : 14}" font-weight="900" letter-spacing="${o.small ? 1 : 3}" fill="#fff" font-family="Georgia,serif">ПРОПАН</text>
      ${o.small ? '' : `<text x="${bx + bw * 0.42}" y="${by + bh * 0.3}" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="1.5" fill="#b3261e" font-family="Georgia,serif">ОГНЕОПАСНО</text>`}
      <rect x="${bx + bw * 0.46}" y="${by - H * 0.06}" width="${W * 0.05}" height="${H * 0.07}" fill="#8d969e" stroke="#2a2f34"/>
      <g transform="translate(${bx + bw * 0.83} ${by + bh * 0.12})"><rect x="0" y="0" width="${W * 0.045}" height="${bh * 0.76}" rx="2" fill="#1a1d20" stroke="#2a2f34"/>
        <rect class="lpg-lvl" x="1.2" y="${(bh * 0.76 * (1 - lv) + 1).toFixed(1)}" width="${W * 0.045 - 2.4}" height="${Math.max(0, bh * 0.76 * lv - 2).toFixed(1)}" fill="${zone}"/>
        ${[0.25, 0.5, 0.75].map(p => `<line x1="0" y1="${(bh * 0.76 * p).toFixed(1)}" x2="${(W * 0.045 * 0.5).toFixed(1)}" y2="${(bh * 0.76 * p).toFixed(1)}" stroke="#ccc" stroke-width=".6"/>`).join('')}</g>
      ${o.small ? '' : `<text x="${bx + bw * 0.85}" y="${by + bh + H * 0.12}" font-size="7" fill="#9aa3ab" font-family="Georgia,serif">уровнемер</text>`}
    </svg>${o.text ? `<div class="gv">${esc(o.text)}</div>` : ''}${o.sub ? `<div class="gl">${esc(o.sub)}</div>` : ''}</div>`;
  }

  /* ---------- Указатель уровня топлива (приборная панель, СССР) ---------- */
  function fuelDial(o) {
    const lv = Math.max(0, Math.min(1, o.level || 0)), cx = 60, cy = 62, A0 = -60, SW = 120;
    const ang = A0 + SW * lv, key = 'fd' + (o.id || o.label || '');
    const from = gaugeMem[key] != null ? gaugeMem[key] : A0 - 4; gaugeMem[key] = ang;
    const P = (deg, r) => { const a = deg * Math.PI / 180; return [(cx + r * Math.sin(a)).toFixed(2), (cy - r * Math.cos(a)).toFixed(2)]; };
    const arc = (d0, d1, r, col, w) => { const [x0, y0] = P(d0, r), [x1, y1] = P(d1, r); return `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
    let ticks = '';
    for (let i = 0; i <= 8; i++) { const d = A0 + SW * i / 8, maj = i % 2 === 0; const [x0, y0] = P(d, maj ? 33 : 36), [x1, y1] = P(d, 41); ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${i < 2 ? '#ff5a4a' : '#efe6c8'}" stroke-width="${maj ? 2 : 1}"/>`; }
    const lab = (d, txt, r = 26) => { const [x, y] = P(d, r); return `<text x="${x}" y="${(+y + 3).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="800" fill="${txt === '0' ? '#ff5a4a' : '#efe6c8'}" font-family="Georgia,serif">${txt}</text>`; };
    const low = lv < 0.2, uid = 'fd' + Math.random().toString(36).slice(2, 8);
    return `<div class="fdial ${low ? 'low' : ''}"><svg viewBox="0 0 120 124" width="100%" role="img" aria-label="${esc(o.label || 'Топливо')}: ${Math.round(lv * 100)}%">
      <defs><linearGradient id="${uid}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef0f2"/><stop offset=".4" stop-color="#8e979f"/><stop offset=".65" stop-color="#d5d9dd"/><stop offset="1" stop-color="#4d555c"/></linearGradient>
      <radialGradient id="${uid}f" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#2b2f33"/><stop offset="1" stop-color="#101214"/></radialGradient></defs>
      <circle cx="${cx}" cy="${cy}" r="56" fill="url(#${uid}r)"/><circle cx="${cx}" cy="${cy}" r="51" fill="url(#${uid}f)"/>
      ${arc(A0, A0 + SW * 0.25, 38, '#b3261e', 5)}${arc(A0 + SW * 0.25, A0 + SW, 39.5, '#6f6a58', 1.4)}${ticks}
      ${lab(A0, '0')}${lab(A0 + SW / 2, '½')}${lab(A0 + SW, 'П')}
      <g transform="translate(${cx - 5} ${cy + 14}) scale(.6)" fill="#efe6c8"><rect x="0" y="2" width="13" height="18" rx="2"/><rect x="2" y="4" width="9" height="6" fill="#16191c"/><path d="M13 7h3l3 3v9a2 2 0 0 1-4 0v-6h-2" fill="none" stroke="#efe6c8" stroke-width="1.8"/></g>
      <text x="${cx}" y="${cy + 35}" text-anchor="middle" font-size="5.6" letter-spacing="1" fill="#bdb49a" font-family="Georgia,serif">ТОПЛИВО</text>
      <circle class="flamp" cx="${cx + 22}" cy="${cy + 22}" r="3.4" fill="${low ? '#ffb300' : '#4a3a12'}" stroke="#000" stroke-width=".8"/>
      <g class="ndl-s" style="--a0:${from.toFixed(1)}deg;--a1:${ang.toFixed(1)}deg;transform-origin:${cx}px ${cy}px"><g class="ndl-j" style="transform-origin:${cx}px ${cy}px">
        <path d="M${cx - 1.6} ${cy + 6} L${cx - 0.9} ${cy} L${cx - 0.3} ${cy - 40} L${cx + 0.3} ${cy - 40} L${cx + 0.9} ${cy} L${cx + 1.6} ${cy + 6}Z" fill="#ff7a1a"/></g></g>
      <circle cx="${cx}" cy="${cy}" r="5.5" fill="#1a1d20" stroke="#5c646b"/>
      <ellipse cx="${cx - 14}" cy="${cy - 30}" rx="30" ry="12" transform="rotate(-20 ${cx - 14} ${cy - 30})" fill="#fff" opacity=".07"/>
    </svg>${o.text ? `<div class="gv">${esc(o.text)}</div>` : ''}${o.sub ? `<div class="gl">${esc(o.sub)}</div>` : ''}</div>`;
  }

  /* ---------- Механический счётчик (барабаны с цифрами) ---------- */
  const odoMem = {};
  function odometer(value, digits, key, red) {
    const s = String(Math.max(0, Math.round(value))).padStart(digits, '0').slice(-digits);
    const prev = odoMem[key] || s; odoMem[key] = s;
    return `<span class="odo" aria-label="${s}">${[...s].map((d, i) => { const f = Number(prev[i]) || 0, n = Number(d); const ch = f !== n;
      return `<span class="od${red && i >= digits - red ? ' red' : ''}"><span class="ods${ch ? ' roll' : ''}" style="--f:${f};--n:${n}">${'0123456789'.split('').map(x => `<i>${x}</i>`).join('')}</span></span>`; }).join('')}</span>`;
  }
  /* ---------- Шильдик оборудования ---------- */
  const PLANTS = ['Завод «Нефтемаш-2»', 'Уральский машзавод № 7', 'Завод «Гидромаш»', 'Каспийский завод нефтеаппаратуры', 'Завод «Красный буровик»', 'Завод «Электропривод»', 'Завод «Химаппарат-4»'];
  function plate() { return ''; }
  /* ---------- Предупреждающий плакат ---------- */
  function danger(text, sub) { return `<div class="dplate"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2 L23 21 H1Z" fill="#ffd400" stroke="#111" stroke-width="1.4"/><path d="M13 7 L9 14 H12 L11 19 L15 11 H12Z" fill="#111"/></svg><div><b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`; }
  /* ---------- Спиртовой термометр (мораль коллектива) ---------- */
  const thermoMem = {};
  function thermo(o) {
    const span = o.max - o.min || 1, t = Math.max(0, Math.min(1, (o.value - o.min) / span));
    const key = o.id || o.label || 'th', f = thermoMem[key] != null ? thermoMem[key] : 0; thermoMem[key] = t;
    const top = 14, bot = 104, H = bot - top, y = v => bot - H * v;
    const kind = c => /e66767|red/.test(String(c)) ? '#c62828' : /c98500|yellow/.test(String(c)) ? '#d49a1a' : '#3f8a46';
    let prev = o.min, bands = '', zone = 'g';
    for (const b of o.bands || []) { const a = (prev - o.min) / span, z = (Math.min(b.to, o.max) - o.min) / span; bands += `<rect x="44" y="${y(z).toFixed(1)}" width="4" height="${(H * (z - a)).toFixed(1)}" fill="${kind(b.color)}"/>`; if (o.value >= prev && o.value <= b.to) zone = kind(b.color) === '#c62828' ? 'r' : kind(b.color) === '#d49a1a' ? 'y' : 'g'; prev = b.to; }
    let ticks = ''; for (let i = 0; i <= 10; i++) { const yy = y(i / 10).toFixed(1); ticks += `<line x1="${i % 5 ? 50 : 49}" y1="${yy}" x2="${i % 5 ? 55 : 58}" y2="${yy}" stroke="#2a2418" stroke-width="${i % 5 ? .7 : 1.2}"/>`; if (i % 5 === 0) ticks += `<text x="60" y="${(+yy + 3).toFixed(1)}" font-size="8" font-weight="700" fill="#2a2418" font-family="Georgia,serif">${Math.round(o.min + span * i / 10)}</text>`; }
    return `<div class="gauge thermo ${zone === 'r' ? 'danger' : zone === 'y' ? 'caution' : ''}"><svg viewBox="0 0 90 132" width="100%" role="img" aria-label="${esc(o.label)}: ${esc(o.text)}">
      <rect x="18" y="4" width="54" height="124" rx="6" fill="#e9dfc2" stroke="#8a7a52"/><rect x="21" y="7" width="48" height="118" rx="4" fill="none" stroke="#c9b88c"/>
      <circle cx="26" cy="11" r="1.6" fill="#8a7a52"/><circle cx="64" cy="11" r="1.6" fill="#8a7a52"/><circle cx="26" cy="121" r="1.6" fill="#8a7a52"/><circle cx="64" cy="121" r="1.6" fill="#8a7a52"/>
      ${bands}${ticks}
      <rect x="35" y="${top - 6}" width="8" height="${H + 8}" rx="4" fill="#f7f4ec" stroke="#9c9480"/>
      <rect class="th-liq" x="37" y="${y(t).toFixed(1)}" width="4" height="${(bot - y(t) + 2).toFixed(1)}" fill="#d32f2f" style="--h0:${(H * f).toFixed(1)}px;--h1:${(H * t).toFixed(1)}px;transform-origin:39px ${bot}px"/>
      <circle cx="39" cy="${bot + 8}" r="7" fill="#d32f2f" stroke="#9c9480"/><circle cx="37" cy="${bot + 6}" r="2" fill="#ff8a80" opacity=".8"/>
      <rect x="36" y="${top - 4}" width="1.5" height="${H}" fill="#fff" opacity=".6"/>
    </svg><div class="gv">${esc(o.text)}</div><div class="gl">${esc(o.label)}</div></div>`;
  }
  /* ---------- Сигнальная колонна (светофор безопасности) ---------- */
  function signal(o) {
    const span = o.max - o.min || 1;
    let prev = o.min, zone = 'g';
    for (const b of o.bands || []) { const c = String(b.color); if (o.value >= prev && o.value <= b.to) zone = /e66767|red/.test(c) ? 'r' : /c98500|yellow/.test(c) ? 'y' : 'g'; prev = b.to; }
    const lamp = (cy, k, on, col, dim) => `<g class="sl-l ${on ? 'on' : ''} ${on && k === 'r' ? 'blink' : ''}"><circle cx="45" cy="${cy}" r="13" fill="#15181b" stroke="#000"/><circle cx="45" cy="${cy}" r="10.5" fill="${on ? col : dim}"/>${on ? `<circle cx="45" cy="${cy}" r="15" fill="${col}" opacity=".25"/><circle cx="41" cy="${cy - 4}" r="3" fill="#fff" opacity=".6"/>` : ''}<path d="M30 ${cy - 13} h30 l-3 -5 h-24z" fill="#2a2f34"/></g>`;
    const segs = Array.from({ length: 10 }, (_, i) => { const v = o.min + span * (i + 0.5) / 10, lit = o.value >= o.min + span * i / 10 + 0.0001; const c = v < (o.bands[0] || {}).to ? '#e53935' : v < (o.bands[1] || {}).to ? '#f2b705' : '#43a047'; return `<rect x="${12 + i * 7}" y="122" width="5" height="8" rx="1" fill="${lit ? c : '#2b3036'}"/>`; }).join('');
    return `<div class="gauge signal ${zone === 'r' ? 'danger' : zone === 'y' ? 'caution' : ''}"><svg viewBox="0 0 90 136" width="100%" role="img" aria-label="${esc(o.label)}: ${esc(o.text)}">
      <rect x="27" y="4" width="36" height="104" rx="6" fill="#3a4047" stroke="#111"/><rect x="30" y="7" width="30" height="98" rx="4" fill="#23282d"/>
      ${lamp(24, 'r', zone === 'r', '#ff3b30', '#4a1513')}${lamp(55, 'y', zone === 'y', '#ffc107', '#4a3a10')}${lamp(86, 'g', zone === 'g', '#4cd964', '#123a1c')}
      <rect x="40" y="108" width="10" height="8" fill="#555c63"/><rect x="8" y="116" width="74" height="18" rx="3" fill="#1c2024" stroke="#000"/>${segs}
    </svg><div class="gv">${esc(o.text)}</div><div class="gl">${esc(o.label)}</div></div>`;
  }
  /* ---------- Табло «Работаем без травм» ---------- */
  function safetyBoard(days, sub) {
    return `<div class="sboard"><div class="sb-h">★ ОХРАНА ТРУДА ★</div><div class="sb-t">РАБОТАЕМ БЕЗ ТРАВМ</div>${odometer(days, 4, 'notrauma')}<div class="sb-t">ДНЕЙ</div>${sub ? `<div class="sb-s">${esc(sub)}</div>` : ''}</div>`;
  }
  /* ---------- Линейная шкала с бегунком (план, доверие) ---------- */
  const linMem = {};
  function linear(o) {
    const span = o.max - o.min || 1, pos = v => Math.max(0, Math.min(100, (v - o.min) / span * 100));
    const p = pos(o.value), key = o.id || o.label || 'lin', f = linMem[key] != null ? linMem[key] : 0; linMem[key] = p;
    const kind = c => /e66767|red/.test(String(c)) ? 'r' : /c98500|yellow/.test(String(c)) ? 'y' : 'g';
    let prev = o.min, zones = '', zone = 'g';
    for (const b of o.bands || []) { const a = pos(prev), z = pos(Math.min(b.to, o.max)); zones += `<i class="z-${kind(b.color)}" style="left:${a}%;width:${z - a}%"></i>`; if (o.value >= prev && o.value <= b.to) zone = kind(b.color); prev = b.to; }
    if (o.value > prev && o.bands && o.bands.length) zone = kind(o.bands[o.bands.length - 1].color);
    if (o.value < o.min && o.bands && o.bands.length) zone = kind(o.bands[0].color);
    const ticks = (o.ticks || [o.min, (o.min + o.max) / 2, o.max]).map(v => `<span style="left:${pos(v)}%">${esc(String(Math.round(v)))}${o.unit || ''}</span>`).join('');
    const mark = o.marker != null ? `<b class="lin-mark" style="left:${pos(o.marker)}%"></b>` : '';
    return `<div class="lin z${zone}"><div class="lin-top"><span class="lin-l">${esc(o.label)}</span><span class="lin-v">${esc(o.text)}</span></div>
      <div class="lin-track">${zones}${mark}<em class="lin-ptr" style="--p0:${f.toFixed(1)}%;--p1:${p.toFixed(1)}%"></em></div><div class="lin-ticks">${ticks}</div>${o.sub ? `<div class="lin-s">${esc(o.sub)}</div>` : ''}</div>`;
  }
  /* ---------- Настроение коллектива (лицо) ---------- */
  function moodFace(o) {
    const v = Math.max(0, Math.min(100, o.value)), zone = v < 40 ? 'r' : v < 60 ? 'y' : 'g';
    const col = { r: '#e66767', y: '#e6a23c', g: '#3fbf6f' }[zone];
    const c = (v - 50) / 50 * 14; // изгиб рта
    const brow = v < 40 ? `<path d="M30 36 L42 40 M70 36 L58 40" stroke="#1b1f24" stroke-width="3" stroke-linecap="round"/>` : '';
    return `<div class="gauge moodf ${zone === 'r' ? 'danger' : zone === 'y' ? 'caution' : ''}"><svg viewBox="0 0 100 100" width="100%" role="img" aria-label="${esc(o.label)}: ${esc(o.text)}">
      <circle cx="50" cy="50" r="44" fill="${col}" stroke="#1b1f24" stroke-width="3"/>
      <circle cx="50" cy="50" r="44" fill="url(#none)" opacity=".15"/>
      ${brow}<g class="mf-eyes"><ellipse cx="36" cy="44" rx="5" ry="6.5" fill="#1b1f24"/><ellipse cx="64" cy="44" rx="5" ry="6.5" fill="#1b1f24"/></g>
      <path d="M30 ${68 - c / 2} Q50 ${68 + c} 70 ${68 - c / 2}" fill="none" stroke="#1b1f24" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="34" cy="28" rx="12" ry="6" fill="#fff" opacity=".22" transform="rotate(-25 34 28)"/>
    </svg><div class="gv">${esc(o.text)}</div><div class="gl">${esc(o.label)}</div></div>`;
  }
  /* ---------- Советская топливораздаточная колонка ---------- */
  function fuelPump(o) {
    const col = o.color || '#3fbf6f', lv = Math.max(0, Math.min(1, o.level || 0)), state = o.dry ? 'dry' : o.on ? 'on' : 'off';
    const lamp = state === 'dry' ? '#ff3b30' : state === 'on' ? '#4cd964' : '#5b636b';
    const L = String(Math.round(o.liters || 0)).padStart(5, '0').slice(-5);
    return `<div class="fpump ${state}"><svg viewBox="0 0 64 128" width="100%" role="img" aria-label="${esc(o.label)}: ${esc(L)} л">
      <rect x="6" y="116" width="52" height="8" rx="2" fill="#2b3036"/>
      <rect x="10" y="22" width="40" height="96" rx="5" fill="${col}" stroke="#14181c" stroke-width="1.5"/>
      <rect x="10" y="22" width="40" height="96" rx="5" fill="url(#none)"/><rect x="13" y="24" width="6" height="92" fill="#fff" opacity=".12"/>
      <rect x="12" y="6" width="36" height="18" rx="8" fill="#f2efe6" stroke="#14181c" stroke-width="1.5"/>
      <text x="30" y="19" text-anchor="middle" font-size="9" font-weight="900" fill="#1c1c1c" font-family="Georgia,serif">${esc(o.label)}</text>
      <rect x="14" y="30" width="32" height="30" rx="2" fill="#e9e2c8" stroke="#14181c"/>
      <rect x="16" y="33" width="28" height="10" fill="#111"/><text x="30" y="41" text-anchor="middle" font-size="8" font-weight="700" fill="#f2efe6" font-family="Courier New,monospace" letter-spacing=".5">${esc(L)}</text>
      <text x="30" y="49" text-anchor="middle" font-size="4.6" fill="#333" font-family="Arial">ЛИТРЫ ЗА СУТКИ</text>
      <text x="30" y="57" text-anchor="middle" font-size="6.5" font-weight="700" fill="#7a1a1a" font-family="Georgia,serif">${esc(o.price || '')}</text>
      <circle class="fp-lamp" cx="20" cy="68" r="3.2" fill="${lamp}" stroke="#111"/>
      <rect x="36" y="64" width="8" height="46" rx="2" fill="#0d1114" stroke="#14181c"/>
      <rect x="37.5" y="${(65.5 + 43 * (1 - lv)).toFixed(1)}" width="5" height="${(43 * lv).toFixed(1)}" fill="${lv < 0.2 ? '#e53935' : '#e8d58a'}" opacity=".9"/>
      ${[0.25, 0.5, 0.75].map(k => `<line x1="36" x2="38" y1="${(65.5 + 43 * k).toFixed(1)}" y2="${(65.5 + 43 * k).toFixed(1)}" stroke="#ccc" stroke-width=".6"/>`).join('')}
      <path d="M10 76 C-2 78 0 104 8 110" fill="none" stroke="#1c1c1c" stroke-width="2.6"/>
      <path d="M10 70 h5 v12 h-5z" fill="#3a3f45"/><path d="M5 108 l6 -4 l2 3 l-6 4z" fill="#3a3f45"/>
    </svg><div class="fp-s ${o.daysCls || ''}">${esc(o.sub || '')}</div></div>`;
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
  const TANK_COL = { oil: ['#3a2a16', '#c98500'], tech: ['#5a3a1e', '#d95926'], water: ['#123a63', '#3987e5'], ai: ['#1f4a2c', '#3fbf6f'], a95: ['#164a46', '#2fb3a8'], a98: ['#33285a', '#9b7be0'], dt: ['#4a4214', '#d8c13a'], mz: ['#1a1410', '#4a3a2a'] };
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
      events: 'M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', gas: 'M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8zM5 21h14', bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18', hse: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', kpi: 'M4 19V5M4 19h16M7 15l4-5 3 3 5-7', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 9H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
      npz: 'M6 21V7l2-3 2 3v14M14 21V10h4v11M3 21h18M6 11h4M6 15h4M14 14h4', azs: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 8h6M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3', shares: 'M4 20h16M7 16V9M7 9V6M12 16v-5M12 11V4M17 16v-3M17 13v-4M5.5 9h3v5h-3zM10.5 6h3v8h-3zM15.5 9h3v5h-3z',
      dorm: 'M3 21V9l9-6 9 6v12M3 21h18M8 21v-5h3v5M14 12h3v3h-3zM7 11h3v3H7z',
      truck: 'M2 16V6h11v10M13 9h5l3 4v3h-8M2 16h2M9 16h6M6.5 18.5a2 2 0 1 0 0-.1M17.5 18.5a2 2 0 1 0 0-.1',
      more: 'M4 6h16M4 12h16M4 18h16', play: 'M7 4l13 8-13 8z', close: 'M6 6l12 12M18 6L6 18', drop: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z', warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', ok: 'M4 12l5 5L20 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6'
    };
    return `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || P.more}"/></svg>`;
  }


  /* ---------- Анимированное лицо работника ---------- */
  const SKIN = ['#f1c9a5', '#e2b48c', '#cc9c72', '#a87852', '#86593a'];
  const HAIR = ['#1d1a18', '#3a2a1e', '#5b3c22', '#7a5c3c'];
  const HELMET = { cdng: '#e8892b', prs: '#e8892b', repair: '#e8892b', trans: '#e8892b', ckppn: '#e3c33a', ppd: '#3a7bd5', energy: '#3a7bd5', hse: '#f2f2f2', geo: '#f2f2f2', chief: '#f2f2f2', npz: '#e3c33a', retail: '#d84a3a', gas: '#3a7bd5' };
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

  root.OMCharts = { lpgTank, panelMeter, fuelDial, fuelPump, linear, moodFace, thermo, signal, safetyBoard, odometer, plate, danger, face, C, line, bars, donut, gauge, spark, pumpjack, ecnHead, injHead, tank, furnace, icon, short, esc };
})(typeof window !== 'undefined' ? window : globalThis);
