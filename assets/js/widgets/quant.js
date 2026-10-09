// Weight quantization explorer: mirrors quantize_uniform / quantize_codebook / normalfloat_levels / sqnr_db in adapt_np.py.
export function quantizeUniform(w, bits, block) {
  const out = new Array(w.length), qmax = 2 ** (bits - 1) - 1, B = block || w.length;
  for (let i = 0; i < w.length; i += B) { let a = 0; for (let j = i; j < Math.min(i + B, w.length); j++) a = Math.max(a, Math.abs(w[j])); const sc = a > 0 ? a / qmax : 1; for (let j = i; j < Math.min(i + B, w.length); j++) out[j] = Math.max(-qmax, Math.min(qmax, roundHalfEven(w[j] / sc))) * sc; }
  return out;
}
export const roundHalfEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };   // numpy rounds half to even
export function erf(x) {                                  // Maclaurin series: accurate to ~1e-15 for |x| <= 3; beyond that erf is within 3e-5 of +-1, enough for the comparisons in ppf
  const s = x < 0 ? -1 : 1; x = Math.abs(x); if (x > 3) return s;
  let term = x, sum = x; for (let n = 1; n < 80; n++) { term *= (-x * x) / n; sum += term / (2 * n + 1); }
  return (s * 2 * sum) / Math.sqrt(Math.PI);
}
const ppf = (p) => { let lo = -10, hi = 10; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (0.5 * (1 + erf(mid / Math.SQRT2)) < p) lo = mid; else hi = mid; } return (lo + hi) / 2; };
export function normalfloatLevels(bits = 4) { const n = 2 ** bits, z = Array.from({ length: n }, (_, i) => ppf((i + 0.5) / n)), m = Math.max(...z.map(Math.abs)); return z.map((v) => v / m); }
export function quantizeCodebook(w, levels, block = 64) { const out = new Array(w.length); for (let i = 0; i < w.length; i += block) { let a = 0; for (let j = i; j < Math.min(i + block, w.length); j++) a = Math.max(a, Math.abs(w[j])); a = a || 1; for (let j = i; j < Math.min(i + block, w.length); j++) { const x = w[j] / a; let b = 0, bd = 1e9; levels.forEach((l, k) => { const d = Math.abs(x - l); if (d < bd) { bd = d; b = k; } }); out[j] = levels[b] * a; } } return out; }
export const sqnr = (w, q) => { let a = 0, b = 0; for (let i = 0; i < w.length; i++) { a += w[i] * w[i]; b += (w[i] - q[i]) ** 2; } return 10 * Math.log10(a / b); };
const NF = normalfloatLevels(4);
export default {
  id: "quant", unit: "u6", group: "Unit 6 · Fine-tuning", title: "Quantization explorer",
  blurb: "Store each weight with fewer bits to shrink the model. See how much accuracy you lose, and why one huge weight can ruin everything unless weights are quantized in small blocks.",
  what: "Each dot is one weight: left-right is its true value, up-down is the value after quantization (a perfect copy lies on the diagonal line). Steps show the few values that remain. The numbers show the quality (higher dB = closer to the original) and the memory saved compared with 16-bit numbers.",
  tryit: "Compare 8 bits (almost no loss) with 4 bits (visible steps). Add one outlier with block size 'all': quality collapses, because one scale must stretch to cover it. Now set the block size to 16: quality recovers. Switch the 4-bit code to 'quantile': levels bunch where weights are dense, which is what QLoRA's NF4 does.",
  params: [
    { key: "bits", label: "Bits per weight", type: "range", min: 2, max: 8, step: 1, value: 4, unit: "bits", help: "Fewer bits = smaller model, more rounding error." },
    { key: "block", label: "Block size (weights sharing one scale)", type: "select", value: "64", options: [["0", "All weights share one scale"], ["256", "256"], ["64", "64"], ["16", "16"]], help: "Smaller blocks adapt to local sizes but store more scales." },
    { key: "outl", label: "Outlier weights (40× typical size)", type: "range", min: 0, max: 4, step: 1, value: 0, unit: "weights", help: "A few very large weights, as found in real LLMs." },
    { key: "code", label: "Code used (4 bits only)", type: "select", value: "uniform", options: [["uniform", "Uniform steps"], ["quantile", "Quantile (NormalFloat-like)"]], help: "Where the 16 allowed values sit. Quantile puts more where weights are dense." },
  ],
  presets: [["8 bits (near perfect)", { bits: 8, outl: 0 }], ["4 bits, clean", { bits: 4, outl: 0, block: "64" }], ["4 bits + outlier, one scale", { bits: 4, outl: 1, block: "0" }], ["4 bits + outlier, blocks of 16", { bits: 4, outl: 1, block: "16" }]],
  draw(ctx, p, S) {
    const rnd = S.rng(2), nrm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()), N = 1024, w = Array.from({ length: N }, nrm);
    for (let i = 0; i < p.outl; i++) w[100 + 211 * i] = 40;
    const bits = Math.round(p.bits), blk = +p.block || null, useQ = p.code === "quantile" && bits === 4, q = useQ ? quantizeCodebook(w, NF, blk || N) : quantizeUniform(w, bits, blk), db = sqnr(w, q);
    const scales = blk ? Math.ceil(N / blk) : 1, bytes = bits / 8 + (scales * 2) / N;
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; const hy = S.wrap(`Quality ${db.toFixed(1)} dB · ${bytes.toFixed(2)} bytes per weight · ${(2 / bytes).toFixed(1)}× smaller than 16-bit`, 16, 26, S.w - 32, 18);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; S.wrap(`${bits} bits${useQ ? ", quantile code" : ", uniform steps"}; ${blk ? "blocks of " + blk : "one scale for everything"}. Rule of thumb: each extra bit adds about 6 dB.`, 16, hy + 2, S.w - 32, 16);
    const side = Math.min(S.w - 40, S.h - 124), x0 = (S.w - side) / 2, y0 = 92, lim = p.outl ? 42 : 4, X = (v) => x0 + ((v + lim) / (2 * lim)) * side, Y = (v) => y0 + side - ((v + lim) / (2 * lim)) * side;
    ctx.strokeStyle = S.line; ctx.strokeRect(x0, y0, side, side); ctx.strokeStyle = S.grey; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(-lim), Y(-lim)); ctx.lineTo(X(lim), Y(lim)); ctx.stroke(); ctx.setLineDash([]);
    w.forEach((v, i) => { ctx.fillStyle = Math.abs(v) > 20 ? S.c[3] : S.c[0]; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(X(v), Y(q[i]), 2.2, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.fillStyle = S.muted; ctx.textAlign = "center"; ctx.fillText("true weight →", x0 + side / 2, y0 + side + 16); ctx.save(); ctx.translate(x0 - 10, y0 + side / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("after quantization →", 0, 0); ctx.restore();
  },
};
