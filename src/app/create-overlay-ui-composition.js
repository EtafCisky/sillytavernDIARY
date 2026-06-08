import { createFloatWindowManager } from '../ui/float-window-manager.js';
import { createRecycleBinDialogManager } from '../ui/recycle-bin-dialog-manager.js';

export function createOverlayUiComposition({
  extensionName,
  extensionSettings,
  getCurrentSettings,
  saveSettings,
  getAllRecycleBinFiles,
  loadRecycleBinItem,
  restoreExchangeDiaryFromRecycleBin,
  saveRecycleBinAsDiary,
  deleteRecycleBinFile,
  clearRecycleBinFiles,
  showDiaryBookDialog,
  startWriteDiary,
  showExchangeDiaryDialog,
  notify,
}) {
  let closeFloatMenu = () => {};

  function openDiaryBook() {
    closeFloatMenu();
    showDiaryBookDialog();
  }

  const {
    showRecycleBinDialog,
    createRecycleBinDialog,
  } = createRecycleBinDialogManager({
    getAllRecycleBinFiles,
    loadRecycleBinItem,
    restoreExchangeDiaryFromRecycleBin,
    saveRecycleBinAsDiary,
    deleteRecycleBinFile,
    clearRecycleBinFiles,
    notify,
  });

  const floatWindowManager = createFloatWindowManager({
    extensionName,
    extensionSettings,
    getCurrentSettings,
    saveSettings,
    notify,
    openDiaryBook,
    startWriteDiary,
    showExchangeDiaryDialog,
    showRecycleBinDialog,
  });

  ({ closeFloatMenu } = floatWindowManager);

  return {
    createRecycleBinDialog,
    ...floatWindowManager,
  };
}
