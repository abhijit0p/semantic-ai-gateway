const conversationHistory = [];
let stats = {
  tier1: 0,
  tier2: 0,
  savedUsd: 0,
  tokens: 0,
  routerLatencies: []
};

function renderMarkdown(raw) {
  if (!raw) return '';
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fence = '```';
  const parts = escaped.split(fence);

  for (let i = 1; i < parts.length; i += 2) {
    const lines = parts[i].split('\n');
    const code = lines.length > 1 ? lines.slice(1).join('\n') : lines[0];
    parts[i] = `<pre><code>${code}</code></pre>`;
  }

  return parts
    .join('')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function updateSidebar(telemetry) {
  if (telemetry.tierKey === 'tier1') stats.tier1++;
  else stats.tier2++;

  stats.savedUsd += telemetry.savedUsd || 0;
  stats.tokens += telemetry.totalTokens || 0;
  stats.routerLatencies.push(telemetry.routingLatencyMs);

  const avgRouter = Math.round(
    stats.routerLatencies.reduce((a, b) => a + b, 0) / stats.routerLatencies.length
  );

  document.getElementById('tier1Count').textContent = stats.tier1;
  document.getElementById('tier2Count').textContent = stats.tier2;
  document.getElementById('totalSaved').textContent = `$${stats.savedUsd.toFixed(5)}`;
  document.getElementById('totalTokens').textContent = `${stats.tokens.toLocaleString()} total tokens metered`;
  document.getElementById('avgRouterMs').textContent = `${avgRouter} ms`;
}

async function dispatchPrompt() {
  const input = document.getElementById('promptInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  const stream = document.getElementById('chatStream');
  const policy = document.getElementById('policySelect').value;

  const userDiv = document.createElement('div');
  userDiv.className = 'msg-user';
  userDiv.textContent = text;
  stream.appendChild(userDiv);

  conversationHistory.push({ role: 'user', content: text });

  // Multi-stage pipeline progress card
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'msg-assistant';
  loaderDiv.innerHTML = `
    <div class="pipeline-loader">
      <div class="stage-row active" id="stage1">
        <span class="spinner"></span>
        <span>Stage 1: Embedding prompt via nomic-embed-text & scoring domain clusters...</span>
      </div>
      <div class="stage-row" id="stage2">
        <span>⏳ Stage 2: Awaiting upstream LLM reasoning & token generation...</span>
      </div>
    </div>
  `;
  stream.appendChild(loaderDiv);
  stream.scrollTop = stream.scrollHeight;

  // Simulate visual transition to Stage 2 after embedding window (~45ms)
  const stageTimer = setTimeout(() => {
    const s1 = loaderDiv.querySelector('#stage1');
    const s2 = loaderDiv.querySelector('#stage2');
    if (s1 && s2) {
      s1.classList.remove('active');
      s1.innerHTML = `<span>✅ Stage 1: Semantic classification complete</span>`;
      s2.classList.add('active');
      s2.innerHTML = `<span class="spinner"></span><span>Stage 2: Executing upstream inference...</span>`;
    }
  }, 60);

  try {
    const res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: policy, messages: conversationHistory, stream: false })
    });

    clearTimeout(stageTimer);
    const data = await res.json();
    loaderDiv.remove();

    if (data.error) {
      const errDiv = document.createElement('div');
      errDiv.className = 'msg-assistant';
      errDiv.style.borderColor = '#ef4444';
      errDiv.textContent = `Upstream Error: ${data.error.message || JSON.stringify(data.error)}`;
      stream.appendChild(errDiv);
      return;
    }

    const reply = data.choices?.[0]?.message?.content || '';
    conversationHistory.push({ role: 'assistant', content: reply });

    const t = data.gatewayTelemetry;
    updateSidebar(t);

    const card = document.createElement('div');
    card.className = 'msg-assistant';
    card.innerHTML = `
      <div class="telemetry-header" style="border-left-color: ${t.tierColor}">
        <div class="telemetry-top">
          <span class="tier-badge" style="color: ${t.tierColor}">${t.tier} (${t.model})</span>
          <div class="latency-pills">
            <span class="pill highlight" title="Local Embedding + Cosine Math">Router: ${t.routingLatencyMs} ms</span>
            <span class="pill" title="Cloud LLM Time">LLM: ${t.inferenceLatencyMs} ms</span>
            <span class="pill">${t.totalTokens} tok</span>
          </div>
        </div>
        <div class="telemetry-reason">↳ ${t.reason} • Saved $${t.savedUsd.toFixed(5)}</div>
      </div>
      <div class="msg-body">${renderMarkdown(reply)}</div>
    `;
    stream.appendChild(card);
    stream.scrollTop = stream.scrollHeight;
  } catch (err) {
    clearTimeout(stageTimer);
    loaderDiv.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'msg-assistant';
    errDiv.style.color = '#ef4444';
    errDiv.textContent = `Gateway Connection Error: ${err.message}`;
    stream.appendChild(errDiv);
  }
}

document.getElementById('runBtn').addEventListener('click', dispatchPrompt);
document.getElementById('promptInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    dispatchPrompt();
  }
});