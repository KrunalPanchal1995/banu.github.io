// Diffusion denoiser running the REAL network trained in NumPy (codes/multimodal/multimodal_np): DDIM sampling with classifier-free guidance.
import WEIGHTS from "./diffusion_weights.js";
const [D, K, T, TEMB] = WEIGHTS.meta, NL = WEIGHTS.W.length;
export function schedule() { const ab = []; let p = 1; for (let t = 0; t < T; t++) { p *= 1 - (1e-4 + ((0.02 - 1e-4) * t) / (T - 1)); ab.push(p); } return ab; }
const AB = schedule();
export function tembed(t) { const out = new Array(TEMB), h = TEMB / 2; for (let i = 0; i < h; i++) { const f = Math.exp((Math.log(100) * i) / (h - 1)), a = 2 * Math.PI * (t / T) * f; out[i] = Math.sin(a); out[h + i] = Math.cos(a); } return out; }
export function eps(x, t, c) {                                   // x: [x0, x1]; c in 0..K (K = null)
  let a = [...x, ...tembed(t), ...Array.from({ length: K + 1 }, (_, i) => (i === c ? 1 : 0))];
  for (let l = 0; l < NL; l++) { const W = WEIGHTS.W[l], b = WEIGHTS.b[l], out = b.slice(); for (let i = 0; i < a.length; i++) { const ai = a[i], row = W[i]; for (let j = 0; j < out.length; j++) out[j] += ai * row[j]; } a = l < NL - 1 ? out.map(Math.tanh) : out; }
  return a;
}
const guided = (x, t, c, w) => { if (c === null) return eps(x, t, K); const ec = eps(x, t, c); if (w === 0) return ec; const eu = eps(x, t, K); return ec.map((v, i) => (1 + w) * v - w * eu[i]); };
const halfEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };   // numpy rounds half to even
export const ddimSteps = (steps) => { const s = new Set(); for (let i = 0; i < steps; i++) s.add(halfEven(((T - 1) * (steps - 1 - i)) / Math.max(steps - 1, 1))); return [...s].sort((a, b) => b - a); };
export function ddim(xT, steps, c, w) {                          // returns the list of states after every step (deterministic, eta = 0)
  const ts = ddimSteps(steps); let x = xT.map((p) => [...p]); const states = [x.map((p) => [...p])];
  ts.forEach((t, i) => { const ab = AB[t], abp = i + 1 < ts.length ? AB[ts[i + 1]] : 1; x = x.map((p) => { const e = guided(p, t, c, w), x0 = p.map((v, k) => (v - Math.sqrt(1 - ab) * e[k]) / Math.sqrt(ab)); return p.map((_, k) => Math.sqrt(abp) * x0[k] + Math.sqrt(Math.max(1 - abp, 0)) * e[k]); }); states.push(x.map((p) => [...p])); });
  return states;
}
const cache = new Map(); const COLS = ["c0", "c1", "c2"];
export default {
  id: "diffusion", unit: "u7", group: "Unit 7 · Multimodal", title: "Diffusion denoiser (real model)",
  blurb: "A small diffusion model, trained in NumPy on three arcs, runs in your browser. Watch random noise turn into data, and see what guidance and the number of steps do.",
  what: "Grey dots: the real data (three arcs). Coloured dots: points produced by the model. At 0% they are pure noise; drag the progress slider to 100% to see them denoised. Each step asks the network 'which part of this is noise?' and removes some of it.",
  tryit: "Use 50 steps and sweep progress from 0 to 100%. Then set steps to 3: the result is a mess (worse than noise). Pick class 1 and raise guidance: the points hug the middle of the arc (less variety) and a few fly off the circle at very high guidance.",
  params: [
    { key: "cls", label: "Which arc to draw (the 'prompt')", type: "select", value: "0", options: [["0", "Arc 0"], ["1", "Arc 1"], ["2", "Arc 2"], ["none", "Any arc (no prompt)"]], help: "The label given to the model, like a text prompt in text-to-image." },
    { key: "w", label: "Guidance strength w", type: "range", min: 0, max: 8, step: 0.5, value: 0, help: "0 = plain conditional model. Higher = follow the prompt harder, with less variety." },
    { key: "steps", label: "Denoising steps", type: "range", min: 2, max: 100, step: 1, value: 50, unit: "steps", help: "Fewer steps = faster but cruder (DDIM sampler)." },
    { key: "prog", label: "Progress through denoising", type: "range", min: 0, max: 100, step: 1, value: 100, unit: "%", help: "0% = pure noise, 100% = finished samples." },
    { key: "n", label: "Number of points", type: "range", min: 50, max: 400, step: 50, value: 250, unit: "points", help: "More points show the shape better but take longer to compute." },
    { key: "seed", label: "Random seed", type: "range", min: 1, max: 20, step: 1, value: 3, help: "Different starting noise." },
  ],
  presets: [["Good samples", { steps: 50, w: 0, prog: 100 }], ["Too few steps", { steps: 3, prog: 100 }], ["Strong guidance", { cls: "1", w: 6, prog: 100 }], ["Start from noise", { prog: 0 }]],
  draw(ctx, p, S) {
    const n = Math.round(p.n), steps = Math.round(p.steps), c = p.cls === "none" ? null : +p.cls, key = [n, steps, p.cls, p.w, p.seed].join("/");
    if (!cache.has(key)) { if (cache.size > 6) cache.clear(); const r = S.rng(p.seed * 31 + 1), nrm = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); cache.set(key, ddim(Array.from({ length: n }, () => [nrm(), nrm()]), steps, c, +p.w)); }
    const st = cache.get(key), idx = Math.round((p.prog / 100) * (st.length - 1)), pts = st[idx], side = Math.min(S.w - 20, S.h - 70), x0 = (S.w - side) / 2, y0 = 56, lim = 5, X = (v) => x0 + ((v + lim) / (2 * lim)) * side, Y = (v) => y0 + side - ((v + lim) / (2 * lim)) * side;
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText(`Step ${idx} of ${st.length - 1} · ${p.cls === "none" ? "any arc" : "arc " + p.cls} · guidance ${p.w}`, 14, 24);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; ctx.fillText("grey = real data, coloured = model output", 14, 42);
    ctx.strokeStyle = S.line; ctx.strokeRect(x0, y0, side, side); const r2 = S.rng(77);
    for (let i = 0; i < 600; i++) { const cl = Math.floor(r2() * 3), a = ((cl * 120 + 10 + 100 * r2()) * Math.PI) / 180, rr = 2 + 0.12 * Math.sqrt(-2 * Math.log(r2() + 1e-12)) * Math.cos(2 * Math.PI * r2()); ctx.fillStyle = S.grey; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(X(rr * Math.cos(a)), Y(rr * Math.sin(a)), 1.8, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.9; ctx.fillStyle = c === null ? S.c[0] : S.c[c % 5]; for (const q of pts) { ctx.beginPath(); ctx.arc(X(Math.max(-lim, Math.min(lim, q[0]))), Y(Math.max(-lim, Math.min(lim, q[1]))), 2.6, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  },
};
