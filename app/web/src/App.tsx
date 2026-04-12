import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, Send, PhoneOff, RefreshCw, Layers,
  LayoutDashboard, Sparkles, Info, Lightbulb, X,
  ChevronUp, Copy, Check, Clock,
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; followUps?: string[] };

interface DealMemory {
  customerName?: string;
  company?: string;
  painPoints?: string[];
  budget?: string;
  timeline?: string;
}

interface FinalReport {
  summaryBullets?: string[];
  actionItems?: { owner: string; item: string }[];
  followupEmail?: string;
}

function newSessionId() {
  return "session-" + Math.random().toString(16).slice(2);
}

const SAMPLE_PROMPTS = [
  "The customer says your product is too expensive compared to competitors.",
  "They're concerned about the implementation timeline being too long.",
  "The prospect says they're happy with their current solution.",
  "They don't see the ROI and want more concrete numbers.",
  "The decision maker is worried about getting buy-in from their team.",
];

// --- Session Timer ---
function useSessionTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    if (startRef.current === null) startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return { display: `${mm}:${ss}`, active };
}

// --- Copy button ---
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-all"
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// --- Post-call report panel ---
function PostCallReport({ final }: { final: FinalReport }) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-xl shadow-lg mt-6 overflow-hidden">
      <div className="px-4 py-3 bg-emerald-600 flex items-center gap-2">
        <Layers size={15} className="text-white" />
        <span className="text-white font-bold text-sm">Post-Call Report</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        {final.summaryBullets && final.summaryBullets.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 mb-2">Summary</p>
            <ul className="space-y-1.5">
              {final.summaryBullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-xs text-emerald-900 leading-relaxed">
                  <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {final.actionItems && final.actionItems.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 mb-2">Action Items</p>
            <div className="space-y-1.5">
              {final.actionItems.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-emerald-900">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    a.owner === "Rep"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>{a.owner}</span>
                  <span className="leading-relaxed">{a.item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up Email */}
        {final.followupEmail && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Follow-Up Email</p>
              <CopyButton text={final.followupEmail} />
            </div>
            <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
              {final.followupEmail}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Deal Intelligence panel content (shared between sidebar and drawer) ---
function DealIntelligenceContent({
  rollingSummary,
  dealMemory,
  final,
}: {
  rollingSummary: string;
  dealMemory: DealMemory;
  final: FinalReport | null;
}) {
  const hasData = rollingSummary || Object.values(dealMemory).some(v => v) || final;

  return (
    <div className="space-y-4">
      {rollingSummary && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-orange-600" />
            <h3 className="text-xs text-slate-600 uppercase font-bold tracking-wide">Rolling Summary</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{rollingSummary}</p>
        </div>
      )}

      <div className="space-y-3">
        <MemoryItem label="Customer" value={dealMemory.customerName} />
        <MemoryItem label="Company" value={dealMemory.company} />
        <MemoryItem label="Pain Points" value={dealMemory.painPoints} isList />
        <MemoryItem label="Budget" value={dealMemory.budget} />
        <MemoryItem label="Timeline" value={dealMemory.timeline} />
      </div>

      {final && <PostCallReport final={final} />}

      {!hasData && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <LayoutDashboard size={24} className="text-orange-600" />
          </div>
          <p className="text-slate-500 text-sm">Deal data will appear here</p>
          <p className="text-slate-400 text-xs mt-1">Try a sample prompt to see it in action</p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [sessionId] = useState(() => newSessionId());
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [dealMemory, setDealMemory] = useState<DealMemory>({});
  const [loading, setLoading] = useState(false);
  const [final, setFinal] = useState<FinalReport | null>(null);
  const [status, setStatus] = useState<string>("");
  const [rollingSummary, setRollingSummary] = useState<string>("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const timerActive = msgs.length > 0;
  const timer = useSessionTimer(timerActive);

  const apiBase = useMemo(() => {
    return import.meta.env.VITE_API_BASE ?? "http://localhost:8787";
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = useCallback(async (text?: string) => {
    const message = text ?? input.trim();
    if (!message || loading) return;

    setLoading(true);
    setStatus("");
    setShowGuide(false);
    setMsgs(m => [...m, { role: "user", content: message }]);
    setInput("");

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      if (!res.ok) throw new Error(`chat failed: ${res.status}`);
      const data = await res.json();

      setMsgs(m => [...m, { role: "assistant", content: data.reply, followUps: data.followUps ?? [] }]);
      if (data.dealMemory) setDealMemory(data.dealMemory);
      if (data.rollingSummary) setRollingSummary(data.rollingSummary);
    } catch (e: any) {
      setStatus(e?.message ?? "Request failed");
      setMsgs(m => [...m, { role: "assistant", content: "Error connecting to agent." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, apiBase, sessionId]);

  async function endCall() {
    if (!confirm("End call and generate report?")) return;
    setStatus("Generating report — this takes about 30 seconds...");
    setFinal(null);
    setIsFinalizing(true);

    try {
      const res = await fetch(`${apiBase}/api/end-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`end-call failed: ${res.status}`);
      const data = await res.json();

      if (data?.final) {
        setFinal(data.final);
        setStatus("Report ready.");
        setIsFinalizing(false);
        return;
      }

      // Fallback poll
      const start = Date.now();
      while (Date.now() - start < 90000) {
        const r = await fetch(`${apiBase}/api/results?sessionId=${encodeURIComponent(sessionId)}`);
        if (r.ok) {
          const out = await r.json();
          if (out?.final) {
            setFinal(out.final);
            setStatus("Report ready.");
            setIsFinalizing(false);
            return;
          }
        }
        await new Promise(x => setTimeout(x, 1200));
      }
      setStatus("Still processing — try refreshing in a moment.");
      setIsFinalizing(false);
    } catch (e: any) {
      setStatus(e?.message ?? "End call failed");
      setIsFinalizing(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all state?")) return;
    try {
      await fetch(`${apiBase}/api/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* best-effort */ }
    setMsgs([]);
    setDealMemory({});
    setFinal(null);
    setRollingSummary("");
    setStatus("");
    setIsFinalizing(false);
    setShowGuide(true);
    setDrawerOpen(false);
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 text-slate-900 font-sans overflow-hidden">

      {/* ── LEFT SIDEBAR (desktop only) ── */}
      <div className="w-96 border-r border-slate-200 bg-white/80 backdrop-blur-sm p-6 overflow-y-auto hidden lg:flex flex-col gap-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <h2 className="font-bold tracking-tight text-slate-900 text-base">Deal Intelligence</h2>
        </div>

        <DealIntelligenceContent
          rollingSummary={rollingSummary}
          dealMemory={dealMemory}
          final={final}
        />

        {/* How It Works */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-orange-600" />
            <h3 className="font-bold text-sm text-slate-900">How It Works</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>🎯 <strong>Real-time Deal Tracking:</strong> Extracts customer info, pain points, budget, and timeline as you chat</p>
            <p>💡 <strong>AI-Powered Coaching:</strong> Get instant objection handling strategies and best practices</p>
            <p>📊 <strong>Post-Call Reports:</strong> Click "End Call" to generate summary, action items, and a follow-up email draft</p>
          </div>
        </div>

        {/* Founder Badge */}
        <div className="pt-6 border-t border-slate-200 mt-auto">
          <div className="bg-gradient-to-br from-slate-50 to-orange-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                DL
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 mb-0.5">Built by Daniel Lambo</p>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Computer Science @ Alabama A&M University · AI agents, sales automation, full-stack
                </p>
                <div className="flex gap-2 mt-2">
                  <a href="https://github.com/DanielLambo" target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-600 hover:text-orange-700 font-medium">GitHub →</a>
                  <a href="https://www.linkedin.com/in/daniel-lambo/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-600 hover:text-orange-700 font-medium">LinkedIn →</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: CHAT COLUMN ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">

        {/* Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 bg-white shadow-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/salescoachAI.PNG" alt="Sales Coach AI" className="h-10 w-auto object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-base lg:text-lg text-slate-900 truncate">Sales Objection Coach</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                <span className="text-xs text-slate-500 font-medium hidden sm:block">AI-Powered Sales Training</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Session timer */}
            {timerActive && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-600 border border-slate-200">
                <Clock size={12} className="text-orange-500" />
                {timer.display}
              </div>
            )}

            {/* Mobile: Deal Intelligence toggle */}
            <button
              onClick={() => setDrawerOpen(o => !o)}
              className="lg:hidden p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Deal Intelligence"
            >
              <LayoutDashboard size={18} />
            </button>

            <button
              onClick={() => setShowGuide(g => !g)}
              className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Toggle Guide"
            >
              <Info size={18} />
            </button>
            <button
              onClick={handleReset}
              className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Reset Session"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={endCall}
              disabled={isFinalizing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm transition-all shadow-md ${
                isFinalizing
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-200"
              }`}
            >
              <PhoneOff size={15} />
              <span className="hidden sm:inline">{isFinalizing ? "Finalizing..." : "End Call"}</span>
            </button>
          </div>
        </header>

        {/* ── Mobile Deal Intelligence Drawer ── */}
        {drawerOpen && (
          <div className="lg:hidden border-b border-slate-200 bg-white shadow-md">
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard size={16} className="text-orange-600" />
                Deal Intelligence
              </div>
              <ChevronUp size={16} className="text-slate-400" />
            </button>
            <div className="px-4 pb-4 max-h-72 overflow-y-auto">
              <DealIntelligenceContent
                rollingSummary={rollingSummary}
                dealMemory={dealMemory}
                final={final}
              />
            </div>
          </div>
        )}

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-gradient-to-br from-slate-50/50 to-orange-50/20">

          {/* Welcome Guide */}
          {showGuide && msgs.length === 0 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl border-2 border-orange-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold mb-1">Welcome to Sales Objection Coach 👋</h2>
                      <p className="text-orange-100 text-sm">AI-powered role-play for handling customer objections in real time</p>
                    </div>
                    <button onClick={() => setShowGuide(false)} className="text-white/70 hover:text-white transition-colors shrink-0 mt-0.5">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-800 mb-1">How it works:</p>
                    <p>1. <strong>You're the sales rep</strong> on a live call with a customer.</p>
                    <p>2. <strong>Type what the customer says</strong> — their objection, concern, or pushback.</p>
                    <p>3. <strong>The AI coach gives you a response</strong> to say back, word for word.</p>
                    <p>4. <strong>"Ask next" suggestions</strong> are follow-up questions you can ask the customer to advance the deal.</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-orange-500" />
                      Common objections to try:
                    </p>
                    <div className="space-y-1.5">
                      {SAMPLE_PROMPTS.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => send(prompt)}
                          className="w-full text-left px-3 py-2.5 bg-gradient-to-r from-slate-50 to-orange-50 hover:from-orange-50 hover:to-orange-100 border border-slate-200 hover:border-orange-300 rounded-lg transition-all text-sm text-slate-700 hover:text-slate-900 group"
                        >
                          <span className="text-orange-500 group-hover:text-orange-600 mr-1.5">→</span>{prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <strong>Tip:</strong> The coach's reply is a script — say it out loud to the customer. The "Ask next" chips are follow-up questions you ask them, not things to type here.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty state (guide hidden) */}
          {!showGuide && msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center shadow-lg">
                <MessageCircle size={32} className="text-orange-600" />
              </div>
              <p className="text-slate-600 font-medium">Ready to practice</p>
              <p className="text-slate-400 text-sm text-center max-w-xs">Type a customer objection to get started</p>
              <button
                onClick={() => setShowGuide(true)}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1 mt-1"
              >
                <Info size={13} /> Show sample prompts
              </button>
            </div>
          )}

          {/* Messages */}
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col w-full ${m.role === "user" ? "items-end" : "items-start"}`}>

              {/* Role label */}
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 ${
                m.role === "user" ? "text-orange-400" : "text-slate-400"
              }`}>
                {m.role === "user" ? "Customer objection" : "Coach suggests saying"}
              </p>

              <div className={`max-w-[80%] lg:max-w-[72%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm"
                  : "bg-white border-2 border-orange-200 text-slate-800 rounded-tl-sm"
              }`}>
                {m.content}
              </div>

              {/* Follow-up chips — copy-to-clipboard, not re-sent as messages */}
              {m.role === "assistant" && m.followUps && m.followUps.length > 0 && (
                <div className="mt-2.5 max-w-[80%] lg:max-w-[72%] space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    Ask next →
                  </p>
                  {m.followUps.map((fu, j) => (
                    <FollowUpChip key={j} text={fu} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-start gap-2">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-duration:0.9s]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-duration:0.9s] [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-duration:0.9s] [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input Area ── */}
        <div className="p-3 lg:p-4 bg-white border-t border-slate-200 shadow-lg shrink-0">
          {status && (
            <div className="max-w-3xl mx-auto mb-2.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
              {status}
            </div>
          )}
          <div className="max-w-3xl mx-auto space-y-2">
            <p className="text-[11px] text-slate-400 font-medium px-1">
              You're the <span className="text-orange-500 font-semibold">rep</span> — type what the customer just said, get a response to say back.
            </p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="What did the customer say?"
                disabled={loading}
                className="flex-1 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm disabled:opacity-50 placeholder:text-slate-400"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Follow-up chip — copies to clipboard, does NOT re-send as a message
function FollowUpChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard — say this to the customer"
      className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs transition-all ${
        copied
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300 text-orange-800"
      }`}
    >
      <span className="leading-relaxed">{text}</span>
      <span className="shrink-0 flex items-center gap-1 font-semibold">
        {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
      </span>
    </button>
  );
}

function MemoryItem({ label, value, isList }: { label: string; value?: string | string[]; isList?: boolean }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-[10px] tracking-wider text-slate-500 uppercase font-bold mb-1.5">{label}</div>
      {isList && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200 font-medium">
              {v}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-slate-900 text-sm font-semibold">{value as string}</div>
      )}
    </div>
  );
}
