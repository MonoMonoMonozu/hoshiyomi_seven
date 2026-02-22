import { useState, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, Copy, Check, Eye, Upload, Calendar, Sparkles, User, ClipboardPaste } from "lucide-react";
import * as XLSX from "xlsx";

// HTMLマンダラからテキストだけ抽出してトークン削減
function extractMandalaText(raw) {
  const str = raw.trim();
  if (!str.startsWith("<") && !str.startsWith("<!")) return raw; // HTML以外はそのまま
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/html");
    // タイトル/サブタイトル
    const h1 = doc.querySelector("h1")?.textContent?.trim() || "";
    const sub = doc.querySelector(".sub strong")?.textContent?.trim() || doc.querySelector(".sub")?.textContent?.trim() || "";
    // .cellのテキストを全収集
    const cells = Array.from(doc.querySelectorAll(".cell"))
      .map(el => el.innerText?.trim() || el.textContent?.trim())
      .filter(t => t.length > 0);
    // カテゴリ(pillar/subcenter/goal)と通常セルに分けて出力
    const goals = Array.from(doc.querySelectorAll(".goal")).map(el => el.textContent?.trim()).filter(Boolean);
    const pillars = Array.from(doc.querySelectorAll(".pillar")).map(el => el.textContent?.trim()).filter(Boolean);
    const subcenter = Array.from(doc.querySelectorAll(".subcenter")).map(el => el.textContent?.trim()).filter(Boolean);
    const items = Array.from(doc.querySelectorAll(".item")).map(el => el.textContent?.trim()).filter(Boolean);
    let result = "";
    if (h1) result += `【タイトル】${h1}\n`;
    if (sub) result += `【中心目標】${sub}\n`;
    if (goals.length) result += `【ゴール】${goals.join(" / ")}\n`;
    if (pillars.length) result += `\n【8つのテーマ】\n${pillars.map(p => "・" + p).join("\n")}\n`;
    if (subcenter.length) result += `\n【サブテーマ】\n${subcenter.map(p => "・" + p).join("\n")}\n`;
    if (items.length) result += `\n【各テーマの行動指針】\n${items.map(p => "・" + p).join("\n")}\n`;
    return result || raw;
  } catch(e) { return raw; }
}

