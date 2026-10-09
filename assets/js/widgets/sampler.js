// Next-token sampler: temperature -> top-k -> top-p -> sample. Same order and rules as tokens_decoding.py.
const SCEN = {
  sure: { prompt: "The capital of France is", tok: ["Paris", "Lyon", "the", "a", "located", "France", "Rome", "big", "London", "blue"], z: [9, 4.5, 3.8, 3.0, 2.8, 2.2, 1.5, 0.8, 0.4, -0.5] },
  mixed: { prompt: "Once upon a", tok: ["time", "midnight", "hill", "dream", "land", "day", "night", "king", "star", "tree"], z: [4.2, 2.6, 2.4, 2.2, 2.1, 1.7, 1.6, 1.2, 0.8, 0.3] },
  open: { prompt: "My favourite food is", tok: ["pizza", "pasta", "rice", "sushi", "salad", "cake", "soup", "bread", "fruit", "tacos"], z: [2.6, 2.4, 2.2, 2.1, 1.9, 1.8, 1.6, 1.4, 1.3, 1.1] },
};
export const softmax = (z, T) => { const m = Math.max(...z), e = z.map((v) => Math.exp((v - m) / T)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
export function topK(p, k) { const idx = p.map((v, i) => i).sort((a, b) => p[b] - p[a] || a - b).slice(0, k), q = p.map(() => 0); idx.forEach((i) => (q[i] = p[i])); const s = q.reduce((a, b) => a + b, 0); return q.map((v) => v / s); }
export function topP(p, tp) { const idx = p.map((v, i) => i).sort((a, b) => p[b] - p[a] || a - b), q = p.map(() => 0); let cum = 0; for (const i of idx) { q[i] = p[i]; cum += p[i]; if (cum >= tp - 1e-12) break; } const s = q.reduce((a, b) => a + b, 0); return q.map((v) => v / s); }
const H = (p) => -p.filter((v) => v > 0).reduce((a, v) => a + v * Math.log2(v), 0);
export default {
  id: "sampler", unit: "u3", group: "Unit 3 · Large language models", title: "Next-token sampler",
  blurb: "The model gives every possible next word a probability. Temperature, top-k and top-p decide which words may be chosen.",
  what: "Pale outline = the model's own probabilities (T = 1). Coloured bar = probabilities after your settings. Grey bar = token removed by top-k or top-p. Dots = how often each token was picked in your random draws.",
  tryit: "Pick 'Sure' and lower the temperature: nothing changes much. Pick 'Open' and set top-p to 0.5: only the best few words survive. Raise Draws to 2000 and watch the dots match the bars.",
  params: [
    { key: "scen", label: "Situation (what the model is unsure about)", type: "select", value: "mixed", options: [["sure", "Sure: 'The capital of France is …'"], ["mixed", "Mixed: 'Once upon a …'"], ["open", "Open: 'My favourite food is …'"]], help: "Same ten candidate words each time, but a different level of model confidence." },
    { key: "T", label: "Temperature", type: "range", min: 0.1, max: 2.5, step: 0.05, value: 1, help: "Low = pick the favourite almost always. High = give unlikely words a real chance." },
    { key: "k", label: "Top-k (how many words stay)", type: "range", min: 1, max: 10, step: 1, value: 10, unit: "words", help: "Keep only the k most likely words. 10 = keep all." },
    { key: "p", label: "Top-p (probability kept)", type: "range", min: 0.1, max: 1, step: 0.05, value: 1, help: "Keep the fewest top words that together reach this probability. 1.0 = keep all." },
    { key: "n", label: "Random draws", type: "range", min: 0, max: 2000, step: 50, value: 500, unit: "draws", help: "How many times to pick a word at random with these settings (fixed seed, so repeatable)." },
  ],
  presets: [["Greedy (always the best)", { T: 0.1, k: 1, p: 1 }], ["Balanced chat", { T: 0.7, k: 10, p: 0.9 }], ["Creative", { T: 1.3, k: 10, p: 0.95 }], ["Too random", { T: 2.5, k: 10, p: 1 }]],
  draw(ctx, p, S) {
    const sc = SCEN[p.scen], p0 = softmax(sc.z, 1), p1 = softmax(sc.z, p.T), pk = topK(p1, Math.round(p.k)), pf = topP(pk, p.p);
    ctx.fillStyle = S.ink; ctx.font = "600 15px system-ui"; ctx.fillText(`“${sc.prompt} …”`, 16, 28);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted;
    const kept = pf.filter((v) => v > 0).length;
    ctx.fillText(`words kept: ${kept} of 10  ·  top word: ${(Math.max(...pf) * 100).toFixed(0)}%`, 16, 48);
    ctx.fillText(`uncertainty: ${H(pf).toFixed(2)} bits (0 = certain, 3.32 = all equal)`, 16, 66);
    const L = 48, R = 16, T0 = 96, B = 62, W = S.w - L - R, Hh = S.h - T0 - B, n = 10, bw = W / n;
    ctx.strokeStyle = S.line; ctx.fillStyle = S.muted; ctx.textAlign = "right";
    for (let g = 0; g <= 4; g++) { const v = g / 4, y = T0 + Hh * (1 - v); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(S.w - R, y); ctx.stroke(); ctx.fillText(v.toFixed(2), L - 6, y + 4); }
    ctx.textAlign = "center";
    const rng = S.rng(7), counts = new Array(n).fill(0), N = Math.round(p.n);
    for (let d = 0; d < N; d++) { let u = rng(), i = 0; while (i < n - 1 && u > pf[i]) { u -= pf[i]; i++; } counts[i]++; }
    for (let i = 0; i < n; i++) {
      const x = L + i * bw + bw * 0.15, w = bw * 0.7, yb = T0 + Hh;
      ctx.strokeStyle = S.grey; ctx.setLineDash([3, 3]); ctx.strokeRect(x, yb - p0[i] * Hh, w, p0[i] * Hh); ctx.setLineDash([]);
      const removed = pf[i] === 0;
      ctx.fillStyle = removed ? S.line : S.c[0]; const hh = (removed ? p1[i] : pf[i]) * Hh; ctx.fillRect(x + 3, yb - hh, w - 6, hh);
      if (N > 0 && !removed) { ctx.fillStyle = S.c[3]; ctx.beginPath(); ctx.arc(x + w / 2, yb - (counts[i] / N) * Hh, 4.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = removed ? S.muted : S.ink; ctx.font = (bw < 62 ? 11 : 13) + "px system-ui"; ctx.fillText(sc.tok[i], x + w / 2, yb + 18); ctx.font = "13px system-ui";
      ctx.fillStyle = S.muted; ctx.fillText(pf[i] > 0 ? (pf[i] * 100).toFixed(0) + "%" : "×", x + w / 2, yb + 34);
    }
    ctx.textAlign = "left"; ctx.fillStyle = S.muted; ctx.fillText("probability", 4, T0 - 8);
    ctx.fillStyle = S.c[3]; ctx.beginPath(); ctx.arc(L + 6, S.h - 14, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = S.muted; ctx.fillText(`= how often picked in ${N} draws`, L + 16, S.h - 10);
  },
};
