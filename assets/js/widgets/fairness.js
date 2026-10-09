// Fairness explorer: exact threshold-classifier metrics per group (Gaussian scores), mirrors group_metrics / parity_gaps in evaluation_np.py.
export function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); if (x > 6) return s; let term = x, sum = x; for (let n = 1; n < 120; n++) { term *= (-x * x) / n; sum += term / (2 * n + 1); } return (s * 2 * sum) / Math.sqrt(Math.PI); }
const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
export function groupMetrics(prev, mu0, mu1, thr) { const tpr = 1 - cdf(thr - mu1), fpr = 1 - cdf(thr - mu0), sel = prev * tpr + (1 - prev) * fpr; return { tpr, fpr, selection: sel, accuracy: prev * tpr + (1 - prev) * (1 - fpr), precision: sel ? (prev * tpr) / sel : NaN }; }
export const gaps = (a, b) => ({ dp: Math.abs(a.selection - b.selection), eo: Math.abs(a.tpr - b.tpr), eodds: Math.max(Math.abs(a.tpr - b.tpr), Math.abs(a.fpr - b.fpr)) });
export default {
  id: "fairness", unit: "u9", group: "Unit 9 · Evaluation & safety", title: "Fairness explorer",
  blurb: "One classifier, two groups. Overall accuracy can look fine while the groups are treated very differently. Change the base rates, the signal quality and the decision thresholds and watch the gaps.",
  what: "Orange and blue bars: accuracy, true positive rate (share of real positives found), false positive rate (share of real negatives wrongly flagged) and selection rate (share flagged) for each group. The gaps below summarise the differences; 0 means equal.",
  tryit: "Start with the default: group B has a lower base rate and a noisier signal, so with one shared threshold its true positive rate is lower. Choose 'separate thresholds' and lower B's threshold until the true positive rates match: see what happens to B's false positive rate. You cannot equalise everything at once when base rates differ.",
  params: [
    { key: "prevA", label: "Group A: base rate of positives", type: "range", min: 0.05, max: 0.95, step: 0.05, value: 0.5, help: "Share of group A that truly is positive." },
    { key: "prevB", label: "Group B: base rate of positives", type: "range", min: 0.05, max: 0.95, step: 0.05, value: 0.2, help: "Share of group B that truly is positive." },
    { key: "sepA", label: "Group A: signal quality", type: "range", min: 0.2, max: 4, step: 0.1, value: 2, help: "How far apart positives and negatives score (bigger = easier)." },
    { key: "sepB", label: "Group B: signal quality", type: "range", min: 0.2, max: 4, step: 0.1, value: 1.2, help: "Smaller if the data about group B is noisier or less relevant." },
    { key: "thr", label: "Decision threshold for group A", type: "range", min: -2, max: 2, step: 0.05, value: 0, help: "Score needed to be flagged positive." },
    { key: "mode", label: "Threshold for group B", type: "select", value: "same", options: [["same", "Same as group A"], ["own", "Its own (set below)"]], help: "Use separate thresholds to trade one fairness measure against another." },
    { key: "thrB", label: "Group B's own threshold", type: "range", min: -2, max: 2, step: 0.05, value: -0.4, help: "Only used when 'its own' is selected." },
  ],
  presets: [["Shared threshold", { mode: "same", thr: 0 }], ["Equal true positive rates", { mode: "own", thrB: -0.4 }], ["Equal base rates", { prevB: 0.5, sepB: 2, mode: "same" }], ["Noisier data for B", { sepB: 0.6, mode: "same" }]],
  draw(ctx, p, S) {
    const a = groupMetrics(p.prevA, -p.sepA / 2, p.sepA / 2, p.thr), tB = p.mode === "own" ? p.thrB : p.thr, b = groupMetrics(p.prevB, -p.sepB / 2, p.sepB / 2, tB), g = gaps(a, b), keys = [["accuracy", "accuracy"], ["tpr", "true positive rate"], ["fpr", "false positive rate"], ["selection", "selection rate"]];
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText("Group A (blue) and group B (orange)", 14, 24); const x0 = 140, bw = S.w - x0 - 60, bh = 14; let y = 44; ctx.font = "12.5px system-ui";
    for (const [k, name] of keys) { ctx.fillStyle = S.muted; ctx.textAlign = "right"; ctx.fillText(name, x0 - 8, y + 24); for (const [m, col, off] of [[a, S.c[0], 0], [b, S.c[1], bh + 3]]) { ctx.fillStyle = S.line; ctx.fillRect(x0, y + off, bw, bh); ctx.fillStyle = col; ctx.fillRect(x0, y + off, bw * Math.max(0, Math.min(1, m[k])), bh); ctx.fillStyle = S.ink; ctx.textAlign = "left"; ctx.fillText(m[k].toFixed(3), x0 + bw + 8, y + off + 11); } y += 2 * bh + 14; }
    ctx.textAlign = "left"; ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText("Gaps between the groups (0 = equal)", 14, y + 8); ctx.font = "13px system-ui";
    [["demographic parity (selection rates)", g.dp], ["equal opportunity (true positive rates)", g.eo], ["equalized odds (larger of TPR and FPR gaps)", g.eodds]].forEach(([n, v], i) => { ctx.fillStyle = S.muted; ctx.fillText(n, 14, y + 30 + i * 19); ctx.fillStyle = v < 0.03 ? S.good : v < 0.1 ? S.c[1] : S.bad; ctx.textAlign = "right"; ctx.fillText(v.toFixed(3), S.w - 14, y + 30 + i * 19); ctx.textAlign = "left"; });
  },
};