const CHARACTERS = [
  {
    id: "ruru", name: "るるるの部屋のホステス", icon: "🌸", color: "pink",
    description: "「まあ〜！素敵なのよ〜！」",
    borderClass: "border-pink-500", bgClass: "bg-pink-950", textClass: "text-pink-300", btnClass: "from-pink-700 to-fuchsia-700",
    systemPrompt: `あなたは「るるるの部屋のホステス」という名の占い師です。花いっぱいの温かいトーク番組のホステスをイメージしてください。【口調】「〜なのよ〜」「まあ〜！」が口癖。相手を「あなた」と呼ぶ。語尾は「〜してちょうだい！」。【性格】大げさに驚き深掘りする。温かく包容力があるがハッキリ言う。自分の経験談を1〜2文添える。良い点は大げさに褒め、改善点は優しく諭す。ラッキーアクティビティには「私もねえ、昔〜をやったらすごくよかったのよ〜」と経験談を添えて。`
  },
  {
    id: "maruko", name: "ゆるまる小学生", icon: "👧", color: "amber",
    description: "「面倒くさいわね、でも本当のこと言うよ」",
    borderClass: "border-amber-500", bgClass: "bg-amber-950", textClass: "text-amber-300", btnClass: "from-amber-600 to-yellow-600",
    systemPrompt: `あなたは「ゆるまる小学生」という名の占い師です。静岡の小さな町に住むゆるくて正直な小学生のキャラクターです。【口調】「〜めんどくさいわね」「まあいっか」「あたし的には」が口癖。「はぁ〜」「ったく」などのリアクション多め。【性格】面倒くさがりだが本質を突く。正直で根は優しい。やる気がなさそうで実は鋭い観察眼を持つ。おじいちゃんの俳句を「おじいちゃん 心の俳句」として締めに入れる。良い点は渋々認める「まあ…それはよかったんじゃない？めんどくさいけど認める」。改善点は「ったく、そこがねえ…面倒くさいけど言わせてよ」と渋々指摘。ラッキーアクティビティは「これだけやっときなよ、簡単だから」と最小限を勧める。`
  },
  {
    id: "honoo", name: "炎のインストラクター", icon: "🔥", color: "orange",
    description: "「心を燃やせ！！」",
    borderClass: "border-orange-500", bgClass: "bg-orange-950", textClass: "text-orange-300", btnClass: "from-red-700 to-orange-600",
    systemPrompt: `あなたは「炎のインストラクター」という名の占い師です。熱血で誠実な武道の師範をイメージしてください。【口調】「うむ！」「よもやよもや」が口癖。語尾に「！！」多用。「俺」一人称、相手は「君」。【性格】真っ直ぐで誠実。弱さを否定せず受け入れる強さを持つ。「心を燃やせ」をここぞで使う。良い点は全力で肯定「素晴らしい！！君の努力は確実に実を結んでいる！！」。改善点は「伸びしろ」として激励「だが、ここにはまだ伸びしろがある！弱さを認められる者こそ強い！！」。ラッキーアクティビティは「来週の君への任務だ！！」として提示。`
  },
  {
    id: "necchukyodai", name: "熱血兄弟", icon: "🎙️", color: "blue",
    description: "「いいんですか？いいんです！」",
    borderClass: "border-blue-500", bgClass: "bg-blue-950", textClass: "text-blue-300", btnClass: "from-blue-700 to-cyan-700",
    systemPrompt: `あなたは「熱血兄弟」という名の占い師です。スポーツ実況が得意な兄弟コンビをイメージしてください。二人の掛け合い形式で話してください。【兄】実況風「さあ！」「出ました！」が口癖。【弟】「いいんですか？いいんです！」が決め台詞。【性格】常にテンション高い。スポーツ実況のようなテンポ。【兄】【弟】で発言者を明示する。良い点は「【兄】素晴らしい！！【弟】いいんですか！？…いいんです！！」。改善点は「【弟】伸びしろがあるんですか？いいんです！！可能性です！！」。最後は必ず「いいんですか？いいんです！！」で締める。`
  },
  {
    id: "kashiwa", name: "松戸デラックス", icon: "👑", color: "purple",
    description: "「あんたの言いたいことはわかってるの」",
    borderClass: "border-purple-500", bgClass: "bg-purple-950", textClass: "text-purple-300", btnClass: "from-purple-700 to-pink-700",
    systemPrompt: `あなたは「松戸デラックス」という名の占い師です。千葉県柏市出身の毒舌で本音を語るキャラクターです。【口調】「あんたの言いたいことはわかってるの」「そういうことでしょ」が口癖。相手を「あなた」と呼ぶ。【性格】相手の言いたいことを先読みして核心を突く。毒舌だが深い愛情がある。回りくどい説明は不要と言わんばかりに本質を先に言う。良い点は「それがあなたの強みでしょ、わかってるわよ」と先読みして肯定。改善点は「あなたが言いにくいことを代わりに言ってあげる、ここよここ」と核心を突く。ラッキーアクティビティは「あなたが本当はやりたいのはこれでしょ」と看破して提案。`
  },
  {
    id: "isegahama", name: "伊勢ヶ浜幽聴", icon: "🪷", color: "green",
    description: "「ほほ、人生とはそういうものじゃ」",
    borderClass: "border-green-500", bgClass: "bg-green-950", textClass: "text-green-300", btnClass: "from-green-700 to-teal-700",
    systemPrompt: `あなたは「伊勢ヶ浜幽聴」という名の占い師です。瀬戸内の島に住む老齢の尼僧・作家をイメージしてください。【口調】「〜じゃ」「〜のう」「ほほ」が口癖。相手を「あなた」と呼ぶ。穏やかで深みのある語り口。【性格】人生経験豊富で温かく受け入れる。愛と慈悲を軸に語る。恋愛・人間関係に深い共感を示す。良い点は「ほほ、それは素晴らしいことじゃ」と温かく肯定。改善点は「人生とはそういうもの、焦らずともよい」と諭す。ラッキーアクティビティは「これをやってごらん、心が軽くなるじゃろう」と優しく提案。人生の深みを感じさせる言葉を添える。`
  },
];

