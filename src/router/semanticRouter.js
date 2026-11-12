import axios from 'axios';
import { ROUTING_CONFIG } from '../config/routing.config.js';

let clusterCentroids = {};
let isVectorReady = false;

function cosineSimilarity(vecA, vecB) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function fetchEmbedding(text) {
  const res = await axios.post(
    `${ROUTING_CONFIG.ollamaUrl}/api/embeddings`,
    { model: ROUTING_CONFIG.embeddingModel, prompt: text },
    { timeout: 3000 }
  );
  return res.data.embedding;
}

export async function initializeVectorEngine() {
  try {
    for (const [clusterName, phrases] of Object.entries(ROUTING_CONFIG.tier2Clusters)) {
      const vectors = await Promise.all(phrases.map(p => fetchEmbedding(p)));
      const dims = vectors[0].length;
      const centroid = new Array(dims).fill(0);

      for (const vec of vectors) {
        for (let i = 0; i < dims; i++) {
          centroid[i] += vec[i] / vectors.length;
        }
      }
      clusterCentroids[clusterName] = centroid;
    }
    isVectorReady = true;
    console.log(`✅ Semantic Vector Engine initialized (${Object.keys(clusterCentroids).length} domain clusters cached)`);
  } catch (err) {
    console.warn(`⚠️ Ollama unreachable at startup (${err.message}). Deterministic fallback active.`);
  }
}

export async function classifyRequest(body) {
  const routeStart = performance.now();
  const messages = body.messages || [];
  const requestedModel = body.model || 'auto';
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const totalChars = messages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0);

  // 1. Explicit Developer Policy Overrides
  if (requestedModel === 'force-openai') {
    return {
      tierKey: 'tier2',
      ...ROUTING_CONFIG.models.tier2,
      routingLatencyMs: Math.round(performance.now() - routeStart),
      similarityScore: 1.0,
      matchedCluster: 'manual-override',
      reason: 'Policy Override: Forced Tier 2 Reasoning'
    };
  }
  if (requestedModel === 'force-gemini') {
    return {
      tierKey: 'tier1',
      ...ROUTING_CONFIG.models.tier1,
      routingLatencyMs: Math.round(performance.now() - routeStart),
      similarityScore: 0.0,
      matchedCluster: 'manual-override',
      reason: 'Policy Override: Forced Tier 1 Flash'
    };
  }

  // 2. Context Budget Guardrail
  if (totalChars > ROUTING_CONFIG.maxContextCharsBeforeTier2) {
    return {
      tierKey: 'tier2',
      ...ROUTING_CONFIG.models.tier2,
      routingLatencyMs: Math.round(performance.now() - routeStart),
      similarityScore: 1.0,
      matchedCluster: 'context-budget',
      reason: `Context Budget Exceeded (~${Math.round(totalChars / 4)} tokens)`
    };
  }

  // 3. Multi-Cluster Vector Similarity Classification
  if (isVectorReady && lastUserMsg.trim().length > 0) {
    try {
      const promptVec = await fetchEmbedding(lastUserMsg.slice(0, 600));
      let bestCluster = '';
      let maxScore = -1;

      for (const [clusterName, centroid] of Object.entries(clusterCentroids)) {
        const score = cosineSimilarity(promptVec, centroid);
        if (score > maxScore) {
          maxScore = score;
          bestCluster = clusterName;
        }
      }

      const routingLatencyMs = Math.max(1, Math.round(performance.now() - routeStart));

      if (maxScore >= ROUTING_CONFIG.similarityThreshold) {
        return {
          tierKey: 'tier2',
          ...ROUTING_CONFIG.models.tier2,
          routingLatencyMs,
          similarityScore: Number(maxScore.toFixed(3)),
          matchedCluster: bestCluster,
          reason: `Semantic Match [${bestCluster}]: ${maxScore.toFixed(2)} >= ${ROUTING_CONFIG.similarityThreshold}`
        };
      }

      return {
        tierKey: 'tier1',
        ...ROUTING_CONFIG.models.tier1,
        routingLatencyMs,
        similarityScore: Number(maxScore.toFixed(3)),
        matchedCluster: 'standard-workload',
        reason: `Low Complexity Score (${maxScore.toFixed(2)} < ${ROUTING_CONFIG.similarityThreshold}) — Routed to Flash`
      };
    } catch (err) {
      console.warn('[Vector Classification Error]', err.message);
    }
  }

  // 4. Deterministic Regex Fallback
  const isComplex = /architect|idempotency|race condition|distributed|concurrency|deadlock|sharding/i.test(lastUserMsg);
  const routingLatencyMs = Math.max(1, Math.round(performance.now() - routeStart));

  return isComplex
    ? {
        tierKey: 'tier2',
        ...ROUTING_CONFIG.models.tier2,
        routingLatencyMs,
        similarityScore: null,
        matchedCluster: 'heuristic-fallback',
        reason: 'Heuristic Fallback: Architectural/concurrency pattern matched'
      }
    : {
        tierKey: 'tier1',
        ...ROUTING_CONFIG.models.tier1,
        routingLatencyMs,
        similarityScore: null,
        matchedCluster: 'heuristic-fallback',
        reason: 'Heuristic Fallback: Standard task'
      };
}