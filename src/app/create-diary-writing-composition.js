import { createAutoDiaryManager } from '../ai/auto-diary-manager.js';
import { createDiaryWritingManager } from '../ai/diary-writing-manager.js';
import { createRecycleBinRecoveryManager } from '../storage/recycle-bin-recovery-manager.js';
import { createCustomCharacterDialogManager } from '../ui/custom-character-dialog-manager.js';

export function createDiaryWritingComposition({
  getChat,
  getCurrentCharacter,
  getContext,
  parseDiaryBlock,
  executeSlashCommandsWithOptions,
  customApiClient,
  saveDiaryToFile,
  saveToRecycleBinFile,
  showSaveSuccessDialog,
  switchToDiaryPreset,
  restoreOriginalPreset,
  getCurrentSettings,
  saveSettings,
  getCurrentFloor,
  isAIGenerating,
  loadAllRecycleBin,
  saveAllRecycleBin,
  loadDiaryFromFile,
  deleteRecycleBinItem,
  exchangeDiaryStorage,
  formatValidator,
  closeFloatMenu,
  updateStatusText,
  notify,
}) {
  let continueWriteDiary;
  let startWriteDiary;
  let parseDiaryContent;
  let getCurrentCharacterName;

  const {
    showCustomCharacterDialog,
    hideCustomCharacterDialog,
    createCustomCharacterDialog,
    bindCustomCharacterDialogEvents,
  } = createCustomCharacterDialogManager({
    getCurrentCharacterName: () => getCurrentCharacterName(),
    continueWriteDiary: () => continueWriteDiary(),
    notify,
  });

  ({
    continueWriteDiary,
    startWriteDiary,
    parseDiaryContent,
    getCurrentCharacterName,
  } = createDiaryWritingManager({
    getChat,
    getCurrentCharacterFromHost: getCurrentCharacter,
    getContext,
    parseDiaryBlock,
    executeSlashCommandsWithOptions,
    customApiClient,
    saveDiaryToFile,
    saveToRecycleBinFile,
    showSaveSuccessDialog,
    showCustomCharacterDialog,
    hideCustomCharacterDialog,
    closeFloatMenu: () => closeFloatMenu(),
    switchToDiaryPreset,
    restoreOriginalPreset,
    notify,
  }));

  const {
    saveRecycleBinAsDiary,
    restoreExchangeDiaryFromRecycleBin,
  } = createRecycleBinRecoveryManager({
    loadAllRecycleBin,
    saveAllRecycleBin,
    parseDiaryContent: messageContent => parseDiaryContent(messageContent),
    saveDiaryToFile,
    loadDiaryFromFile,
    deleteRecycleBinItem,
    exchangeDiaryStorage,
    formatValidator,
    getCurrentFloor,
  });

  const {
    getAutoDiaryConfig,
    saveAutoDiaryInterval,
    updateAutoDiaryStatus,
    checkAndTriggerAutoDiary,
  } = createAutoDiaryManager({
    getCurrentSettings,
    saveSettings,
    getContext,
    getCurrentCharacterName: () => getCurrentCharacterName(),
    getCurrentFloor,
    isAIGenerating,
    switchToDiaryPreset,
    restoreOriginalPreset,
    executeSlashCommandsWithOptions,
    customApiClient,
    parseDiaryContent: messageContent => parseDiaryContent(messageContent),
    saveDiaryToFile,
    saveToRecycleBinFile,
    updateStatusText,
    notify,
  });

  return {
    showCustomCharacterDialog,
    hideCustomCharacterDialog,
    createCustomCharacterDialog,
    bindCustomCharacterDialogEvents,
    continueWriteDiary,
    startWriteDiary,
    parseDiaryContent,
    getCurrentCharacterName,
    saveRecycleBinAsDiary,
    restoreExchangeDiaryFromRecycleBin,
    getAutoDiaryConfig,
    saveAutoDiaryInterval,
    updateAutoDiaryStatus,
    checkAndTriggerAutoDiary,
  };
}
