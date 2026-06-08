export function createExchangeDeleteModeManager({
  exchangeDiaryStorage,
  showExchangeDiaryThreadList,
  showExchangeDiaryEntryList,
  notify,
}) {
  function setThreadDeleteMode(enabled) {
    $('#diary-exchange-thread-delete-mode-btn').toggleClass('active', enabled);
    $('#diary-exchange-thread-cancel-delete-btn').toggle(enabled);
    $('.diary-exchange-thread-checkbox-container').toggle(enabled);
    $('.diary-exchange-thread-rename-btn').toggle(!enabled);

    if (!enabled) {
      $('.diary-exchange-thread-checkbox').prop('checked', false);
    }
  }

  function setEntryDeleteMode(enabled) {
    $('#diary-exchange-entry-delete-mode-btn').toggleClass('active', enabled);
    $('#diary-exchange-entry-cancel-delete-btn').toggle(enabled);
    $('.diary-exchange-entry-checkbox-container').toggle(enabled);

    if (!enabled) {
      $('.diary-exchange-entry-checkbox').prop('checked', false);
    }
  }

  function getSelectedThreadIds() {
    const selectedThreadIds = [];
    $('.diary-exchange-thread-checkbox:checked').each(function () {
      selectedThreadIds.push($(this).data('thread-id'));
    });
    return selectedThreadIds;
  }

  function getSelectedEntryNumbers() {
    const selectedEntryNumbers = [];
    $('.diary-exchange-entry-checkbox:checked').each(function () {
      selectedEntryNumbers.push(Number($(this).data('entry-number')));
    });
    return selectedEntryNumbers;
  }

  function toggleThreadDeleteMode() {
    setThreadDeleteMode(!$('#diary-exchange-thread-delete-mode-btn').hasClass('active'));
  }

  function deleteSelectedThreads() {
    const selectedThreadIds = getSelectedThreadIds();

    if (selectedThreadIds.length === 0) {
      notify.warning('请先选择要删除的系列');
      return;
    }

    const confirmMessage = `确定要删除选中的 ${selectedThreadIds.length} 个系列吗？此操作不可恢复。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    let characterName = null;
    let successCount = 0;

    selectedThreadIds.forEach(threadId => {
      const thread = exchangeDiaryStorage.getThread(threadId);
      if (!thread) {
        return;
      }

      characterName = thread.characterName;
      if (exchangeDiaryStorage.deleteThread(threadId)) {
        successCount++;
      }
    });

    if (successCount === 0) {
      notify.error('删除失败');
      return;
    }

    notify.success(`成功删除 ${successCount} 个系列`);
    setThreadDeleteMode(false);

    if (characterName) {
      showExchangeDiaryThreadList(characterName);
    }
  }

  function toggleEntryDeleteMode() {
    setEntryDeleteMode(!$('#diary-exchange-entry-delete-mode-btn').hasClass('active'));
  }

  function deleteSelectedEntries() {
    const selectedEntryNumbers = getSelectedEntryNumbers();

    if (selectedEntryNumbers.length === 0) {
      notify.warning('请先选择要删除的条目');
      return;
    }

    const confirmMessage = `确定要删除选中的 ${selectedEntryNumbers.length} 个条目吗？此操作不可恢复。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const currentThreadId = $('#diary-exchange-entry-list-container').data('current-thread-id');
    if (!currentThreadId) {
      notify.error('无法获取当前系列信息');
      return;
    }

    const thread = exchangeDiaryStorage.getThread(currentThreadId);
    if (!thread) {
      notify.error('系列不存在');
      return;
    }

    const selectedEntrySet = new Set(selectedEntryNumbers);
    const originalCount = thread.entries.length;
    thread.entries = thread.entries.filter(entry => !selectedEntrySet.has(Number(entry.entryNumber)));

    const successCount = originalCount - thread.entries.length;
    if (successCount === 0) {
      notify.error('删除失败');
      return;
    }

    const data = exchangeDiaryStorage.loadAll();
    data.threads[currentThreadId] = {
      ...thread,
      updatedAt: new Date().toISOString(),
    };

    if (!exchangeDiaryStorage.saveAll(data)) {
      notify.error('删除失败');
      return;
    }

    notify.success(`成功删除 ${successCount} 个条目`);
    setEntryDeleteMode(false);
    showExchangeDiaryEntryList(currentThreadId);
  }

  return {
    toggleThreadDeleteMode,
    deleteSelectedThreads,
    toggleEntryDeleteMode,
    deleteSelectedEntries,
  };
}
