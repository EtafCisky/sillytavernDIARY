import { createExchangeFeatureComposition } from '../app/create-exchange-feature-composition.js';
import { createOverlayUiComposition } from '../app/create-overlay-ui-composition.js';
import { createPluginSupportComposition } from '../app/create-plugin-support-composition.js';
import { createDiaryLibraryComposition } from '../app/create-diary-library-composition.js';
import { createSettingsUiComposition } from '../app/create-settings-ui-composition.js';
import { createDiaryWritingComposition } from '../app/create-diary-writing-composition.js';
import { parseDiaryBlock } from '../parser/diary-parser.js';
import { createCustomApiClient } from '../ai/custom-api-client.js';

function createExchangeSupportAndLibraryCompositions({
  extensionName,
  extensionFolderPath,
  pluginVersion,
  runtime,
  storage,
  notify,
  customApiClient,
}) {
  const exchangeFeature = createExchangeFeatureComposition({
    executeSlashCommandsWithOptions: runtime.executeSlashCommandsWithOptions,
    customApiClient,
    exchangeDiaryStorage: storage.exchangeDiaryStorage,
    getCurrentFloor: runtime.getCurrentFloor,
    isAIGenerating: runtime.isAIGenerating,
    getCurrentCharacter: runtime.getCurrentCharacter,
    getContext: runtime.getContext,
    saveToRecycleBinFile: storage.saveToRecycleBinFile,
    loadAllRecycleBin: storage.loadAllRecycleBin,
    saveAllRecycleBin: storage.saveAllRecycleBin,
    getDefaultCharacterName: runtime.getDefaultCharacterName,
    notify,
  });

  const supportComposition = createPluginSupportComposition({
    pluginVersion,
    extensionName,
    extensionFolderPath,
    extensionSettings: runtime.extensionSettings,
    getCurrentSettings: runtime.getCurrentSettings,
    getPresetManager: runtime.getPresetManager,
    saveSettings: runtime.saveSettings,
    saveSettingsDebounced: runtime.saveSettingsDebounced,
    loadAllDiaries: storage.loadAllDiaries,
    saveAllDiaries: storage.saveAllDiaries,
    loadAllRecycleBin: storage.loadAllRecycleBin,
    saveAllRecycleBin: storage.saveAllRecycleBin,
    exchangeDiaryStorage: storage.exchangeDiaryStorage,
    loadDiaryGroupData: storage.loadDiaryGroupData,
    saveDiaryGroupData: storage.saveDiaryGroupData,
    loadLegacyStorageSnapshot: storage.loadLegacyStorageSnapshot,
    getFileStorageStatus: storage.getFileStorageStatus,
    notify,
  });

  const libraryComposition = createDiaryLibraryComposition({
    getAllCharacters: storage.getAllCharacters,
    getCharacterDiaries: storage.getCharacterDiaries,
    loadDiaryFromFile: storage.loadDiaryFromFile,
    deleteDiaryFromFile: storage.deleteDiaryFromFile,
    updateDiaryRemark: storage.updateDiaryRemark,
    getDiaryGroups: storage.getDiaryGroups,
    createDiaryGroup: storage.createDiaryGroup,
    updateDiaryGroup: storage.updateDiaryGroup,
    deleteDiaryGroup: storage.deleteDiaryGroup,
    notify,
  });

  return {
    exchangeFeature,
    supportComposition,
    libraryComposition,
  };
}

function createWritingSettingsAndOverlayCompositions({
  extensionName,
  extensionFolderPath,
  defaultSettings,
  runtime,
  storage,
  notify,
  exchangeFeature,
  supportComposition,
  libraryComposition,
  customApiClient,
}) {
  let closeFloatMenu = () => {};

  const writingComposition = createDiaryWritingComposition({
    getChat: runtime.getChat,
    getCurrentCharacter: runtime.getCurrentCharacter,
    getContext: runtime.getContext,
    parseDiaryBlock,
    executeSlashCommandsWithOptions: runtime.executeSlashCommandsWithOptions,
    customApiClient,
    saveDiaryToFile: storage.saveDiaryToFile,
    saveToRecycleBinFile: storage.saveToRecycleBinFile,
    showSaveSuccessDialog: libraryComposition.showSaveSuccessDialog,
    switchToDiaryPreset: supportComposition.switchToDiaryPreset,
    restoreOriginalPreset: supportComposition.restoreOriginalPreset,
    getCurrentSettings: runtime.getCurrentSettings,
    saveSettings: runtime.saveSettings,
    getCurrentFloor: runtime.getCurrentFloor,
    isAIGenerating: runtime.isAIGenerating,
    loadAllRecycleBin: storage.loadAllRecycleBin,
    saveAllRecycleBin: storage.saveAllRecycleBin,
    loadDiaryFromFile: storage.loadDiaryFromFile,
    deleteRecycleBinItem: storage.deleteRecycleBinItem,
    exchangeDiaryStorage: storage.exchangeDiaryStorage,
    formatValidator: exchangeFeature.formatValidator,
    closeFloatMenu: () => closeFloatMenu(),
    updateStatusText: text => $('#diary_auto_status').text(text),
    notify,
  });

  const settingsUi = createSettingsUiComposition({
    extensionSettings: runtime.extensionSettings,
    extensionName,
    extensionFolderPath,
    defaultSettings,
    getCurrentSettings: runtime.getCurrentSettings,
    saveSettings: runtime.saveSettings,
    saveSettingsDebounced: runtime.saveSettingsDebounced,
    exchangeDiaryStorage: storage.exchangeDiaryStorage,
    getAutoDiaryConfig: writingComposition.getAutoDiaryConfig,
    saveAutoDiaryInterval: writingComposition.saveAutoDiaryInterval,
    updateAutoDiaryStatus: writingComposition.updateAutoDiaryStatus,
    loadApiSettingsSync: storage.loadApiSettingsSync,
    saveApiSettings: storage.saveApiSettings,
    testCustomApiConnection: settings => customApiClient.testConnection(settings),
    notify,
  });

  const overlayUi = createOverlayUiComposition({
    extensionName,
    extensionSettings: runtime.extensionSettings,
    getCurrentSettings: runtime.getCurrentSettings,
    saveSettings: runtime.saveSettings,
    getAllRecycleBinFiles: storage.getAllRecycleBinFiles,
    loadRecycleBinItem: storage.loadRecycleBinItem,
    restoreExchangeDiaryFromRecycleBin: writingComposition.restoreExchangeDiaryFromRecycleBin,
    saveRecycleBinAsDiary: writingComposition.saveRecycleBinAsDiary,
    deleteRecycleBinFile: storage.deleteRecycleBinFile,
    clearRecycleBinFiles: storage.clearRecycleBinFiles,
    showDiaryBookDialog: libraryComposition.showDiaryBookDialog,
    startWriteDiary: () => writingComposition.startWriteDiary(),
    showExchangeDiaryDialog: () => exchangeFeature.showExchangeDiaryDialog(),
    notify,
  });

  ({ closeFloatMenu } = overlayUi);

  return {
    writingComposition,
    settingsUi,
    overlayUi,
  };
}

