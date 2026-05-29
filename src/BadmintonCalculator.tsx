import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "badminton_settings";
const saveSettings = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };
const loadSettings = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };

const ROUNDING = ["四捨五入", "無條件進位", "無條件捨去"];

function applyRounding(val, mode) {
  if (mode === "無條件進位") return Math.ceil(val);
  if (mode === "無條件捨去") return Math.floor(val);
  return Math.round(val);
}

// ── Palette ────────────────────────────────────────────────────
const C = {
  bg:          "#eef4fb",       // 淡藍底
  bgCard:      "#ffffff",       // 卡片白
  bgInput:     "#e8f1fa",       // 輸入框淡藍
  bgSection:   "#f4f8fd",       // 區塊背景
  border:      "#c8ddf0",       // 邊框藍
  borderFocus: "#5b9bd5",       // 焦點邊框

  text:        "#1a2a3a",       // 主文字（深藍灰）
  textSub:     "#5a7a9a",       // 次要文字
  textMute:    "#90adc4",       // 弱化文字

  accent:      "#2e7fc1",       // 主強調（藍）
  accentLight: "#ddeeff",       // 強調淡底
  accentBorder:"#90c0e8",       // 強調邊框

  gold:        "#4a9fd4",       // 亮藍（取代金）
  goldLight:   "#dff0fb",       // 亮藍淡底

  teal:        "#3ab5c6",       // 青藍（次強調）
  tealLight:   "#e0f6f9",       // 青藍淡底

  danger:      "#c0404a",       // 警示紅
  dangerLight: "#fceaea",       // 警示淡底

  success:     "#3a8a6a",       // 成功綠
  successLight:"#e4f4ee",       // 成功淡底

  headerFrom:  "#1a4a7a",       // header深藍
  headerTo:    "#2e7fc1",       // header中藍
  headerAccent:"#a8d8f8",       // header亮色文字
};

