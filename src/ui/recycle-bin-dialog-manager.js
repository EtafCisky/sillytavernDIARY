export function createRecycleBinDialogManager({
  getAllRecycleBinFiles,
  loadRecycleBinItem,
  restoreExchangeDiaryFromRecycleBin,
  saveRecycleBinAsDiary,
  deleteRecycleBinFile,
  clearRecycleBinFiles,
  notify,
  confirmAction = message => confirm(message),
}) {
  const recycleBinDialogEventNamespace = '.recycleBinDialog';
  const recycleBinListEventNamespace = '.recycleBinList';
  let recycleBinDialogAttached = false;
  let recycleBinEventsBound = false;
  let currentRecycleBinItem = null;

  function safeText(value) {
    return String(value ?? '');
  }

  function getRecycleBinItemMetadata(file) {
    const metadata = file?.metadata || {};

    return {
      failureReason: metadata.failureReason || metadata['失败原因'] || 'Unknown reason',
      saveTime: metadata.saveTime || metadata['保存时间'] || '',
      isExchangeDiary:
        metadata.type === 'exchange_diary' || metadata['类型'] === 'exchange_diary' || file?.type === 'exchange_diary',
    };
  }

  function showRecycleBinDialog() {
    $('#diary-recycle-bin-dialog').show();
    void refreshRecycleBin();
  }

  function hideRecycleBinDialog() {
    $('#diary-recycle-bin-dialog').hide();
    hideRecycleBinDetail();
  }

  async function refreshRecycleBin() {
    try {
      const groupedFiles = await getAllRecycleBinFiles();
      if (!groupedFiles || Object.keys(groupedFiles).length === 0) {
        showEmptyRecycleBin();
        return;
      }

      renderRecycleBinList(groupedFiles);
    } catch (error) {
      console.error('[Diary Plugin] Failed to refresh recycle bin:', error);
      $('#recycle-bin-list').html('<div class="recycle-bin-empty">Failed to load recycle bin</div>');
    }
  }

  function showEmptyRecycleBin() {
    $('#recycle-bin-list').html(`
      <div class="recycle-bin-empty">
        <div class="recycle-bin-empty-icon">Empty</div>
        <div>Recycle bin is empty</div>
        <div style="font-size: 12px; margin-top: 5px;">Failed AI output is stored here automatically.</div>
      </div>
    `);
  }

  function renderRecycleBinList(groupedFiles) {
    if (!groupedFiles || typeof groupedFiles !== 'object') {
      showEmptyRecycleBin();
      return;
    }

    const $list = $('#recycle-bin-list');
    $list.empty();

    for (const characterName in groupedFiles) {
      const characterFiles = Array.isArray(groupedFiles[characterName]) ? groupedFiles[characterName] : [];
      const $group = $('<div class="recycle-character-group"></div>');
      const $header = $('<div class="recycle-character-header"></div>').attr('data-character', characterName);

      $header.append($('<span class="recycle-character-toggle"></span>').text('>'));
      $header.append($('<span class="recycle-character-name"></span>').text(characterName));
      $header.append($('<span class="recycle-character-count"></span>').text(`(${characterFiles.length})`));

      const $items = $('<div class="recycle-character-items" style="display: none;"></div>');

      characterFiles.forEach(file => {
        const content = safeText(file?.content);
        const preview = content.replace(/\n/g, ' ').substring(0, 80) + (content.length > 80 ? '...' : '');
        const { failureReason, saveTime, isExchangeDiary } = getRecycleBinItemMetadata(file);
        const typeLabel = isExchangeDiary ? 'Exchange Diary' : 'Diary';
        const $item = $('<div class="recycle-bin-item"></div>').attr('data-filename', safeText(file?.filename));

        if (isExchangeDiary) {
          $item.addClass('exchange-diary-item');
        }

        const $headerRow = $('<div class="recycle-bin-item-header"></div>');
        $headerRow.append($('<span class="recycle-bin-item-name"></span>').text(`Entry ${safeText(file?.number)}`));
        $headerRow.append($('<small style="color: #999;"></small>').text(`${typeLabel} | ${safeText(failureReason)}`));

        $item.append($headerRow);
        $item.append($('<div class="recycle-bin-item-preview"></div>').text(preview));
        $item.append(
          $('<div class="recycle-bin-item-actions"></div>').append(
            $('<small style="color: #666;"></small>').text(`${content.length} chars | ${safeText(saveTime)}`),
          ),
        );
        $items.append($item);
      });

      $group.append($header);
      $group.append($items);
      $list.append($group);
    }
  }
  async function showRecycleBinItemDetail(filename) {
    try {
      const match = filename.match(/^(.+)_(\d+)$/);
      if (!match) {
        notify.error('Invalid recycle bin filename', 'Recycle Bin');
        return;
      }

      const characterName = match[1];
      const id = parseInt(match[2], 10);
      const item = await loadRecycleBinItem(characterName, id);

      if (!item) {
        notify.error('Unable to load recycle bin entry', 'Recycle Bin');
        return;
      }

      const isExchangeDiary = item.type === 'exchange_diary';
      currentRecycleBinItem = {
        filename,
        characterName,
        content: item.content,
        type: item.type || 'normal',
        metadata: {
          characterName,
          id: item.id,
          failureReason: item.failureReason,
          saveTime: item.saveTime,
          type: item.type || 'normal',
          ...(isExchangeDiary && {
            threadId: item.threadId,
            entryNumber: item.entryNumber,
            originalPrompt: item.originalPrompt,
          }),
        },
      };

      const typeLabel = isExchangeDiary ? 'Exchange Diary' : 'Diary';
      const failureReason = item.failureReason || 'Unknown reason';

      let titleText = `${typeLabel} - ${characterName} - Entry ${item.id} (${failureReason})`;
      if (isExchangeDiary && item.threadId && item.entryNumber) {
        titleText += ` | Thread ${item.threadId}, Entry ${item.entryNumber}`;
      }

      $('#recycle-bin-item-title').text(titleText);
      $('#recycle-bin-content').val(item.content);
      $('#recycle-bin-save-btn').text(isExchangeDiary ? 'Restore exchange diary' : 'Save as diary');
      $('#recycle-bin-list').hide();
      $('#recycle-bin-detail').show();
    } catch (error) {
      console.error('[Diary Plugin] Failed to show recycle bin detail:', error);
      notify.error('Failed to show recycle bin detail', 'Recycle Bin');
    }
  }

  function hideRecycleBinDetail() {
    $('#recycle-bin-detail').hide();
    $('#recycle-bin-list').show();
    currentRecycleBinItem = null;
  }

  async function saveRecycleBinItemAsDiary() {
    if (!currentRecycleBinItem) {
      return;
    }

    try {
      const editedContent = $('#recycle-bin-content').val().trim();
      if (!editedContent) {
        notify.error('Content cannot be empty', 'Recycle Bin');
        return;
      }

      if (currentRecycleBinItem.type === 'exchange_diary') {
        const restoreResult = await restoreExchangeDiaryFromRecycleBin(currentRecycleBinItem, editedContent);
        if (restoreResult.success) {
          notify.success('Exchange diary restored', 'Recycle Bin');
          hideRecycleBinDetail();
          await refreshRecycleBin();
        } else {
          notify.error(`Restore failed: ${restoreResult.error}`, 'Recycle Bin');
        }
        return;
      }

      const saveResult = await saveRecycleBinAsDiary(currentRecycleBinItem.filename, editedContent);
      if (saveResult.success) {
        notify.success(`Diary saved successfully, ID: ${saveResult.diaryId}`, 'Recycle Bin');
        hideRecycleBinDetail();
        await refreshRecycleBin();
      } else {
        notify.error(`Save failed: ${saveResult.error}`, 'Recycle Bin');
      }
    } catch (error) {
      console.error('[Diary Plugin] Failed to save recycle bin item:', error);
      notify.error(`Save failed: ${error.message}`, 'Recycle Bin');
    }
  }

  async function deleteRecycleBinItemUI(showConfirm = true) {
    if (!currentRecycleBinItem) {
      return;
    }

    if (showConfirm && !confirmAction('Delete this recycle bin entry?')) {
      return;
    }

    try {
      const result = await deleteRecycleBinFile(currentRecycleBinItem.filename);
      if (result.success) {
        notify.success('Recycle bin entry deleted', 'Recycle Bin');
        hideRecycleBinDetail();
        await refreshRecycleBin();
      } else {
        notify.error(`Delete failed: ${result.error}`, 'Recycle Bin');
      }
    } catch (error) {
      console.error('[Diary Plugin] Failed to delete recycle bin item:', error);
      notify.error('Failed to delete recycle bin entry', 'Recycle Bin');
    }
  }

  async function clearRecycleBin() {
    if (!confirmAction('Clear the entire recycle bin? This cannot be undone.')) {
      return;
    }

    try {
      const result = await clearRecycleBinFiles();
      if (result.success) {
        notify.success(`Recycle bin cleared (${result.deletedCount} files removed)`, 'Recycle Bin');
        hideRecycleBinDetail();
        await refreshRecycleBin();
      } else {
        notify.error(`Clear failed: ${result.error}`, 'Recycle Bin');
      }
    } catch (error) {
      console.error('[Diary Plugin] Failed to clear recycle bin:', error);
      notify.error('Failed to clear recycle bin', 'Recycle Bin');
    }
  }

  function bindRecycleBinDialogEvents() {
    if (recycleBinEventsBound) {
      return;
    }

    $('#diary-recycle-bin-dialog .diary-close-btn')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function () {
        hideRecycleBinDialog();
      });

    $('#diary-recycle-bin-dialog')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function (event) {
        if (event.target === this) {
          hideRecycleBinDialog();
        }
      });

    $(document)
      .off(`keydown${recycleBinDialogEventNamespace}`)
      .on(`keydown${recycleBinDialogEventNamespace}`, function (event) {
        if (event.keyCode === 27 && $('#diary-recycle-bin-dialog').is(':visible')) {
          hideRecycleBinDialog();
        }
      })
      .off(`click${recycleBinListEventNamespace}`, '.recycle-bin-item')
      .on(`click${recycleBinListEventNamespace}`, '.recycle-bin-item', function () {
        const filename = $(this).data('filename');
        void showRecycleBinItemDetail(filename);
      })
      .off(`click${recycleBinListEventNamespace}`, '.recycle-character-header')
      .on(`click${recycleBinListEventNamespace}`, '.recycle-character-header', function () {
        const $header = $(this);
        const $items = $header.next('.recycle-character-items');
        const $toggle = $header.find('.recycle-character-toggle');

        if ($items.is(':visible')) {
          $items.slideUp(200);
          $toggle.text('>');
        } else {
          $items.slideDown(200);
          $toggle.text('v');
        }
      });

    $('#clear-recycle-bin')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function () {
        void clearRecycleBin();
      });

    $('#recycle-bin-back-btn')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function () {
        hideRecycleBinDetail();
      });

    $('#recycle-bin-save-btn')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function () {
        void saveRecycleBinItemAsDiary();
      });

    $('#recycle-bin-delete-btn')
      .off(`click${recycleBinDialogEventNamespace}`)
      .on(`click${recycleBinDialogEventNamespace}`, function () {
        void deleteRecycleBinItemUI();
      });

    recycleBinEventsBound = true;
  }

  function createRecycleBinDialog() {
    const $dialog = $('#diary-recycle-bin-dialog');
    if ($dialog.length === 0) {
      return;
    }

    if (!recycleBinDialogAttached) {
      if (!$dialog.parent().is('body')) {
        $dialog.appendTo('body');
      }
      recycleBinDialogAttached = true;
    }

    bindRecycleBinDialogEvents();
  }

  return {
    showRecycleBinDialog,
    hideRecycleBinDialog,
    refreshRecycleBin,
    showEmptyRecycleBin,
    renderRecycleBinList,
    showRecycleBinItemDetail,
    hideRecycleBinDetail,
    saveRecycleBinItemAsDiary,
    deleteRecycleBinItemUI,
    clearRecycleBin,
    createRecycleBinDialog,
  };
}