function createBootstrapDependencies({
  runtime,
  storage,
  exchangeFeature,
  supportComposition,
  libraryComposition,
  writingComposition,
  settingsUi,
  overlayUi,
}) {
  return {
    exportDiaryData: supportComposition.exportDiaryData,
    importDiaryData: supportComposition.importDiaryData,
    toggleFloatWindow: overlayUi.toggleFloatWindow,
    resetFloatWindowPosition: overlayUi.resetFloatWindowPosition,
    configurePresets: () => supportComposition.showPresetDialog(),
    loadSettings: settingsUi.loadSettings,
    loadPluginSettingsStyle: settingsUi.loadPluginSettingsStyle,
    loadExchangeDiaryCSS: settingsUi.loadExchangeDiaryCSS,
    createFloatWindow: overlayUi.createFloatWindow,
    createCustomCharacterDialog: writingComposition.createCustomCharacterDialog,
    createExchangeDiaryDialog: exchangeFeature.createExchangeDiaryDialog,
    createPresetDialog: supportComposition.createPresetDialog,
    createDiaryBookDialog: libraryComposition.createDiaryBookDialog,
    createReadmeDialog: supportComposition.createReadmeDialog,
    createSaveSuccessDialog: libraryComposition.createSaveSuccessDialog,
    createRecycleBinDialog: overlayUi.createRecycleBinDialog,
    loadPresetData: supportComposition.loadPresetData,
    bindCustomCharacterDialogEvents: writingComposition.bindCustomCharacterDialogEvents,
    bindExchangeDiaryDialogEvents: exchangeFeature.bindExchangeDiaryDialogEvents,
    bindDiaryBookDialogEvents: libraryComposition.bindDiaryBookDialogEvents,
    bindReadmeDialogEvents: supportComposition.bindReadmeDialogEvents,
    bindSaveSuccessDialogEvents: libraryComposition.bindSaveSuccessDialogEvents,
    getCurrentSettings: runtime.getCurrentSettings,
    checkAndTriggerAutoDiary: writingComposition.checkAndTriggerAutoDiary,
    triggerManager: exchangeFeature.triggerManager,
    initializeFileStorage: storage.initializeFileStorage,
    migrateExchangeDiaryData: storage.migrateExchangeDiaryData,
    bindUpdateNotificationEvents: supportComposition.bindUpdateNotificationEvents,
    checkAndShowUpdateNotification: supportComposition.checkAndShowUpdateNotification,
  };
}

export function createDiaryPluginCompositions({
  extensionName,
  extensionFolderPath,
  defaultSettings,
  pluginVersion,
  runtime,
  storage,
  notify,
}) {
  const customApiClient = createCustomApiClient({
    loadApiSettingsSync: storage.loadApiSettingsSync,
    saveApiSettings: storage.saveApiSettings,
    getRequestHeaders: runtime.getRequestHeaders,
    executeSlashCommandsWithOptions: runtime.executeSlashCommandsWithOptions,
    eventSource: runtime.eventSource,
    eventTypes: runtime.eventTypes,
  });

  const {
    exchangeFeature,
    supportComposition,
    libraryComposition,
  } = createExchangeSupportAndLibraryCompositions({
    extensionName,
    extensionFolderPath,
    pluginVersion,
    runtime,
    storage,
    notify,
    customApiClient,
  });

  const {
    writingComposition,
    settingsUi,
    overlayUi,
  } = createWritingSettingsAndOverlayCompositions({
    extensionName,
    extensionFolderPath,
    defaultSettings,
    runtime,
    storage,
    notify,
    exchangeFeature,
    supportComposition,
    libraryComposition,
    customApiClient,
  });

  return createBootstrapDependencies({
    runtime,
    storage,
    exchangeFeature,
    supportComposition,
    libraryComposition,
    writingComposition,
    settingsUi,
    overlayUi,
  });
}
