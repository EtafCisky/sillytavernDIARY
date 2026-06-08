export function createSettingsManager({
  extensionSettings,
  extensionName,
  defaultSettings,
  getCurrentSettings,
  exchangeDiaryStorage,
  loadFloatWindowStyle,
  loadPluginSettingsStyle,
  loadTheme,
  loadButtonThemeStyle,
  initThemeSelector,
  updateThemeUI,
  initButtonThemeSelector,
  updateButtonThemeUI,
  initFontColorSelector,
  updateFontColorUI,
  applyFontColorMode,
  getAutoDiaryConfig,
  saveAutoDiaryInterval,
  updateAutoDiaryStatus,
  notify,
}) {
  const SETTINGS_EVENT_NAMESPACE = '.diarySettings';

  async function loadSettings() {
    extensionSettings[extensionName] = extensionSettings[extensionName] || {};
    if (Object.keys(extensionSettings[extensionName]).length === 0) {
      Object.assign(extensionSettings[extensionName], defaultSettings);
    }

    loadFloatWindowStyle();
    loadPluginSettingsStyle();

    const settings = getCurrentSettings();
    const selectedTheme = settings.selectedTheme || 'classic';
    loadTheme(selectedTheme);

    loadButtonThemeStyle();
    applyFontColorMode();
    updateSettingsUI();
  }

  function updateSettingsUI() {
    const settings = getCurrentSettings();

    initThemeSelector();
    updateThemeUI();
    initButtonThemeSelector();
    updateButtonThemeUI();
    initFontColorSelector();
    updateFontColorUI();
    applyFontColorMode();

    if (settings.selectedPreset) {
      $('#diary_selected_preset').text(`当前预设: ${settings.selectedPreset}`);
    } else {
      $('#diary_selected_preset').text('未选择预设');
    }

    const autoDiaryConfig = getAutoDiaryConfig();
    $('#diary_auto_interval').val(autoDiaryConfig.interval || '');
    updateAutoDiaryStatus();

    $('#diary_auto_interval')
      .off(`change${SETTINGS_EVENT_NAMESPACE}`)
      .on(`change${SETTINGS_EVENT_NAMESPACE}`, function () {
        const value = $(this).val();
        saveAutoDiaryInterval(value);
        updateAutoDiaryStatus();
        console.log('[自动写日记] 用户修改触发间隔:', value || '0 (已禁用)');
      });

    const exchangeDiaryConfig = exchangeDiaryStorage.getConfig();
    $('#diary_exchange_trigger_min').val(exchangeDiaryConfig.triggerWindowMin || 1);
    $('#diary_exchange_trigger_max').val(exchangeDiaryConfig.triggerWindowMax || 10);

    $('#diary_exchange_trigger_min')
      .off(`change${SETTINGS_EVENT_NAMESPACE}`)
      .on(`change${SETTINGS_EVENT_NAMESPACE}`, function () {
        saveExchangeDiaryTriggerWindow();
      });

    $('#diary_exchange_trigger_max')
      .off(`change${SETTINGS_EVENT_NAMESPACE}`)
      .on(`change${SETTINGS_EVENT_NAMESPACE}`, function () {
        saveExchangeDiaryTriggerWindow();
      });
  }

  function saveExchangeDiaryTriggerWindow() {
    let minValue = parseInt($('#diary_exchange_trigger_min').val(), 10);
    let maxValue = parseInt($('#diary_exchange_trigger_max').val(), 10);

    if (isNaN(minValue) || isNaN(maxValue)) {
      notify.warning('请输入有效的数字');
      return;
    }

    if (minValue < 1) {
      notify.warning('最小楼层数不能小于1');
      $('#diary_exchange_trigger_min').val(1);
      return;
    }

    if (maxValue < 1) {
      notify.warning('最大楼层数不能小于1');
      $('#diary_exchange_trigger_max').val(1);
      return;
    }

    if (minValue > maxValue) {
      notify.warning('最小楼层数不能大于最大楼层数');
      [minValue, maxValue] = [maxValue, minValue];
      $('#diary_exchange_trigger_min').val(minValue);
      $('#diary_exchange_trigger_max').val(maxValue);
    }

    const success = exchangeDiaryStorage.updateConfig({
      triggerWindowMin: minValue,
      triggerWindowMax: maxValue,
    });

    if (success) {
      console.log(`[交换日记配置] 触发窗口已更新: ${minValue}-${maxValue}楼层`);
      notify.success(`触发窗口已设置为 ${minValue}-${maxValue} 楼层`);
    } else {
      notify.error('保存配置失败');
    }
  }

  return {
    loadSettings,
    updateSettingsUI,
    saveExchangeDiaryTriggerWindow,
  };
}
