import { createImportExportManager } from '../data/import-export-manager.js';
import { createPresetDialogManager } from '../ui/preset-dialog-manager.js';
import { createUpdateNotificationManager } from '../ui/update-notification-manager.js';

export function createPluginSupportComposition({
  pluginVersion,
  extensionName,
  extensionFolderPath,
  extensionSettings,
  getCurrentSettings,
  getPresetManager,
  saveSettings,
  saveSettingsDebounced,
  loadAllDiaries,
  saveAllDiaries,
  loadAllRecycleBin,
  saveAllRecycleBin,
  exchangeDiaryStorage,
  loadDiaryGroupData,
  saveDiaryGroupData,
  loadLegacyStorageSnapshot,
  getFileStorageStatus,
  notify,
}) {
  const {
    checkAndShowUpdateNotification,
    bindUpdateNotificationEvents,
  } = createUpdateNotificationManager({
    pluginVersion,
    extensionFolderPath,
    getCurrentSettings,
    saveSettings,
  });

  const { exportDiaryData, importDiaryData } = createImportExportManager({
    pluginVersion,
    loadAllDiaries,
    saveAllDiaries,
    loadAllRecycleBin,
    saveAllRecycleBin,
    exchangeDiaryStorage,
    loadDiaryGroupData,
    saveDiaryGroupData,
    loadLegacyStorageSnapshot,
    getFileStorageStatus,
    notify,
  });

  const {
    showPresetDialog,
    loadPresetData,
    switchToDiaryPreset,
    restoreOriginalPreset,
    createPresetDialog,
    bindReadmeDialogEvents,
    createReadmeDialog,
  } = createPresetDialogManager({
    extensionName,
    extensionFolderPath,
    extensionSettings,
    getPresetManager,
    saveSettingsDebounced,
    notify,
  });

  return {
    checkAndShowUpdateNotification,
    bindUpdateNotificationEvents,
    exportDiaryData,
    importDiaryData,
    showPresetDialog,
    loadPresetData,
    switchToDiaryPreset,
    restoreOriginalPreset,
    createPresetDialog,
    bindReadmeDialogEvents,
    createReadmeDialog,
  };
}
