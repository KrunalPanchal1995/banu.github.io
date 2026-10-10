/* IoT and Robotics playground: eleven small widgets. Every calculation is a pure function on window.IOT, a JavaScript port of the Python module named beside it;
   tools/browser_test.py checks each against numbers computed by the Python modules (tools/widget_reference.json). No dependencies. */
(function () {
  'use strict';
  var SQ2 = Math.SQRT2;

  // ------------------------------------------------------------------ pure functions (ports)
  // circuits_np
  function divider(vin, r1, r2, rload) { var r2e = (rload == null) ? r2 : (r2 * rload) / (r2 + rload); return vin * r2e / (r1 + r2e); }
  function ledR(vs, vf, i) { return (vs - vf) / i; }
  function lsb(vref, bits) { return vref / Math.pow(2, bits); }
  function adcCode(v, vref, bits) { var c = Math.floor(v / lsb(vref, bits)); return Math.max(0, Math.min(Math.pow(2, bits) - 1, c)); }
  function adcRms(vref, bits) { return lsb(vref, bits) / Math.sqrt(12); }
  // sensors_np
  function pyRound(x) { var f = Math.floor(x), d = x - f; if (d < 0.5) return f; if (d > 0.5) return f + 1; return (f % 2 === 0) ? f : f + 1; }
  function alias(f, fs) { return Math.abs(f - fs * pyRound(f / fs)); }
  // fsm_sim / node_fsm.Debouncer
  function debounce(levels, times, stableMs) {
    var state = 1, cand = 1, tch = 0, presses = 0, raw = 0;
    for (var i = 0; i < levels.length; i++) {
      var v = levels[i], now = times[i];
      if (v !== cand) { cand = v; tch = now; } else if (v !== state && now - tch >= stableMs) { state = v; if (state === 0) presses++; }
      if (i > 0 && levels[i] === 0 && levels[i - 1] === 1) raw++;
    }
    return { presses: presses, rawEdges: raw };
  }
  // netcalc
  function qosExpectedPackets(p, qos) { if (qos === 0) return 1; var ph = 1 / Math.pow(1 - p, 2) + 1 / (1 - p); return qos === 1 ? ph : 2 * ph; }
  function lostFraction(p, attempts) { return Math.pow(p, attempts); }
  // telemetry_np detectors
  function threshold(lo, hi, h, xs) { var on = false, out = []; xs.forEach(function (x) { if (x < lo || x > hi) on = true; else if (lo + h <= x && x <= hi - h) on = false; out.push(on); }); return out; }
  function zscore(window, k, xs) {
    var buf = [], s = 0, s2 = 0, out = [];
    xs.forEach(function (x) {
      var alarm = false, n = buf.length;
      if (n >= window) { var mean = s / n, v = Math.max(s2 / n - mean * mean, 0), sd = Math.sqrt(v); alarm = sd > 0 && Math.abs(x - mean) > k * sd; }
      buf.push(x); s += x; s2 += x * x;
      if (buf.length > window) { var y = buf.shift(); s -= y; s2 -= y * y; }
      out.push(alarm);
    });
    return out;
  }
  function ewma(mu0, sigma, lam, L, xs) {
    var z = mu0, t = 0, out = [];
    xs.forEach(function (x) { t++; z = lam * x + (1 - lam) * z; var lim = L * sigma * Math.sqrt(lam / (2 - lam) * (1 - Math.pow(1 - lam, 2 * t))); out.push(Math.abs(z - mu0) > lim); });
    return out;
  }
  function cusum(mu0, k, h, xs) {
    var sp = 0, sn = 0, out = [];
    xs.forEach(function (x) { sp = Math.max(0, sp + (x - mu0) - k); sn = Math.max(0, sn - (x - mu0) - k); out.push(sp > h || sn > h); });
    return out;
  }
  // kinematics_np
  function fk(q1, q2, l1, l2) { return [l1 * Math.cos(q1) + l2 * Math.cos(q1 + q2), l1 * Math.sin(q1) + l2 * Math.sin(q1 + q2)]; }
  function ik(x, y, l1, l2, elbow) {
    var c2 = (x * x + y * y - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    if (c2 < -1 - 1e-12 || c2 > 1 + 1e-12) return null;
    c2 = Math.max(-1, Math.min(1, c2));
    var q2 = Math.acos(c2) * (elbow === 'up' ? 1 : -1);
    var q1 = Math.atan2(y, x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
    return [q1, q2];
  }
  function arcPose(p, dsl, dsr, track) {
    var x = p[0], y = p[1], th = p[2], ds = 0.5 * (dsr + dsl), dth = (dsr - dsl) / track;
    if (Math.abs(dth) < 1e-12) return [x + ds * Math.cos(th), y + ds * Math.sin(th), th];
    var R = ds / dth;
    return [x + R * (Math.sin(th + dth) - Math.sin(th)), y - R * (Math.cos(th + dth) - Math.cos(th)), th + dth];
  }
  function radiusMismatch(eps, s, track) { return arcPose([0, 0, 0], s, (1 + eps) * s, track); }
  function slipLateralStd(q, s, track) { return Math.sqrt(2 * q * Math.pow(s, 3) / (3 * track * track)); }
  // control_np: WheelMotor, PID, simulate_speed_loop (quantise optional), step_metrics, lambda_pi
  function motor() {
    var vr = 6.0, ist = 0.8, i0 = 0.15, rpm = 200.0, J = 1.0e-3;
    var R = vr / ist, w0 = rpm * 2 * Math.PI / 60, k = (vr - i0 * R) / w0, b = k * i0 / w0, den = b + k * k / R;
    return { k: k, R: R, b: b, den: den, tau: J / den, K: (k / R) / den, cpr: 1320, umax: 7.0 };
  }
  function lambdaPI(K, tau, tauC) { return { kp: tau / (K * tauC), ti: tau }; }
  function simulateSpeed(kp, ki, kd, o) {
    o = o || {};
    var ts = o.ts || 0.01, delay = (o.delay == null) ? 1 : o.delay, quant = !!o.quantise, tEnd = o.tEnd || 2.0, stepAt = (o.stepAt == null) ? 0.1 : o.stepAt, rr = (o.r == null) ? 3.0 : o.r;
    var windup = o.windup || 'clamp', m = motor(), n = Math.round(tEnd / ts), N = 10.0, umin = -7, umax = 7;
    var kb = (kp && ki) ? ki / kp : 1.0 / ts, I = 0, D = 0, prevY = null;
    var w = 0, rev = 0, counts = 0, last = 0, pending = [], dcount = 2 * Math.PI / m.cpr, t = [], wTrue = [], u = [], yMeas = [];
    for (var i = 0; i < delay; i++) pending.push(0);
    for (var kk = 0; kk < n; kk++) {
      var tk = kk * ts, meas;
      if (quant) { meas = (counts - last) * dcount / ts; last = counts; } else meas = w;
      var r = tk >= stepAt - 1e-12 ? rr : 0.0, e = r - meas, p = kp * e;
      if (kd && kp) { var td = kd / kp, a = td / (td + N * ts), dy = prevY === null ? 0 : meas - prevY; D = a * D - (kp * td * N / (td + N * ts)) * dy; }
      prevY = meas;
      var uRaw = p + I + D, uc = Math.max(umin, Math.min(umax, uRaw));
      if (windup === 'none') I += ki * e * ts;
      else if (windup === 'clamp') { if (uc === uRaw || (uRaw > umax && e < 0) || (uRaw < umin && e > 0)) I += ki * e * ts; }
      else I += (ki * e + kb * (uc - uRaw)) * ts;
      pending.push(uc); var ua = pending.shift();
      var uu = Math.max(-m.umax, Math.min(m.umax, ua)), winf = m.K * uu, w0_ = w, w1 = winf + (w0_ - winf) * Math.exp(-ts / m.tau);
      w = w1; rev += 0.5 * (w0_ + w1) * ts / (2 * Math.PI);
      var nw = rev >= 0 ? Math.floor(rev * m.cpr) : -Math.floor(-rev * m.cpr); counts = nw;
      t.push(tk); wTrue.push(w); u.push(uc); yMeas.push(meas);
    }
    return { t: t, w: wTrue, u: u, y: yMeas };
  }
  function stepMetrics(t, y, r, tol) {
    tol = tol || 0.02; var y0 = y[0], span = r - y0, f = y.map(function (v) { return (v - y0) / span; });
    function first(level) { for (var i = 0; i < f.length; i++) if (f[i] >= level) return t[i]; return NaN; }
    var rise = first(0.9) - first(0.1), fmax = Math.max.apply(null, f), over = Math.max(0, fmax - 1) * 100, last = -1;
    for (var i = 0; i < f.length; i++) if (Math.abs(f[i] - 1) > tol) last = i;
    var settle = last >= 0 ? t[last] - t[0] : 0; if (last === f.length - 1) settle = NaN;
    return { rise: rise, overshoot: over, settle: settle, sse: r - y[y.length - 1] };
  }
  // localize_np: Kalman1D, OccupancyGrid
  function steadyGain(q, r) { var pm = 0.5 * (q + Math.sqrt(q * q + 4 * q * r)); return { k: pm / (pm + r), pminus: pm }; }
  function kalman1d(x0, p0, q, r, zs) {
    var x = x0, p = p0, xs = [], ks = [];
    zs.forEach(function (z) { p += q; var k = p / (p + r); x += k * (z - x); p *= (1 - k); xs.push(x); ks.push(k); });
    return { x: xs, k: ks, p: p };
  }
  function OccGrid(w, h, res) { this.res = res; this.nx = Math.round(w / res); this.ny = Math.round(h / res); this.L = new Float64Array(this.nx * this.ny); this.lo = 0.85; this.lf = -0.4; }
  OccGrid.prototype.cell = function (x, y) { return [Math.floor(y / this.res), Math.floor(x / this.res)]; };
  OccGrid.prototype.clip = function (v) { return Math.max(-5, Math.min(5, v)); };
  OccGrid.prototype.updateRay = function (x, y, th, rng, hit) {
    var n = Math.floor(rng / (this.res * 0.5)), seen = {};
    for (var k = 0; k < n; k++) {
      var s = k * this.res * 0.5, rc = this.cell(x + s * Math.cos(th), y + s * Math.sin(th)), r = rc[0], c = rc[1], key = r + ',' + c;
      if (r >= 0 && r < this.ny && c >= 0 && c < this.nx && !seen[key]) { seen[key] = 1; this.L[r * this.nx + c] = this.clip(this.L[r * this.nx + c] + this.lf); }
    }
    if (hit) {
      var e = this.cell(x + rng * Math.cos(th), y + rng * Math.sin(th)), er = e[0], ec = e[1];
      if (er >= 0 && er < this.ny && ec >= 0 && ec < this.nx) {
        if (seen[er + ',' + ec]) this.L[er * this.nx + ec] -= this.lf;
        this.L[er * this.nx + ec] = this.clip(this.L[er * this.nx + ec] + this.lo);
      }
    }
  };
  OccGrid.prototype.prob = function (i) { return 1 / (1 + Math.exp(-this.L[i])); };
  // planning_np: world, inflation, A*
  var RES = 0.05;
  function makeWorld() {
    var nx = 200, ny = 120, w = new Uint8Array(nx * ny);
    function box(x0, x1, y0, y1) { for (var r = Math.round(y0 / RES); r < Math.round(y1 / RES); r++) for (var c = Math.round(x0 / RES); c < Math.round(x1 / RES); c++) w[r * nx + c] = 1; }
    for (var c = 0; c < nx; c++) { w[c] = 1; w[(ny - 1) * nx + c] = 1; }
    for (var r = 0; r < ny; r++) { w[r * nx] = 1; w[r * nx + nx - 1] = 1; }
    box(2.0, 8.0, 1.4, 2.0); box(2.0, 6.0, 3.6, 4.2); box(6.2, 9.95, 3.6, 4.2);
    return { w: w, nx: nx, ny: ny };
  }
  function inflate(world, radius) {
    var nx = world.nx, ny = world.ny, out = new Uint8Array(nx * ny), rc = radius / RES, lim = rc * rc, m = Math.ceil(rc);
    for (var r = 0; r < ny; r++) for (var c = 0; c < nx; c++) if (world.w[r * nx + c]) {
      for (var dr = -m; dr <= m; dr++) for (var dc = -m; dc <= m; dc++) {
        if (dr * dr + dc * dc < lim) { var rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ny && cc >= 0 && cc < nx) out[rr * nx + cc] = 1; }
      }
    }
    return { w: out, nx: nx, ny: ny };
  }
  var N8 = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, SQ2], [-1, 1, SQ2], [1, -1, SQ2], [1, 1, SQ2]];
  function octile(a, b) { var dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]); return (dx + dy) + (SQ2 - 2.0) * Math.min(dx, dy); }
  function MinHeap() { this.a = []; }
  MinHeap.prototype.less = function (x, y) { return x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && (x[2] < y[2] || (x[2] === y[2] && x[3] < y[3]))))); };
  MinHeap.prototype.push = function (v) { var a = this.a; a.push(v); var i = a.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (this.less(a[i], a[p])) { var t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break; } };
  MinHeap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; var i = 0, n = a.length; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < n && this.less(a[l], a[m])) m = l; if (r < n && this.less(a[r], a[m])) m = r; if (m === i) break; var t = a[i]; a[i] = a[m]; a[m] = t; i = m; } }
    return top;
  };
  function astar(grid, start, goal, weight, zeroH) {
    var nx = grid.nx, ny = grid.ny, blocked = grid.w, g = new Float64Array(nx * ny).fill(Infinity), parent = new Int32Array(nx * ny).fill(-2), closed = new Uint8Array(nx * ny), closedList = [];
    var s = start[0] * nx + start[1]; g[s] = 0; parent[s] = -1;
    var h = new MinHeap(); h.push([weight * (zeroH ? 0 : octile(start, goal)), 0, start[0], start[1]]); var exp = 0;
    while (h.a.length) {
      var it = h.pop(), gu = it[1], r = it[2], c = it[3], u = r * nx + c;
      if (closed[u]) continue; closed[u] = 1; exp++; closedList.push(u);
      if (r === goal[0] && c === goal[1]) { var path = [], p = u; while (p !== -1) { path.push([Math.floor(p / nx), p % nx]); p = parent[p]; } path.reverse(); return { path: path, cost: gu, expanded: exp, closed: closedList }; }
      for (var j = 0; j < 8; j++) {
        var dr = N8[j][0], dc = N8[j][1], w = N8[j][2], rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= ny || cc < 0 || cc >= nx || blocked[rr * nx + cc]) continue;
        if (dr !== 0 && dc !== 0 && (blocked[(r + dr) * nx + c] || blocked[r * nx + c + dc])) continue;
        var ng = gu + w, v = rr * nx + cc;
        if (ng < g[v]) { g[v] = ng; parent[v] = u; h.push([ng + weight * (zeroH ? 0 : octile([rr, cc], goal)), ng, rr, cc]); }
      }
    }
    return { path: null, cost: null, expanded: exp, closed: closedList };
  }

  window.IOT = { divider: divider, ledR: ledR, lsb: lsb, adcCode: adcCode, adcRms: adcRms, alias: alias, debounce: debounce, qosExpectedPackets: qosExpectedPackets, lostFraction: lostFraction,
    threshold: threshold, zscore: zscore, ewma: ewma, cusum: cusum, fk: fk, ik: ik, arcPose: arcPose, radiusMismatch: radiusMismatch, slipLateralStd: slipLateralStd, motor: motor,
    lambdaPI: lambdaPI, simulateSpeed: simulateSpeed, stepMetrics: stepMetrics, steadyGain: steadyGain, kalman1d: kalman1d, OccGrid: OccGrid, makeWorld: makeWorld, inflate: inflate,
    astar: astar, octile: octile };

  // ------------------------------------------------------------------ UI helpers
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function slider(label, min, max, step, value, fmt, onchange) {
    var inp = el('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label }), out = el('output', { text: fmt(value) });
    inp.addEventListener('input', function () { out.textContent = fmt(+inp.value); onchange(); });
    var row = el('label', { class: 'ctl' }, [el('span', { text: label }), inp, out]);
    row.get = function () { return +inp.value; }; row.set = function (v) { inp.value = v; out.textContent = fmt(v); };
    return row;
  }
  function canvas(h) { var c = el('canvas', { width: 360, height: h || 200 }); c.style.width = '100%'; c.style.height = 'auto'; c.style.background = 'var(--surface)'; c.style.border = '1px solid var(--line)'; c.style.borderRadius = '8px'; return c; }
  function plot(cv, series, opt) {
    opt = opt || {}; var g = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 40, r: 8, t: 12, b: 26 };
    g.clearRect(0, 0, W, H);
    var xs = [], ys = []; series.forEach(function (s) { s.x.forEach(function (v) { xs.push(v); }); s.y.forEach(function (v) { if (isFinite(v)) ys.push(v); }); });
    var x0 = opt.xmin != null ? opt.xmin : Math.min.apply(null, xs), x1 = opt.xmax != null ? opt.xmax : Math.max.apply(null, xs), y0 = opt.ymin != null ? opt.ymin : Math.min.apply(null, ys), y1 = opt.ymax != null ? opt.ymax : Math.max.apply(null, ys);
    if (y1 - y0 < 1e-12) { y1 = y0 + 1; } if (x1 - x0 < 1e-12) { x1 = x0 + 1; }
    function X(v) { return m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r); } function Y(v) { return H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b); }
    g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10px sans-serif'; g.lineWidth = 1;
    for (var i = 0; i <= 4; i++) { var yv = y0 + (y1 - y0) * i / 4, xv = x0 + (x1 - x0) * i / 4; g.beginPath(); g.moveTo(m.l, Y(yv)); g.lineTo(W - m.r, Y(yv)); g.stroke(); g.fillText(yv.toPrecision(3), 2, Y(yv) + 3); g.fillText(xv.toPrecision(3), X(xv) - 12, H - 12); }
    (opt.hlines || []).forEach(function (hl) { g.strokeStyle = css('--grey'); g.setLineDash([4, 3]); g.beginPath(); g.moveTo(m.l, Y(hl)); g.lineTo(W - m.r, Y(hl)); g.stroke(); g.setLineDash([]); });
    var cols = [css('--c1'), css('--c4'), css('--c3'), css('--c2'), css('--c5')];
    series.forEach(function (s, k) {
      g.strokeStyle = s.color || cols[k % cols.length]; g.lineWidth = s.dots ? 1 : 1.8;
      if (s.dots) { g.fillStyle = g.strokeStyle; s.x.forEach(function (v, j) { g.beginPath(); g.arc(X(v), Y(s.y[j]), 2, 0, 6.3); g.fill(); }); }
      else { g.beginPath(); s.x.forEach(function (v, j) { if (!isFinite(s.y[j])) return; if (j === 0) g.moveTo(X(v), Y(s.y[j])); else g.lineTo(X(v), Y(s.y[j])); }); g.stroke(); }
      if (s.label) { g.fillStyle = g.strokeStyle; g.fillText(s.label, m.l + 6 + k * 105, m.t + 8); }
    });
    if (opt.xlabel) { g.fillStyle = css('--muted'); g.fillText(opt.xlabel, W - m.r - 5.2 * opt.xlabel.length, H - 2); }
  }
  function card(host, title, unit, blurb) {
    var c = el('div', { class: 'card pgw' }, [el('span', { class: 'num', text: 'UNIT ' + unit }), el('h3', { text: title }), el('p', { text: blurb })]);
    host.appendChild(c); return c;
  }
  function readout(text) { var d = el('div', { class: 'readout' }); d.set = function (t) { d.innerHTML = t; }; d.set(text || ''); return d; }
  function fx(x, n) { return (isFinite(x) ? x.toFixed(n) : 'n/a'); }
  function lcg(seed) { var s = seed >>> 0; return function () { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; }

  // ------------------------------------------------------------------ widgets
  var W = {};
  W.divider = function (host) {
    var c = card(host, 'Voltage divider and LED resistor', 2, 'Output of a divider with and without a load, and the series resistor for an LED. Same equations as circuits_np.divider and led_resistor.');
    var vin = slider('Vin (V)', 1, 12, 0.1, 5, function (v) { return v.toFixed(1); }, upd), r1 = slider('R1 top (kohm)', 1, 100, 1, 10, function (v) { return v + ''; }, upd), r2 = slider('R2 bottom (kohm)', 1, 100, 1, 20, function (v) { return v + ''; }, upd),
      rl = slider('Load across R2 (kohm, 100 = none)', 1, 100, 1, 100, function (v) { return v >= 100 ? 'none' : v + ''; }, upd), vf = slider('LED forward drop (V)', 1.5, 3.2, 0.05, 2.0, function (v) { return v.toFixed(2); }, upd), il = slider('LED current (mA)', 1, 20, 0.5, 10, function (v) { return v.toFixed(1); }, upd);
    var out = readout();
    [vin, r1, r2, rl, vf, il, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var load = rl.get() >= 100 ? null : rl.get() * 1e3, vo = divider(vin.get(), r1.get() * 1e3, r2.get() * 1e3, load);
      out.set('Output = <b>' + fx(vo, 3) + ' V</b>' + (load ? ' (loaded)' : ' (unloaded)') + '; unloaded would be ' + fx(divider(vin.get(), r1.get() * 1e3, r2.get() * 1e3), 3) + ' V.<br>LED resistor from ' + fx(vin.get(), 1) + ' V: <b>' + fx(ledR(vin.get(), vf.get(), il.get() / 1000), 0) + ' ohm</b>.');
    }
    upd();
  };
  W.adc = function (host) {
    var c = card(host, 'ADC quantisation and aliasing', 2, 'Sample a sine of frequency f at fs with an N-bit ADC. The apparent frequency is the alias; the step is the LSB. Ports of circuits_np.lsb, adc_rms_error and sensors_np.alias_frequency.');
    var bits = slider('ADC bits', 2, 12, 1, 4, function (v) { return v + ''; }, upd), f = slider('Signal f (Hz)', 1, 120, 1, 70, function (v) { return v + ''; }, upd), fs = slider('Sample rate fs (Hz)', 20, 200, 1, 100, function (v) { return v + ''; }, upd), cv = canvas(), out = readout();
    [bits, f, fs, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var T = 1.0, N = 600, tt = [], sig = [], st = [], sv = [], vref = 3.3;
      for (var i = 0; i < N; i++) { var t = i * T / N; tt.push(t); sig.push(1.65 + 1.5 * Math.sin(2 * Math.PI * f.get() * t)); }
      for (var k = 0; k * (1 / fs.get()) < T; k++) { var ts = k / fs.get(), v = 1.65 + 1.5 * Math.sin(2 * Math.PI * f.get() * ts); st.push(ts); sv.push((adcCode(v, vref, bits.get()) + 0.5) * lsb(vref, bits.get())); }
      plot(cv, [{ x: tt, y: sig, label: 'signal' }, { x: st, y: sv, dots: true, label: 'samples', color: css('--c4') }], { xlabel: 'time (s)', xmin: 0, xmax: T });
      var al = alias(f.get(), fs.get());
      out.set('LSB = <b>' + fx(lsb(vref, bits.get()) * 1e3, 3) + ' mV</b>, RMS quantisation error = ' + fx(adcRms(vref, bits.get()) * 1e3, 3) + ' mV. Apparent frequency = <b>' + fx(al, 1) + ' Hz</b>' + (f.get() > fs.get() / 2 ? ' (aliased: f is above fs/2 = ' + fx(fs.get() / 2, 1) + ' Hz)' : ' (no aliasing)') + '.');
    }
    upd();
  };
  W.debounce = function (host) {
    var c = card(host, 'Button debounce', 4, 'A bouncing press and release (a seeded random chatter). Counting raw edges overcounts; the debouncer accepts a level only after it is stable for the chosen time (port of node_fsm.Debouncer).');
    var st = slider('Stable time (ms)', 0, 20, 1, 10, function (v) { return v + ''; }, upd), seed = slider('Bounce seed', 1, 50, 1, 7, function (v) { return v + ''; }, upd), cv = canvas(150), out = readout();
    [st, seed, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var rnd = lcg(seed.get() * 7919), dt = 0.05, n = 800, t = [], lv = [], i;
      for (i = 0; i < n; i++) { t.push(i * dt); lv.push((i * dt >= 5 && i * dt < 25) ? 0 : 1); }
      [[5, 0], [25, 1]].forEach(function (e) { var k = 2 + Math.floor(rnd() * 7), times = []; for (var j = 0; j < k; j++) times.push(e[0] + rnd() * 6.0); times.sort(function (a, b) { return a - b; }); times.forEach(function (x) { var w = 0.05 + rnd() * 1.95; for (var q = 0; q < n; q++) if (t[q] >= x && t[q] < x + w) lv[q] = 1 - e[1]; }); });
      var res = debounce(lv, t, st.get());
      plot(cv, [{ x: t, y: lv, label: 'raw level (1 = released)' }], { ymin: -0.1, ymax: 1.1, xlabel: 'time (ms)' });
      out.set('Raw falling edges: <b>' + res.rawEdges + '</b>. Debounced presses: <b>' + res.presses + '</b> (the true number is 1).');
    }
    upd();
  };
  W.qos = function (host) {
    var c = card(host, 'MQTT QoS and packet loss', 5, 'Packets per message and the fraction lost for good with retries, against the packet-loss probability p. Ports of netcalc.qos_expected_packets and the p^n law; a Monte Carlo run checks it.');
    var p = slider('Packet loss p', 0, 0.9, 0.01, 0.1, function (v) { return v.toFixed(2); }, upd), att = slider('Max attempts', 1, 8, 1, 5, function (v) { return v + ''; }, upd), btn = el('button', { type: 'button', class: 'btn small', text: 'Run 20000 messages' }), out = readout(), mc = readout();
    [p, att, btn, out, mc].forEach(function (n) { c.appendChild(n); });
    function upd() {
      out.set('QoS 0: 1 packet, delivered with probability <b>' + fx(1 - p.get(), 3) + '</b>.<br>QoS 1 (unlimited retries): <b>' + fx(qosExpectedPackets(p.get(), 1), 3) + '</b> packets per message; QoS 2: ' + fx(qosExpectedPackets(p.get(), 2), 3) + '.<br>With ' + att.get() + ' attempts a message is lost for good with probability p^' + att.get() + ' = <b>' + (lostFraction(p.get(), att.get()) * 100).toPrecision(3) + '%</b>.');
    }
    btn.addEventListener('click', function () {
      var rnd = lcg(12345), lost = 0, n = 20000, pr = p.get(), A = att.get();
      for (var i = 0; i < n; i++) { var ok = false; for (var k = 0; k < A; k++) if (rnd() >= pr) { ok = true; break; } if (!ok) lost++; }
      mc.set('Simulated: lost ' + (lost / n * 100).toFixed(3) + '% of ' + n + ' messages (formula ' + (lostFraction(pr, A) * 100).toFixed(3) + '%).');
    });
    upd();
  };
  W.detect = function (host) {
    var c = card(host, 'Anomaly detectors', 6, 'A reading with noise and a step in the mean. Threshold (with hysteresis), z-score, EWMA and CUSUM, ported from telemetry_np. Alarms are the vertical ticks.');
    var step = slider('Step size', 0, 4, 0.1, 1.0, function (v) { return v.toFixed(1); }, upd), noise = slider('Noise std', 0.1, 1.5, 0.05, 0.5, function (v) { return v.toFixed(2); }, upd), cv = canvas(), out = readout();
    [step, noise, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var rnd = lcg(99), n = 240, xs = [], t = [];
      function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
      for (var i = 0; i < n; i++) { t.push(i); xs.push(20 + (i >= 120 ? step.get() : 0) + noise.get() * gauss()); }
      var det = { threshold: threshold(17, 22, 0.5, xs), zscore: zscore(60, 3, xs), ewma: ewma(20, noise.get(), 0.1, 3, xs), cusum: cusum(20, 0.5 * Math.max(step.get(), 0.2), 5 * noise.get(), xs) };
      plot(cv, [{ x: t, y: xs, label: 'reading' }], { xlabel: 'sample' });
      var g = cv.getContext('2d'), cols = [css('--c4'), css('--c3'), css('--c2'), css('--c5')], names = Object.keys(det), msg = [];
      names.forEach(function (nm, k) {
        var first = det[nm].slice(120).indexOf(true), fa = det[nm].slice(0, 120).filter(Boolean).length;
        msg.push('<b>' + nm + '</b>: first alarm after the step ' + (first < 0 ? 'never' : first + ' samples') + ', ' + fa + ' alarm samples before it');
        g.fillStyle = cols[k]; det[nm].forEach(function (a, i) { if (a) g.fillRect(40 + i / (n - 1) * (cv.width - 48), cv.height - 34 - k * 4, 1.5, 4); });
      });
      out.set(msg.join('<br>'));
    }
    upd();
  };
  W.arm = function (host) {
    var c = card(host, 'Two-link arm: forward and inverse kinematics', 8, 'Drag the target with the sliders: both inverse solutions (elbow up and down) are drawn. Ports of kinematics_np.fk_2link and ik_2link; links 0.30 m and 0.20 m.');
    var tx = slider('Target x (m)', -0.5, 0.5, 0.005, 0.35, function (v) { return v.toFixed(3); }, upd), ty = slider('Target y (m)', -0.5, 0.5, 0.005, 0.2, function (v) { return v.toFixed(3); }, upd), cv = canvas(250), out = readout();
    [tx, ty, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var l1 = 0.30, l2 = 0.20, g = cv.getContext('2d'), W_ = cv.width, H_ = cv.height, sc = 235, ox = W_ / 2, oy = H_ / 2 + 50; g.clearRect(0, 0, W_, H_);
      function P(x, y) { return [ox + x * sc, oy - y * sc]; }
      g.strokeStyle = css('--line'); g.beginPath(); g.arc(ox, oy, (l1 + l2) * sc, 0, 6.3); g.stroke(); g.beginPath(); g.arc(ox, oy, Math.abs(l1 - l2) * sc, 0, 6.3); g.stroke();
      var tgt = P(tx.get(), ty.get()); g.fillStyle = css('--bad'); g.beginPath(); g.arc(tgt[0], tgt[1], 5, 0, 6.3); g.fill();
      var msg = [];
      ['up', 'down'].forEach(function (e, k) {
        var q = ik(tx.get(), ty.get(), l1, l2, e);
        if (!q) { msg.push('elbow ' + e + ': unreachable'); return; }
        var j = fk(q[0], 0, l1, 0), t2 = fk(q[0], q[1], l1, l2), a = P(0, 0), b = P(j[0], j[1]), d = P(t2[0], t2[1]);
        g.strokeStyle = k ? css('--c4') : css('--c1'); g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.stroke(); g.lineWidth = 1;
        msg.push('elbow ' + e + ': q1 = ' + fx(q[0] * 180 / Math.PI, 2) + ' deg, q2 = ' + fx(q[1] * 180 / Math.PI, 2) + ' deg (forward kinematics gives (' + fx(t2[0], 3) + ', ' + fx(t2[1], 3) + '))');
      });
      out.set(msg.join('<br>'));
    }
    upd();
  };
  W.odo = function (host) {
    var c = card(host, 'Odometry drift', 8, 'A rover drives straight for s metres; the odometry believes it stays on the x axis. A radius error makes it arc away (error grows as s squared); random slip adds a spread that grows as s^1.5. Ports of radius_mismatch_arc and random_slip_lateral_std.');
    var eps = slider('Right-wheel radius error (%)', 0, 2, 0.05, 0.5, function (v) { return v.toFixed(2); }, upd), q = slider('Slip variance q (1e-6 m^2/m)', 0, 20, 0.5, 4, function (v) { return v.toFixed(1); }, upd), cv = canvas(), out = readout();
    [eps, q, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var s = [], err = [], sl = [], i, tr = 0.16;
      for (i = 1; i <= 40; i++) { var d = i * 0.5, p = radiusMismatch(eps.get() / 100, d, tr); s.push(d); err.push(Math.hypot(p[0] - d, p[1])); sl.push(slipLateralStd(q.get() * 1e-6, d, tr)); }
      plot(cv, [{ x: s, y: err, label: 'radius error' }, { x: s, y: sl, label: 'slip (1 sigma)' }, { x: s, y: s.map(function (v) { return 0.1 * v; }), label: '10% of distance', color: css('--grey') }], { xlabel: 'distance (m)' });
      out.set('At 20 m: radius error gives <b>' + fx(err[39], 2) + ' m</b> (' + fx(err[39] / 20 * 100, 1) + '% of distance); random slip alone <b>' + fx(sl[39], 2) + ' m</b> (1 sigma).');
    }
    upd();
  };
  W.pid = function (host) {
    var c = card(host, 'PID tuner on the wheel motor', 9, 'Step the wheel speed 3 rad/s and tune a PI/PID: the sampled motor, one sample of delay and the 7 V limit of Unit 9 (ports of control_np.WheelMotor, PID, step_metrics).');
    var kp = slider('Kp (V per rad/s)', 0.1, 4, 0.05, 1.07, function (v) { return v.toFixed(2); }, upd), ti = slider('Ti (ms, 0 = P only)', 0, 300, 1, 112, function (v) { return v === 0 ? 'off' : v + ''; }, upd), td = slider('Td (ms)', 0, 20, 0.5, 0, function (v) { return v + ''; }, upd),
      dl = slider('Delay (samples)', 0, 3, 1, 1, function (v) { return v + ''; }, upd), cv = canvas(), out = readout(), btn = el('button', { type: 'button', class: 'btn small', text: 'Lambda design (tau_c = 30 ms)' });
    [kp, ti, td, dl, btn, cv, out].forEach(function (n) { c.appendChild(n); });
    btn.addEventListener('click', function () { var m = motor(), l = lambdaPI(m.K, m.tau, 0.03); kp.set(Math.round(l.kp * 100) / 100); ti.set(Math.round(l.ti * 1000)); td.set(0); upd(); });
    function upd() {
      var ki = ti.get() > 0 ? kp.get() / (ti.get() / 1000) : 0, kd = kp.get() * td.get() / 1000, sim = simulateSpeed(kp.get(), ki, kd, { delay: dl.get(), tEnd: 1.5, quantise: false }), m = stepMetrics(sim.t.slice(10), sim.w.slice(10), 3.0);
      plot(cv, [{ x: sim.t, y: sim.w, label: 'speed (rad/s)' }, { x: sim.t, y: sim.u, label: 'voltage (V)', color: css('--c4') }], { xlabel: 'time (s)', hlines: [3.0] });
      out.set('Rise <b>' + (isFinite(m.rise) ? fx(m.rise * 1000, 0) + ' ms' : 'never') + '</b>, overshoot <b>' + fx(m.overshoot, 1) + '%</b>, settling <b>' + (isFinite(m.settle) ? fx(m.settle * 1000, 0) + ' ms' : 'does not settle') + '</b>, final error ' + fx(m.sse, 3) + ' rad/s, peak voltage ' + fx(Math.max.apply(null, sim.u), 2) + ' V.');
    }
    upd();
  };
  W.kalman = function (host) {
    var c = card(host, 'Kalman filter in one dimension', 10, 'A drifting level measured with noise. The filter against the raw readings and a fixed-gain EMA; the steady-state gain in closed form (ports of Kalman1D and steady_state_gain).');
    var q = slider('Process variance q (log10)', -6, -2, 0.1, -4, function (v) { return '1e' + v.toFixed(1); }, upd), r = slider('Measurement std', 0.02, 0.5, 0.01, 0.1, function (v) { return v.toFixed(2); }, upd), cv = canvas(), out = readout();
    [q, r, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var rnd = lcg(5), n = 300, x = 0.5, truth = [], z = [], t = [], Q = Math.pow(10, q.get()), R = r.get() * r.get();
      function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
      for (var i = 0; i < n; i++) { x += Math.sqrt(Q) * gauss(); truth.push(x); z.push(x + r.get() * gauss()); t.push(i); }
      var kf = kalman1d(z[0], 1.0, Q, R, z), sg = steadyGain(Q, R), ema = [z[0]], a = sg.k;
      for (i = 1; i < n; i++) ema.push(ema[i - 1] + a * (z[i] - ema[i - 1]));
      function rmse(v) { var s = 0, c0 = 0; for (var j = 100; j < n; j++) { s += (v[j] - truth[j]) * (v[j] - truth[j]); c0++; } return Math.sqrt(s / c0); }
      plot(cv, [{ x: t, y: z, dots: true, label: 'readings', color: css('--grey') }, { x: t, y: truth, label: 'truth', color: css('--ink') }, { x: t, y: kf.x, label: 'Kalman' }], { xlabel: 'sample' });
      out.set('Steady-state gain <b>' + fx(sg.k, 4) + '</b> (the EMA with alpha = ' + fx(a, 3) + ' is the same filter). RMSE after sample 100: raw ' + fx(rmse(z), 4) + ', Kalman ' + fx(rmse(kf.x), 4) + ', EMA ' + fx(rmse(ema), 4) + '.');
    }
    upd();
  };
  W.grid = function (host) {
    var c = card(host, 'Occupancy grid from range beams', 10, 'A rover at the centre of a walled room scans 24 beams; log-odds update each cell (free -0.4, occupied +0.85). More scans make the walls firmer. Port of localize_np.OccupancyGrid.');
    var scans = slider('Scans', 1, 12, 1, 3, function (v) { return v + ''; }, upd), noise = slider('Range noise (cm)', 0, 6, 0.5, 2, function (v) { return v.toFixed(1); }, upd), cv = canvas(340), out = readout();
    [scans, noise, cv, out].forEach(function (n) { c.appendChild(n); });
    function upd() {
      var res = 0.05, g = new OccGrid(3.0, 3.0, res), rnd = lcg(3);
      function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
      for (var s = 0; s < scans.get(); s++) for (var b = 0; b < 24; b++) {
        var th = b * 2 * Math.PI / 24 + 0.01 * s, dx = Math.cos(th), dy = Math.sin(th), tx = dx > 0 ? (3.0 - 1.5) / dx : dx < 0 ? (0 - 1.5) / dx : 1e9, ty = dy > 0 ? (3.0 - 1.5) / dy : dy < 0 ? (0 - 1.5) / dy : 1e9, rng = Math.min(tx, ty) + noise.get() / 100 * gauss();
        g.updateRay(1.5, 1.5, th, Math.max(rng, 0.1), true);
      }
      var cg = cv.getContext('2d'), size = cv.width - 40, cs = size / g.nx, occ = 0, free = 0; cg.clearRect(0, 0, cv.width, cv.height);
      for (var r = 0; r < g.ny; r++) for (var cc = 0; cc < g.nx; cc++) {
        var p = g.prob(r * g.nx + cc), v = p > 0.65 ? 0 : p < 0.35 ? 255 : 150; if (p > 0.65) occ++; else if (p < 0.35) free++;
        cg.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; cg.fillRect(20 + cc * cs, 8 + (g.ny - 1 - r) * cs, cs + 0.5, cs + 0.5);
      }
      out.set('After ' + scans.get() + ' scan(s): <b>' + occ + '</b> occupied cells, <b>' + free + '</b> free, ' + (g.nx * g.ny - occ - free) + ' unknown (black = occupied, white = free, grey = unknown).');
    }
    upd();
  };
  W.astar = function (host) {
    var c = card(host, 'A* on the greenhouse', 11, 'The 10 m by 6 m greenhouse of Units 11 and 12, inflated by the rover (0.175 m). Choose the goal and the weight w: cells expanded and path length. A port of planning_np.astar; w = 1 is optimal.');
    var goal = el('select', { 'aria-label': 'goal' }, [['P1', 'Plant P1'], ['P2', 'Plant P2'], ['P3', 'Plant P3'], ['P4', 'Plant P4']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    goal.value = 'P4';
    var w = slider('Weight w on the heuristic', 1, 10, 0.5, 1, function (v) { return v.toFixed(1); }, upd), zero = el('input', { type: 'checkbox', id: 'astar-zero' }), zl = el('label', {}, [zero, el('span', { text: ' h = 0 (Dijkstra)' })]), cv = canvas(225), out = readout();
    var world = makeWorld(), infl = inflate(world, 0.175), P = { P1: [5.0, 0.9], P2: [9.2, 2.8], P3: [3.0, 2.8], P4: [6.0, 5.0] };
    [goal, w, zl, cv, out].forEach(function (n) { c.appendChild(n); });
    goal.addEventListener('change', upd); zero.addEventListener('change', upd);
    function upd() {
      var gp = P[goal.value], start = [Math.floor(0.6 / RES), Math.floor(0.6 / RES)], gl = [Math.floor(gp[1] / RES), Math.floor(gp[0] / RES)], res = astar(infl, start, gl, w.get(), zero.checked);
      var g = cv.getContext('2d'), cs = (cv.width - 20) / infl.nx, x0 = 10, y0 = 5; g.clearRect(0, 0, cv.width, cv.height);
      for (var r = 0; r < infl.ny; r++) for (var cc = 0; cc < infl.nx; cc++) { var o = world.w[r * infl.nx + cc], i = infl.w[r * infl.nx + cc]; g.fillStyle = o ? '#000' : i ? '#777' : '#fff'; g.fillRect(x0 + cc * cs, y0 + (infl.ny - 1 - r) * cs, cs + 0.4, cs + 0.4); }
      g.fillStyle = 'rgba(31,95,191,0.25)'; res.closed.forEach(function (u) { var r = Math.floor(u / infl.nx), cc = u % infl.nx; g.fillRect(x0 + cc * cs, y0 + (infl.ny - 1 - r) * cs, cs + 0.4, cs + 0.4); });
      if (res.path) { g.strokeStyle = css('--bad'); g.lineWidth = 2; g.beginPath(); res.path.forEach(function (p, k) { var X = x0 + (p[1] + 0.5) * cs, Y = y0 + (infl.ny - 1 - p[0] + 0.5) * cs; if (k) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); g.lineWidth = 1; }
      out.set(res.path ? 'Path length <b>' + fx(res.cost * RES, 3) + ' m</b>, cells expanded <b>' + res.expanded + '</b> of ' + (infl.w.length - infl.w.reduce(function (a, b) { return a + b; }, 0)) + ' free cells (blue wash: expanded; grey: inflated margin).' : 'No path.');
    }
    upd();
  };
  var ORDER = ['divider', 'adc', 'debounce', 'qos', 'detect', 'arm', 'odo', 'pid', 'kalman', 'grid', 'astar'];
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.getElementById('widgets'); if (!host) return;
    ORDER.forEach(function (k) { try { W[k](host); } catch (e) { host.appendChild(el('div', { class: 'box warn', text: 'Widget ' + k + ' failed: ' + e.message })); } });
  });
})();