export default function BadmintonCalculator() {
  const saved = loadSettings();

  const [courtFee, setCourtFee] = useState("");
  const [courts, setCourts] = useState([{ label: "場地A", fee: "" }]);
  const [multiCourt, setMultiCourt] = useState(false);

  const [shuttleBoxPrice, setShuttleBoxPrice] = useState(saved.shuttleBoxPrice ?? 399);
  const [shuttleBoxCount, setShuttleBoxCount] = useState(saved.shuttleBoxCount ?? 12);
  const [shuttlesUsed, setShuttlesUsed] = useState("");

  const [players, setPlayers] = useState([
    { name: "我", sessions: 1, shuttleOwner: true, excludeShuttle: false, paymentLink: "" },
  ]);
  const [totalSessions, setTotalSessions] = useState(1);
  const [partialSession, setPartialSession] = useState(false);

  const [rounding, setRounding] = useState(saved.rounding ?? "四捨五入");
  const [calculated, setCalculated] = useState(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    saveSettings({ shuttleBoxPrice, shuttleBoxCount, rounding });
  }, [shuttleBoxPrice, shuttleBoxCount, rounding]);

  const addPlayer = () => setPlayers([...players, {
    name: `玩家 ${players.length + 1}`, sessions: 1,
    shuttleOwner: false, excludeShuttle: false, paymentLink: "",
  }]);
  const removePlayer = (i) => { if (players.length <= 1) return; setPlayers(players.filter((_, idx) => idx !== i)); };
  const updatePlayer = (i, key, val) => setPlayers(players.map((p, idx) => idx === i ? { ...p, [key]: val } : p));

  const addCourt = () => setCourts([...courts, { label: `場地${String.fromCharCode(65 + courts.length)}`, fee: "" }]);
  const removeCourt = (i) => { if (courts.length <= 1) return; setCourts(courts.filter((_, idx) => idx !== i)); };
  const updateCourt = (i, key, val) => setCourts(courts.map((c, idx) => idx === i ? { ...c, [key]: val } : c));

  const calculate = useCallback(() => {
    const R = (n) => applyRounding(n, rounding);
    let totalCourt = 0;
    if (multiCourt) courts.forEach(c => { totalCourt += parseFloat(c.fee) || 0; });
    else totalCourt = parseFloat(courtFee) || 0;

    const boxPrice = parseFloat(shuttleBoxPrice) || 399;
    const boxCount = parseFloat(shuttleBoxCount) || 12;
    const used = parseFloat(shuttlesUsed) || 0;
    const shuttleFeeTotal = (used / boxCount) * boxPrice;

    const n = players.length;
    if (n === 0) return;

    let courtResults;
    if (partialSession && totalSessions > 0) {
      const totalWeight = players.reduce((sum, p) => sum + (parseFloat(p.sessions) || 0), 0);
      courtResults = players.map(p => R(totalCourt * ((parseFloat(p.sessions) || 0) / totalWeight)));
    } else {
      const base = R(totalCourt / n);
      courtResults = players.map(() => base);
    }

    const shuttlePayers = players.filter(p => !p.excludeShuttle);
    const shuttlePayerCount = shuttlePayers.length;
    const shuttlePerPayer = shuttlePayerCount > 0 ? shuttleFeeTotal / shuttlePayerCount : 0;
    const owners = players.filter(p => p.shuttleOwner && !p.excludeShuttle);
    const ownerCount = owners.length;
    const paidPerOwner = ownerCount > 0 ? shuttleFeeTotal / ownerCount : 0;

    const playerResults = players.map((p, i) => {
      const courtShare = courtResults[i];
      const excluded = p.excludeShuttle;
      const shuttleShare = excluded ? 0 : R(shuttlePerPayer);
      const isOwner = p.shuttleOwner && !excluded;
      let netPay, receives;
      if (isOwner) {
        netPay = courtShare - (paidPerOwner - shuttleShare);
        receives = R(paidPerOwner - shuttleShare);
      } else {
        netPay = courtShare + shuttleShare;
        receives = 0;
      }
      return { name: p.name, isOwner, excludeShuttle: excluded, courtShare, shuttleShare, netPay: R(netPay), receives: R(receives), sessions: p.sessions, paymentLink: p.paymentLink || "" };
    });

    setCalculated({ totalCourt, shuttleFeeTotal: R(shuttleFeeTotal), playerResults, owners: owners.map(o => o.name), shuttlePerPayer: R(shuttlePerPayer), rounding });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [courtFee, courts, multiCourt, shuttleBoxPrice, shuttleBoxCount, shuttlesUsed, players, totalSessions, partialSession, rounding]);

  const buildShareText = () => {
    if (!calculated) return "";
    const date = new Date().toLocaleDateString("zh-TW");
    let lines = [`🏸 ${date} 羽球分帳`, ""];
    calculated.playerResults.forEach(p => {
      if (p.isOwner) {
        lines.push(p.receives > 0
          ? `${p.name}：付場地 $${p.courtShare}，收球費 $${p.receives}`
          : `${p.name}：付 $${Math.abs(p.netPay)}（已含墊付球費）`);
      } else if (p.excludeShuttle) {
        lines.push(`${p.name}：付 $${p.courtShare}（僅場地費）`);
      } else {
        lines.push(`${p.name}：付 $${p.netPay}`);
      }
    });
    if (calculated.owners.length > 0) {
      lines.push("", `💡 球費請付給：${calculated.owners.join("、")}（每人 $${calculated.shuttlePerPayer}）`);
    }
    return lines.join("\n");
  };

  const copyToClipboard = async () => {
    const text = buildShareText();
    try { await navigator.clipboard.writeText(text); }
    catch { const el = document.createElement("textarea"); el.value = text; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const R = (n) => applyRounding(n, rounding);
  const shuttleFeePreview = shuttlesUsed && shuttleBoxPrice && shuttleBoxCount
    ? R((parseFloat(shuttlesUsed) / parseFloat(shuttleBoxCount)) * parseFloat(shuttleBoxPrice)) : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif", color: C.text, paddingBottom: 60 }}>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.headerFrom}, ${C.headerTo})`, padding: "32px 24px 28px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: "0 4px 20px #0000002a" }}>
        <div style={{ position: "absolute", top: -20, right: -10, fontSize: 130, opacity: 0.07, transform: "rotate(12deg)", userSelect: "none" }}>🏸</div>
        <div style={{ position: "absolute", bottom: -10, left: -10, fontSize: 80, opacity: 0.05, transform: "rotate(-20deg)", userSelect: "none" }}>🏸</div>
        <div style={{ fontSize: 40, marginBottom: 6 }}>🏸</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: "0 2px 10px #00000040" }}>羽球費用計算機</h1>
        <p style={{ margin: "8px 0 0", color: C.headerAccent, fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>打完球快速分帳，不再尷尬</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" }}>

        {/* ── Court Fee ── */}
        <Section title="場地費用" icon="🏟️">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: C.textSub }}>多場地模式</span>
            <Toggle value={multiCourt} onChange={setMultiCourt} />
          </div>
          {!multiCourt ? (
            <InputRow label="今日場地費">
              <NumberInput value={courtFee} onChange={setCourtFee} placeholder="例：700" prefix="$" suffix="元" />
            </InputRow>
          ) : (
            <>
              {courts.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input value={c.label} onChange={e => updateCourt(i, "label", e.target.value)} style={inputStyle} placeholder="名稱" />
                  <span style={{ color: C.gold, fontSize: 14 }}>$</span>
                  <input type="number" value={c.fee} onChange={e => updateCourt(i, "fee", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="費用" />
                  <span style={{ color: C.textSub, fontSize: 13 }}>元</span>
                  <button onClick={() => removeCourt(i)} style={removeBtnStyle}>×</button>
                </div>
              ))}
              <button onClick={addCourt} style={addDashedStyle}>＋ 新增場地</button>
              {courts.some(c => c.fee) && (
                <PreviewChip>
                  場地費合計：<strong style={{ color: C.accent }}>${courts.reduce((s, c) => s + (parseFloat(c.fee) || 0), 0)} 元</strong>
                </PreviewChip>
              )}
            </>
          )}
        </Section>

        {/* ── Shuttle Fee ── */}
        <Section title="球費設定" icon="🪶">
          <InputRow label="一盒羽球價格">
            <NumberInput value={shuttleBoxPrice} onChange={setShuttleBoxPrice} placeholder="399" prefix="$" suffix="元" />
          </InputRow>
          <InputRow label="一盒顆數">
            <NumberInput value={shuttleBoxCount} onChange={setShuttleBoxCount} placeholder="12" suffix="顆" />
          </InputRow>
          <InputRow label="今天用了幾顆">
            <NumberInput value={shuttlesUsed} onChange={setShuttlesUsed} placeholder="例：3" suffix="顆" />
          </InputRow>
          {shuttleFeePreview !== null && (
            <PreviewChip>
              球費合計：<strong style={{ color: C.accent }}>${shuttleFeePreview} 元</strong>
              （每顆約 ${R(parseFloat(shuttleBoxPrice) / parseFloat(shuttleBoxCount))} 元）
              <span style={{ marginLeft: 8, fontSize: 11, color: C.teal }}>設定已記憶 ✓</span>
            </PreviewChip>
          )}
        </Section>

        {/* ── Players ── */}
        <Section title={`參與人員（${players.length} 人）`} icon="👥">
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textSub }}>依出席時段分攤場地費</span>
              <Toggle value={partialSession} onChange={setPartialSession} />
            </div>
            {partialSession && (
              <InputRow label="總局數/節數">
                <NumberInput value={totalSessions} onChange={setTotalSessions} placeholder="例：4" suffix="節" />
              </InputRow>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.textMute, marginBottom: 10, display: "flex", gap: 14 }}>
            <span>🪶 球費持有者</span><span>🚫 不分球費</span>{partialSession && <span>📅 出席節數</span>}
          </div>
          {players.map((p, i) => (
            <div key={i} style={{
              background: p.shuttleOwner ? C.goldLight : C.bgSection,
              border: `1.5px solid ${p.shuttleOwner ? C.accentBorder : C.border}`,
              borderRadius: 12, padding: "10px 12px", marginBottom: 8,
            }}>
              <div style={{ display: "flex", gap: 6, marginBottom: partialSession ? 8 : 0, alignItems: "center" }}>
                <button onClick={() => updatePlayer(i, "shuttleOwner", !p.shuttleOwner)} title="切換球費持有者"
                  style={{ ...iconBtnStyle, background: p.shuttleOwner ? C.gold : C.bgInput, border: `2px solid ${p.shuttleOwner ? C.gold : C.border}` }}>🪶</button>
                <button onClick={() => updatePlayer(i, "excludeShuttle", !p.excludeShuttle)} title="切換不分球費"
                  style={{ ...iconBtnStyle, background: p.excludeShuttle ? C.dangerLight : C.bgInput, border: `2px solid ${p.excludeShuttle ? C.danger : C.border}` }}>🚫</button>
                <input value={p.name} onChange={e => updatePlayer(i, "name", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder={`玩家 ${i + 1}`} />
                <button onClick={() => removePlayer(i)} style={removeBtnStyle}>×</button>
              </div>
              {partialSession && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.textSub }}>出席節數</span>
                  <input type="number" value={p.sessions} onChange={e => updatePlayer(i, "sessions", e.target.value)}
                    style={{ ...inputStyle, width: 56, textAlign: "center" }} min="0" />
                  <span style={{ fontSize: 12, color: C.textSub }}>/ {totalSessions} 節</span>
                  <span style={{ fontSize: 11, color: C.textMute }}>
                    ({totalSessions > 0 ? Math.round((parseFloat(p.sessions) || 0) / totalSessions * 100) : 0}%)
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 18 }}>💳</span>
                <input
                  value={p.paymentLink}
                  onChange={e => updatePlayer(i, "paymentLink", e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                  placeholder="付款連結（LINE Pay / 街口 / 銀行...）"
                />
              </div>
            </div>
          ))}
          <button onClick={addPlayer} style={addDashedStyle}>＋ 新增玩家</button>
        </Section>

        {/* ── Rounding ── */}
        <Section title="進位設定" icon="🔢">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ROUNDING.map(r => (
              <button key={r} onClick={() => setRounding(r)} style={{
                padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                border: `1.5px solid ${rounding === r ? C.gold : C.border}`,
                background: rounding === r ? C.goldLight : C.bgInput,
                color: rounding === r ? C.headerTo : C.textSub,
                fontWeight: rounding === r ? 700 : 400, transition: "all 0.15s",
              }}>{r}</button>
            ))}
          </div>
        </Section>

        {/* ── Calculate ── */}
        <button onClick={calculate} style={{
          width: "100%", padding: "16px", marginBottom: 24,
          background: `linear-gradient(135deg, ${C.headerFrom}, ${C.headerTo})`,
          border: "none", borderRadius: 14, color: "#fff",
          fontSize: 18, fontWeight: 800, letterSpacing: 2,
          cursor: "pointer", boxShadow: `0 6px 24px ${C.headerTo}55`,
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.boxShadow = "none"; }}
          onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 6px 24px ${C.headerTo}55`; }}
        >💰 計算分帳</button>

        {/* ── Results ── */}
        {calculated && (
          <div ref={resultRef} style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px #0000001a" }}>

            {/* Summary */}
            <div style={{ background: `linear-gradient(135deg, ${C.headerFrom}, ${C.headerTo})`, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, color: C.headerAccent, marginBottom: 10, letterSpacing: 1 }}>▸ 費用總覽</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <StatChip label="場地費" value={`$${calculated.totalCourt}`} color="#fff" sub={C.headerAccent} />
                <StatChip label="球費" value={`$${calculated.shuttleFeeTotal}`} color="#fff" sub={C.headerAccent} />
                <StatChip label="進位方式" value={calculated.rounding} color={C.headerAccent} small sub={C.headerAccent} />
              </div>
            </div>

            {/* Per-person */}
            <div style={{ padding: "18px 16px" }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, letterSpacing: 1 }}>▸ 各人分帳明細</div>

              {calculated.playerResults.map((p, i) => (
                <div key={i} style={{
                  background: p.isOwner ? C.goldLight : C.bgSection,
                  border: `1.5px solid ${p.isOwner ? C.accentBorder : C.border}`,
                  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%",
                    background: p.isOwner ? C.gold : C.bgInput,
                    border: `2px solid ${p.isOwner ? C.accentBorder : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {p.isOwner ? "🪶" : p.excludeShuttle ? "🚫" : "🏸"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                      {p.name}
                      {p.isOwner && <span style={{ fontSize: 11, color: C.gold, marginLeft: 6, fontWeight: 400 }}>球費持有</span>}
                      {p.excludeShuttle && <span style={{ fontSize: 11, color: C.danger, marginLeft: 6, fontWeight: 400 }}>不分球費</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMute, marginTop: 3 }}>
                      場地 ${p.courtShare}{!p.excludeShuttle && ` ＋ 球費 $${p.shuttleShare}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {p.isOwner ? (
                      <>
                        <div style={{ fontSize: 11, color: C.textMute }}>付場地費</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>${p.courtShare}</div>
                        {p.receives > 0 && <div style={{ fontSize: 11, color: C.teal }}>收球費 ${p.receives}</div>}
                        {p.paymentLink && (
                          <a href={p.paymentLink.startsWith("http") ? p.paymentLink : `https://${p.paymentLink}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-block", marginTop: 6, padding: "5px 10px", background: C.tealLight, border: `1px solid ${C.teal}`, borderRadius: 8, color: C.teal, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                            💳 付款給{p.name}
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: C.textMute }}>應付</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: C.headerTo }}>${p.netPay}</div>
                        {calculated.owners.length > 0 && !p.excludeShuttle && (
                          <div style={{ fontSize: 11, color: C.textMute }}>含 ${p.shuttleShare} 給 {calculated.owners.join("/")}</div>
                        )}
                        {p.paymentLink && (
                          <a href={p.paymentLink.startsWith("http") ? p.paymentLink : `https://${p.paymentLink}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-block", marginTop: 6, padding: "5px 10px", background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, color: C.accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                            💳 付款連結
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Copy LINE */}
              <button onClick={copyToClipboard} style={{
                width: "100%", marginTop: 14, padding: "14px",
                background: copied ? C.successLight : C.bgInput,
                border: `1.5px solid ${copied ? C.success : C.border}`,
                borderRadius: 12, color: copied ? C.success : C.textSub,
                fontSize: 14, cursor: "pointer", fontWeight: 600,
                letterSpacing: 0.5, transition: "all 0.2s",
              }}>
                {copied ? "✅ 已複製！貼到 LINE 群組吧" : "📋 複製分帳結果（LINE 格式）"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared element styles ───────────────────────────────────────
const inputStyle = {
  background: C.bgInput, border: `1.5px solid ${C.border}`,
  borderRadius: 10, padding: "9px 12px",
  color: C.text, fontSize: 14, outline: "none",
};
const removeBtnStyle = {
  background: C.dangerLight, border: `1.5px solid #e8c4c0`,
  borderRadius: 8, width: 32, height: 32,
  color: C.danger, fontSize: 17, cursor: "pointer", flexShrink: 0,
};
const addDashedStyle = {
  width: "100%", marginTop: 4, background: "transparent",
  border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: "10px",
  color: C.textSub, fontSize: 14, cursor: "pointer", letterSpacing: 1,
};
const iconBtnStyle = {
  borderRadius: 8, width: 34, height: 34, fontSize: 15,
  cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
};

// ── Sub-components ──────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: 1.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}>
        <span>{icon}</span>{title}
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 14px 10px", boxShadow: "0 2px 8px #0000000a" }}>
        {children}
      </div>
    </div>
  );
}

function InputRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: C.textSub, width: 100, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, placeholder, prefix, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {prefix && <span style={{ color: C.gold, fontSize: 14, fontWeight: 600 }}>{prefix}</span>}
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, ...inputStyle, minWidth: 0 }} />
      {suffix && <span style={{ color: C.textMute, fontSize: 13, whiteSpace: "nowrap" }}>{suffix}</span>}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: "pointer",
      background: value ? C.gold : C.bgInput,
      border: `2px solid ${value ? C.gold : C.border}`,
      position: "relative", transition: "all 0.2s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 2, left: value ? 20 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: value ? "#fff" : C.border,
        transition: "left 0.2s", boxShadow: "0 1px 4px #00000022",
      }} />
    </div>
  );
}

function PreviewChip({ children }) {
  return (
    <div style={{ background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "8px 14px", marginTop: 8, fontSize: 13, color: C.textSub }}>
      {children}
    </div>
  );
}

function StatChip({ label, value, color, sub, small }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: sub, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: small ? 14 : 20, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}
