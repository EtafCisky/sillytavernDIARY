import { createDataStorageApi } from './data-storage-api.js';
import { createDiaryStore } from './diary-store.js';
import { createExchangeDiaryStorage } from './exchange-diary-store.js';
import { createDiaryFileStorageApi } from './file-storage-api.js';
import { createRecycleBinStore } from './recycle-bin-store.js';

export function createPluginStorage({ extensionSettings, extensionName, saveSettings, getRequestHeaders }) {
  const fileStorageApi = createDiaryFileStorageApi({
    extensionSettings,
    extensionName,
    saveSettings,
    getRequestHeaders,
  });

  const dataStorageApi = createDataStorageApi({
    extensionSettings,
    extensionName,
    saveSettings,
    fileStorageApi,
  });

  const diaryStore = createDiaryStore(dataStorageApi);
  const recycleBinStore = createRecycleBinStore(dataStorageApi);
  const exchangeDiaryStorage = createExchangeDiaryStorage({
    extensionSettings,
    extensionName,
    saveSettings,
    fileStorageApi,
  });

  async function initializeFileStorage() {
    await fileStorageApi.initializeAll();
  }

  function migrateExchangeDiaryData() {
    try {
      const settings = extensionSettings[extensionName] || {};
      const rawExchangeDiaries = settings.exchangeDiaries;
      const data = exchangeDiaryStorage.loadAll();
      const needsSave =
        !rawExchangeDiaries ||
        !rawExchangeDiaries.config ||
        !rawExchangeDiaries.threadCounters ||
        !rawExchangeDiaries.triggeredEntries;

      if (needsSave) {
        exchangeDiaryStorage.saveAll(data);
      }

      console.log('[Storage Migration] Exchange diary data checked');
    } catch (error) {
      console.error('[Storage Migration] Failed to migrate exchange diary data:', error);
    }
  }

  function loadLegacyStorageSnapshot() {
    return {
      diaries: fileStorageApi.getLegacyData('diaries'),
      recycleBin: fileStorageApi.getLegacyData('recycleBin'),
      exchangeDiaries: fileStorageApi.getLegacyData('exchangeDiaries'),
    };
  }

  return {
    exchangeDiaryStorage,
    initializeFileStorage,
    getFileStorageStatus: fileStorageApi.getStatus,
    loadLegacyStorageSnapshot,
    migrateExchangeDiaryData,
    loadAllDiaries: diaryStore.loadAllDiaries,
    saveAllDiaries: diaryStore.saveAllDiaries,
    getNextDiaryId: diaryStore.getNextDiaryId,
    saveDiaryToFile: diaryStore.saveDiaryToFile,
    loadDiaryFromFile: diaryStore.loadDiaryFromFile,
    getCharacterDiaries: diaryStore.getCharacterDiaries,
    getAllCharacters: diaryStore.getAllCharacters,
    deleteDiaryFromFile: diaryStore.deleteDiaryFromFile,
    loadAllRecycleBin: recycleBinStore.loadAllRecycleBin,
    saveAllRecycleBin: recycleBinStore.saveAllRecycleBin,
    getNextRecycleBinNumber: recycleBinStore.getNextRecycleBinNumber,
    saveToRecycleBinFile: recycleBinStore.saveToRecycleBinFile,
    loadRecycleBinItem: recycleBinStore.loadRecycleBinItem,
    getAllRecycleBinFiles: recycleBinStore.getAllRecycleBinFiles,
    deleteRecycleBinItem: recycleBinStore.deleteRecycleBinItem,
    deleteRecycleBinFile: recycleBinStore.deleteRecycleBinFile,
    clearRecycleBinFiles: recycleBinStore.clearRecycleBinFiles,
  };
}
