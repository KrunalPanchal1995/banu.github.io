// BPE stepper: port of codes/llm/tokens_decoding train_bpe/encode (same tie-break: highest count, then pair order).
const CORPORA = {
  toy: "low low low low low lower lower newest newest newest newest newest newest widest widest widest",
  ml: "the model learns the pattern the model predicts the next token the tokens are learned from the training text and the training loss falls as the model learns",
  low: "lower lowest lowly slow slowest slowly flow flower flowing showing slowing blowing growing glowing",
};
export function trainBPE(text, M) {
  const freq = new Map();
  for (const w of text.split(/\s+/).filter(Boolean)) freq.set(w, (freq.get(w) || 0) + 1);
  let vocab = [...freq].map(([w, c]) => ({ s: [...w, "</w>"], c }));
  const merges = [];
  for (let m = 0; m < M; m++) {
    const pc = new Map();
    for (const { s, c } of vocab) for (let i = 0; i < s.length - 1; i++) { const k = s[i] + "\u0000" + s[i + 1]; pc.set(k, (pc.get(k) || 0) + c); }
    if (!pc.size) break;
    let best = null, bc = -1;
    for (const [k, c] of pc) if (c > bc || (c === bc && k > best)) { best = k; bc = c; }
    const [a, b] = best.split("\u0000");
    merges.push({ a, b, c: bc });
    for (const v of vocab) {
      const n = []; for (let i = 0; i < v.s.length; i++) { if (i < v.s.length - 1 && v.s[i] === a && v.s[i + 1] === b) { n.push(a + b); i++; } else n.push(v.s[i]); }
      v.s = n;
    }
  }
  return merges;
}
export function encodeWord(word, merges) {
  const t = [...word, "</w>"];
  for (const { a, b } of merges) for (let i = 0; i < t.length - 1;) { if (t[i] === a && t[i + 1] === b) t.splice(i, 2, a + b); else i++; }
  return t;
}
function chip(ctx, S, label, x, y, color, fill) {
  const t = label.replace("</w>", "·");
  const w = ctx.measureText(t).width + 14;
  ctx.fillStyle = fill; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = S.ink; ctx.fillText(t, x + 7, y + 18);
  return w;
}
export default {
  id: "bpe", unit: "u3", group: "Unit 3 · Large language models", title: "BPE tokenizer stepper",
  blurb: "Watch a tokenizer learn its vocabulary by merging the most frequent pair of symbols, one step at a time.",
  what: "Left: the merge table (newest merge highlighted). Right: how your test words are split with the merges learned so far. Coloured boxes are tokens; · marks the end of a word.",
  tryit: "Start at 0 merges (every letter is a token), then drag Merges up slowly. Watch 'lowest' become 'low' + 'est·'. Switch to the 'low' corpus and see which word pieces appear.",
  params: [
    { key: "corpus", label: "Training text", type: "select", value: "toy", options: [["toy", "Toy: low / lower / newest / widest"], ["ml", "A sentence about language models"], ["low", "Words that share 'low' and 'ow'"], ["custom", "My own text (type below)"]],
      help: "The text the tokenizer learns from. Frequent letter pairs in this text get merged first." },
    { key: "merges", label: "Number of merges", type: "range", min: 0, max: 30, step: 1, value: 6, help: "Each merge adds one new token to the vocabulary. 0 = single characters." },
    { key: "probe", label: "Test words", type: "text", value: "lowest newer", help: "Words to tokenize with the merges learned so far. Unseen words work too." },
    { key: "custom", label: "My own text", type: "text", value: "the cat sat on the mat the cat ate", help: "Used only when 'My own text' is chosen above." },
  ],
  presets: [["Start: 0 merges", { merges: 0 }], ["Suffix 'est' appears", { corpus: "toy", merges: 3 }], ["Whole words", { corpus: "toy", merges: 12 }]],
  draw(ctx, p, S) {
    const text = (p.corpus === "custom" ? p.custom : CORPORA[p.corpus]).toLowerCase().replace(/[^a-z ]/g, " ");
    const all = trainBPE(text, 30), M = Math.min(p.merges, all.length), merges = all.slice(0, M);
    ctx.fillStyle = S.ink; ctx.font = "600 15px system-ui"; ctx.fillText(`Merges learned: ${M}`, 16, 28);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted;
    const base = new Set(text.replace(/ /g, "")).size; ctx.fillText(`Vocabulary ≈ ${base} letters + ${M} merges = ${base + M} tokens`, 16, 48);
    const colW = Math.max(190, S.w * 0.36);
    // table
    ctx.fillStyle = S.muted; ctx.fillText("step   merged pair   count", 16, 78);
    const rows = Math.floor((S.h - 100) / 20), start = Math.max(0, M - rows);
    for (let i = start; i < M; i++) {
      const y = 98 + (i - start) * 20, last = i === M - 1;
      if (last) { ctx.fillStyle = S.accent + "33"; ctx.fillRect(10, y - 14, colW - 10, 20); }
      ctx.fillStyle = last ? S.ink : S.muted;
      ctx.fillText(String(i + 1).padStart(2, " "), 18, y);
      ctx.fillText(`${merges[i].a.replace("</w>", "·")} + ${merges[i].b.replace("</w>", "·")}`, 60, y);
      ctx.fillText(String(merges[i].c), 18 + colW - 40, y);
    }
    if (M === 0) { ctx.fillStyle = S.muted; ctx.fillText("(no merges yet)", 18, 98); }
    // tokens
    let x0 = colW + 30, y = 78;
    ctx.fillStyle = S.muted; ctx.fillText("test words → tokens", x0, y); y += 14;
    let total = 0, chars = 0;
    for (const word of p.probe.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8)) {
      const toks = encodeWord(word, merges); total += toks.length; chars += word.length + 1;
      ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText(word, x0, y + 16); ctx.font = "13px system-ui";
      let x = x0, row = y + 24;
      toks.forEach((t, i) => { const col = S.c[i % 5]; if (x + ctx.measureText(t).width + 20 > S.w - 8) { x = x0; row += 32; } x += chip(ctx, S, t, x, row, col, col + "26") + 4; });
      y = row + 42;
    }
    ctx.fillStyle = S.ink; ctx.fillText(`${total} tokens for ${chars} characters → ${(total / Math.max(chars, 1)).toFixed(2)} tokens per character`, x0, Math.min(S.h - 14, y + 4));
  },
};
