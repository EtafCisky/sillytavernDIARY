import { escapeHtmlText } from '../utils/display.js';

export function createRerollUiManager({
  exchangeDiaryStorage,
  rerollManager,
  renderMobileView,
  renderDesktopView,
  notify,
}) {
  let currentRerollThreadId = null;
  let currentRerollEntryNumber = null;

  function escapeHtml(text) {
    return escapeHtmlText(text);
  }

  function getCurrentRerollTarget() {
    if (!currentRerollThreadId || !currentRerollEntryNumber) {
      console.error('[Reroll] Missing current thread or entry');
      return null;
    }

    return {
      threadId: currentRerollThreadId,
      entryNumber: Number(currentRerollEntryNumber),
    };
  }

  function getReadViewTarget() {
    const $readView = $('#diary-exchange-read-view');
    const threadId = $readView.data('current-thread-id');
    const entryNumber = $readView.data('current-entry-number');

    if (!threadId || !entryNumber) {
      console.error('[Reroll] Missing current thread or entry from read view');
      return null;
    }

    return {
      threadId,
      entryNumber: Number(entryNumber),
    };
  }

  function getReplyCount(entry) {
    return Array.isArray(entry.characterReplies) ? entry.characterReplies.length : 0;
  }

  function getSelectedReplyIndex(entry) {
    const replies = Array.isArray(entry?.characterReplies) ? entry.characterReplies : [];
    const selectedIndex = Number(entry?.selectedReplyIndex);

    if (Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < replies.length) {
      return selectedIndex;
    }

    return 0;
  }

  function getMaxRerolls() {
    const config = exchangeDiaryStorage.getConfig();
    return config.maxRerollsPerEntry || 5;
  }

  function updateGenerateButton(entry) {
    const maxRerolls = getMaxRerolls();
    const currentReplyCount = getReplyCount(entry);
    const $generateBtn = $('#diary-exchange-reroll-generate-btn');

    if (currentReplyCount >= maxRerolls) {
      $generateBtn.prop('disabled', true).text(`已达到最大版本数 (${maxRerolls})`);
      return;
    }

    $generateBtn.prop('disabled', false).text(`生成新版本 (${currentReplyCount}/${maxRerolls})`);
  }

  function renderReplyVersion(reply, index, selectedIndex) {
    const isCurrent = index === selectedIndex;

    return $(`
      <div class="diary-exchange-reroll-version ${isCurrent ? 'selected' : ''}" data-index="${index}">
        <div class="diary-exchange-reroll-version-header">
          <span class="diary-exchange-reroll-version-label">版本 ${index + 1}</span>
          ${isCurrent ? '<span class="diary-exchange-reroll-version-badge">当前</span>' : ''}
        </div>
        <div class="diary-exchange-reroll-version-title">${escapeHtml(reply.title || '无标题')}</div>
        <div class="diary-exchange-reroll-version-preview">${escapeHtml(reply.content || '无内容')}</div>
      </div>
    `);
  }

  function refreshCurrentReadView() {
    const target = getCurrentRerollTarget();
    if (!target) {
      return false;
    }

    const thread = exchangeDiaryStorage.getThread(target.threadId);
    if (!thread) {
      console.error(`[Reroll] Thread not found: ${target.threadId}`);
      return false;
    }

    const entryIndex = thread.entries.findIndex(entry => Number(entry.entryNumber) === Number(target.entryNumber));
    if (entryIndex === -1) {
      console.error(`[Reroll] Entry not found: ${target.threadId}, entry ${target.entryNumber}`);
      return false;
    }

    if (window.innerWidth <= 768) {
      renderMobileView(thread, entryIndex * 2 + 2, thread.entries.length * 2);
    } else {
      renderDesktopView(thread, entryIndex + 1, thread.entries.length);
    }

    return true;
  }

  function showRerollSelector() {
    const target = getReadViewTarget();
    if (!target) {
      return;
    }

    const entry = exchangeDiaryStorage.getEntry(target.threadId, target.entryNumber);
    if (!entry) {
      console.error(`[Reroll] Entry not found: ${target.threadId}, entry ${target.entryNumber}`);
      return;
    }

    currentRerollThreadId = target.threadId;
    currentRerollEntryNumber = target.entryNumber;

    renderRerollVersions(entry);
    $('#diary-exchange-reroll-selector').fadeIn(200);
  }

  function hideRerollSelector() {
    $('#diary-exchange-reroll-selector').fadeOut(200);
    currentRerollThreadId = null;
    currentRerollEntryNumber = null;
  }

  function renderRerollVersions(entry) {
    const $versionsContainer = $('#diary-exchange-reroll-versions');
    const replies = entry.characterReplies || [];
    const selectedIndex = getSelectedReplyIndex(entry);

    $versionsContainer.empty();

    if (replies.length === 0) {
      $versionsContainer.html(`
        <div class="diary-exchange-empty-versions">
          <div class="diary-exchange-empty-icon">...</div>
          <div class="diary-exchange-empty-text">还没有回复版本，点击下方按钮生成第一个版本</div>
        </div>
      `);
    } else {
      replies.forEach((reply, index) => {
        $versionsContainer.append(renderReplyVersion(reply, index, selectedIndex));
      });
    }

    updateGenerateButton(entry);
  }

  async function generateNewRerollVersion() {
    const target = getCurrentRerollTarget();
    if (!target) {
      return;
    }

    const $generateBtn = $('#diary-exchange-reroll-generate-btn');
    $generateBtn.prop('disabled', true).text('生成中...');

    try {
      const result = await rerollManager.generateReroll(target.threadId, target.entryNumber);
      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }

      const saved = rerollManager.saveRerollVersion(target.threadId, target.entryNumber, result.reply);
      if (!saved) {
        throw new Error('保存版本失败');
      }

      const entry = exchangeDiaryStorage.getEntry(target.threadId, target.entryNumber);
      renderRerollVersions(entry);

      if (getReplyCount(entry) === 1) {
        exchangeDiaryStorage.selectReply(target.threadId, target.entryNumber, 0);
        exchangeDiaryStorage.updateEntry(target.threadId, target.entryNumber, {
          status: 'completed',
          canUseReroll: true,
        });

        refreshCurrentReadView();
        hideRerollSelector();
      }

      notify.success('新版本生成成功！', '成功');
    } catch (error) {
      console.error('[Reroll] Failed to generate new version:', error);
      notify.error(error.message || '生成失败', '错误');

      const entry = exchangeDiaryStorage.getEntry(target.threadId, target.entryNumber);
      if (entry) {
        updateGenerateButton(entry);
      }
    }
  }

  function confirmRerollSelection() {
    const target = getCurrentRerollTarget();
    if (!target) {
      return;
    }

    const entry = exchangeDiaryStorage.getEntry(target.threadId, target.entryNumber);
    if (!entry || getReplyCount(entry) === 0) {
      notify.info('请先点击"生成新版本"按钮生成第一个回复', '提示');
      return;
    }

    const $selected = $('.diary-exchange-reroll-version.selected');
    if ($selected.length === 0) {
      notify.warning('请选择一个版本', '提示');
      return;
    }

    const selectedIndex = Number($selected.data('index'));
    const success = rerollManager.selectReply(target.threadId, target.entryNumber, selectedIndex);

    if (!success) {
      notify.error('选择版本失败', '错误');
      return;
    }

    notify.success(`已选择版本 ${selectedIndex + 1}`, '成功');
    refreshCurrentReadView();
    hideRerollSelector();
  }

  return {
    showRerollSelector,
    hideRerollSelector,
    renderRerollVersions,
    generateNewRerollVersion,
    confirmRerollSelection,
    escapeHtml,
  };
}
