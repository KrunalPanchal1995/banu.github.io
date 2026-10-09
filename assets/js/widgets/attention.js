// Attention heatmap on a hand-built toy: word types decide who looks at whom (no trained weights). Shows masks and sharpness.
const DET = "the a an this that these those my your his her its our their".split(" ");
const PRON = "it he she they them him her we i you".split(" ");
const VERB = "was were is are am be been sat ate crossed cross crosses bites bite bit ran runs run saw see sees chased chase eats eat likes like went go".split(" ");
const ADJ = "tired big small red blue happy sad old young hungry brown lazy quick".split(" ");
const OTHER = "because didn't doesn't not and or but of in on to at by for with from as than so if then".split(" ");
export const typeOf = (w) => (OTHER.includes(w) ? "other" : DET.includes(w) ? "det" : PRON.includes(w) ? "pron" : VERB.includes(w) || /(ed|ing)$/.test(w) && w.length > 4 ? "verb" : ADJ.includes(w) ? "adj" : "noun");
const COMPAT = { pron: { noun: 3, pron: 0.5 }, verb: { noun: 2, verb: 0.5 }, adj: { noun: 2.5, verb: 1 }, noun: { det: 2, adj: 1, verb: 1 }, det: { noun: 2 } };
export function attnMatrix(words, sharp, near, causal) {
  const n = words.length, ty = words.map(typeOf);
  return words.map((_, i) => {
    const s = words.map((_, j) => (((COMPAT[ty[i]] || {})[ty[j]] || 0) + (i === j ? 1 : 0) - near * 0.4 * Math.abs(i - j)) * sharp);
    const ok = s.map((_, j) => !causal || j <= i), m = Math.max(...s.filter((_, j) => ok[j])), e = s.map((v, j) => (ok[j] ? Math.exp(v - m) : 0)), z = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / z);
  });
}
export default {
  id: "attention", unit: "u2", group: "Unit 2 · Transformers", title: "Attention heatmap",
  blurb: "Every word looks at every other word and takes a weighted average. Edit the sentence and see who reads whom.",
  what: "Each row is a word that is reading; each column is a word being read; darker = more weight. Each row adds up to 1. The bars on the right show the row you picked. This is a hand-built toy (word types decide the scores), not a trained model.",
  tryit: "Word 8 is 'it': it reads the two nouns, 'animal' and 'street', about equally, because this toy only knows word types. Real models learn from data which noun is meant. Raise 'Preference for nearby words' to 1 and 'it' now prefers 'street' (a wrong guess). Switch Mask to causal and pick word 2: it can only look backwards.",
  params: [
    { key: "text", label: "Sentence", type: "text", value: "The animal didn't cross the street because it was tired", help: "Up to 12 words. Words are classed as article / noun / verb / pronoun / adjective by a tiny word list; unknown words count as nouns." },
    { key: "focus", label: "Word that is reading (number)", type: "range", min: 1, max: 12, step: 1, value: 8, help: "Which row to highlight and show as bars. Counted from the first word." },
    { key: "mask", label: "Mask", type: "select", value: "none", options: [["none", "None: sees every word (BERT-style)"], ["causal", "Causal: sees only earlier words (GPT-style)"]], help: "A causal mask hides all later words, so the table becomes triangular." },
    { key: "sharp", label: "Sharpness", type: "range", min: 0.2, max: 4, step: 0.1, value: 1.5, help: "Low = spread weight evenly. High = nearly all weight on the best match (like low temperature)." },
    { key: "near", label: "Preference for nearby words", type: "range", min: 0, max: 2, step: 0.1, value: 0, help: "0 = only meaning matters. Higher = nearby words get extra weight (what positional encoding allows)." },
  ],
  presets: [["'it' reads the nouns", { text: "The animal didn't cross the street because it was tired", focus: 8, mask: "none", sharp: 1.5, near: 0 }], ["Causal (GPT-style)", { mask: "causal", focus: 8 }], ["Spread out", { sharp: 0.3 }], ["Only nearby words", { near: 2, sharp: 2 }]],
  draw(ctx, p, S) {
    const words = p.text.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 12);
    if (words.length < 2) { ctx.fillStyle = S.muted; ctx.fillText("Type at least two words.", 16, 30); return; }
    const n = words.length, f = Math.min(Math.max(p.focus, 1), n) - 1, W = attnMatrix(words, p.sharp, p.near, p.mask === "causal");
    const lw = 70, top = 28, cell = Math.min((S.h - top - 70) / n, (S.w * 0.55 - lw - 10) / n, 44), x0 = lw + 8, y0 = top;
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; ctx.textAlign = "left"; ctx.fillText("key (being read) →", x0, 16);
    for (let i = 0; i < n; i++) {
      ctx.textAlign = "right"; ctx.fillStyle = i === f ? S.ink : S.muted; ctx.font = (i === f ? "600 " : "") + "12px system-ui"; ctx.fillText(`${i + 1} ${words[i]}`.slice(0, 11), x0 - 6, y0 + i * cell + cell / 2 + 4);
      for (let j = 0; j < n; j++) { const v = W[i][j]; ctx.fillStyle = S.accent; ctx.globalAlpha = 0.08 + 0.92 * v; ctx.fillRect(x0 + j * cell, y0 + i * cell, cell - 1, cell - 1); ctx.globalAlpha = 1;
        if (cell > 30 && v > 0.04) { ctx.fillStyle = v > 0.5 ? "#fff" : S.ink; ctx.textAlign = "center"; ctx.font = "10px system-ui"; ctx.fillText(v.toFixed(2), x0 + j * cell + cell / 2, y0 + i * cell + cell / 2 + 3); } }
    }
    ctx.strokeStyle = S.c[3]; ctx.lineWidth = 2.5; ctx.strokeRect(x0 - 1, y0 + f * cell - 1, n * cell + 1, cell + 1); ctx.lineWidth = 1;
    ctx.font = "12px system-ui"; ctx.fillStyle = S.muted; ctx.textAlign = "right";
    for (let j = 0; j < n; j++) { ctx.save(); ctx.translate(x0 + j * cell + cell / 2 + 4, y0 + n * cell + 8); ctx.rotate(Math.PI / 3.2); ctx.textAlign = "left"; ctx.fillStyle = j === f ? S.ink : S.muted; ctx.fillText(`${j + 1} ${words[j]}`.slice(0, 11), 0, 0); ctx.restore(); }
    // bars for focus row
    const bx = x0 + n * cell + 40, bw = S.w - bx - 20; if (bw < 120) return;
    ctx.textAlign = "left"; ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText(`“${words[f]}” reads:`, bx, 34);
    const bh = Math.min(22, (S.h - 90) / n);
    words.forEach((w, j) => { const y = 46 + j * (bh + 4); ctx.fillStyle = S.line; ctx.fillRect(bx, y, bw - 50, bh); ctx.fillStyle = j === f ? S.c[3] : S.c[0]; ctx.fillRect(bx, y, (bw - 50) * W[f][j], bh);
      ctx.fillStyle = S.ink; ctx.font = "12px system-ui"; ctx.fillText(`${w} ${(W[f][j] * 100).toFixed(0)}%`, bx + 6, y + bh - 6); });
  },
};
