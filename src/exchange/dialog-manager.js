export function createExchangeDialogManager({
  exchangeDiaryStorage,
  initializeWriteDiaryForm,
  initializeViewDiaryPage,
  showExchangeDiaryThreadList,
  showExchangeDiaryEntryList,
  renderExchangeDiaryEntryList,
  toggleThreadDeleteMode,
  deleteSelectedThreads,
  toggleEntryDeleteMode,
  deleteSelectedEntries,
  showRerollSelector,
  hideRerollSelector,
  confirmRerollSelection,
  generateNewRerollVersion,
}) {
  const eventNamespace = '.diaryExchangeDialog';
  let eventsBound = false;
  let dialogAttached = false;

  function bindDocumentClick(selector, handler) {
    $(document).off(`click${eventNamespace}`, selector).on(`click${eventNamespace}`, selector, handler);
  }

  function getEntryListState() {
    const $container = $('#diary-exchange-entry-list-container');

    return {
      threadId: $container.data('current-thread-id'),
      currentPage: $container.data('current-page') || 1,
      totalPages: $container.data('total-pages') || 1,
    };
  }

  function getThreadById(threadId) {
    if (!threadId) {
      return null;
    }

    return exchangeDiaryStorage.getThread(threadId);
  }

  function bindCloseEvents() {
    bindDocumentClick('#diary-exchange-close-btn', function (e) {
      e.preventDefault();
      hideExchangeDiaryDialog();
    });

    bindDocumentClick('#diary-exchange-dialog', function (e) {
      if (e.target === this) {
        hideExchangeDiaryDialog();
      }
    });

    $(document)
      .off(`keydown${eventNamespace}`)
      .on(`keydown${eventNamespace}`, function (e) {
        if (e.key === 'Escape' && $('#diary-exchange-dialog').is(':visible')) {
          hideExchangeDiaryDialog();
        }
      });
  }

  function bindViewSwitchEvents() {
    bindDocumentClick('#diary-exchange-write-switch-btn', function (e) {
      e.preventDefault();
      switchExchangeDiaryView('write');
    });

    bindDocumentClick('#diary-exchange-open-btn', function (e) {
      e.preventDefault();
      switchExchangeDiaryView('character-list');
    });

    bindDocumentClick('#diary-exchange-back-to-cover-btn', function (e) {
      e.preventDefault();
      switchExchangeDiaryView('cover');
    });

    bindDocumentClick('#diary-exchange-back-to-cover-from-list', function (e) {
      e.preventDefault();
      switchExchangeDiaryView('cover');
    });

    bindDocumentClick('#diary-exchange-back-to-character-list', function (e) {
      e.preventDefault();
      switchExchangeDiaryView('character-list');
    });
  }

  function bindBackNavigationEvents() {
    bindDocumentClick('#diary-exchange-back-to-thread-list-from-entry', function (e) {
      e.preventDefault();

      const thread = getThreadById(getEntryListState().threadId);
      if (thread) {
        showExchangeDiaryThreadList(thread.characterName);
      }
    });

    bindDocumentClick('#diary-exchange-back-to-entry-list', function (e) {
      e.preventDefault();

      const currentThreadId = $('#diary-exchange-read-view').data('current-thread-id');
      if (currentThreadId) {
        showExchangeDiaryEntryList(currentThreadId);
      }
    });
  }

  function bindDeleteModeEvents() {
    bindDocumentClick('#diary-exchange-thread-delete-mode-btn', function (e) {
      e.preventDefault();

      if ($(this).hasClass('active')) {
        deleteSelectedThreads();
      } else {
        toggleThreadDeleteMode();
      }
    });

    bindDocumentClick('#diary-exchange-thread-cancel-delete-btn', function (e) {
      e.preventDefault();
      toggleThreadDeleteMode();
    });

    bindDocumentClick('#diary-exchange-entry-delete-mode-btn', function (e) {
      e.preventDefault();

      if ($(this).hasClass('active')) {
        deleteSelectedEntries();
      } else {
        toggleEntryDeleteMode();
      }
    });

    bindDocumentClick('#diary-exchange-entry-cancel-delete-btn', function (e) {
      e.preventDefault();
      toggleEntryDeleteMode();
    });

    bindDocumentClick('#diary-exchange-entry-cancel-delete', function (e) {
      e.preventDefault();
      toggleEntryDeleteMode();
    });
  }

  function bindEntryPaginationEvents() {
    bindDocumentClick('#diary-exchange-entry-prev-page', function (e) {
      e.preventDefault();

      const { threadId, currentPage } = getEntryListState();
      if (!threadId || currentPage <= 1) {
        return;
      }

      const thread = getThreadById(threadId);
      if (thread) {
        renderExchangeDiaryEntryList(thread, currentPage - 1);
      }
    });

    bindDocumentClick('#diary-exchange-entry-next-page', function (e) {
      e.preventDefault();

      const { threadId, currentPage, totalPages } = getEntryListState();
      if (!threadId || currentPage >= totalPages) {
        return;
      }

      const thread = getThreadById(threadId);
      if (thread) {
        renderExchangeDiaryEntryList(thread, currentPage + 1);
      }
    });

    bindDocumentClick('#diary-exchange-prev-btn', function (e) {
      e.preventDefault();
    });

    bindDocumentClick('#diary-exchange-next-btn', function (e) {
      e.preventDefault();
    });
  }

  function bindRerollEvents() {
    bindDocumentClick('#diary-exchange-reroll-btn', function (e) {
      e.preventDefault();
      showRerollSelector();
    });

    bindDocumentClick('.diary-exchange-reroll-close', function (e) {
      e.preventDefault();
      hideRerollSelector();
    });

    bindDocumentClick('#diary-exchange-reroll-cancel-btn', function (e) {
      e.preventDefault();
      hideRerollSelector();
    });

    bindDocumentClick('#diary-exchange-reroll-confirm-btn', function (e) {
      e.preventDefault();
      confirmRerollSelection();
    });

    bindDocumentClick('#diary-exchange-reroll-generate-btn', async function (e) {
      e.preventDefault();
      await generateNewRerollVersion();
    });

    bindDocumentClick('.diary-exchange-reroll-version', function (e) {
      e.preventDefault();
      $('.diary-exchange-reroll-version').removeClass('selected');
      $(this).addClass('selected');
    });

    bindDocumentClick('.diary-exchange-reroll-overlay', function (e) {
      e.preventDefault();
      hideRerollSelector();
    });
  }

  function createExchangeDiaryDialog() {
    if (dialogAttached) {
      return;
    }

    const $dialog = $('#diary-exchange-dialog');
    if ($dialog.length === 0) {
      console.warn('[Exchange Diary Dialog] Dialog element not found.');
      return;
    }

    if (!$dialog.parent().is('body')) {
      $dialog.appendTo('body');
    }

    dialogAttached = true;
  }

  function bindExchangeDiaryDialogEvents() {
    if (eventsBound) {
      return;
    }

    bindCloseEvents();
    bindViewSwitchEvents();
    bindBackNavigationEvents();
    bindDeleteModeEvents();
    bindEntryPaginationEvents();
    bindRerollEvents();

    eventsBound = true;
  }

  function showExchangeDiaryDialog() {
    $('#diary-exchange-dialog').css('display', 'flex');
    switchExchangeDiaryView('cover');
  }

  function resetExchangeDiaryTransientState() {
    hideRerollSelector();

    $('#diary-exchange-thread-delete-mode-btn').removeClass('active');
    $('#diary-exchange-thread-cancel-delete-btn').hide();
    $('.diary-exchange-thread-checkbox-container').hide();
    $('.diary-exchange-thread-checkbox').prop('checked', false);
    $('.diary-exchange-thread-rename-btn').show();

    $('#diary-exchange-entry-delete-mode-btn').removeClass('active');
    $('#diary-exchange-entry-cancel-delete-btn').hide();
    $('.diary-exchange-entry-checkbox-container').hide();
    $('.diary-exchange-entry-checkbox').prop('checked', false);
  }

  function hideExchangeDiaryDialog() {
    resetExchangeDiaryTransientState();
    $('#diary-exchange-dialog').css('display', 'none');
  }

  function switchExchangeDiaryView(viewName) {
    $('.diary-exchange-view').removeClass('active');
    $(`#diary-exchange-${viewName}-view`).addClass('active');

    if (viewName === 'write') {
      initializeWriteDiaryForm();
    } else if (viewName === 'character-list') {
      initializeViewDiaryPage();
    }
  }

  return {
    createExchangeDiaryDialog,
    bindExchangeDiaryDialogEvents,
    showExchangeDiaryDialog,
    hideExchangeDiaryDialog,
    switchExchangeDiaryView,
  };
}
