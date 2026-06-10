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
  loadApiSettingsSync,
  saveApiSettings,
  testCustomApiConnection,
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

    updateCustomApiUI();
    bindCustomApiEvents();
  }

  function getCustomApiFormSettings() {
    const current = typeof loadApiSettingsSync === 'function' ? loadApiSettingsSync() : {};
    return {
      ...current,
      enabled: $('#diary_custom_api_enabled').is(':checked'),
      url: String($('#diary_custom_api_url').val() || '').trim(),
      key: String($('#diary_custom_api_key').val() || ''),
      model: String($('#diary_custom_api_model').val() || '').trim(),
    };
  }

  function renderCustomApiModels(models = [], selectedModel = '') {
    const $modelSelect = $('#diary_custom_api_model');
    if (!$modelSelect.length) {
      return;
    }

    const uniqueModels = [...new Set(models.map(model => String(model || '').trim()).filter(Boolean))];
    const options = uniqueModels.length ? uniqueModels : selectedModel ? [selectedModel] : [];

    $modelSelect.empty();
    $modelSelect.append('<option value="">未选择模型</option>');
    for (const model of options) {
      $modelSelect.append($('<option></option>').attr('value', model).text(model));
    }

    $modelSelect.val(selectedModel || '');
  }

  function updateCustomApiStatus(settings) {
    if (!$('#diary_custom_api_status').length) {
      return;
    }

    if (settings?.lastTestedAt && settings?.models?.length) {
      $('#diary_custom_api_status').text(`已获取 ${settings.models.length} 个模型`);
      return;
    }

    $('#diary_custom_api_status').text('请先测试连接获取模型列表。');
  }

  function updateCustomApiUI() {
    const settings = typeof loadApiSettingsSync === 'function' ? loadApiSettingsSync() : {};
    if (!$('#diary_custom_api_enabled').length) {
      return;
    }

    $('#diary_custom_api_enabled').prop('checked', Boolean(settings.enabled));
    $('#diary_custom_api_url').val(settings.url || '');
    $('#diary_custom_api_key').val(settings.key || '');
    renderCustomApiModels(settings.models || [], settings.model || '');
    updateCustomApiStatus(settings);
  }

  async function saveCustomApiSettingsFromUI(extraSettings = {}) {
    if (typeof saveApiSettings !== 'function') {
      return false;
    }

    const current = getCustomApiFormSettings();
    return saveApiSettings({
      ...current,
      ...extraSettings,
      models: extraSettings.models || current.models || [],
    });
  }

  function bindCustomApiEvents() {
    if (!$('#diary_custom_api_enabled').length) {
      return;
    }

    $('#diary_custom_api_enabled, #diary_custom_api_url, #diary_custom_api_key, #diary_custom_api_model')
      .off(`change${SETTINGS_EVENT_NAMESPACE} blur${SETTINGS_EVENT_NAMESPACE}`)
      .on(`change${SETTINGS_EVENT_NAMESPACE} blur${SETTINGS_EVENT_NAMESPACE}`, async function () {
        await saveCustomApiSettingsFromUI();
      });

    $('#diary_custom_api_test')
      .off(`click${SETTINGS_EVENT_NAMESPACE}`)
      .on(`click${SETTINGS_EVENT_NAMESPACE}`, async function () {
        const $button = $(this);
        const formSettings = getCustomApiFormSettings();

        if (!formSettings.url) {
          notify.warning('请先填写 API URL');
          return;
        }

        $button.prop('disabled', true);
        $('#diary_custom_api_status').text('正在测试连接...');

        try {
          const testedSettings = await testCustomApiConnection(formSettings);
          renderCustomApiModels(testedSettings.models, testedSettings.model);
          updateCustomApiStatus(testedSettings);
          notify.success(`连接成功，已获取 ${testedSettings.models.length} 个模型`);
        } catch (error) {
          console.error('[Custom API] Test connection failed:', error);
          $('#diary_custom_api_status').text('连接测试失败');
          notify.error(error.message || '连接测试失败');
        } finally {
          $button.prop('disabled', false);
        }
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
