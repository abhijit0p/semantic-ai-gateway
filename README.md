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