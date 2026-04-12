# Sales Objection Coach — Edge AI

> A rep is mid-call. The prospect says: *"We're already talking to your competitor and they're 20% cheaper."*
> Instead of fumbling or going off-script, they get a coached, speakable response in seconds — built on live deal context from earlier in the call.
> That's what this tool does.

**Live demo:** [sales-objection-coach-web.pages.dev](https://sales-objection-coach-web.pages.dev)

---

<img width="1493" height="812" alt="image" src="https://github.com/user-attachments/assets/bf801858-5180-4f65-b896-bbb85d4af108" />


---

## What This Does

An AI-powered sales objection coaching tool built entirely on Cloudflare's edge platform. It helps sales reps respond to objections in real time, maintain structured deal context across a call, and automatically generate a summary, action items, and follow-up email when the call ends.

- Live chat UI where the rep types what the customer just said
- Coached, speakable responses generated in real time (2-3 sentences, designed to say out loud)
- Deal Intelligence panel that extracts and tracks customer name, company, pain points, budget, and timeline as the conversation develops
- Rolling summary that compresses call context without losing signal
- Post-call report triggered on "End Call": summary bullets, action items with Rep/Customer ownership, and a ready-to-send follow-up email

---

## Why I Built This

The inspiration comes from my dad, who is a sales coach. Growing up, I watched him help reps navigate tough conversations, and I wanted to see if I could capture some of that coaching intuition in software.

Sales objections are a great test case for AI:
- They're conversational
- They require memory across a call
- They benefit from structured reasoning, not just text generation

This project intentionally avoids generic chatbot demos and focuses on outputs a rep can actually use mid-call.

---

## Architecture

```
Cloudflare Pages         →  React/Vite chat UI, edge-deployed
Cloudflare Workers       →  API layer: routing, validation, all AI orchestration
Workers AI (Llama 3.3)   →  Inference: coached replies, deal memory extraction, post-call report
Workers KV               →  Per-session state: messages, deal memory, rolling summary (7-day TTL)
```

All inference and state management runs at the edge — no external databases, no third-party AI APIs, no servers to manage.

---

## Key Design Decisions

**Session state via Workers KV**
Each session is stored as a JSON object under a `sessionId` key with a 7-day TTL. Reading and writing on every request keeps state simple, scoped, and cost-free on the free tier — no race conditions, no global state.

**Rolling summaries instead of full history**
Full conversation history quickly becomes noisy and expensive to pass to the model. Every 3 user turns, a second LLM call extracts structured deal memory and compresses context into a rolling summary. The message window is capped at 40 to prevent unbounded growth.

**Plain-text replies, structured extraction only where it matters**
Forcing strict JSON from the model for chat replies caused brittle parsing and repetitive fallbacks. Natural language is used for coached responses. Structured extraction (deal memory, summaries, post-call report) is handled in separate targeted LLM calls.

**Synchronous post-call pipeline**
The end-of-call report runs three sequential LLM calls (summary → action items → follow-up email) directly in the Worker and returns the result immediately. No polling, no background jobs.

**UI designed around the use case**
Bubbles are labeled "Customer objection" and "Coach suggests saying" — one glance makes the flow obvious. Coach replies have an orange border as a visual cue that this is a script to read aloud, not a chat response. Follow-up chips copy to clipboard instead of populating the input, so the rep says them to the customer rather than sending them back into the chat.

---

## Mistakes I Made (and Fixed)

**Started with Durable Objects and Cloudflare Workflows**
Durable Objects require a paid Workers plan. Workflows are still maturing. Refactored to Workers KV + synchronous pipeline — simpler, free tier compatible, and actually easier to reason about.

**Over-constraining model output**
Initially forced strict JSON for all model responses. Fixed by separating conversational replies from structured data extraction — each handled differently with appropriate prompts.

**State fields going null after schema changes**
Fixed by merging stored KV state with defaults on every load.

**Follow-up chips creating a chat loop**
Originally chips populated the input field, which caused the AI to answer its own follow-up questions. Fixed by making chips copy-to-clipboard only — the rep reads them and says them to the customer.

**Unbounded message growth**
Fixed by capping history at 40 messages and summarizing proactively every 3 turns.

---

## Running Locally

**1. Start the Worker**
```bash
cd app/worker
npm install
npm run dev
# Runs on http://localhost:8787
```

**2. Start the frontend**
```bash
cd app/web
cp .env.example .env   # set VITE_API_BASE=http://localhost:8787 for local dev
npm install
npm run dev
# Runs on http://localhost:5173
```

**3. Try it**
- Type a sales objection: pricing, competitor, timing, stakeholder pushback
- Watch deal memory populate in the left panel as the conversation develops
- Click **End Call** to generate the post-call summary, action items, and follow-up email

---

## Deployment

Worker is deployed on Cloudflare Workers. Frontend is on Cloudflare Pages.

```bash
# Deploy worker
cd app/worker && wrangler deploy

# Deploy frontend
cd app/web && npm run build && wrangler pages deploy dist --project-name=sales-objection-coach-web
```
