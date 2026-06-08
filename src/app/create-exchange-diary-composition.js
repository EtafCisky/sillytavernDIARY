import { createExchangeDeleteModeManager } from '../exchange/delete-mode-manager.js';
import { createExchangeDialogManager } from '../exchange/dialog-manager.js';
import { createRerollUiManager } from '../exchange/reroll-ui-manager.js';
import { createExchangeViewManager } from '../exchange/view-manager.js';
import { createExchangeWriteFormManager } from '../exchange/write-form-manager.js';

function createExchangeDialogComposition({
  exchangeDiaryStorage,
  refs,
}) {
  return createExchangeDialogManager({
    exchangeDiaryStorage,
    initializeWriteDiaryForm: () => refs.initializeWriteDiaryForm(),
    initializeViewDiaryPage: () => refs.initializeViewDiaryPage(),
    showExchangeDiaryThreadList: characterName => refs.showExchangeDiaryThreadList(characterName),
    showExchangeDiaryEntryList: threadId => refs.showExchangeDiaryEntryList(threadId),
    renderExchangeDiaryEntryList: (thread, page) => refs.renderExchangeDiaryEntryList(thread, page),
    toggleThreadDeleteMode: () => refs.toggleThreadDeleteMode(),
    deleteSelectedThreads: () => refs.deleteSelectedThreads(),
    toggleEntryDeleteMode: () => refs.toggleEntryDeleteMode(),
    deleteSelectedEntries: () => refs.deleteSelectedEntries(),
    showRerollSelector: () => refs.showRerollSelector(),
    hideRerollSelector: () => refs.hideRerollSelector(),
    confirmRerollSelection: () => refs.confirmRerollSelection(),
    generateNewRerollVersion: () => refs.generateNewRerollVersion(),
  });
}

function createExchangeFeatureModules({
  exchangeDiaryStorage,
  ghostwriteManager,
  rerollManager,
  getContext,
  getDefaultCharacterName,
  getCurrentFloor,
  notify,
  hideExchangeDiaryDialog,
  switchExchangeDiaryView,
}) {
  const writeForm = createExchangeWriteFormManager({
    exchangeDiaryStorage,
    ghostwriteManager,
    getContext,
    getDefaultCharacterName,
    getCurrentFloor,
    hideExchangeDiaryDialog: () => hideExchangeDiaryDialog(),
    notify,
  });

  const viewManager = createExchangeViewManager({
    exchangeDiaryStorage,
    switchExchangeDiaryView: viewName => switchExchangeDiaryView(viewName),
    getCurrentFloor,
    notify,
  });

  const rerollUi = createRerollUiManager({
    exchangeDiaryStorage,
    rerollManager,
    renderMobileView: (thread, currentPage, totalPages) => viewManager.renderMobileView(thread, currentPage, totalPages),
    renderDesktopView: (thread, currentPage, totalPages) => viewManager.renderDesktopView(thread, currentPage, totalPages),
    notify,
  });

  const deleteMode = createExchangeDeleteModeManager({
    exchangeDiaryStorage,
    showExchangeDiaryThreadList: characterName => viewManager.showExchangeDiaryThreadList(characterName),
    showExchangeDiaryEntryList: threadId => viewManager.showExchangeDiaryEntryList(threadId),
    notify,
  });

  return {
    writeForm,
    viewManager,
    rerollUi,
    deleteMode,
  };
}

function createCompositionExports({
  dialogComposition,
  writeForm,
  viewManager,
  rerollUi,
  deleteMode,
}) {
  return {
    ...dialogComposition,
    ...writeForm,
    ...viewManager,
    ...rerollUi,
    ...deleteMode,
  };
}

export function createExchangeDiaryComposition({
  exchangeDiaryStorage,
  ghostwriteManager,
  rerollManager,
  getContext,
  getDefaultCharacterName,
  getCurrentFloor,
  notify,
}) {
  const refs = {
    initializeWriteDiaryForm: () => {},
    initializeViewDiaryPage: () => {},
    showExchangeDiaryThreadList: () => {},
    showExchangeDiaryEntryList: () => {},
    renderExchangeDiaryEntryList: () => {},
    toggleThreadDeleteMode: () => {},
    deleteSelectedThreads: () => {},
    toggleEntryDeleteMode: () => {},
    deleteSelectedEntries: () => {},
    showRerollSelector: () => {},
    hideRerollSelector: () => {},
    confirmRerollSelection: () => {},
    generateNewRerollVersion: () => {},
  };

  const dialogComposition = createExchangeDialogComposition({
    exchangeDiaryStorage,
    refs,
  });

  const {
    showExchangeDiaryDialog,
    hideExchangeDiaryDialog,
    switchExchangeDiaryView,
  } = dialogComposition;

  const {
    writeForm,
    viewManager,
    rerollUi,
    deleteMode,
  } = createExchangeFeatureModules({
    exchangeDiaryStorage,
    ghostwriteManager,
    rerollManager,
    getContext,
    getDefaultCharacterName,
    getCurrentFloor,
    notify,
    hideExchangeDiaryDialog,
    switchExchangeDiaryView,
  });

  refs.initializeWriteDiaryForm = () => writeForm.initializeWriteDiaryForm();
  refs.initializeViewDiaryPage = () => viewManager.initializeViewDiaryPage();
  refs.showExchangeDiaryThreadList = characterName => viewManager.showExchangeDiaryThreadList(characterName);
  refs.showExchangeDiaryEntryList = threadId => viewManager.showExchangeDiaryEntryList(threadId);
  refs.renderExchangeDiaryEntryList = (thread, page) => viewManager.renderExchangeDiaryEntryList(thread, page);
  refs.toggleThreadDeleteMode = () => deleteMode.toggleThreadDeleteMode();
  refs.deleteSelectedThreads = () => deleteMode.deleteSelectedThreads();
  refs.toggleEntryDeleteMode = () => deleteMode.toggleEntryDeleteMode();
  refs.deleteSelectedEntries = () => deleteMode.deleteSelectedEntries();
  refs.showRerollSelector = () => rerollUi.showRerollSelector();
  refs.hideRerollSelector = () => rerollUi.hideRerollSelector();
  refs.confirmRerollSelection = () => rerollUi.confirmRerollSelection();
  refs.generateNewRerollVersion = () => rerollUi.generateNewRerollVersion();

  return createCompositionExports({
    dialogComposition,
    writeForm,
    viewManager,
    rerollUi,
    deleteMode,
  });
}
