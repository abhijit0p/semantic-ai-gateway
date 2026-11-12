import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROUTING_CONFIG } from './config/routing.config.js';
import { initializeVectorEngine, classifyRequest } from './router/semanticRouter.js';
import { forwardToProvider } from './providers/upstreamProxy.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// OpenAI-compatible endpoint (Dashboard & Cursor IDE)
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const routeDecision = await classifyRequest(req.body);
    const result = await forwardToProvider(req.body, routeDecision);
    res.json(result);
  } catch (err) {
    console.error('[Gateway Error]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

// Anthropic-compatible endpoint (Claude Code CLI)
app.post('/v1/messages', async (req, res) => {
  try {
    const openaiBody = {
      model: req.body.model || 'auto',
      messages: (req.body.messages || []).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))
    };

    const routeDecision = await classifyRequest(openaiBody);
    const result = await forwardToProvider(openaiBody, routeDecision);
    const reply = result.choices?.[0]?.message?.content || '';

    res.json({
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: routeDecision.id,
      content: [{ type: 'text', text: reply }],
      usage: {
        input_tokens: result.gatewayTelemetry.promptTokens,
        output_tokens: result.gatewayTelemetry.completionTokens
      }
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(ROUTING_CONFIG.port, async () => {
  console.log(`🚀 Semantic AI Gateway listening on http://localhost:${ROUTING_CONFIG.port}`);
  await initializeVectorEngine();
});