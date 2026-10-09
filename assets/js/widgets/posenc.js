// Sinusoidal positional encoding: matrix and PE[p].PE[p+k] vs offset k (depends on k only).
export function pe(n, d) { const m = []; for (let p = 0; p < n; p++) { const r = new Array(d); for (let i = 0; i < d / 2; i++) { const a = p / Math.pow(10000, (2 * i) / d); r[2 * i] = Math.sin(a); r[2 * i + 1] = Math.cos(a); } m.push(r); } return m; }
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export default {
  id: "posenc", unit: "u2", group: "Unit 2 · Transformers", title: "Positional encoding",
  blurb: "Attention cannot see word order by itself. Positional encoding adds a unique pattern of waves to each position.",
  what: "Left: one row per position, one column per dimension (red = +1, blue = −1). Early columns wobble fast, late columns slowly. Right: how similar position p is to position p+k. The curve depends only on the gap k, not on where you start.",
  tryit: "Move 'Start position' and watch the right curve stay exactly the same (the dots always sit on the line). Make the width smaller and see the curve get rougher. At gap 0 the value always equals half the width.",
  params: [
    { key: "d", label: "Vector width d", type: "select", value: "64", options: [["16", "16"], ["32", "32"], ["64", "64"], ["128", "128"]], help: "How many numbers describe each position. Real models use 768 to 12,000+." },
    { key: "n", label: "Number of positions", type: "range", min: 16, max: 128, step: 8, value: 64, unit: "tokens", help: "How many positions the matrix shows." },
    { key: "p", label: "Start position p", type: "range", min: 0, max: 100, step: 1, value: 30, help: "Compare this position with the ones after it. Changing it should not change the curve." },
    { key: "kmax", label: "Largest gap k", type: "range", min: 10, max: 120, step: 5, value: 60, unit: "tokens", help: "How far ahead to compare." },
  ],
  presets: [["Small width (16)", { d: "16", kmax: 60 }], ["Typical (64)", { d: "64", n: 64 }], ["Long gaps", { d: "64", kmax: 120, p: 5 }]],
  draw(ctx, p, S) {
    const d = +p.d, n = Math.round(p.n), P0 = Math.round(p.p), K = Math.round(p.kmax), M = pe(Math.max(n, P0 + K + 1), d);
    const lx = 40, ty = 40, lw = S.w * 0.34, lh = S.h - ty - 84;
    ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.textAlign = "left"; ctx.fillText("PE matrix", lx, 24);
    const cw = lw / d, ch = lh / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < d; c++) { const v = M[r][c]; ctx.fillStyle = v >= 0 ? `rgba(213,94,0,${v})` : `rgba(0,114,178,${-v})`; ctx.fillRect(lx + c * cw, ty + r * ch, cw + 0.5, ch + 0.5); }
    if (P0 < n) { ctx.strokeStyle = S.ink; ctx.lineWidth = 2; ctx.strokeRect(lx - 1, ty + P0 * ch - 1, lw + 2, ch + 2); ctx.lineWidth = 1; }
    ctx.fillStyle = S.muted; ctx.font = "12px system-ui"; ctx.fillText("dimension →", lx, ty + lh + 16); ctx.save(); ctx.translate(14, ty + lh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("position →", -20, 0); ctx.restore();
    // right panel
    const rx = lx + lw + 50, rw = S.w - rx - 16, ry = ty, rh = lh, ymax = d / 2, ymin = Math.min(...Array.from({ length: K + 1 }, (_, k) => dot(M[0], M[k])), 0) - 1;
    ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText("similarity of p and p + k", rx, 24);
    const X = (k) => rx + (k / K) * rw, Y = (v) => ry + rh - ((v - ymin) / (ymax - ymin)) * rh;
    ctx.strokeStyle = S.line; ctx.strokeRect(rx, ry, rw, rh); ctx.fillStyle = S.muted; ctx.textAlign = "right";
    for (let g = 0; g <= 4; g++) { const v = ymin + ((ymax - ymin) * g) / 4; ctx.fillText(v.toFixed(0), rx - 6, Y(v) + 4); ctx.beginPath(); ctx.moveTo(rx, Y(v)); ctx.lineTo(rx + rw, Y(v)); ctx.stroke(); }
    ctx.textAlign = "left"; ctx.fillText("gap k →", rx, ry + rh + 16);
    ctx.strokeStyle = S.c[0]; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k <= K; k++) { const v = dot(M[0], M[k]); k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v)); } ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = S.c[3]; let maxdiff = 0; for (let k = 0; k <= K; k += 2) { const v = dot(M[P0], M[P0 + k]); maxdiff = Math.max(maxdiff, Math.abs(v - dot(M[0], M[k]))); ctx.beginPath(); ctx.arc(X(k), Y(v), 3.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = S.c[0]; ctx.fillText("line: p = 0", rx, ry + rh + 34); ctx.fillStyle = S.c[3]; ctx.fillText(`dots: p = ${P0}`, rx + 128, ry + rh + 34);
    ctx.fillStyle = S.ink; ctx.fillText(`largest difference between them: ${maxdiff.toExponential(1)}`, lx, ry + rh + 52); ctx.fillText(`similarity at gap 0 is always d/2 = ${d / 2}`, lx, ry + rh + 70);
  },
};
