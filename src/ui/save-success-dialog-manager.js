export function createSaveSuccessDialogManager({ showDiaryBookDialog, showDiaryBookDetail }) {
  const eventNamespace = '.diarySaveSuccess';
  let eventsBound = false;
  let dialogAttached = false;

  function showSaveSuccessDialog(saveResult) {
    if (!saveResult || !saveResult.success) {
      console.error('[Save Success Dialog] Invalid save result.');
      return;
    }

    $('#diary-save-success-title-text').text(saveResult.title || 'Unknown Title');
    $('#diary-save-success-character-text').text(saveResult.characterName || 'Unknown Character');

    const $dialog = $('#diary-save-success-dialog');
    if ($dialog.length === 0) {
      console.error('[Save Success Dialog] Dialog element not found.');
      return;
    }

    try {
      $dialog.show();

      setTimeout(() => {
        if ($dialog.is(':visible')) {
          return;
        }

        $dialog[0].style.setProperty('display', 'flex', 'important');
        $dialog[0].style.setProperty('opacity', '1', 'important');
        $dialog[0].style.setProperty('visibility', 'visible', 'important');
      }, 100);
    } catch (error) {
      console.error('[Save Success Dialog] Failed to show dialog:', error);
    }

    $dialog.data('entryId', saveResult.diaryId);
    $dialog.data('characterName', saveResult.characterName);
  }

  function hideSaveSuccessDialog() {
    $('#diary-save-success-dialog').hide();
  }

  function viewSavedDiary(entryId, characterName) {
    try {
      hideSaveSuccessDialog();

      setTimeout(async () => {
        showDiaryBookDialog();

        setTimeout(async () => {
          try {
            await showDiaryBookDetail(characterName, entryId);
          } catch (detailError) {
            console.error('[Save Success Dialog] Failed to show saved diary detail:', detailError);
            toastr.error('无法显示日记详情，请手动查看', '查看日记');
          }
        }, 300);
      }, 300);
    } catch (error) {
      console.error('[Save Success Dialog] Failed to open saved diary:', error);
      toastr.error('打开日记本失败，请手动查看', '查看日记');
    }
  }

  function createSaveSuccessDialog() {
    if (dialogAttached) {
      return;
    }

    const $dialog = $('#diary-save-success-dialog');
    if ($dialog.length === 0) {
      console.warn('[Save Success Dialog] Dialog element not found.');
      return;
    }

    if (!$dialog.parent().is('body')) {
      $dialog.appendTo('body');
    }

    dialogAttached = true;
  }

  function bindSaveSuccessDialogEvents() {
    if (eventsBound) {
      return;
    }

    $('#diary-save-success-close-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        hideSaveSuccessDialog();
      });

    $('#diary-save-success-close-action-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        hideSaveSuccessDialog();
      });

    $('#diary-save-success-view-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();

        const $dialog = $('#diary-save-success-dialog');
        const entryId = $dialog.data('entryId');
        const characterName = $dialog.data('characterName');

        if (entryId && characterName) {
          viewSavedDiary(entryId, characterName);
          return;
        }

        console.error('[Save Success Dialog] Missing diary metadata for view action.');
        toastr.error('缺少日记信息，无法查看', '查看日记');
        hideSaveSuccessDialog();
      });

    $('#diary-save-success-dialog')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        if (e.target === this) {
          hideSaveSuccessDialog();
        }
      });

    eventsBound = true;
  }

  return {
    showSaveSuccessDialog,
    hideSaveSuccessDialog,
    viewSavedDiary,
    createSaveSuccessDialog,
    bindSaveSuccessDialogEvents,
  };
}
