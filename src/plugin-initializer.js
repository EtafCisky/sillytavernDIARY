export function createPluginInitializer({
  extensionFolderPath,
  pluginAuthor,
  verifyAuthorInfo,
  getAuthorViolationToastContent,
  exportDiaryData,
  importDiaryData,
  toggleFloatWindow,
  resetFloatWindowPosition,
  configurePresets,
  bindSettingsTabEvents,
  loadSettings,
  loadPluginSettingsStyle,
  loadExchangeDiaryCSS,
  createFloatWindow,
  createCustomCharacterDialog,
  createExchangeDiaryDialog,
  createPresetDialog,
  createDiaryBookDialog,
  createReadmeDialog,
  createSaveSuccessDialog,
  createRecycleBinDialog,
  loadPresetData,
  bindCustomCharacterDialogEvents,
  bindExchangeDiaryDialogEvents,
  bindDiaryBookDialogEvents,
  bindReadmeDialogEvents,
  bindSaveSuccessDialogEvents,
  getCurrentSettings,
  checkAndTriggerAutoDiary,
  triggerManager,
  initializeFileStorage = async () => {},
  migrateExchangeDiaryData = () => {},
  bindUpdateNotificationEvents,
  checkAndShowUpdateNotification,
  notify,
  scheduleInterval = setInterval,
  scheduleTimeout = setTimeout,
}) {
  const GLOBAL_INIT_STATE_KEY = '__sillytavernDiaryPluginInitState__';
  const AUTO_DIARY_INTERVAL_MS = 3000;
  const UPDATE_NOTIFICATION_DELAY_MS = 1000;
  const AUTHOR_NOTICE_DELAY_MS = 500;
  const ERROR_TITLE = 'Diary Plugin';

  let hasInitialized = false;
  let isInitializing = false;
  let mainSettingsEventsBound = false;
  let dialogsCreated = false;
  let dialogEventsBound = false;
  let autoDiaryTimerId = null;
  let updateNotificationInitialized = false;

  const dialogCreators = [
    createFloatWindow,
    createCustomCharacterDialog,
    createExchangeDiaryDialog,
    createPresetDialog,
    createDiaryBookDialog,
    createReadmeDialog,
    createSaveSuccessDialog,
    createRecycleBinDialog,
  ];

  const dialogEventBinders = [
    bindCustomCharacterDialogEvents,
    bindExchangeDiaryDialogEvents,
    bindDiaryBookDialogEvents,
    bindReadmeDialogEvents,
    bindSaveSuccessDialogEvents,
  ];

  function getGlobalInitState() {
    if (!window[GLOBAL_INIT_STATE_KEY]) {
      window[GLOBAL_INIT_STATE_KEY] = {
        initialized: false,
        initializing: false,
      };
    }

    return window[GLOBAL_INIT_STATE_KEY];
  }

  async function loadSettingsHtml() {
    const $author = $('#diary-plugin-author');
    if ($author.length > 0) {
      $author.text(pluginAuthor.name);
      return;
    }

    const settingsHtml = await $.get(`${extensionFolderPath}/index.html`);
    $('#extensions_settings2').append(settingsHtml);
    $('#diary-plugin-author').text(pluginAuthor.name);
  }

  function showAuthorViolationToast() {
    const { errorTitle, errorMessage, officialTitle, officialMessage } = getAuthorViolationToastContent();

    notify.error(errorMessage, errorTitle, {
      timeOut: 0,
      extendedTimeOut: 0,
      closeButton: true,
      escapeHtml: false,
    });

    scheduleTimeout(() => {
      notify.info(officialMessage, officialTitle, {
        timeOut: 0,
        extendedTimeOut: 0,
        closeButton: true,
        escapeHtml: false,
      });
    }, AUTHOR_NOTICE_DELAY_MS);
  }

  async function verifyLoadedAuthor() {
    const verification = await verifyAuthorInfo();
    if (!verification.verified) {
      showAuthorViolationToast();
      return false;
    }

    return true;
  }

  function bindClick(selector, handler) {
    $(selector).off('click.diaryPlugin').on('click.diaryPlugin', handler);
  }

  function bindMainSettingsEvents() {
    if (mainSettingsEventsBound) {
      return;
    }

    bindClick('#diary_export_data', exportDiaryData);
    bindClick('#diary_import_data', () => $('#diary_import_file').click());
    $('#diary_import_file').off('change.diaryPlugin').on('change.diaryPlugin', importDiaryData);
    bindClick('#diary_toggle_float_window', toggleFloatWindow);
    bindClick('#diary_reset_float_position', resetFloatWindowPosition);
    bindClick('#diary_configure_presets', configurePresets);

    bindSettingsTabEvents();
    mainSettingsEventsBound = true;
  }

  function createDialogs() {
    if (dialogsCreated) {
      return;
    }

    dialogCreators.forEach(createDialog => createDialog());
    dialogsCreated = true;
  }

  function bindDialogEvents() {
    if (dialogEventsBound) {
      return;
    }

    dialogEventBinders.forEach(bindEvents => bindEvents());
    dialogEventsBound = true;
  }

  function applyFloatWindowVisibility() {
    const settings = getCurrentSettings();
    $('#diary-float-window').toggle(Boolean(settings.floatWindowVisible));
  }

  function startAutoDiaryTimer() {
    if (autoDiaryTimerId) {
      return;
    }

    autoDiaryTimerId = scheduleInterval(() => {
      checkAndTriggerAutoDiary();
    }, AUTO_DIARY_INTERVAL_MS);
    console.log('[Diary Plugin] Auto diary timer started');
  }

  function startExchangeTriggerManager() {
    triggerManager.start();
    migrateExchangeDiaryData();
    console.log('[Diary Plugin] Exchange trigger manager started');
  }

  function initializeUpdateNotification() {
    if (updateNotificationInitialized) {
      return;
    }

    const $notification = $('#diary-update-notification');
    if ($notification.length > 0 && !$notification.parent().is('body')) {
      $notification.appendTo('body');
    }

    bindUpdateNotificationEvents();

    scheduleTimeout(() => {
      checkAndShowUpdateNotification();
    }, UPDATE_NOTIFICATION_DELAY_MS);

    updateNotificationInitialized = true;
  }

  async function initializePluginUi() {
    bindMainSettingsEvents();

    await initializeFileStorage();
    await loadSettings();
    loadPluginSettingsStyle();
    loadExchangeDiaryCSS();

    createDialogs();
    await loadPresetData();
    bindDialogEvents();

    applyFloatWindowVisibility();
    startAutoDiaryTimer();
    startExchangeTriggerManager();
    initializeUpdateNotification();
  }

  function markInitialized(globalInitState) {
    hasInitialized = true;
    globalInitState.initialized = true;
  }

  function shouldSkipInitialization(globalInitState) {
    return hasInitialized || isInitializing || globalInitState.initialized || globalInitState.initializing;
  }

  async function initialize() {
    const globalInitState = getGlobalInitState();
    if (shouldSkipInitialization(globalInitState)) {
      return;
    }

    console.log('[Diary Plugin] Initializing...');

    try {
      isInitializing = true;
      globalInitState.initializing = true;

      await loadSettingsHtml();

      const verified = await verifyLoadedAuthor();
      if (!verified) {
        return;
      }

      await initializePluginUi();
      markInitialized(globalInitState);
      console.log('[Diary Plugin] Initialization complete');
    } catch (error) {
      console.error('[Diary Plugin] Initialization failed:', error);
      notify.error(`Plugin initialization failed: ${error.message}`, ERROR_TITLE);
    } finally {
      isInitializing = false;
      globalInitState.initializing = false;
    }
  }

  function initializeOnReady() {
    jQuery(initialize);
  }

  return {
    initialize,
    initializeOnReady,
  };
}
