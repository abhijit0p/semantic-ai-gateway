import axios from 'axios';
import { ROUTING_CONFIG } from '../config/routing.config.js';

function calculateCosts(usage, selectedTierKey) {
  const promptTokens = usage?.prompt_tokens || 0;
  const completionTokens = usage?.completion_tokens || 0;

  const selectedModel = ROUTING_CONFIG.models[selectedTierKey];
  const tier2Model = ROUTING_CONFIG.models.tier2;

  const actualCost =
    (promptTokens / 1_000_000) * selectedModel.inputCostPer1M +
    (completionTokens / 1_000_000) * selectedModel.outputCostPer1M;

  const baselineTier2Cost =
    (promptTokens / 1_000_000) * tier2Model.inputCostPer1M +
    (completionTokens / 1_000_000) * tier2Model.outputCostPer1M;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    actualCostUsd: actualCost,
    savedUsd: Math.max(0, baselineTier2Cost - actualCost)
  };
}

export async function forwardToProvider(body, routeDecision) {
  const inferenceStart = performance.now();

  const isGemini = routeDecision.provider === 'gemini';
  const url = isGemini
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const apiKey = isGemini ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;

  const payload = {
    ...body,
    model: routeDecision.id
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const inferenceLatencyMs = Math.round(performance.now() - inferenceStart);
  const data = response.data;
  const costMetrics = calculateCosts(data.usage, routeDecision.tierKey);

  return {
    ...data,
    gatewayTelemetry: {
      tier: routeDecision.label,
      tierKey: routeDecision.tierKey,
      tierColor: routeDecision.color,
      model: routeDecision.id,
      provider: routeDecision.provider,
      reason: routeDecision.reason,
      matchedCluster: routeDecision.matchedCluster,
      similarityScore: routeDecision.similarityScore,
      routingLatencyMs: routeDecision.routingLatencyMs,
      inferenceLatencyMs,
      totalLatencyMs: routeDecision.routingLatencyMs + inferenceLatencyMs,
      ...costMetrics
    }
  };
}