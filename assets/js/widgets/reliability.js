// Agent reliability calculator: mirrors chain_success and step_success_with_retry in agents_np.py.
export const chainSuccess = (eps, k) => (1 - eps) ** k;
export const stepSuccess = (eps, q, c, retries) => { const d = eps * (q + (1 - q) * c); let s = 0; for (let j = 0; j <= retries; j++) s += d ** j; return (1 - eps) * s; };
export default {
  id: "reliability", unit: "u8", group: "Unit 8 · Agents", title: "Agent reliability calculator",
  blurb: "Agents chain many steps, and errors multiply. See how fast success falls, and how retries and verification change it.",
  what: "The curve shows the chance that a task with k steps works from start to finish. The dashed curve is an agent with no safeguards; the solid one uses your settings. The marker shows your chosen task length.",
  tryit: "Per-step error 5%, 10 steps: only about 60% of tasks succeed. Now set 'catches silent mistakes' to 100%: success jumps to nearly 100%. Set it to 50% and see the middle ground. Safeguards only help against mistakes they can actually detect.",
  params: [
    { key: "eps", label: "Chance one step goes wrong", type: "range", min: 0, max: 0.3, step: 0.005, value: 0.05, help: "Per-step error probability of the model." },
    { key: "k", label: "Steps in the task", type: "range", min: 1, max: 30, step: 1, value: 10, unit: "steps", help: "How many tool calls the task needs." },
    { key: "q", label: "Share of mistakes that break the format", type: "range", min: 0, max: 1, step: 0.05, value: 0.5, help: "Format errors are always caught by the parser; the rest are silent wrong results." },
    { key: "c", label: "Share of silent mistakes a checker catches", type: "range", min: 0, max: 1, step: 0.05, value: 0, help: "0 = no verification. 1 = a perfect independent check." },
    { key: "r", label: "Retries allowed per step", type: "range", min: 0, max: 5, step: 1, value: 2, unit: "retries", help: "How many times a caught mistake may be redone." },
  ],
  presets: [["No safeguards", { c: 0, r: 0 }], ["Retry format errors only", { c: 0, r: 3 }], ["Plus a perfect checker", { c: 1, r: 3 }], ["Long task (25 steps)", { k: 25 }]],
  draw(ctx, p, S) {
    const L = 52, R = 18, T = 70, B = 44, W = S.w - L - R, H = S.h - T - B, K = 30, X = (k) => L + ((k - 1) / (K - 1)) * W, Y = (v) => T + H * (1 - v), s1 = stepSuccess(p.eps, p.q, p.c, Math.round(p.r)), here = s1 ** Math.round(p.k), bare = chainSuccess(p.eps, Math.round(p.k));
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; let y = S.wrap(`A ${Math.round(p.k)}-step task succeeds ${(100 * here).toFixed(1)}% of the time (without safeguards: ${(100 * bare).toFixed(1)}%)`, 14, 24, S.w - 28, 18);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; ctx.fillText(`per-step success with your safeguards: ${(100 * s1).toFixed(2)}%`, 14, y + 2);
    ctx.strokeStyle = S.line; ctx.textAlign = "right"; for (let g = 0; g <= 5; g++) { const v = g / 5; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(S.w - R, Y(v)); ctx.stroke(); ctx.fillStyle = S.muted; ctx.fillText(v.toFixed(1), L - 6, Y(v) + 4); }
    ctx.textAlign = "center"; for (const k of [1, 10, 20, 30]) ctx.fillText(String(k), X(k), T + H + 16); ctx.fillText("steps in the task", L + W / 2, T + H + 34);
    const curve = (f, col, dash) => { ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 1; k <= K; k++) { k === 1 ? ctx.moveTo(X(k), Y(f(k))) : ctx.lineTo(X(k), Y(f(k))); } ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; };
    curve((k) => chainSuccess(p.eps, k), S.bad, [6, 4]); curve((k) => s1 ** k, S.good, []);
    ctx.fillStyle = S.ink; ctx.beginPath(); ctx.arc(X(Math.round(p.k)), Y(here), 5, 0, 7); ctx.fill();
  },
};
