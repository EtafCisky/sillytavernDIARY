export function createDataStorageApi({ extensionSettings, extensionName, saveSettings, fileStorageApi }) {
  function ensurePluginSettings() {
    if (!extensionSettings[extensionName]) {
      extensionSettings[extensionName] = {};
    }

    return extensionSettings[extensionName];
  }

  async function loadDiaries() {
    try {
      if (fileStorageApi) {
        return await fileStorageApi.load('diaries');
      }

      const settings = extensionSettings[extensionName] || {};
      const diaries = settings.diaries || {};
      console.log('[数据存储] 成功加载日记数据');
      return diaries;
    } catch (error) {
      console.error('[数据存储] 加载日记数据失败:', error);
      return {};
    }
  }

  async function saveDiaries(data) {
    try {
      if (fileStorageApi) {
        return await fileStorageApi.save('diaries', data);
      }

      const settings = ensurePluginSettings();
      settings.diaries = data;
      saveSettings();
      console.log('[数据存储] 成功保存日记数据');
      return true;
    } catch (error) {
      console.error('[数据存储] 保存日记数据失败:', error);
      return false;
    }
  }

  async function loadRecycleBin() {
    try {
      if (fileStorageApi) {
        return await fileStorageApi.load('recycleBin');
      }

      const settings = extensionSettings[extensionName] || {};
      const recycleBin = settings.recycleBin || {};
      console.log('[数据存储] 成功加载回收站数据');
      return recycleBin;
    } catch (error) {
      console.error('[数据存储] 加载回收站数据失败:', error);
      return {};
    }
  }

  async function saveRecycleBin(data) {
    try {
      if (fileStorageApi) {
        return await fileStorageApi.save('recycleBin', data);
      }

      const settings = ensurePluginSettings();
      settings.recycleBin = data;
      saveSettings();
      console.log('[数据存储] 成功保存回收站数据');
      return true;
    } catch (error) {
      console.error('[数据存储] 保存回收站数据失败:', error);
      return false;
    }
  }

  return {
    loadDiaries,
    saveDiaries,
    loadRecycleBin,
    saveRecycleBin,
  };
}