const ANALYSIS_TEMPLATE = `あなたは占い師として、「活動方針」と「活動ログ」を照合し振り返りフィードバックを行います。

### 活動方針・目標
\`\`\`
{{MANDALA}}
\`\`\`

### 活動ログ（{{DATE_FROM}} 〜 {{DATE_TO}}）
\`\`\`
{{LOG}}
\`\`\`

以下のJSON形式「のみ」を出力してください。JSON以外のテキストは不要です。

\`\`\`json
{
  "summary": "【ここに総評を記入】",
  "insight": "【ここに洞察を記入】",
  "scores": [
    { "category": "走ること", "score": 0 },
    { "category": "心のケア", "score": 0 },
    { "category": "クリエイティブ", "score": 0 },
    { "category": "学びと探求", "score": 0 },
    { "category": "仕事・DX", "score": 0 },
    { "category": "人と繋がり", "score": 0 },
    { "category": "旅とリセット", "score": 0 },
    { "category": "文化と感性", "score": 0 }
  ],
  "good_points": [
    { "title": "【良かった点1のタイトル】", "detail": "【詳細コメント】" },
    { "title": "【良かった点2のタイトル】", "detail": "【詳細コメント】" }
  ],
  "improve_points": [
    { "title": "【改善点のタイトル】", "detail": "【詳細コメント】" }
  ],
  "lucky_activity": {
    "title": "【ラッキーアクティビティ名】",
    "description": "【具体的な行動と励まし】",
    "reasons": ["【理由1】", "【理由2】", "【理由3】"]
  }
}
\`\`\`

制約：ポジティブ比率7:3。ログの具体的内容に必ず言及する。ラッキーアクティビティは明日からすぐできる行動1つ。占い風演出を加える。scoresのカテゴリは活動方針から抽出した実際のカテゴリ名を使うこと。`;

function getDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function StepNav({ step }) {
  const labels = ["開始","キャラ","目標","ログ","期間","生成","結果"];
  return (
    <div className="flex justify-center gap-1 py-3 flex-wrap">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= i ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-600"}`}>{i+1}</div>
          {i < labels.length-1 && <div className={`w-3 h-0.5 ${step > i ? "bg-purple-500" : "bg-gray-800"}`} />}
        </div>
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel="次へ", nextDisabled=false }) {
  return (
    <div className="flex justify-between pt-6">
      <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"><ChevronLeft size={18}/> 戻る</button>
      <button onClick={onNext} disabled={nextDisabled}
        className={`px-6 py-2 rounded-full font-bold flex items-center gap-1 text-sm ${nextDisabled ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
        {nextLabel} <ChevronRight size={18}/>
      </button>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef();
  const handleCopy = () => {
    const fallback = () => {
      const ta = taRef.current;
      if (!ta) return;
      ta.value = text;
      ta.style.display = "block";
      ta.select();
      ta.setSelectionRange(0, text.length);
      try { document.execCommand("copy"); } catch(e) {}
      ta.style.display = "none";
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
        .catch(fallback);
    } else { fallback(); }
  };
  return (
    <>
      <textarea ref={taRef} style={{display:"none",position:"fixed",top:0,left:0,opacity:0,width:"1px",height:"1px"}} readOnly/>
      <button onClick={handleCopy}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-base transition-all ${copied ? "bg-green-700 text-green-100" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
        {copied ? <><Check size={18}/> コピーしました！</> : <><Copy size={18}/> プロンプトをコピー</>}
      </button>
    </>
  );
}

function FileDropArea({ onLoad, accept, hint, value, onChange }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  const handleFile = async (file) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();
    if (["xlsx","xlsm","xls"].includes(ext)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      let allText = "";
      wb.SheetNames.forEach(name => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        if (csv.trim()) allText += `=== シート: ${name} ===\n${csv}\n\n`;
      });
      onLoad(allText);
    } else {
      onLoad(await file.text());
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragging ? "border-purple-400 bg-purple-950" : "border-gray-700 hover:border-gray-500"}`}>
        <Upload size={24} className="mx-auto mb-2 text-gray-500"/>
        <p className="text-gray-400 text-sm">{fileName || "ファイルをドロップ または クリックして選択"}</p>
        <p className="text-gray-600 text-xs mt-1">{hint}</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}/>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-800"/>
        <span className="text-gray-600 text-xs">または直接入力・貼り付け</span>
        <div className="flex-1 h-px bg-gray-800"/>
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="テキストをここに貼り付け..."
        className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white text-sm resize-none focus:outline-none focus:border-purple-500 placeholder-gray-600"/>
      {value && <p className="text-gray-500 text-xs">{value.length} 文字</p>}
    </div>
  );
}

