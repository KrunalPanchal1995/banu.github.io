// Context window budget: mirrors fit_context in codes/llm/prompting_tools (system + pinned always kept, then the newest messages that fit).
export function fitContext(msgs, window, reserve) {
  const budget = window - reserve, fixed = msgs.filter((m) => m.role === "system" || m.pin), rest = msgs.filter((m) => !fixed.includes(m));
  let used = fixed.reduce((a, m) => a + m.tokens, 0); const keep = new Set(fixed);
  for (let i = rest.length - 1; i >= 0; i--) { if (used + rest[i].tokens > budget) { if (!rest.slice(i + 1).length) return { error: true, used }; break; } keep.add(rest[i]); used += rest[i].tokens; }
  return { kept: msgs.filter((m) => keep.has(m)), dropped: msgs.filter((m) => !keep.has(m)), used, error: false };
}
export function build(p) {
  const m = [{ role: "system", label: "system prompt", tokens: p.sys }];
  for (let i = 1; i <= p.shots; i++) m.push({ role: "example", label: `example ${i}`, tokens: p.shotTok, pin: p.pinShots === "yes" });
  if (p.docs > 0) m.push({ role: "docs", label: "retrieved documents", tokens: p.docs, pin: p.pinDocs === "yes" });
  for (let i = 1; i <= p.turns; i++) { m.push({ role: "user", label: `turn ${i} user`, tokens: Math.round(p.turnTok * 0.3) }); m.push({ role: "assistant", label: `turn ${i} reply`, tokens: Math.round(p.turnTok * 0.7) }); }
  m.push({ role: "question", label: "NEW question", tokens: p.q });
  return m;
}
export default {
  id: "context", unit: "u4", group: "Unit 4 · Prompting", title: "Context window budget",
  blurb: "Everything you send, plus the room for the reply, must fit in the model's context window. See what gets thrown away when it does not.",
  what: "One bar, drawn to scale, in conversation order: purple = system prompt, orange = few-shot examples, brown = retrieved documents, blue = your messages, green = model replies. Hatched blocks are DROPPED (oldest first). The red line is where the room reserved for the reply begins.",
  tryit: "Set the window to 2k tokens and look at what is hatched: the examples and the documents go first, because they are the oldest. Turn on 'Keep examples' (pinning) and see which messages go instead. Then raise the number of turns and watch the total tokens processed grow much faster than the number of turns.",
  params: [
    { key: "window", label: "Context window", type: "select", value: "4096", options: [["2048", "2,048 tokens"], ["4096", "4,096 tokens"], ["8192", "8,192 tokens"], ["16384", "16,384 tokens"], ["32768", "32,768 tokens"]], help: "The model's limit on input plus output." },
    { key: "reserve", label: "Room kept for the reply", type: "range", min: 100, max: 2000, step: 100, value: 500, unit: "tokens", help: "Space left free so the model can answer." },
    { key: "sys", label: "System prompt size", type: "range", min: 0, max: 1000, step: 50, value: 150, unit: "tokens", help: "Standing instructions sent with every call." },
    { key: "shots", label: "Number of few-shot examples", type: "range", min: 0, max: 10, step: 1, value: 3, help: "Worked examples placed before the conversation." },
    { key: "shotTok", label: "Size of each example", type: "range", min: 20, max: 300, step: 10, value: 100, unit: "tokens", help: "Question and answer together." },
    { key: "docs", label: "Retrieved documents", type: "range", min: 0, max: 6000, step: 250, value: 1500, unit: "tokens", help: "Text pasted in by a search or retrieval step (Unit 5)." },
    { key: "turns", label: "Past chat turns", type: "range", min: 0, max: 40, step: 1, value: 7, help: "Earlier question-and-reply pairs." },
    { key: "turnTok", label: "Size of each turn", type: "range", min: 50, max: 600, step: 10, value: 170, unit: "tokens", help: "Question plus reply." },
    { key: "q", label: "Your new question", type: "range", min: 10, max: 500, step: 10, value: 80, unit: "tokens", help: "The message you are sending now." },
    { key: "pinShots", label: "Keep the examples (pin)?", type: "select", value: "no", options: [["no", "No: drop oldest first"], ["yes", "Yes: never drop them"]], help: "Pinned messages are kept even though they are old." },
    { key: "pinDocs", label: "Keep the documents (pin)?", type: "select", value: "no", options: [["no", "No: drop oldest first"], ["yes", "Yes: never drop them"]], help: "Pin retrieved text only if it fits." },
  ],
  presets: [["Roomy (4k window)", { window: "4096", turns: 7 }], ["Tight (2k window)", { window: "2048", turns: 7 }], ["Tight, examples pinned", { window: "2048", pinShots: "yes" }], ["Very long chat", { window: "8192", turns: 40, docs: 0 }]],
  draw(ctx, p, S) {
    const W = +p.window, msgs = build(p), r = fitContext(msgs, W, p.reserve), total = msgs.reduce((a, m) => a + m.tokens, 0), maxX = Math.max(W, total) * 1.02;
    const col = { system: S.c[4], example: S.c[1], docs: "#8c564b", user: S.c[0], assistant: S.c[2], question: S.c[0] }, L = 20, bw = S.w - 2 * L, X = (t) => L + (t / maxX) * bw, y = 110, h = 60;
    ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.textAlign = "left";
    ctx.fillText(r.error ? "The pinned messages plus your question do not fit!" : `${r.kept.length} of ${msgs.length} messages kept (${r.used} tokens) · ${r.dropped.length} dropped`, L, 28);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted;
    let yy = S.wrap(`Everything you want to send: ${total} tokens. Window ${W} minus ${p.reserve} for the reply leaves ${W - p.reserve} tokens.`, L, 50, bw, 17);
    let x = 0; const keptSet = new Set(r.kept || []);
    for (const m of msgs) { const w = Math.max(1, X(x + m.tokens) - X(x)), keep = keptSet.has(m); ctx.fillStyle = keep ? col[m.role] : S.bg; ctx.fillRect(X(x), y, w, h); ctx.strokeStyle = col[m.role]; ctx.lineWidth = 1.2; ctx.strokeRect(X(x), y, w, h);
      if (!keep) { ctx.save(); ctx.beginPath(); ctx.rect(X(x), y, w, h); ctx.clip(); ctx.strokeStyle = col[m.role]; for (let k = -h; k < w; k += 6) { ctx.beginPath(); ctx.moveTo(X(x) + k, y + h); ctx.lineTo(X(x) + k + h, y); ctx.stroke(); } ctx.restore(); }
      x += m.tokens; }
    ctx.strokeStyle = S.bad; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(W - p.reserve), y - 14); ctx.lineTo(X(W - p.reserve), y + h + 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = S.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(W), y - 14); ctx.lineTo(X(W), y + h + 14); ctx.stroke(); ctx.fillStyle = S.ink; ctx.textAlign = "right"; ctx.fillText(`window ${W}`, X(W) - 4, y - 18); ctx.fillStyle = S.bad; ctx.textAlign = "left"; ctx.fillText("reply room starts", Math.max(L, X(W - p.reserve) - 110), y + h + 30);
    // legend and conversation cost
    ctx.textAlign = "left"; let lx = L; ctx.font = "12px system-ui";
    for (const [k, name] of [["system", "system"], ["example", "examples"], ["docs", "documents"], ["user", "you"], ["assistant", "model"]]) { ctx.fillStyle = col[k]; ctx.fillRect(lx, y + h + 46, 12, 12); ctx.fillStyle = S.muted; ctx.fillText(name, lx + 17, y + h + 57); lx += 22 + ctx.measureText(name).width + 12; }
    const K = p.turns, cost = K * p.sys + p.turnTok * K * (K + 1) / 2;
    ctx.fillStyle = S.ink; ctx.font = "13px system-ui"; S.wrap(`Over ${K} turns the model reads about ${Math.round(cost).toLocaleString()} tokens in total (it re-reads the whole chat every time), not ${Math.round(p.sys + p.turnTok * K).toLocaleString()}.`, L, y + h + 90, bw, 17);
  },
};
