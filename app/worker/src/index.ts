import type { Env } from "./types";
import {
	type AgentState,
	type DealMemory,
	DEFAULT_STATE,
	DEFAULT_DEAL_MEMORY,
} from "./agents";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
	"http://localhost:5173",
	"http://localhost:4173",
]);

function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) return false;
	if (ALLOWED_ORIGINS.has(origin)) return true;
	try {
		const { hostname } = new URL(origin);
		return hostname.endsWith(".pages.dev");
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

async function loadState(env: Env, sessionId: string): Promise<AgentState> {
	const raw = await env.SESSION_STORE.get(sessionId, "json") as Partial<AgentState> | null;
	if (!raw) return { ...DEFAULT_STATE, dealMemory: { ...DEFAULT_DEAL_MEMORY } };
	return {
		messages: Array.isArray(raw.messages) ? raw.messages : DEFAULT_STATE.messages,
		dealMemory: { ...DEFAULT_DEAL_MEMORY, ...(raw.dealMemory ?? {}) },
		rollingSummary: raw.rollingSummary ?? DEFAULT_STATE.rollingSummary,
		userTurnCount: typeof raw.userTurnCount === "number" ? raw.userTurnCount : DEFAULT_STATE.userTurnCount,
		final: raw.final ?? null,
	};
}

async function saveState(env: Env, sessionId: string, state: AgentState): Promise<void> {
	// KV TTL: 7 days — sessions auto-expire, no manual cleanup needed
	await env.SESSION_STORE.put(sessionId, JSON.stringify(state), { expirationTtl: 604800 });
}

// ---------------------------------------------------------------------------
// AI helpers (shared by chat and finalize)
// ---------------------------------------------------------------------------

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function normalizeAIText(output: any): string {
	if (!output) return "";
	if (typeof output === "string") return output;
	if (typeof output.response === "string") return output.response;
	if (typeof output.output_text === "string") return output.output_text;
	if (typeof output.result?.response === "string") return output.result.response;
	try { return JSON.stringify(output); } catch { return ""; }
}

function extractBetween(text: string, startTag: string, endTag: string): string | null {
	const s = text.indexOf(startTag);
	const e = text.lastIndexOf(endTag);
	if (s === -1 || e === -1 || e <= s) return null;
	return text.slice(s + startTag.length, e).trim();
}

function extractJsonObject(text: string): string | null {
	const s = text.indexOf("{");
	const e = text.lastIndexOf("}");
	if (s === -1 || e === -1 || e <= s) return null;
	return text.slice(s, e + 1);
}

function safeJsonParse<T>(text: string): T | null {
	try { return JSON.parse(text) as T; } catch { return null; }
}

function lastN<T>(arr: T[], n: number): T[] {
	return arr.slice(Math.max(0, arr.length - n));
}

function parseSalesResponse(text: string): { reply: string; followUps: string[] } {
	let replyMatch = extractBetween(text, "<REPLY>", "</REPLY>");
	if (!replyMatch && text.includes("</REPLY>")) {
		replyMatch = text.split("</REPLY>")[0].trim();
	}

	const f1 = text.match(/FOLLOW_UP_1:\s*(.+)/);
	const f2 = text.match(/FOLLOW_UP_2:\s*(.+)/);
	const followUps: string[] = [];
	if (f1?.[1]) followUps.push(f1[1].trim());
	if (f2?.[1]) followUps.push(f2[1].trim());

	let reply = replyMatch ?? text;
	reply = reply.replace(/<\/REPLY>/g, "").replace(/<REPLY>/g, "").trim();
	if (!reply) reply = "I'm listening—could you say more about that?";
	if (followUps.length === 0) {
		followUps.push("Can you elaborate?");
		followUps.push("Is there anything else?");
	}
	return { reply, followUps: followUps.slice(0, 2) };
}

// ---------------------------------------------------------------------------
// Chat handler — reads/writes KV, runs LLM
// ---------------------------------------------------------------------------

async function handleChat(env: Env, sessionId: string, message: string) {
	const s = await loadState(env, sessionId);

	s.messages.push({ role: "user", content: message });
	s.userTurnCount += 1;

	const recent = lastN(s.messages, 10);
	const recentText = recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

	const systemPrompt = `
You are an expert Sales Objection Coach.
Your goal is to help a rep respond to a customer's specific objection.

GUIDELINES:
- **Price Objection**: Acknowledge budget, pivot to value/ROI, or ask about specific expectations. Don't just verify the price.
- **Competitor Objection**: Differentiate on reliability, premium features, or service. Don't bash the competitor.
- **Service Complaint**: Apologize sincerely, validate feelings, propose immediate resolution.
- **"Just looking"**: Qualify their timeline or specific interest.

RESPONSE LENGTH:
- Your reply MUST be 2-3 sentences maximum. No exceptions.
- It must be short enough to say out loud naturally during a live sales call.
- If you find yourself writing more than 3 sentences, cut it down. Brevity is the point.

GUARDRAILS:
- You must NOT answer questions that violate CFPB (Consumer Financial Protection Bureau), FDIC, or retail organization rules.
- If asked about illegal financial structuring, exact compliance limits for evasion, or specific internal banking regulation loopholes, politely decline.
- State that you are an AI sales coach and cannot provide legal or regulatory compliance advice.
- IF users send prompts that are not related to sales (e.g. taxes, cooking, general life), respond with "I'm sorry, I can only help with sales-related questions."

FORMAT (Strict):
<REPLY>
(Your suggested natural language response, 2-3 sentences max)
</REPLY>
FOLLOW_UP_1: (Strategic question to advance the deal)
FOLLOW_UP_2: (Alternative probing question)

Do NOT return JSON for the reply. Use the tags above.
`.trim();

	const userPrompt = `
Rolling Summary: ${s.rollingSummary || "(none yet)"}
Deal Data: ${JSON.stringify(s.dealMemory)}

Conversation:
${recentText}

Respond to the latest USER message.
`.trim();

	const aiResp = await env.AI.run(MODEL, {
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
	});

	const parsed = parseSalesResponse(normalizeAIText(aiResp));

	// Memory extraction every 3 turns
	if (s.userTurnCount % 3 === 0) {
		const memSystem = `
Extract Deal Memory from the conversation. Output strictly valid JSON inside <json> tags.
Keys: customerName, company, industry, painPoints, budget, timeline, objections, nextSteps, rollingSummary.
IMPORTANT: If a field cannot be clearly inferred from the conversation, leave it as null — do not guess or fabricate values.
Only populate fields that are explicitly mentioned or strongly implied by the customer.
<json>
{ ... }
</json>
`.trim();

		const memUser = `
Current Memory: ${JSON.stringify(s.dealMemory)}
Rolling Summary: ${s.rollingSummary}
Conversation:
${recentText}
`.trim();

		const memResp = await env.AI.run(MODEL, {
			messages: [
				{ role: "system", content: memSystem },
				{ role: "user", content: memUser },
			],
		});

		const memRaw = normalizeAIText(memResp);
		const memJson = extractBetween(memRaw, "<json>", "</json>") ?? extractJsonObject(memRaw);
		const memParsed = safeJsonParse<Partial<DealMemory> & { rollingSummary?: string }>(memJson ?? "");

		if (memParsed) {
			s.dealMemory = {
				customerName: memParsed.customerName ?? s.dealMemory.customerName,
				company: memParsed.company ?? s.dealMemory.company,
				industry: memParsed.industry ?? s.dealMemory.industry,
				painPoints: Array.isArray(memParsed.painPoints) ? memParsed.painPoints : s.dealMemory.painPoints,
				budget: memParsed.budget ?? s.dealMemory.budget,
				timeline: memParsed.timeline ?? s.dealMemory.timeline,
				objections: Array.isArray(memParsed.objections) ? memParsed.objections : s.dealMemory.objections,
				nextSteps: Array.isArray(memParsed.nextSteps) ? memParsed.nextSteps : s.dealMemory.nextSteps,
			};
			s.rollingSummary = memParsed.rollingSummary ?? s.rollingSummary;
		}
	}

	s.messages.push({ role: "assistant", content: parsed.reply });
	if (s.messages.length > 40) s.messages = s.messages.slice(-40);

	await saveState(env, sessionId, s);

	return {
		reply: parsed.reply,
		followUps: parsed.followUps,
		dealMemory: s.dealMemory,
		rollingSummary: s.rollingSummary,
		userTurnCount: s.userTurnCount,
	};
}

// ---------------------------------------------------------------------------
// Post-call finalize — 3 sequential LLM calls, writes final back to KV
// ---------------------------------------------------------------------------

type FinalOutput = {
	summaryBullets: string[];
	actionItems: { owner: "Rep" | "Customer"; item: string }[];
	followupEmail: string;
};

async function runFinalizeCall(env: Env, sessionId: string): Promise<FinalOutput> {
	const s = await loadState(env, sessionId);
	const convo = s.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

	// Step 1: Summary bullets
	const sumResp = await env.AI.run(MODEL, {
		messages: [{
			role: "user", content: `
Return ONLY valid JSON:
{ "summaryBullets": string[] }
Up to 6 bullets summarizing the key points of this sales conversation.
Conversation:
${convo}
`.trim(),
		}],
	});

	const sumRaw = normalizeAIText(sumResp);
	const sumParsed = safeJsonParse<{ summaryBullets: string[] }>(extractJsonObject(sumRaw) ?? sumRaw);
	const summaryBullets = Array.isArray(sumParsed?.summaryBullets) ? sumParsed!.summaryBullets.slice(0, 6) : [];

	// Step 2: Action items
	const actResp = await env.AI.run(MODEL, {
		messages: [{
			role: "user", content: `
Return ONLY valid JSON:
{ "actionItems": [{"owner":"Rep"|"Customer","item":string}] }
Based on this summary:
${summaryBullets.map(b => `- ${b}`).join("\n")}
`.trim(),
		}],
	});

	const actRaw = normalizeAIText(actResp);
	const actParsed = safeJsonParse<{ actionItems: any[] }>(extractJsonObject(actRaw) ?? actRaw);
	const actionItems = Array.isArray(actParsed?.actionItems) ? actParsed!.actionItems : [];

	// Step 3: Follow-up email
	const emailResp = await env.AI.run(MODEL, {
		messages: [{
			role: "user", content: `
Write a concise follow-up email (120-180 words).
Context:
- Summary: ${summaryBullets.join(" ")}
- Next steps: ${actionItems.map((a: any) => `${a.owner}: ${a.item}`).join("; ")}
Return ONLY plain text. No subject line.
`.trim(),
		}],
	});

	const followupEmail = normalizeAIText(emailResp).trim();

	const final: FinalOutput = { summaryBullets, actionItems, followupEmail };

	// Persist final into session state
	s.final = final;
	await saveState(env, sessionId, s);

	return final;
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const allowedOrigin = isAllowedOrigin(origin) ? origin! : "*";

		const corsHeaders: Record<string, string> = {
			"Access-Control-Allow-Origin": allowedOrigin,
			"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			...(allowedOrigin !== "*" ? { "Vary": "Origin" } : {}),
		};

		function withCors(resp: Response): Response {
			const h = new Headers(resp.headers);
			Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v));
			return new Response(resp.body, { status: resp.status, headers: h });
		}

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// --- /api/chat ---
		if (url.pathname === "/api/chat" && request.method === "POST") {
			const { sessionId, message } = await request.json<{ sessionId: string; message: string }>()
				.catch(() => ({ sessionId: "", message: "" }));

			if (!sessionId || !message)
				return withCors(new Response("Missing sessionId or message", { status: 400 }));
			if (sessionId.length > 64)
				return withCors(new Response("Session ID too long (max 64 chars)", { status: 400 }));
			if (message.length > 4000)
				return withCors(new Response("Message too long (max 4000 chars)", { status: 400 }));

			try {
				const result = await handleChat(env, sessionId, message);
				return withCors(Response.json(result));
			} catch {
				return withCors(Response.json({
					reply: "I'm having trouble connecting. Could you repeat that?",
					followUps: [],
					dealMemory: DEFAULT_DEAL_MEMORY,
					rollingSummary: "",
					userTurnCount: 0,
				}));
			}
		}

		// --- /api/end-call ---
		if (url.pathname === "/api/end-call" && request.method === "POST") {
			const { sessionId } = await request.json<{ sessionId: string }>()
				.catch(() => ({ sessionId: "" }));
			if (!sessionId)
				return withCors(new Response("Missing sessionId", { status: 400 }));

			try {
				const final = await runFinalizeCall(env, sessionId);
				return withCors(Response.json({ ok: true, final }));
			} catch (err: any) {
				return withCors(new Response(`Finalize failed: ${err?.message ?? "unknown"}`, { status: 500 }));
			}
		}

		// --- /api/results — reads final from KV state ---
		if (url.pathname === "/api/results" && request.method === "GET") {
			const sessionId = url.searchParams.get("sessionId");
			if (!sessionId)
				return withCors(new Response("Missing sessionId", { status: 400 }));

			const s = await loadState(env, sessionId);
			return withCors(Response.json(s));
		}

		// --- /api/debug — alias for /api/results ---
		if (url.pathname === "/api/debug" && request.method === "GET") {
			const sessionId = url.searchParams.get("sessionId");
			if (!sessionId)
				return withCors(new Response("Missing sessionId", { status: 400 }));

			const s = await loadState(env, sessionId);
			return withCors(Response.json(s));
		}

		// --- /api/reset ---
		if (url.pathname === "/api/reset" && request.method === "POST") {
			const { sessionId } = await request.json<{ sessionId: string }>()
				.catch(() => ({ sessionId: "" }));
			if (!sessionId)
				return withCors(new Response("Missing sessionId", { status: 400 }));

			await env.SESSION_STORE.delete(sessionId);
			return withCors(Response.json({ ok: true }));
		}

		return withCors(new Response("Not found", { status: 404 }));
	},
};
