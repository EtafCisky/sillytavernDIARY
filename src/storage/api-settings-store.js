export const DEFAULT_API_SETTINGS = {
  enabled: false,
  url: '',
  key: '',
  model: '',
  models: [],
  updatedAt: '',
  lastTestedAt: '',
};

function cloneData(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function normalizeModelList(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  return [...new Set(models.map(model => String(model || '').trim()).filter(Boolean))];
}

function pickFirstValue(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return fallback;
}

function normalizeEnabled(value) {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function unwrapSettings(settings) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  if (
    source.data &&
    typeof source.data === 'object' &&
    !Array.isArray(source.data) &&
    (source.kind === 'sillytavernDIARY.apiSettings' || source.schemaVersion !== undefined)
  ) {
    return source.data;
  }

  return source;
}

export function normalizeApiSettings(settings = {}) {
  const source = unwrapSettings(settings);
  const models = normalizeModelList(
    Array.isArray(source.models)
      ? source.models
      : Array.isArray(source.availableModels)
        ? source.availableModels
        : source.modelList,
  );
  const normalized = {
    enabled: normalizeEnabled(pickFirstValue(source, ['enabled', 'customApiEnabled', 'useCustomApi'], false)),
    url: String(pickFirstValue(source, ['url', 'apiUrl', 'baseUrl', 'baseURL', 'endpoint', 'reverse_proxy'])).trim(),
    key: String(pickFirstValue(source, ['key', 'apiKey', 'token', 'password', 'proxy_password'])),
    model: String(pickFirstValue(source, ['model', 'selectedModel', 'modelId', 'modelName'])).trim(),
    models,
    updatedAt: String(source.updatedAt || ''),
    lastTestedAt: String(source.lastTestedAt || ''),
  };

  if (!normalized.model && normalized.models.length) {
    normalized.model = normalized.models[0];
  }

  if (normalized.model && !normalized.models.includes(normalized.model)) {
    normalized.models = [normalized.model, ...normalized.models];
  }

  return normalized;
}

export function createApiSettingsStore(fileStorageApi) {
  async function loadApiSettings() {
    return normalizeApiSettings(await fileStorageApi.load('apiSettings'));
  }

  function loadApiSettingsSync() {
    return normalizeApiSettings(fileStorageApi.loadSync('apiSettings'));
  }

  async function saveApiSettings(settings) {
    const normalized = normalizeApiSettings({
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    return fileStorageApi.save('apiSettings', normalized);
  }

  function saveApiSettingsQueued(settings) {
    const normalized = normalizeApiSettings({
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    return fileStorageApi.saveQueued('apiSettings', cloneData(normalized));
  }

  return {
    loadApiSettings,
    loadApiSettingsSync,
    saveApiSettings,
    saveApiSettingsQueued,
  };
}
