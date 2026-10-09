// Metric lab: BLEU, ROUGE-1/2/L, token F1, exact match on two texts; mirrors evaluation_np.py.
export const toks = (t) => t.toLowerCase().match(/[a-z0-9]+/g) || [];
const ngrams = (t, n) => { const m = new Map(); for (let i = 0; i + n <= t.length; i++) { const k = t.slice(i, i + n).join(" "); m.set(k, (m.get(k) || 0) + 1); } return m; };
const clipped = (cc, rc) => { let s = 0; for (const [g, v] of cc) s += Math.min(v, rc.get(g) || 0); return s; };
const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
export function bleu(ref, cand, N = 4, smooth = false) {
  const r = toks(ref), c = toks(cand); if (!c.length) return 0; let logs = 0;
  for (let n = 1; n <= N; n++) { const cc = ngrams(c, n), rc = ngrams(r, n); let clip = clipped(cc, rc), tot = total(cc); if (smooth && n > 1) { clip += 1; tot += 1; } if (clip === 0 || tot === 0) return 0; logs += Math.log(clip / tot) / N; }
  return (c.length > r.length ? 1 : Math.exp(1 - r.length / c.length)) * Math.exp(logs);
}
const prf = (ov, nc, nr) => { const p = ov / Math.max(nc, 1), r = ov / Math.max(nr, 1); return [p, r, p + r ? (2 * p * r) / (p + r) : 0]; };
export const rougeN = (ref, cand, n) => { const rc = ngrams(toks(ref), n), cc = ngrams(toks(cand), n); return prf(clipped(cc, rc), total(cc), total(rc)); };
export function lcs(a, b) { const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[a.length][b.length]; }
export const rougeL = (ref, cand) => { const r = toks(ref), c = toks(cand); return prf(lcs(r, c), c.length, r.length); };
export function tokenF1(ref, cand) { const rc = ngrams(toks(ref), 1), cc = ngrams(toks(cand), 1); let ov = 0; for (const [g, v] of cc) ov += Math.min(v, rc.get(g) || 0); if (!ov) return 0; const p = ov / total(cc), r = ov / total(rc); return (2 * p * r) / (p + r); }
export const exactMatch = (ref, cand) => (toks(ref).join(" ") === toks(cand).join(" ") ? 1 : 0);
export default {
  id: "metrics", unit: "u9", group: "Unit 9 · Evaluation & safety", title: "Metric lab: BLEU, ROUGE, F1",
  blurb: "Type a reference answer and a candidate answer and see how common overlap metrics score them. Then try a paraphrase and a negation, and see where the numbers mislead.",
  what: "Each bar is one metric between 0 and 1. They count shared words (or word sequences); none of them understands meaning. The sentence under the bars points out when a score is probably wrong.",
  tryit: "Pick 'Negation': the answer means the opposite, yet ROUGE-L is about 0.8. Pick 'Paraphrase': the meaning is the same, yet the scores are near 0.1. Pick 'Word shuffle': ROUGE-1 stays high but ROUGE-L and BLEU fall, because they look at order.",
  params: [
    { key: "ref", label: "Reference answer (the right one)", type: "text", value: "attention lets every word look at every other word", help: "The answer you consider correct." },
    { key: "cand", label: "Candidate answer (to be scored)", type: "text", value: "attention does not let every word look at every other word", help: "The model's answer." },
    { key: "N", label: "BLEU: longest n-gram", type: "select", value: "4", options: [["1", "1 (single words)"], ["2", "2"], ["3", "3"], ["4", "4 (standard)"]], help: "BLEU multiplies the precision of 1..N-word sequences." },
    { key: "smooth", label: "BLEU smoothing", type: "select", value: "yes", options: [["no", "No: zero if any n-gram precision is zero"], ["yes", "Yes: add one to counts for n > 1"]], help: "Short sentences often have no matching 4-grams, giving BLEU = 0 without smoothing." },
  ],
  presets: [["Identical", { cand: "attention lets every word look at every other word" }], ["Paraphrase (same meaning)", { cand: "each token can attend to all the other tokens" }], ["Negation (opposite meaning)", { cand: "attention does not let every word look at every other word" }], ["Word shuffle", { cand: "word every at look other every word let attention" }]],
  draw(ctx, p, S) {
    const N = +p.N, sm = p.smooth === "yes", rows = [[`BLEU-${N}${sm ? " (smoothed)" : ""}`, bleu(p.ref, p.cand, N, sm)], ["ROUGE-1 F1", rougeN(p.ref, p.cand, 1)[2]], ["ROUGE-2 F1", rougeN(p.ref, p.cand, 2)[2]], ["ROUGE-L F1", rougeL(p.ref, p.cand)[2]], ["token F1", tokenF1(p.ref, p.cand)], ["exact match", exactMatch(p.ref, p.cand)]];
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText("Overlap scores (0 = nothing shared, 1 = identical)", 14, 24);
    const x0 = 130, bw = S.w - x0 - 60, y0 = 44, bh = 24, gap = 10; ctx.font = "12.5px system-ui";
    rows.forEach(([n, v], i) => { const y = y0 + i * (bh + gap); ctx.fillStyle = S.muted; ctx.textAlign = "right"; ctx.fillText(n, x0 - 8, y + 16); ctx.fillStyle = S.line; ctx.fillRect(x0, y, bw, bh); ctx.fillStyle = S.c[i % 5]; ctx.fillRect(x0, y, bw * v, bh); ctx.fillStyle = S.ink; ctx.textAlign = "left"; ctx.fillText(v.toFixed(3), x0 + bw + 8, y + 16); });
    const r = toks(p.ref), c = toks(p.cand), neg = /\b(not|no|never|n't)\b/i, flip = neg.test(p.ref) !== neg.test(p.cand), high = rougeL(p.ref, p.cand)[2];
    let msg = "Scores look reasonable."; if (flip && high > 0.5) msg = "Warning: high overlap but one text negates the other. Overlap metrics cannot see this."; else if (high < 0.25 && c.length > 0) msg = "Low overlap: if the meaning is the same (a paraphrase), these metrics under-score it."; else if (rougeN(p.ref, p.cand, 1)[2] > 0.8 && high < 0.6) msg = "Words match but order differs: ROUGE-1 is high, ROUGE-L and BLEU are lower.";
    ctx.fillStyle = S.accent; ctx.font = "13px system-ui"; S.wrap(msg, 14, y0 + 6 * (bh + gap) + 14, S.w - 28, 17);
  },
};
