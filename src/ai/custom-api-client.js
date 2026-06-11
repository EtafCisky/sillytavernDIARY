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
    payload?.pipe ||
    payload?.content ||
    payload?.text ||
    payload?.message?.content ||
    payload?.message ||
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

function removeEventListener(eventSource, eventName, listener) {
  if (typeof eventSource?.removeListener === 'function') {
    eventSource.removeListener(eventName, listener);
    return;
  }

  if (typeof eventSource?.off === 'function') {
    eventSource.off(eventName, listener);
  }
}

function addFinalEventListener(eventSource, eventName, listener) {
  if (typeof eventSource?.makeLast === 'function') {
    eventSource.makeLast(eventName, listener);
    return;
  }

  eventSource.on(eventName, listener);
}

function applyCustomApiOverrides(generateData, settings) {
  generateData.chat_completion_source = CHAT_COMPLETION_SOURCE;
  generateData.reverse_proxy = normalizeCustomApiUrl(settings.url);
  generateData.proxy_password = settings.key || '';
  generateData.model = settings.model;
  generateData.stream = false;
}

export function createCustomApiClient({
  loadApiSettingsSync,
  saveApiSettings,
  getRequestHeaders,
  executeSlashCommandsWithOptions,
  eventSource,
  eventTypes,
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
      throw new Error('Please enter an API URL first.');
    }

    const response = await fetch('/api/backends/chat-completions/status', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(buildApiPayload(normalizedSettings)),
    });

    if (!response.ok) {
      throw new Error(`Connection failed: HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const models = extractModels(payload);
    if (!models.length) {
      throw new Error('Connection succeeded, but no models were returned.');
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
      throw new Error('Custom API is disabled or incomplete.');
    }

    if (typeof executeSlashCommandsWithOptions !== 'function') {
      throw new Error('Custom API generation requires SillyTavern slash command support.');
    }

    if (!eventSource || typeof eventSource.on !== 'function') {
      throw new Error('Custom API generation requires SillyTavern event support.');
    }

    const eventName = eventTypes?.CHAT_COMPLETION_SETTINGS_READY || 'chat_completion_settings_ready';
    let handled = false;
    const overrideRequestTarget = generateData => {
      if (handled || !generateData) {
        return;
      }

      handled = true;
      applyCustomApiOverrides(generateData, settings);
      removeEventListener(eventSource, eventName, overrideRequestTarget);
    };

    addFinalEventListener(eventSource, eventName, overrideRequestTarget);

    let rawResult;
    try {
      rawResult = await executeSlashCommandsWithOptions(`/gen ${prompt}`, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        parserFlags: {},
        abortController: null,
        source: 'diary-plugin-custom-api',
      });
    } finally {
      removeEventListener(eventSource, eventName, overrideRequestTarget);
    }

    const text = extractGeneratedText(rawResult);
    if (!text) {
      throw new Error('Custom API returned no text.');
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
