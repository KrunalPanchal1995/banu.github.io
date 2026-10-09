// Majority vote (self-consistency): exact binomial tail A_k(p) and a Monte-Carlo check, mirroring majority_vote_accuracy in prompting_tools.py.
export function majority(p, k) { let s = 0, c = 1; for (let j = 0; j <= k; j++) { if (j > 0) c = (c * (k - j + 1)) / j; if (j > k / 2) s += c * Math.pow(p, j) * Math.pow(1 - p, k - j); } return s; }
export default {
  id: "vote", unit: "u4", group: "Unit 4 · Prompting", title: "Majority vote (self-consistency)",
  blurb: "Ask the model k times and take the most common answer. Does that improve accuracy? It depends on one number: how often a single answer is right.",
  what: "The line is the exact accuracy of the majority answer for k = 1, 3, 5 … The dots are a random simulation to check the formula. The dashed line is the accuracy of one single answer (k = 1).",
  tryit: "Set the single-answer accuracy to 0.6 and watch voting climb. Move it to 0.5: the line goes flat. Move it to 0.4: voting makes things WORSE. Remember the formula assumes the answers are independent; real model samples are not, so real gains are smaller.",
  params: [
    { key: "p", label: "Accuracy of ONE answer", type: "range", min: 0.05, max: 0.95, step: 0.05, value: 0.6, help: "How often a single sample is correct." },
    { key: "k", label: "Most answers voted over", type: "range", min: 1, max: 51, step: 2, value: 21, unit: "answers", help: "The curve is drawn for 1, 3, 5, … up to this number." },
    { key: "sim", label: "Show simulation dots", type: "select", value: "yes", options: [["yes", "Yes"], ["no", "No"]], help: "Random trials that should land on the line." },
    { key: "trials", label: "Simulation trials per dot", type: "range", min: 100, max: 5000, step: 100, value: 1000, unit: "trials", help: "More trials = dots closer to the line." },
  ],
  presets: [["Helps (p = 0.6)", { p: 0.6 }], ["No change (p = 0.5)", { p: 0.5 }], ["Hurts (p = 0.4)", { p: 0.4 }], ["Strong model (p = 0.8)", { p: 0.8 }]],
  draw(ctx, p, S) {
    const K = p.k % 2 === 0 ? p.k + 1 : p.k, L = 56, R = 20, T = 100, B = 46, W = S.w - L - R, H = S.h - T - B, X = (k) => L + ((k - 1) / Math.max(1, K - 1)) * W, Y = (v) => T + H * (1 - v);
    const fin = majority(p.p, K), verdict = p.p > 0.5 ? "voting helps" : p.p < 0.5 ? "voting HURTS" : "voting changes nothing";
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText(`One answer: ${(p.p * 100).toFixed(0)}% right.  Majority of ${K}: ${(fin * 100).toFixed(1)}% right.`, 16, 26);
    ctx.fillStyle = p.p > 0.5 ? S.good : p.p < 0.5 ? S.bad : S.muted; ctx.fillText(`→ ${verdict}`, 16, 46);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; S.wrap("Exact formula for independent answers whose mistakes do not agree with each other.", 16, 66, S.w - 32, 16);
    ctx.strokeStyle = S.line; ctx.textAlign = "right";
    for (let g = 0; g <= 5; g++) { const v = g / 5; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(S.w - R, Y(v)); ctx.stroke(); ctx.fillStyle = S.muted; ctx.fillText(v.toFixed(1), L - 6, Y(v) + 4); }
    ctx.textAlign = "center"; for (const k of [1, Math.round((K + 1) / 2) | 1, K]) ctx.fillText(String(k), X(k), T + H + 18); ctx.fillText("number of answers voted over (k)", L + W / 2, T + H + 36);
    ctx.strokeStyle = S.grey; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(L, Y(p.p)); ctx.lineTo(L + W, Y(p.p)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = S.c[0]; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 1; k <= K; k += 2) { k === 1 ? ctx.moveTo(X(k), Y(majority(p.p, k))) : ctx.lineTo(X(k), Y(majority(p.p, k))); } ctx.stroke(); ctx.lineWidth = 1;
    if (p.sim === "yes") { const rnd = S.rng(5), N = Math.round(p.trials); ctx.fillStyle = S.c[3]; for (let k = 1; k <= K; k += 2) { if (K > 21 && ((k - 1) / 2) % 3) continue; let ok = 0; for (let t = 0; t < N; t++) { let c = 0; for (let j = 0; j < k; j++) c += rnd() < p.p; ok += c > k / 2; } ctx.beginPath(); ctx.arc(X(k), Y(ok / N), 3.6, 0, 7); ctx.fill(); } }
    ctx.textAlign = "left"; ctx.fillStyle = S.grey; ctx.fillText("one answer", L + 6, Y(p.p) - 6);
  },
};
