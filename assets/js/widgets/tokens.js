// Token calculator for images, video and audio; mirrors n_image_tokens / n_video_tokens / attention_cost_ratio in multimodal_np.py.
export const nImage = (H, W, P) => Math.floor(H / P) * Math.floor(W / P);
export const nVideo = (frames, H, W, P, tube) => Math.floor(frames / tube) * nImage(H, W, P);
export const audioFrames = (sec, sr, hop) => 1 + Math.floor((sec * sr) / hop);
const fmt = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2) + " billion" : v >= 1e6 ? (v / 1e6).toFixed(2) + " million" : v.toLocaleString());
export default {
  id: "tokens", unit: "u7", group: "Unit 7 · Multimodal", title: "Tokens: image, video, audio",
  blurb: "A multimodal model turns pictures, video and sound into a sequence of tokens. Count them, and see why long video is so expensive for attention.",
  what: "The big number is the number of tokens the model must read. Self-attention compares every token with every other, so its cost grows with the square: the bar shows the cost compared with one 224-pixel image cut into 16-pixel patches (196 tokens).",
  tryit: "Image mode: double the side from 224 to 448 and see tokens ×4 but attention cost ×16. Video mode: 16 frames of 224 pixels is 3,136 tokens and 256 times the attention cost of one image. Audio mode: 30 seconds at a 10 ms hop is about 3,000 frames.",
  params: [
    { key: "mode", label: "What to count", type: "select", value: "video", options: [["image", "Image"], ["video", "Video"], ["audio", "Audio (speech)"]], help: "Pictures, clips or sound." },
    { key: "side", label: "Image side (pixels)", type: "select", value: "224", options: [["112", "112"], ["224", "224"], ["336", "336"], ["448", "448"], ["672", "672"], ["896", "896"]], help: "Image or video frame is square." },
    { key: "patch", label: "Patch size (pixels)", type: "select", value: "16", options: [["8", "8"], ["14", "14"], ["16", "16"], ["32", "32"]], help: "Each patch becomes one token. Small patches = more detail, many more tokens." },
    { key: "frames", label: "Video frames", type: "range", min: 1, max: 64, step: 1, value: 16, unit: "frames", help: "Only used in video mode." },
    { key: "tube", label: "Frames merged per token (video)", type: "select", value: "1", options: [["1", "1 (no merging)"], ["2", "2"], ["4", "4"]], help: "Merging neighbouring frames into one patch token cuts the count." },
    { key: "sec", label: "Audio length", type: "range", min: 1, max: 60, step: 1, value: 30, unit: "seconds", help: "Only used in audio mode." },
    { key: "hop", label: "Audio frame hop", type: "select", value: "10", options: [["10", "10 ms (speech models)"], ["20", "20 ms"], ["40", "40 ms"]], help: "Time between audio frames; 16,000 samples per second." },
  ],
  presets: [["One image 224", { mode: "image", side: "224", patch: "16" }], ["High-res image", { mode: "image", side: "896", patch: "16" }], ["Short video", { mode: "video", frames: 16, side: "224", tube: "1" }], ["30 s of speech", { mode: "audio", sec: 30, hop: "10" }]],
  draw(ctx, p, S) {
    const ref = nImage(224, 224, 16); let N, desc;
    if (p.mode === "image") { N = nImage(+p.side, +p.side, +p.patch); desc = `${+p.side}×${+p.side} image, ${+p.patch}-pixel patches: (${Math.floor(+p.side / +p.patch)})² patches`; }
    else if (p.mode === "video") { N = nVideo(Math.round(p.frames), +p.side, +p.side, +p.patch, +p.tube); desc = `${Math.round(p.frames)} frames of ${+p.side}×${+p.side}, ${+p.patch}-pixel patches, ${+p.tube} frame(s) per token`; }
    else { N = audioFrames(p.sec, 16000, (16000 * +p.hop) / 1000); desc = `${p.sec} s of audio at 16 kHz, one frame every ${p.hop} ms`; }
    const pairs = N * N, ratio = pairs / (ref * ref), mem = (pairs * 2) / 1e6;
    ctx.textAlign = "left"; ctx.font = "600 22px system-ui"; ctx.fillStyle = S.ink; ctx.fillText(`${N.toLocaleString()} tokens`, 16, 40); ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; let y = S.wrap(desc, 16, 62, S.w - 32, 16);
    ctx.fillStyle = S.ink; y = S.wrap(`Attention compares every token with every other: ${fmt(pairs)} pairs per head per layer (about ${mem >= 1000 ? (mem / 1000).toFixed(1) + " GB" : mem.toFixed(1) + " MB"} for the score matrix of one head in 16-bit).`, 16, y + 10, S.w - 32, 17);
    const bw = S.w - 32, frac = Math.min(1, Math.log10(Math.max(ratio, 0.01) * 100) / 6), by = y + 20;
    ctx.fillStyle = S.line; ctx.fillRect(16, by, bw, 28); ctx.fillStyle = ratio > 100 ? S.bad : ratio > 10 ? S.c[1] : S.c[0]; ctx.fillRect(16, by, Math.max(4, bw * frac), 28);
    ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText(`${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(2)}× the attention cost of one 224-pixel image (196 tokens)`, 24, by + 19);
    ctx.font = "12px system-ui"; ctx.fillStyle = S.muted; ctx.fillText("bar: logarithmic scale, 0.01× to 10,000×", 16, by + 48);
    if (p.mode === "audio") S.wrap(`Raw sound has ${(16000 * p.sec).toLocaleString()} numbers; the 80-band log-mel features keep ${(N * 80).toLocaleString()}.`, 16, by + 70, S.w - 32, 16);
  },
};
