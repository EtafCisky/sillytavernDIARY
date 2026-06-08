import { escapeHtmlText } from '../utils/display.js';

export function createPresetDialogManager({
  extensionName,
  extensionFolderPath,
  extensionSettings,
  getPresetManager,
  saveSettingsDebounced,
  notify,
}) {
  const presetEventNamespace = '.diaryPresetDialog';
  const readmeEventNamespace = '.diaryReadmeDialog';
  let presetEventsBound = false;
  let readmeEventsBound = false;
  let presetDialogAttached = false;
  let readmeDialogAttached = false;

  const presetListState = {
    presets: [],
    currentPreset: '',
    selectedPreset: null,
    currentPage: 1,
    pageSize: 8,
    totalPages: 1,
  };

  function escapeHtml(value) {
    return escapeHtmlText(value ?? '');
  }

  function escapeHtmlAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPluginSettings() {
    extensionSettings[extensionName] ??= {};
    return extensionSettings[extensionName];
  }

  function showPresetDialog() {
    $('#diary-preset-dialog').show();
    loadPresetData();
    renderPresetList();
  }

  function hidePresetDialog() {
    $('#diary-preset-dialog').hide();
  }

  async function showReadmeDialog() {
    $('#diary-readme-dialog').css('display', 'flex');
    await loadReadmeContent();
  }

  function hideReadmeDialog() {
    $('#diary-readme-dialog').css('display', 'none');
  }

  async function loadReadmeContent() {
    const container = $('#diary-readme-content-container');

    try {
      container.html('<div class="diary-readme-loading">Loading README...</div>');

      const readmePath = `${extensionFolderPath}/README.md`;
      const response = await fetch(readmePath);

      if (!response.ok) {
        throw new Error(`Failed to load README: ${response.status}`);
      }

      const markdown = await response.text();
      const html = convertMarkdownToHTML(markdown);
      container.html(html);
      container.parent().scrollTop(0);
    } catch (error) {
      console.error('[Diary Plugin] Failed to load README:', error);
      container.html(`
        <div style="text-align: center; padding: 40px; color: #999;">
          <p style="font-size: 16px; margin-bottom: 12px;">README load failed</p>
          <p style="font-size: 14px;">${error.message}</p>
        </div>
      `);
    }
  }

  function convertMarkdownToHTML(markdown) {
    let html = markdown;

    const codeBlocks = [];
    html = html.replace(/```[\s\S]*?```/g, match => {
      codeBlocks.push(match);
      return `__CODEBLOCK_${codeBlocks.length - 1}__`;
    });

    const inlineCode = [];
    html = html.replace(/`[^`]+`/g, match => {
      inlineCode.push(match);
      return `__INLINECODE_${inlineCode.length - 1}__`;
    });

    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^---$/gim, '<hr>');
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    codeBlocks.forEach((block, index) => {
      const code = block.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, content) => {
        return `<pre><code>${content.trim()}</code></pre>`;
      });
      html = html.replace(`__CODEBLOCK_${index}__`, code);
    });

    inlineCode.forEach((code, index) => {
      const content = code.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(`__INLINECODE_${index}__`, content);
    });

    html = html.replace(/\n/g, '<br>');
    return html;
  }

  async function loadPresetData() {
    try {
      const presetManager = getPresetManager();

      if (!presetManager) {
        presetListState.presets = [];
        presetListState.currentPreset = 'Unavailable';
        presetListState.selectedPreset = null;
        presetListState.currentPage = 1;
        presetListState.totalPages = 1;
        updatePresetDisplayText();
        return;
      }

      const allPresets = presetManager.getAllPresets() || [];
      const currentPreset = presetManager.getSelectedPresetName();
      const savedPreset = getPluginSettings().selectedPreset;

      presetListState.presets = allPresets;
      presetListState.currentPreset = currentPreset || 'Not selected';
      presetListState.selectedPreset = savedPreset || null;
      presetListState.totalPages = Math.max(1, Math.ceil(allPresets.length / presetListState.pageSize));
      presetListState.currentPage = 1;

      updatePresetDisplayText();
    } catch (error) {
      console.error('[Diary Plugin] Failed to load preset data:', error);
      presetListState.presets = [];
      presetListState.currentPreset = 'Load failed';
      presetListState.selectedPreset = null;
      presetListState.currentPage = 1;
      presetListState.totalPages = 1;
      updatePresetDisplayText();
      notify.error('Failed to load preset list', 'Preset Manager');
    }
  }

  function updatePresetDisplayText() {
    const displayText = presetListState.selectedPreset
      ? `Diary preset: ${presetListState.selectedPreset}`
      : 'No diary preset selected (using the current system preset)';
    $('#diary_selected_preset').text(displayText);
  }

  function renderPresetList() {
    const $grid = $('#diary-preset-grid');
    const $empty = $('#diary-preset-empty');
    const $systemPreset = $('#diary-preset-system-name');
    const $selectedPreset = $('#diary-preset-selected-name');

    $systemPreset.text(presetListState.currentPreset);
    $selectedPreset.text(presetListState.selectedPreset || 'Not set (using current system preset)');
    $grid.empty();

    if (presetListState.presets.length === 0) {
      $grid.hide();
      $empty.show();
      updatePresetPagination();
      return;
    }

    $empty.hide();
    $grid.show();

    const startIndex = (presetListState.currentPage - 1) * presetListState.pageSize;
    const endIndex = Math.min(startIndex + presetListState.pageSize, presetListState.presets.length);
    const currentPagePresets = presetListState.presets.slice(startIndex, endIndex);

    currentPagePresets.forEach((presetName, index) => {
      $grid.append(createPresetCard(presetName, startIndex + index));
    });

    updatePresetPagination();
  }

  function createPresetCard(presetName) {
    const isSystemCurrent = presetName === presetListState.currentPreset;
    const isSelected = presetName === presetListState.selectedPreset;
    const escapedPresetName = escapeHtml(presetName);
    const escapedPresetNameAttribute = escapeHtmlAttribute(presetName);

    let cardClasses = 'diary-preset-item';
    if (isSelected) {
      cardClasses += ' diary-preset-item-selected';
    } else if (isSystemCurrent) {
      cardClasses += ' diary-preset-item-current';
    }

    let badges = '';
    if (isSystemCurrent) {
      badges += '<span class="diary-preset-badge diary-preset-badge-current">Current</span>';
    }
    if (isSelected) {
      badges += '<span class="diary-preset-badge diary-preset-badge-selected">Selected</span>';
    }

    return `
      <div class="${cardClasses}" data-preset-name="${escapedPresetNameAttribute}">
        <div class="diary-preset-item-info">
          <div class="diary-preset-item-name">${escapedPresetName}</div>
        </div>
        ${badges}
      </div>
    `;
  }

  function updatePresetPagination() {
    $('#diary-preset-page-info').text(`Page ${presetListState.currentPage} / ${presetListState.totalPages}`);
    $('#diary-preset-prev-page').prop('disabled', presetListState.currentPage === 1);
    $('#diary-preset-next-page').prop('disabled', presetListState.currentPage === presetListState.totalPages);
  }

  async function selectPresetForDiary(presetName) {
    try {
      presetListState.selectedPreset = presetName;
      getPluginSettings().selectedPreset = presetName;
      saveSettingsDebounced();

      updatePresetDisplayText();
      renderPresetList();
      notify.success(`Selected preset: ${presetName}`, 'Preset Settings');
    } catch (error) {
      console.error('[Diary Plugin] Failed to save preset selection:', error);
      notify.error('Failed to save preset setting', 'Preset Manager');
    }
  }

  async function unselectPresetForDiary() {
    try {
      presetListState.selectedPreset = null;
      getPluginSettings().selectedPreset = null;
      saveSettingsDebounced();

      updatePresetDisplayText();
      renderPresetList();
      notify.info('Diary writing will use the current system preset', 'Preset Settings');
    } catch (error) {
      console.error('[Diary Plugin] Failed to reset preset selection:', error);
      notify.error('Failed to reset preset setting', 'Preset Manager');
    }
  }

  async function switchToDiaryPreset() {
    const result = {
      switched: false,
      originalPreset: null,
    };

    try {
      const diaryPresetName = getPluginSettings().selectedPreset;
      if (!diaryPresetName) {
        return result;
      }

      const presetManager = getPresetManager();
      if (!presetManager) {
        return result;
      }

      const currentPresetName = presetManager.getSelectedPresetName();
      if (currentPresetName === diaryPresetName) {
        return result;
      }

      const diaryPresetValue = presetManager.findPreset(diaryPresetName);
      if (!diaryPresetValue) {
        notify.warning(`Preset "${diaryPresetName}" does not exist. Using the current preset instead.`, 'Preset Switch');
        return result;
      }

      presetManager.selectPreset(diaryPresetValue);
      notify.success(`Switched to diary preset: ${diaryPresetName}`, 'Preset Switch', { timeOut: 2000 });

      result.switched = true;
      result.originalPreset = currentPresetName;
    } catch (error) {
      console.error('[Diary Plugin] Failed to switch to diary preset:', error);
      notify.error('Failed to switch preset; continuing with the current preset', 'Preset Switch');
    }

    return result;
  }

  async function restoreOriginalPreset(originalPresetName) {
    try {
      if (!originalPresetName) {
        return;
      }

      const presetManager = getPresetManager();
      if (!presetManager) {
        return;
      }

      const originalPresetValue = presetManager.findPreset(originalPresetName);
      if (!originalPresetValue) {
        return;
      }

      presetManager.selectPreset(originalPresetValue);
    } catch (error) {
      console.error('[Diary Plugin] Failed to restore original preset:', error);
      notify.warning('Failed to restore original preset', 'Preset Restore');
    }
  }

  function createPresetDialog() {
    const $dialog = $('#diary-preset-dialog');
    if ($dialog.length === 0) {
      return;
    }

    if (!presetDialogAttached) {
      if (!$dialog.parent().is('body')) {
        $dialog.appendTo('body');
      }
      presetDialogAttached = true;
    }

    bindPresetDialogEvents();
  }

  function bindPresetDialogEvents() {
    if (presetEventsBound) {
      return;
    }

    $(document)
      .off(`click${presetEventNamespace}`, '#diary-preset-close-btn')
      .on(`click${presetEventNamespace}`, '#diary-preset-close-btn', function () {
        hidePresetDialog();
      })
      .off(`click${presetEventNamespace}`, '#diary-preset-dialog')
      .on(`click${presetEventNamespace}`, '#diary-preset-dialog', function (event) {
        if (event.target === this) {
          hidePresetDialog();
        }
      })
      .off(`keydown${presetEventNamespace}`)
      .on(`keydown${presetEventNamespace}`, function (event) {
        if (event.keyCode === 27 && $('#diary-preset-dialog').is(':visible')) {
          hidePresetDialog();
        }
      })
      .off(`click${presetEventNamespace}`, '.diary-preset-item')
      .on(`click${presetEventNamespace}`, '.diary-preset-item', function () {
        const presetName = $(this).data('preset-name');
        const isSelected = presetName === presetListState.selectedPreset;

        if (isSelected) {
          void unselectPresetForDiary();
        } else {
          void selectPresetForDiary(presetName);
        }
      })
      .off(`click${presetEventNamespace}`, '#diary-preset-prev-page')
      .on(`click${presetEventNamespace}`, '#diary-preset-prev-page', function () {
        if (presetListState.currentPage > 1) {
          presetListState.currentPage -= 1;
          renderPresetList();
        }
      })
      .off(`click${presetEventNamespace}`, '#diary-preset-next-page')
      .on(`click${presetEventNamespace}`, '#diary-preset-next-page', function () {
        if (presetListState.currentPage < presetListState.totalPages) {
          presetListState.currentPage += 1;
          renderPresetList();
        }
      });

    presetEventsBound = true;
  }

  function bindReadmeDialogEvents() {
    if (readmeEventsBound) {
      return;
    }

    $(document)
      .off(`click${readmeEventNamespace}`, '#diary-readme-open-btn')
      .on(`click${readmeEventNamespace}`, '#diary-readme-open-btn', function () {
        void showReadmeDialog();
      })
      .off(`click${readmeEventNamespace}`, '#diary-readme-close-btn')
      .on(`click${readmeEventNamespace}`, '#diary-readme-close-btn', function () {
        hideReadmeDialog();
      })
      .off(`click${readmeEventNamespace}`, '#diary-readme-dialog')
      .on(`click${readmeEventNamespace}`, '#diary-readme-dialog', function (event) {
        if (event.target === this) {
          hideReadmeDialog();
        }
      })
      .off(`keydown${readmeEventNamespace}`)
      .on(`keydown${readmeEventNamespace}`, function (event) {
        if (event.keyCode === 27 && $('#diary-readme-dialog').is(':visible')) {
          hideReadmeDialog();
        }
      });

    readmeEventsBound = true;
  }

  function createReadmeDialog() {
    const $dialog = $('#diary-readme-dialog');
    if ($dialog.length === 0) {
      return;
    }

    if (!readmeDialogAttached) {
      if (!$dialog.parent().is('body')) {
        $dialog.appendTo('body');
      }
      readmeDialogAttached = true;
    }
  }

  return {
    showPresetDialog,
    hidePresetDialog,
    showReadmeDialog,
    hideReadmeDialog,
    loadReadmeContent,
    convertMarkdownToHTML,
    loadPresetData,
    updatePresetDisplayText,
    renderPresetList,
    createPresetCard,
    updatePresetPagination,
    selectPresetForDiary,
    unselectPresetForDiary,
    switchToDiaryPreset,
    restoreOriginalPreset,
    createPresetDialog,
    bindPresetDialogEvents,
    bindReadmeDialogEvents,
    createReadmeDialog,
  };
}