function RadarChart({ scores, color }) {
  const size = 280, center = 140, radius = 95, levels = 4;
  const count = scores.length;
  const step = (2 * Math.PI) / count;
  const pt = (i, v) => { const a = step*i - Math.PI/2, r = (v/100)*radius; return { x: center+r*Math.cos(a), y: center+r*Math.sin(a) }; };
  const colors = {
    pink: ["rgba(244,114,182,0.3)","#f472b6"],
    amber: ["rgba(251,191,36,0.3)","#fbbf24"],
    orange: ["rgba(251,146,60,0.3)","#f97316"],
    blue: ["rgba(96,165,250,0.3)","#60a5fa"],
    purple: ["rgba(192,132,252,0.3)","#c084fc"],
    green: ["rgba(74,222,128,0.3)","#4ade80"]
  };
  const [fill, stroke] = colors[color] || colors.blue;
  const pts = scores.map((s,i) => { const p = pt(i,s.score); return `${p.x},${p.y}`; }).join(" ");
  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-xs mx-auto">
      <rect x="0" y="0" width="280" height="280" fill="#09090b" rx="12"/>
      {[...Array(levels)].map((_,l) => {
        const r2=(radius*(l+1))/levels;
        const p2=scores.map((_,i)=>{const a=step*i-Math.PI/2;return `${center+r2*Math.cos(a)},${center+r2*Math.sin(a)}`;}).join(" ");
        return <polygon key={l} points={p2} fill="none" stroke="#27272a" strokeWidth="1"/>;
      })}
      {scores.map((_,i) => { const p=pt(i,100); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#27272a" strokeWidth="0.8"/>; })}
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2.5"/>
      {scores.map((s,i) => { const p=pt(i,118); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill="#d4d4d8" fontWeight="bold">{s.category}</text>; })}
      {scores.map((s,i) => { const p=pt(i,s.score); return <circle key={i} cx={p.x} cy={p.y} r="4" fill={stroke} stroke="white" strokeWidth="1.5"/>; })}
    </svg>
  );
}

export default function App() {
  const [step, setStep] = useState(0);
  const [charId, setCharId] = useState(null);
  const [mandala, setMandala] = useState("");
  const [log, setLog] = useState("");
  const [dateFrom, setDateFrom] = useState(getDateStr(6));
  const [dateTo, setDateTo] = useState(getDateStr(0));
  const [resultJson, setResultJson] = useState("");
  const [parsedResult, setParsedResult] = useState(null);
  const [parseError, setParseError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const char = CHARACTERS.find(c => c.id === charId);

  const buildPrompt = () => {
    if (!char) return "";
    return `【システムプロンプト】\n${char.systemPrompt}\n\n---\n\n${ANALYSIS_TEMPLATE
      .replace("{{MANDALA}}", extractMandalaText(mandala))
      .replace("{{LOG}}", log)
      .replace("{{DATE_FROM}}", dateFrom)
      .replace("{{DATE_TO}}", dateTo)}`;
  };

  const callAPI = async () => {
    if (!apiKey.trim()) { setApiError("APIキーを入力してください"); return; }
    setIsLoading(true);
    setApiError("");
    try {
      const prompt = buildPrompt();
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4000,
          system: char?.systemPrompt || "",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `APIエラー: ${res.status}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      setResultJson(text);
      // そのままパース
      let t = text.trim();
      const fenced = t.match(/```json?\s*([\s\S]*?)```/);
      if (fenced) { t = fenced[1].trim(); }
      else {
        const start = t.indexOf("{");
        if (start === -1) throw new Error("JSONが見つかりません");
        t = t.substring(start);
        let depth = 0, end = -1;
        for (let i = 0; i < t.length; i++) {
          if (t[i] === "{") depth++;
          else if (t[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) t = t.substring(0, end + 1);
      }
      const parsed = JSON.parse(t);
      setParsedResult(parsed);
      setStep(6);
    } catch(e) {
      setApiError("エラー: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParse = () => {
    setParseError("");
    try {
      let text = resultJson.trim();
      // ```json ... ``` ブロックがあれば中身だけ取り出す
      const fenced = text.match(/```json?\s*([\s\S]*?)```/);
      if (fenced) {
        text = fenced[1].trim();
      } else {
        // { から始まる最初のJSONオブジェクトだけを抽出（後ろの余分なテキストを除去）
        const start = text.indexOf("{");
        if (start === -1) throw new Error("JSONが見つかりません");
        text = text.substring(start);
        // 対応する閉じ括弧を数えて正確なJSON範囲を特定
        let depth = 0, end = -1;
        for (let i = 0; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) text = text.substring(0, end + 1);
      }
      const data = JSON.parse(text);
      if (!data.summary || !data.scores) throw new Error("summaryまたはscoresがありません。Claudeの出力をそのまま貼り付けてください。");
      setParsedResult(data);
    } catch(e) { setParseError("JSONの解析に失敗しました。\n" + e.message); }
  };

  const renderStep = () => {
    switch(step) {
      case 0:
        return (
          <div className="flex flex-col items-center text-center space-y-6 pt-8">
            <div className="text-6xl">🔮</div>
            <h1 className="text-3xl font-bold text-white">星よみリフレクション</h1>
            <p className="text-gray-300 max-w-sm leading-relaxed">あなた専属の占い師が今週の活動を読み解き、来週のラッキーアクティビティをお伝えします。</p>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-left max-w-sm w-full">
              <p className="text-gray-400 text-xs mb-2 font-bold">📋 用意するもの</p>
              <p className="text-gray-300 text-sm">① 目標・活動方針（テキスト / HTMLファイル）</p>
              <p className="text-gray-300 text-sm">② 活動ログ（Excel / CSV / テキスト）</p>
              <p className="text-gray-400 text-xs mt-2">※ Claude.ai または ChatGPT を使います</p>
            </div>
            <div className="w-full max-w-sm space-y-2">
              <p className="text-gray-400 text-xs text-left font-bold">🔑 Anthropic APIキー（任意・入力すると自動分析）</p>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 placeholder-gray-600 font-mono"
              />
              <p className="text-gray-600 text-xs">入力しない場合はClaude.aiを使う手動モードになります</p>
            </div>
            <button onClick={() => setStep(1)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2">
              はじめる <Sparkles size={18}/>
            </button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><User size={22}/> 占い師を選ぶ</h2>
            <div className="space-y-3">
              {CHARACTERS.map(c => (
                <button key={c.id} onClick={() => setCharId(c.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${charId===c.id ? `${c.borderClass} ${c.bgClass}` : "border-gray-800 bg-gray-900 hover:border-gray-600"}`}>
                  <span className="text-3xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className={`font-bold ${charId===c.id ? "text-white" : "text-gray-300"}`}>{c.name}</p>
                    <p className="text-sm text-gray-400">{c.description}</p>
                  </div>
                  {charId===c.id && <span className="text-green-400 text-lg">✓</span>}
                </button>
              ))}
            </div>
            <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!charId}/>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Eye size={22}/> 目標・活動方針</h2>
            <p className="text-gray-400 text-sm">マンダラチャート、目標リスト、何でもOK。ファイルをドロップするか直接入力してください。</p>
            <FileDropArea
              accept=".html,.htm,.txt,.md,.csv"
              hint="HTML / TXT / MD / CSV 対応"
              value={mandala}
              onChange={setMandala}
              onLoad={setMandala}
            />
            <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={mandala.trim().length===0}/>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Upload size={22}/> 活動ログ</h2>
            <p className="text-gray-400 text-sm">日記、日報、Excelの記録など何でもOK。ファイルをドロップするか直接入力してください。</p>
            <FileDropArea
              accept=".xlsx,.xlsm,.xls,.csv,.txt,.md"
              hint="Excel(xlsm/xlsx) / CSV / TXT 対応"
              value={log}
              onChange={setLog}
              onLoad={setLog}
            />
            <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={log.trim().length===0}/>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar size={22}/> 分析期間</h2>
            <div className="space-y-2">
              {[{label:"直近7日",f:6,t:0},{label:"直近14日",f:13,t:0},{label:"直近30日",f:29,t:0}].map(p => (
                <button key={p.label} onClick={() => { setDateFrom(getDateStr(p.f)); setDateTo(getDateStr(p.t)); }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${dateFrom===getDateStr(p.f)&&dateTo===getDateStr(p.t) ? "border-purple-500 bg-purple-950 text-white" : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-2">カスタム期間</p>
              <div className="flex items-center gap-3">
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"/>
                <span className="text-gray-500">〜</span>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"/>
              </div>
            </div>
            <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="プロンプト生成"/>
          </div>
        );

      case 5:
        const prompt = buildPrompt();
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Copy size={22}/> プロンプト完成！</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{char?.icon}</span>
              <div>
                <p className="text-white font-bold">{char?.name}</p>
                <p className="text-gray-500 text-xs">{dateFrom} 〜 {dateTo} ／ 目標 {mandala.length}字 ／ ログ {log.length}字</p>
              </div>
            </div>
            <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4 space-y-1">
              <p className="text-yellow-200 font-bold text-sm">📋 次のステップ</p>
              <p className="text-yellow-100 text-sm">① 下のボタンでプロンプトをコピー</p>
              <p className="text-yellow-100 text-sm">② <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline text-yellow-300">claude.ai</a> または ChatGPT に貼り付けて送信</p>
              <p className="text-yellow-100 text-sm">③ 返ってきたJSONを「次へ」で貼り付け</p>
            </div>
            <div className="flex justify-center"><CopyButton text={prompt}/></div>
            <details className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <summary className="p-3 text-gray-400 text-xs cursor-pointer">プロンプトを確認 ▼</summary>
              <pre className="p-4 text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">{prompt}</pre>
            </details>
            <div className="space-y-3">
              {apiKey ? (
                <button onClick={callAPI} disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white ${isLoading ? "bg-gray-700 cursor-not-allowed" : `bg-gradient-to-r ${char?.btnClass}`}`}>
                  {isLoading ? <><span className="animate-spin">⟳</span> 分析中...</> : <><Sparkles size={18}/> AIに送信して分析する</>}
                </button>
              ) : (
                <div className="bg-gray-900 border border-yellow-700 rounded-xl p-3 text-yellow-300 text-sm text-center">
                  ⚠️ ステップ1でAPIキーを入力するとここで直接分析できます
                </div>
              )}
              {apiError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg p-3">{apiError}</p>}
            </div>
            <NavButtons onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="手動でJSONを貼り付ける"/>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardPaste size={22}/> 結果を貼り付け</h2>
            <p className="text-gray-400 text-sm">AIから返ってきたJSON結果をそのまま貼り付けてください。</p>
            <textarea value={resultJson} onChange={e => { setResultJson(e.target.value); setParseError(""); setParsedResult(null); }}
              placeholder='{"summary": "...", "scores": [...], ...}'
              className="w-full h-48 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white text-sm resize-none focus:outline-none focus:border-purple-500 placeholder-gray-600 font-mono"/>
            {parseError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg p-3 whitespace-pre-wrap">{parseError}</p>}

            {!parsedResult ? (
              <div className="space-y-3">
                <button onClick={handleParse} disabled={resultJson.trim().length===0}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${resultJson.trim().length>0 ? `bg-gradient-to-r ${char?.btnClass} text-white` : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
                  <Sparkles size={18}/> 占い結果を表示する
                </button>
                <button onClick={() => setStep(5)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"><ChevronLeft size={18}/> 戻る</button>
              </div>
            ) : (
              <div className="space-y-5 pt-2">
                <div className="text-center">
                  <div className="text-5xl mb-2">{char?.icon}</div>
                  <h3 className="text-2xl font-bold text-white">{char?.name}の星よみ</h3>
                  <p className="text-gray-400 text-sm">{dateFrom} 〜 {dateTo}</p>
                </div>

                <RadarChart scores={parsedResult.scores||[]} color={char?.color||"blue"}/>

                <div className="space-y-2">
                  {(parsedResult.scores||[]).map(s => (
                    <div key={s.category} className="flex items-center gap-3">
                      <span className="text-xs text-white w-24 text-right shrink-0">{s.category}</span>
                      <div className="flex-1 bg-gray-900 rounded-full h-3 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${s.score>=70?"bg-green-500":s.score>=50?"bg-yellow-500":"bg-red-500"}`} style={{width:`${s.score}%`}}/>
                      </div>
                      <span className="text-xs text-white w-8 shrink-0">{s.score}</span>
                    </div>
                  ))}
                </div>

                <div className={`${char?.bgClass} border ${char?.borderClass} rounded-xl p-4`}>
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{parsedResult.summary}</p>
                </div>

                {parsedResult.insight && (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <p className="text-gray-300 font-bold text-sm mb-2">🔍 洞察</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{parsedResult.insight}</p>
                  </div>
                )}

                {(parsedResult.good_points||[]).map((gp,i) => (
                  <div key={i} className="bg-gray-900 border-l-4 border-green-500 rounded-r-xl p-4">
                    <p className="text-green-300 font-bold text-sm mb-1">⭐ {gp.title}</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{gp.detail}</p>
                  </div>
                ))}

                {(parsedResult.improve_points||[]).map((ip,i) => (
                  <div key={i} className="bg-gray-900 border-l-4 border-amber-500 rounded-r-xl p-4">
                    <p className="text-amber-300 font-bold text-sm mb-1">💛 {ip.title}</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{ip.detail}</p>
                  </div>
                ))}

                {parsedResult.lucky_activity && (
                  <div className={`${char?.bgClass} border-2 ${char?.borderClass} rounded-2xl p-5 text-center`}>
                    <p className="text-gray-400 text-xs mb-1">🍀 ラッキーアクティビティ</p>
                    <h4 className={`text-xl font-bold ${char?.textClass} mb-3`}>{parsedResult.lucky_activity.title}</h4>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap mb-3">{parsedResult.lucky_activity.description}</p>
                    <div className="bg-black rounded-lg p-3 text-left space-y-1">
                      {(parsedResult.lucky_activity.reasons||[]).map((r,i) => (
                        <p key={i} className="text-gray-300 text-xs">✦ {r}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <button onClick={() => { setStep(0); setCharId(null); setMandala(""); setLog(""); setResultJson(""); setParsedResult(null); }}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-full text-sm">
                    最初からやり直す
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <StepNav step={step}/>
      <div className="flex-1 flex items-start justify-center p-4">
        <div className="w-full max-w-md pb-12">{renderStep()}</div>
      </div>
    </div>
  );
}
