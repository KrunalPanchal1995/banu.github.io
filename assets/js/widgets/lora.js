// LoRA calculator: trainable parameters of rank-r adapters, mirroring lora_params in adapt_np.py and |Theta| = 2 L d r (Hu et al. 2021) for Wq, Wv.
export const loraParams = (dOut, dIn, r) => r * (dOut + dIn);
const SETS = { qv: "Wq and Wv (as in the LoRA paper)", attn: "all four attention matrices", all: "attention and the MLP" };
export function totals(d, L, r, set) {
  const attn = (n) => n * loraParams(d, d, r), mlp = 2 * loraParams(4 * d, d, r), perLayer = set === "qv" ? attn(2) : set === "attn" ? attn(4) : attn(4) + mlp;
  const base = L * 12 * d * d;                                    // attention 4 d^2 + MLP 8 d^2 per layer (d_ff = 4d, biases ignored)
  return { adapter: L * perLayer, base };
}
export default {
  id: "lora", unit: "u6", group: "Unit 6 · Fine-tuning", title: "LoRA calculator",
  blurb: "Fine-tuning every weight is expensive. LoRA freezes the model and trains two thin matrices per layer instead. See how few numbers that is.",
  what: "Left bar: the model's weights (frozen in LoRA). Right bar: the adapter you actually train, drawn on the same scale (a hair-thin sliver when it is tiny). The big numbers give the exact counts and the share. The lower line shows how much extra memory Adam needs while training.",
  tryit: "Choose width 4096 and 32 layers (a 7-billion-class shape), rank 8, 'Wq and Wv': the adapter is about 4 million numbers, around 0.1% of the model. Raise the rank to 64 and watch the share grow in proportion (it is linear in the rank). Switch to 'attention and the MLP' to adapt more of the model.",
  params: [
    { key: "d", label: "Model width d", type: "select", value: "4096", options: [["768", "768 (small)"], ["1024", "1,024"], ["2048", "2,048"], ["4096", "4,096"], ["8192", "8,192"]], help: "Size of each hidden vector. Weight matrices are about d × d." },
    { key: "L", label: "Number of layers", type: "range", min: 6, max: 96, step: 2, value: 32, unit: "layers", help: "Transformer blocks stacked in the model." },
    { key: "r", label: "LoRA rank r", type: "range", min: 1, max: 256, step: 1, value: 8, help: "How many 'directions' the adapter can use. Bigger = more flexible, more parameters." },
    { key: "set", label: "Which matrices get an adapter", type: "select", value: "qv", options: [["qv", "Wq and Wv (as in the LoRA paper)"], ["attn", "All four attention matrices"], ["all", "Attention and the MLP"]], help: "More matrices adapted means more trainable parameters." },
  ],
  presets: [["7B-class, r = 8", { d: "4096", L: 32, r: 8, set: "qv" }], ["Small model, r = 4", { d: "768", L: 12, r: 4, set: "qv" }], ["Adapt everything, r = 64", { d: "4096", L: 32, r: 64, set: "all" }], ["Tiny adapter, r = 1", { r: 1, set: "qv" }]],
  draw(ctx, p, S) {
    const d = +p.d, L = Math.round(p.L), r = Math.round(p.r), { adapter, base } = totals(d, L, r, p.set), frac = adapter / base, fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + " billion" : n >= 1e6 ? (n / 1e6).toFixed(2) + " million" : n >= 1e3 ? (n / 1e3).toFixed(1) + " thousand" : String(n));
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; let y = S.wrap(`Adapter: ${fmt(adapter)} numbers to train = ${(100 * frac).toFixed(frac < 0.01 ? 3 : 2)}% of the model`, 16, 26, S.w - 32, 18);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; y = S.wrap(`Model (frozen): about ${fmt(base)} weights in attention and MLP (12·d²·layers).`, 16, y + 2, S.w - 32, 16);
    const L0 = 16, W = S.w - 32, by = y + 14, bh = 34, share = Math.max(frac, 2 / W);
    ctx.fillStyle = S.c[0]; ctx.fillRect(L0, by, W, bh); ctx.fillStyle = S.bg; ctx.font = "600 12px system-ui"; ctx.fillText("model weights: frozen, not trained", L0 + 8, by + 22);
    ctx.fillStyle = S.c[3]; ctx.fillRect(L0, by + bh + 12, W * share, bh); ctx.fillStyle = S.ink; ctx.fillText(`adapter: trained (${(100 * frac).toFixed(3)}% of the bar above${frac < 2 / W ? "; drawn 2 pixels wide, too thin to see at true scale" : ""})`, L0 + W * share + 8, by + bh + 12 + 22);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.ink; y = by + 2 * bh + 40;
    y = S.wrap(`Per adapted matrix of size ${d} × ${d}: r·(d + d) = ${r}·${2 * d} = ${loraParams(d, d, r).toLocaleString()} numbers, against ${(d * d).toLocaleString()} in the full matrix (${(100 * loraParams(d, d, r) / (d * d)).toFixed(2)}%).`, 16, y, S.w - 32, 16);
    y = S.wrap(`Adam keeps two extra numbers per trained parameter: ${fmt(2 * adapter)} here, against ${fmt(2 * base)} if you trained the whole model.`, 16, y + 4, S.w - 32, 16);
    ctx.fillStyle = S.muted; S.wrap("The adapter file is also tiny, and can be merged into the weights for serving (W + (α/r)·B·A), so it adds no delay.", 16, y + 4, S.w - 32, 16);
  },
};
