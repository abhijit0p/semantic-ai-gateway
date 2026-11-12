# Semantic AI Model Router (AI Gateway)

A lightweight, local-embedding-powered semantic reverse proxy and observability gateway that dynamically routes developer requests across cost-optimized and deep-reasoning LLMs while preserving multi-turn conversational state.

Instead of brittle regex rules or slow autoregressive LLM classifiers, this gateway uses an on-device embedding model (`nomic-embed-text` via Ollama) to compute cosine similarity against multi-domain engineering centroids in **< 20ms**—routing boilerplate to fast, low-cost models (Gemini Flash) and escalating complex architectural or concurrency tasks to frontier reasoning models (GPT-4o).

---

## Architecture

```text
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Web Dashboard     │   │     Cursor IDE      │   │     Claude Code     │
│   (:4000/dashboard) │   │ (/v1/chat/complet.) │   │   (/v1/messages)    │
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
          ┌─────────────────────────────────────────────────────┐
          │         Semantic Model Router (Node/Express)        │
          │                                                     │
          │  1. Embed Prompt ──► Local Ollama (nomic-embed)     │
          │  2. Cosine Math  ──► Compare vs. Domain Centroids   │
          │  3. Route & Meter ─► Token accounting & cost ledger │
          └──────────────┬───────────────────────┬──────────────┘
                         │                       │
        Score < 0.60     │                       │  Score >= 0.60
     (Syntax/Boilerplate)│                       │  (Arch/Concurrency)
                         ▼                       ▼
          ┌──────────────────────────┐ ┌──────────────────────────┐
          │     Tier 1: Fast/Cheap   │ │   Tier 2: Deep Reasoning │
          │     Gemini 3.8 Flash     │ │          GPT-4o          │
          └──────────────────────────┘ └──────────────────────────┘
```

---

## Key Capabilities

- **Sub-20ms Local Semantic Classification:** Embeds incoming prompts via Ollama (`nomic-embed-text`) and measures cosine similarity against cached domain centroids (`distributedSystems`, `concurrencyAndSecurity`, `performanceAndData`).
- **Cross-Provider State Preservation:** Translates and maintains multi-turn conversation history seamlessly when switching mid-thread between Google Gemini and OpenAI.
- **IDE & CLI Compatibility:** Exposes both OpenAI-compatible (`/v1/chat/completions`) and Anthropic-compatible (`/v1/messages`) endpoints for drop-in integration with Cursor and Claude Code.
- **Real-Time Telemetry & Cost Ledger:** Meters actual prompt/completion tokens from upstream responses to calculate verified dollar savings against a 100% Tier 2 baseline.
- **Deterministic Resilience:** Automatically falls back to heuristic pattern matching and context-length guardrails if the local embedding service is offline.

---

## Project Structure

```text
semantic-ai-gateway/
├── .env.example                 # Environment variable template
├── .gitignore                   # Git exclusions (.env, node_modules)
├── package.json                 # Dependencies & scripts
├── src/
│   ├── config/
│   │   └── routing.config.js    # Model tiers, token pricing, thresholds & domain clusters
│   ├── router/
│   │   └── semanticRouter.js    # Vector embedding engine & cosine similarity classifier
│   ├── providers/
│   │   └── upstreamProxy.js     # Provider dispatch, latency tracking & token cost math
│   └── server.js                # Express server & API compatibility adapters
└── public/
    ├── index.html               # Observability console markup
    ├── styles.css               # UI theme & two-stage pipeline progress animations
    └── app.js                   # Frontend state, telemetry updates & markdown renderer
```

---

## Quick Start

### 1. Prerequisites
- **Node.js** v18+
- **Ollama** installed and running locally with `nomic-embed-text`:

```bash
ollama pull nomic-embed-text
```

### 2. Installation

```bash
git clone https://github.com/abhijit0p/semantic-ai-gateway.git
cd semantic-ai-gateway
npm install
cp .env.example .env
```

Add your `GEMINI_API_KEY` and `OPENAI_API_KEY` to `.env`.

### 3. Run the Gateway

```bash
npm start
```

Open `http://localhost:4000/dashboard` to access the observability console.

---

## IDE & CLI Integration

### Cursor IDE
1. Open Cursor Settings (`Ctrl + Shift + J` / `Cmd + Shift + J`) $\rightarrow$ **Models**.
2. Expand **API Keys**, enter any placeholder key (e.g., `sk-local-router`), and enable **Override OpenAI Base URL**.
3. Set the Base URL to:
   ```text
   http://127.0.0.1:4000/v1
   ```
4. Add `auto` as a custom model name and verify.

### Claude Code CLI
Route Claude Code through the gateway's Anthropic-compatible `/v1/messages` adapter:

**PowerShell:**
```powershell
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:4000"
$env:ANTHROPIC_AUTH_TOKEN = "local-proxy-token"
claude
```

**macOS / Linux:**
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
export ANTHROPIC_AUTH_TOKEN="local-proxy-token"
claude
```

---

## Configuration

Customize thresholds, model IDs, token pricing, and reference clusters in `src/config/routing.config.js`:

- `similarityThreshold`: Cosine similarity cutoff (`0.0` – `1.0`) for escalating to Tier 2 (default: `0.60`).
- `maxContextCharsBeforeTier2`: Automatic escalation threshold for large multi-file context payloads.
- `tier2Clusters`: Add or refine domain anchor phrases; centroids are automatically recomputed at server startup.

---

## License

MIT
