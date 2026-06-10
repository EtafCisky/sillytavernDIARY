const CHAT_COMPLETION_SOURCE = 'openai';

export function normalizeCustomApiUrl(url) {
  let normalized = String(url || '').trim();
  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.replace(/\/chat\/completions$/i, '');
  normalized = normalized.replace(/\/models$/i, '');
  return normalized;
}

function normalizeModelId(model) {
  if (typeof model === 'string') {
    return model.trim();
  }

  if (model && typeof model === 'object') {
    return String(model.id || model.name || model.model || '').trim();
  }

  return '';
}

function extractModels(payload) {
  const candidateLists = [
    payload?.data,
    payload?.models,
    payload?.result?.data,
    payload?.result?.models,
    payload,
  ];

  for (const candidate of candidateLists) {
    if (Array.isArray(candidate)) {
      return [...new Set(candidate.map(normalizeModelId).filter(Boolean))];
    }
  }

  return [];
}

function extractGeneratedText(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  const firstChoice = payload?.choices?.[0];
  return (
    firstChoice?.message?.content ||
    firstChoice?.text ||
    payload?.content ||
    payload?.text ||
    payload?.message?.content ||
    payload?.data?.content ||
    payload?.data?.text ||
    ''
  );
}

function buildApiPayload(settings) {
  return {
    chat_completion_source: CHAT_COMPLETION_SOURCE,
    reverse_proxy: normalizeCustomApiUrl(settings.url),
    proxy_password: settings.key || '',
  };
}

export function createCustomApiClient({
  loadApiSettingsSync,
  saveApiSettings,
  getRequestHeaders,
}) {
  function getSettings() {
    return typeof loadApiSettingsSync === 'function' ? loadApiSettingsSync() : {};
  }

  function isReady(settings = getSettings()) {
    return Boolean(settings?.enabled && normalizeCustomApiUrl(settings.url) && settings.model);
  }

  function getReadinessStatus(settings = getSettings()) {
    return {
      ready: isReady(settings),
      enabled: Boolean(settings?.enabled),
      hasUrl: Boolean(normalizeCustomApiUrl(settings?.url)),
      hasModel: Boolean(settings?.model),
      model: settings?.model || '',
      modelsCount: Array.isArray(settings?.models) ? settings.models.length : 0,
    };
  }

  async function testConnection(settings) {
    const normalizedSettings = {
      ...getSettings(),
      ...settings,
      url: normalizeCustomApiUrl(settings?.url),
      key: String(settings?.key || ''),
    };

    if (!normalizedSettings.url) {
      throw new Error('请先填写 API URL');
    }

    const response = await fetch('/api/backends/chat-completions/status', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(buildApiPayload(normalizedSettings)),
    });

    if (!response.ok) {
      throw new Error(`连接失败: HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const models = extractModels(payload);
    if (!models.length) {
      throw new Error('连接成功，但未获取到可用模型');
    }

    const nextSettings = {
      ...normalizedSettings,
      models,
      model: models.includes(normalizedSettings.model) ? normalizedSettings.model : models[0],
      lastTestedAt: new Date().toISOString(),
    };

    if (typeof saveApiSettings === 'function') {
      await saveApiSettings(nextSettings);
    }

    return nextSettings;
  }

  async function generate(prompt) {
    const settings = getSettings();
    if (!isReady(settings)) {
      throw new Error('自定义 API 未启用或配置不完整');
    }

    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        ...buildApiPayload(settings),
        type: 'quiet',
        model: settings.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.7,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`自定义 API 生成失败: HTTP ${response.status}: ${await response.text()}`);
    }

    const text = extractGeneratedText(await response.json());
    if (!text) {
      throw new Error('自定义 API 未返回文本内容');
    }

    return text;
  }

  return {
    isReady,
    getReadinessStatus,
    testConnection,
    generate,
  };
}
