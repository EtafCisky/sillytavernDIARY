import {
  BUTTON_THEMES,
  FLOAT_WINDOW_BASE_CSS,
  PLUGIN_SETTINGS_CSS,
  SUB_BUTTONS_CSS,
  THEMES,
} from './theme-assets.js';

export function createThemeManager({
  extensionSettings,
  extensionName,
  extensionFolderPath,
  getCurrentSettings,
  saveSettings,
  saveSettingsDebounced,
  notify,
}) {
  const THEME_EVENT_NAMESPACE = '.diaryTheme';

  let currentThemeLink = null;
  let pluginSettingsStyleLink = null;
  let floatWindowStyleLink = null;
  let buttonThemeStyleLink = null;

  function removeStyleNode(id, cachedNode = null) {
    if (cachedNode) {
      cachedNode.remove();
    }

    document.querySelectorAll(`#${id}`).forEach(node => node.remove());
  }

  function createStyleNode(id, textContent) {
    removeStyleNode(id);

    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = id;
    style.textContent = textContent;

    document.head.appendChild(style);
    return style;
  }

  function createStylesheetLink(id, href) {
    removeStyleNode(id);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    link.id = id;

    document.head.appendChild(link);
    return link;
  }

  function loadFloatWindowStyle() {
    removeStyleNode('diary-float-window-css', floatWindowStyleLink);
    floatWindowStyleLink = createStyleNode('diary-float-window-css', FLOAT_WINDOW_BASE_CSS + SUB_BUTTONS_CSS);
  }

  function loadButtonThemeStyle() {
    const selectedButtonTheme = extensionSettings[extensionName].selectedButtonTheme || 'heart';

    const buttonTheme = BUTTON_THEMES[selectedButtonTheme];
    if (!buttonTheme) {
      console.error(`[Diary Theme] Button theme not found: ${selectedButtonTheme}`);
      return;
    }

    const floatIcon = document.querySelector('.diary-float-icon');
    if (floatIcon) {
      floatIcon.textContent = buttonTheme.symbol;
    }

    removeStyleNode('diary-button-theme-css', buttonThemeStyleLink);
    buttonThemeStyleLink = createStyleNode('diary-button-theme-css', buttonTheme.css);
  }

  function loadPluginSettingsStyle() {
    removeStyleNode('diary-plugin-settings-css', pluginSettingsStyleLink);
    pluginSettingsStyleLink = createStyleNode('diary-plugin-settings-css', PLUGIN_SETTINGS_CSS);
  }

  function loadExchangeDiaryCSS() {
    console.log('[Diary Theme] Loading exchange diary CSS...');

    createStylesheetLink('diary-exchange-css', `${extensionFolderPath}/exchange-diary.css`);

    console.log('[Diary Theme] Exchange diary CSS loaded');
  }

  function loadTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) {
      console.error(`[Diary Theme] Theme not found: ${themeId}`);
      return;
    }

    removeStyleNode('diary-theme-css', currentThemeLink);
    currentThemeLink = createStylesheetLink('diary-theme-css', `${extensionFolderPath}/${theme.cssFile}`);
  }

  function switchTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) {
      console.error(`[Diary Theme] Theme not found: ${themeId}`);
      notify.error('主题不存在', '主题切换');
      return;
    }

    loadTheme(themeId);

    const settings = getCurrentSettings();
    settings.selectedTheme = themeId;
    saveSettings();

    updateThemeUI();

    notify.success(`已切换到 ${theme.name} 主题`, '主题切换');
  }

  function initThemeSelector() {
    const $select = $('#diary_theme_select');
    $select.empty();

    Object.values(THEMES).forEach(theme => {
      const option = $('<option>').val(theme.id).text(theme.name);
      $select.append(option);
    });

    const settings = getCurrentSettings();
    const currentTheme = settings.selectedTheme || 'classic';
    $select.val(currentTheme);

    $select.off(`change${THEME_EVENT_NAMESPACE}`).on(`change${THEME_EVENT_NAMESPACE}`, function () {
      const themeId = $(this).val();
      switchTheme(themeId);
    });

    console.log('[Diary Theme] Theme selector initialized');
  }

  function updateThemeUI() {
    const settings = getCurrentSettings();
    const currentTheme = settings.selectedTheme || 'classic';
    const theme = THEMES[currentTheme];

    if (theme) {
      $('#diary_theme_select').val(currentTheme);
      $('#diary_theme_description').text(theme.description);
    }
  }

  function initButtonThemeSelector() {
    const $select = $('#diary_button_theme_select');
    $select.empty();

    Object.values(BUTTON_THEMES).forEach(buttonTheme => {
      const option = $('<option>').val(buttonTheme.id).text(`${buttonTheme.symbol} ${buttonTheme.name}`);
      $select.append(option);
    });

    const settings = getCurrentSettings();
    const currentButtonTheme = settings.selectedButtonTheme || 'heart';
    $select.val(currentButtonTheme);

    $select.off(`change${THEME_EVENT_NAMESPACE}`).on(`change${THEME_EVENT_NAMESPACE}`, function () {
      const buttonThemeId = $(this).val();
      switchButtonTheme(buttonThemeId);
    });

    console.log('[Diary Theme] Button theme selector initialized');
  }

  function updateButtonThemeUI() {
    const settings = getCurrentSettings();
    const currentButtonTheme = settings.selectedButtonTheme || 'heart';
    const buttonTheme = BUTTON_THEMES[currentButtonTheme];

    if (buttonTheme) {
      $('#diary_button_theme_select').val(currentButtonTheme);
      $('#diary_button_theme_description').text(buttonTheme.description);
    }
  }

  function switchButtonTheme(buttonThemeId) {
    if (!BUTTON_THEMES[buttonThemeId]) {
      console.error(`[Diary Theme] Button theme not found: ${buttonThemeId}`);
      return;
    }

    extensionSettings[extensionName].selectedButtonTheme = buttonThemeId;
    saveSettingsDebounced();

    loadButtonThemeStyle();
    updateButtonThemeUI();

    notify.success(`已切换到 ${BUTTON_THEMES[buttonThemeId].name} 按钮样式`, '按钮美化');
  }

  function initFontColorSelector() {
    const $select = $('#diary_font_color_select');

    const settings = getCurrentSettings();
    const currentFontColorMode = settings.fontColorMode || 'light';
    $select.val(currentFontColorMode);

    $select.off(`change${THEME_EVENT_NAMESPACE}`).on(`change${THEME_EVENT_NAMESPACE}`, function () {
      const fontColorMode = $(this).val();
      switchFontColorMode(fontColorMode);
    });
  }

  function updateFontColorUI() {
    const settings = getCurrentSettings();
    const currentFontColorMode = settings.fontColorMode || 'light';

    $('#diary_font_color_select').val(currentFontColorMode);

    const descriptions = {
      light: '当前使用浅色字体，适合深色背景环境。本设置区域预览深色字体效果。',
      dark: '当前使用深色字体，适合浅色背景环境。本设置区域预览浅色字体效果。',
    };
    $('#diary_font_color_description').text(descriptions[currentFontColorMode]);
  }

  function switchFontColorMode(fontColorMode) {
    if (!['light', 'dark'].includes(fontColorMode)) {
      console.error(`[Diary Theme] Invalid font color mode: ${fontColorMode}`);
      return;
    }

    extensionSettings[extensionName].fontColorMode = fontColorMode;
    saveSettingsDebounced();

    applyFontColorMode();
    updateFontColorUI();

    const modeNames = {
      light: '浅色字体',
      dark: '深色字体',
    };
    notify.success(`已切换到 ${modeNames[fontColorMode]}`, '字体颜色');
  }

  function applyFontColorMode() {
    const settings = getCurrentSettings();
    const fontColorMode = settings.fontColorMode || 'light';
    const $pluginSettings = $('.diary-plugin-settings');

    $pluginSettings.removeClass('dark-font');

    if (fontColorMode === 'dark') {
      $pluginSettings.addClass('dark-font');
    }
  }

  return {
    loadFloatWindowStyle,
    loadButtonThemeStyle,
    loadPluginSettingsStyle,
    loadExchangeDiaryCSS,
    loadTheme,
    switchTheme,
    initThemeSelector,
    updateThemeUI,
    initButtonThemeSelector,
    updateButtonThemeUI,
    switchButtonTheme,
    initFontColorSelector,
    updateFontColorUI,
    switchFontColorMode,
    applyFontColorMode,
  };
}
