export function createCustomCharacterDialogManager({ getCurrentCharacterName, continueWriteDiary, notify }) {
  const eventNamespace = '.diaryCustomCharacter';
  let eventsBound = false;
  let dialogAttached = false;

  function showCustomCharacterDialog() {
    const currentCharacterName = getCurrentCharacterName();

    $('#diary-custom-character-dialog').show();
    $('#diary-character-input').attr('placeholder', currentCharacterName);
    $('#diary-character-input').val('');
    $('#diary-character-input').focus();
  }

  function hideCustomCharacterDialog() {
    $('#diary-custom-character-dialog').hide();
  }

  function createCustomCharacterDialog() {
    if (dialogAttached) {
      return;
    }

    const $dialog = $('#diary-custom-character-dialog');
    if ($dialog.length === 0) {
      console.warn('[Custom Character Dialog] Dialog element not found.');
      return;
    }

    if (!$dialog.parent().is('body')) {
      $dialog.appendTo('body');
    }

    dialogAttached = true;
  }

  function cancelWritingDiary() {
    hideCustomCharacterDialog();
    notify.info('Diary writing cancelled.', 'Diary');
  }

  function bindCustomCharacterDialogEvents() {
    if (eventsBound) {
      return;
    }

    $(document)
      .off(`click${eventNamespace}`, '#diary-character-send-btn')
      .on(`click${eventNamespace}`, '#diary-character-send-btn', async function (e) {
        e.preventDefault();
        await continueWriteDiary();
      });

    $(document)
      .off(`click${eventNamespace}`, '#diary-character-cancel-btn')
      .on(`click${eventNamespace}`, '#diary-character-cancel-btn', function (e) {
        e.preventDefault();
        cancelWritingDiary();
      });

    $(document)
      .off(`click${eventNamespace}`, '#diary-character-close-btn')
      .on(`click${eventNamespace}`, '#diary-character-close-btn', function (e) {
        e.preventDefault();
        cancelWritingDiary();
      });

    $(document)
      .off(`click${eventNamespace}`, '#diary-custom-character-dialog')
      .on(`click${eventNamespace}`, '#diary-custom-character-dialog', function (e) {
        if (e.target === this) {
          cancelWritingDiary();
        }
      });

    $(document)
      .off(`keypress${eventNamespace}`, '#diary-character-input')
      .on(`keypress${eventNamespace}`, '#diary-character-input', async function (e) {
        if (e.which === 13) {
          e.preventDefault();
          await continueWriteDiary();
        }
      });

    $(document)
      .off(`keydown${eventNamespace}`)
      .on(`keydown${eventNamespace}`, function (e) {
        if (e.key === 'Escape' && $('#diary-custom-character-dialog').is(':visible')) {
          cancelWritingDiary();
        }
      });

    eventsBound = true;
  }

  return {
    showCustomCharacterDialog,
    hideCustomCharacterDialog,
    createCustomCharacterDialog,
    bindCustomCharacterDialogEvents,
  };
}
