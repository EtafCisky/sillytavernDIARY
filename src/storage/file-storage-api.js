export const DIARY_FILE_STORAGE = {
  diaries: {
    fileName: 'diary-data.json',
    kind: 'sillytavernDIARY.diaries',
    settingsKey: 'diaries',
  },
  exchangeDiaries: {
    fileName: 'diary-exchange-data.json',
    kind: 'sillytavernDIARY.exchangeDiaries',
    settingsKey: 'exchangeDiaries',
  },
  recycleBin: {
    fileName: 'diary-recycle-bin.json',
    kind: 'sillytavernDIARY.recycleBin',
    settingsKey: 'recycleBin',
  },
  apiSettings: {
    fileName: 'diary-api-settings.json',
    kind: 'sillytavernDIARY.apiSettings',
    settingsKey: 'apiSettings',
  },
  diaryGroups: {
    fileName: 'diary-groups.json',
    kind: 'sillytavernDIARY.diaryGroups',
    settingsKey: 'diaryGroups',
  },
};

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function encodeJsonToBase64(data) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(data, null, 2)));
}

function normalizeFilePath(path) {
  return String(path || '').replace(/^\/+/, '');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneData(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function createEmptyData() {
  return {};
}

export function createDiaryFileStorageApi({
  extensionSettings,
  extensionName,
  saveSettings,
  getRequestHeaders,
}) {
  const state = Object.fromEntries(
    Object.keys(DIARY_FILE_STORAGE).map(key => [
      key,
      {
        initialized: false,
        cache: null,
        source: 'uninitialized',
        lastError: null,
        writeQueue: Promise.resolve(),
      },
    ]),
  );

  function ensurePluginSettings() {
    if (!extensionSettings[extensionName]) {
      extensionSettings[extensionName] = {};
    }

    return extensionSettings[extensionName];
  }

  function getTarget(key) {
    const target = DIARY_FILE_STORAGE[key];
    if (!target) {
      throw new Error(`Unknown diary file storage key: ${key}`);
    }

    return target;
  }

  function getLegacyData(key) {
    const target = getTarget(key);
    const settings = extensionSettings[extensionName] || {};
    return isPlainObject(settings[target.settingsKey]) ? cloneData(settings[target.settingsKey]) : createEmptyData();
  }

  function saveLegacyData(key, data) {
    const target = getTarget(key);
    const settings = ensurePluginSettings();
    settings[target.settingsKey] = cloneData(data);
    saveSettings();
  }

  function buildFilePayload(key, data) {
    const target = getTarget(key);
    return {
      schemaVersion: 1,
      kind: target.kind,
      updatedAt: new Date().toISOString(),
      data,
    };
  }

  function unwrapFilePayload(key, payload) {
    const target = getTarget(key);
    if (!isPlainObject(payload)) {
      throw new Error(`${target.fileName} is not a JSON object`);
    }

    if (payload.kind === target.kind && isPlainObject(payload.data)) {
      return cloneData(payload.data);
    }

    if (payload.schemaVersion !== undefined || payload.kind !== undefined || payload.data !== undefined) {
      throw new Error(`${target.fileName} has an unexpected diary storage format`);
    }

    return cloneData(payload);
  }

  async function uploadJsonFile(key, data) {
    const target = getTarget(key);
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name: target.fileName,
        data: encodeJsonToBase64(buildFilePayload(key, data)),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return normalizeFilePath(result.path || `user/files/${target.fileName}`);
  }

  async function jsonFileExists(key) {
    const target = getTarget(key);
    const path = `user/files/${target.fileName}`;
    const response = await fetch('/api/files/verify', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ urls: [path] }),
    });

    if (!response.ok) {
      throw new Error(`File verify failed: HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return result[path] === true || result[`/${path}`] === true;
  }

  async function readJsonFile(key) {
    const target = getTarget(key);
    const path = `user/files/${target.fileName}`;
    const response = await fetch(`/${path}?diaryStorage=${Date.now()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return unwrapFilePayload(key, await response.json());
  }

  function canUseFileStorage() {
    return typeof getRequestHeaders === 'function';
  }

  async function initialize(key) {
    const targetState = state[key];
    if (targetState.initialized) {
      return cloneData(targetState.cache);
    }

    if (!canUseFileStorage()) {
      targetState.cache = getLegacyData(key);
      targetState.source = 'settings';
      targetState.initialized = true;
      targetState.lastError = 'getRequestHeaders is unavailable';
      return cloneData(targetState.cache);
    }

    try {
      const exists = await jsonFileExists(key);
      if (!exists) {
        targetState.cache = getLegacyData(key);
        targetState.source = 'settings-fallback';
        targetState.lastError = `${getTarget(key).fileName} does not exist yet`;
        targetState.initialized = true;
        console.info(`[Diary File Storage] ${getTarget(key).fileName} does not exist yet; using settings fallback.`);
        return cloneData(targetState.cache);
      }

      targetState.cache = await readJsonFile(key);
      targetState.source = 'file';
      targetState.lastError = null;
    } catch (error) {
      targetState.cache = getLegacyData(key);
      targetState.source = 'settings-fallback';
      targetState.lastError = error.message;
      console.warn(`[Diary File Storage] Failed to read ${getTarget(key).fileName}; using settings fallback.`, error);
    }

    targetState.initialized = true;
    return cloneData(targetState.cache);
  }

  async function initializeAll() {
    await Promise.all(Object.keys(DIARY_FILE_STORAGE).map(key => initialize(key)));
    console.log('[Diary File Storage] Initialization complete', getStatus());
  }

  async function load(key) {
    return initialize(key);
  }

  function loadSync(key) {
    const targetState = state[key];
    if (targetState?.initialized && targetState.cache !== null) {
      return cloneData(targetState.cache);
    }

    return getLegacyData(key);
  }

  async function save(key, data) {
    const targetState = state[key];
    const snapshot = cloneData(isPlainObject(data) ? data : createEmptyData());
    targetState.cache = snapshot;
    targetState.initialized = true;

    if (!canUseFileStorage()) {
      saveLegacyData(key, snapshot);
      targetState.source = 'settings-fallback';
      targetState.lastError = 'getRequestHeaders is unavailable';
      return true;
    }

    try {
      await uploadJsonFile(key, snapshot);
      targetState.source = 'file';
      targetState.lastError = null;
      return true;
    } catch (error) {
      console.error(`[Diary File Storage] Failed to write ${getTarget(key).fileName}; saving to settings fallback.`, error);
      targetState.source = 'settings-fallback';
      targetState.lastError = error.message;

      try {
        saveLegacyData(key, snapshot);
        return true;
      } catch (fallbackError) {
        targetState.lastError = `${error.message}; fallback failed: ${fallbackError.message}`;
        console.error('[Diary File Storage] Settings fallback save failed:', fallbackError);
        return false;
      }
    }
  }

  function saveQueued(key, data) {
    const targetState = state[key];
    const snapshot = cloneData(isPlainObject(data) ? data : createEmptyData());
    targetState.cache = snapshot;
    targetState.initialized = true;

    targetState.writeQueue = targetState.writeQueue
      .catch(() => {})
      .then(() => save(key, snapshot));

    return true;
  }

  function getStatus() {
    return Object.fromEntries(
      Object.entries(state).map(([key, value]) => [
        key,
        {
          initialized: value.initialized,
          source: value.source,
          lastError: value.lastError,
          fileName: getTarget(key).fileName,
        },
      ]),
    );
  }

  return {
    initializeAll,
    load,
    loadSync,
    save,
    saveQueued,
    getLegacyData,
    saveLegacyData,
    getStatus,
  };
}
