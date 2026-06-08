import { escapeHtmlText, formatRelativeDate } from '../utils/display.js';

import {
  buildCharacterSummaries,
  createCharacterCardHtml,
  createEntryNode,
  createThreadCardHtml,
  getBookPageForEntry,
  getBookTotalPages,
  getEntryListPage,
  getSelectedCharacterReply,
  normalizePageNumber,
} from './view-render-helpers.js';

export function createExchangeViewManager({
  exchangeDiaryStorage,
  switchExchangeDiaryView,
  getCurrentFloor,
  notify,
}) {
  const READ_VIEW_EVENT_NAMESPACE = '.exchangeDiaryView';
  const LIST_VIEW_EVENT_NAMESPACE = '.exchangeDiaryListView';

  function escapeHtml(text) {
    return escapeHtmlText(text);
  }

  function getEntryTriggerTargetFloor(entry) {
    return entry.userDiary?.triggerWindow?.targetFloor ?? entry.userDiary?.triggerWindow?.end;
  }

  function ensureEntryCanUseReroll(threadId, entry) {
    if (entry.canUseReroll) {
      return true;
    }

    const targetFloor = getEntryTriggerTargetFloor(entry);
    if (targetFloor === undefined) {
      return false;
    }

    const currentFloor = getCurrentFloor();
    if (currentFloor < targetFloor) {
      return false;
    }

    exchangeDiaryStorage.updateEntry(threadId, entry.entryNumber, {
      canUseReroll: true,
    });

    console.log(`[Exchange Diary] Entry ${entry.entryNumber} reroll unlocked permanently`);
    return true;
  }

  function updateReadViewPager(thread, currentPage, totalPages) {
    const $pageInput = $('#diary-exchange-page-input');
    $pageInput.val(currentPage);
    $pageInput.attr('max', totalPages);
    $('#diary-exchange-total-pages').text(totalPages);

    $pageInput
      .off(`change${READ_VIEW_EVENT_NAMESPACE} keypress${READ_VIEW_EVENT_NAMESPACE}`)
      .on(`change${READ_VIEW_EVENT_NAMESPACE}`, function () {
        let targetPage = parseInt($(this).val());
        if (isNaN(targetPage) || targetPage < 1) {
          targetPage = 1;
        }
        if (targetPage > totalPages) {
          targetPage = totalPages;
        }
        if (targetPage !== currentPage) {
          renderExchangeDiaryBookView(thread, targetPage);
        }
      })
      .on(`keypress${READ_VIEW_EVENT_NAMESPACE}`, function (e) {
        if (e.which === 13) {
          $(this).trigger('change');
        }
      });
  }

  function bindReadViewNavigation(thread, currentPage, totalPages) {
    $('#diary-exchange-back-to-thread-list')
      .off(`click${READ_VIEW_EVENT_NAMESPACE}`)
      .on(`click${READ_VIEW_EVENT_NAMESPACE}`, function () {
        console.log('返回线程列表');
        showExchangeDiaryThreadList(thread.characterName);
      });

    const $prevBtn = $('#diary-exchange-prev-btn');
    const $nextBtn = $('#diary-exchange-next-btn');

    $prevBtn.prop('disabled', currentPage <= 1).css('opacity', currentPage <= 1 ? '0.3' : '1');
    $nextBtn.prop('disabled', currentPage >= totalPages).css('opacity', currentPage >= totalPages ? '0.3' : '1');

    $prevBtn.off(`click${READ_VIEW_EVENT_NAMESPACE}`).on(`click${READ_VIEW_EVENT_NAMESPACE}`, function () {
      if (currentPage > 1) {
        renderExchangeDiaryBookView(thread, currentPage - 1);
      }
    });

    $nextBtn.off(`click${READ_VIEW_EVENT_NAMESPACE}`).on(`click${READ_VIEW_EVENT_NAMESPACE}`, function () {
      if (currentPage < totalPages) {
        renderExchangeDiaryBookView(thread, currentPage + 1);
      }
    });
  }

  function updateCharacterReplyPanel(thread, entry) {
    const $characterContent = $('#diary-exchange-character-content');
    const $rerollBtn = $('#diary-exchange-reroll-btn');
    const canUseReroll = ensureEntryCanUseReroll(thread.threadId, entry);

    const characterReply = getSelectedCharacterReply(entry);
    if (characterReply) {

      $('#diary-exchange-character-title').text(characterReply.title || `${thread.characterName} 的回复`);
      $('#diary-exchange-character-time').text(characterReply.time || formatDate(new Date(characterReply.triggeredAt)));
      $characterContent.html(escapeHtml(characterReply.content).replace(/\n/g, '<br>'));
    } else {
      $('#diary-exchange-character-title').text('等待回复');
      $('#diary-exchange-character-time').text('');
      $characterContent.html(`
        <div class="diary-exchange-empty-page">
          <div class="diary-exchange-empty-icon">💌</div>
          <div class="diary-exchange-empty-text">等待角色回复...</div>
        </div>
      `);
    }

    if (canUseReroll) {
      $rerollBtn.show();
    } else {
      $rerollBtn.hide();
    }
  }

  function setReadViewEntryContext(thread, entry) {
    $('#diary-exchange-read-view').data('current-thread-id', thread.threadId);
    $('#diary-exchange-read-view').data('current-entry-number', entry.entryNumber);
  }

  function renderUserDiaryPage(entry) {
    const userDiary = entry.userDiary || {};

    $('#diary-exchange-user-title').text('我的日记');
    $('#diary-exchange-user-time').text(userDiary.time || formatDate(new Date(userDiary.writtenAt)));
    $('#diary-exchange-user-content').html(escapeHtml(userDiary.content || '').replace(/\n/g, '<br>'));
  }

  function bindListViewEvents() {
    $(document)
      .off(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-character-card')
      .on(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-character-card', function () {
        const characterName = $(this).data('character');
        console.log(`点击角色: ${characterName}`);
        showExchangeDiaryThreadList(characterName);
      });

    $(document)
      .off(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-thread-card')
      .on(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-thread-card', function (e) {
        if (
          $(e.target).closest('.diary-exchange-thread-rename-btn').length > 0 ||
          $(e.target).closest('.diary-exchange-thread-checkbox-container').length > 0
        ) {
          return;
        }

        if ($('#diary-exchange-thread-delete-mode-btn').hasClass('active')) {
          return;
        }

        const threadId = $(this).data('thread-id');
        console.log(`选择系列: ${threadId}`);
        showExchangeDiaryEntryList(threadId);
      });

    $(document)
      .off(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-thread-rename-btn')
      .on(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-thread-rename-btn', function (e) {
        e.stopPropagation();
        const threadId = $(this).data('thread-id');
        const threadData = exchangeDiaryStorage.getThread(threadId);
        console.log(`重命名系列: ${threadId}`);
        if (threadData) {
          showThreadRenameDialog(threadId, threadData.threadName);
        }
      });

    $(document)
      .off(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-entry-card')
      .on(`click${LIST_VIEW_EVENT_NAMESPACE}`, '.diary-exchange-entry-card', function (e) {
        if ($(e.target).closest('.diary-exchange-entry-checkbox-container').length > 0) {
          return;
        }

        if ($('#diary-exchange-entry-delete-mode-btn').hasClass('active')) {
          return;
        }

        const clickedThreadId = $(this).data('thread-id');
        const clickedEntryNumber = $(this).data('entry-number');
        console.log(`打开条目: ${clickedThreadId}, 条目${clickedEntryNumber}`);
        showExchangeDiaryEntryDetail(clickedThreadId, clickedEntryNumber);
      });
  }
// ===== 查看日记页面功能 =====

/**
 * 初始化查看日记页面
 */
function initializeViewDiaryPage() {
  console.log('[Exchange Diary View] Initializing view diary page...');

  bindListViewEvents();

  // 加载角色列表
  loadExchangeDiaryCharacterList();

  console.log('[Exchange Diary View] View diary page initialized');
}

/**
 * 加载交换日记角色列表
 */
function loadExchangeDiaryCharacterList() {
  console.log('[Exchange Diary View] Loading character list...');

  const data = exchangeDiaryStorage.loadAll();
  const characters = buildCharacterSummaries(data.threads);

  console.log(`找到 ${characters.length} 个角色`);

  // 渲染角色列表
  renderExchangeDiaryCharacterList(characters);
}

/**
 * 渲染交换日记角色列表
 * @param {Array} characters - 角色数据数组
 */
function renderExchangeDiaryCharacterList(characters) {
  console.log('[Exchange Diary View] Rendering character list...');

  const $listContainer = $('#diary-exchange-character-list');
  const $emptyState = $('#diary-exchange-character-empty');

  // 清空现有内容
  $listContainer.empty();

  if (characters.length === 0) {
    // 显示空状态
    $listContainer.hide();
    $emptyState.show();
    console.log('[Exchange Diary View] Showing empty character state');
    return;
  }

  // 隐藏空状态
  $emptyState.hide();
  $listContainer.show();

  characters.forEach(character => {
    $listContainer.append($(createCharacterCardHtml(character)));
  });

  console.log(`[Exchange Diary View] Rendered ${characters.length} characters`);
}

/**
 * 显示交换日记线程列表
 * @param {string} characterName - 角色名
 */
function showExchangeDiaryThreadList(characterName) {
  console.log(`[Exchange Diary View] Showing thread list: ${characterName}`);

  // 获取该角色的所有线程
  const threads = exchangeDiaryStorage.getAllThreads(characterName);

  console.log(`找到 ${threads.length} 个系列`);

  // 切换到线程列表视图
  switchExchangeDiaryView('thread-list');

  // 渲染线程列表
  renderExchangeDiaryThreadList(characterName, threads);
}

/**
 * 渲染交换日记线程列表
 * @param {string} characterName - 角色名
 * @param {Array} threads - 线程数据数组
 */
function renderExchangeDiaryThreadList(characterName, threads) {
  console.log('[Exchange Diary View] Rendering thread list...');

  // 更新标题
  $('#diary-exchange-thread-character-name').text(`${characterName} 的交换日记`);
  $('.diary-exchange-thread-subtitle').text(`共 ${threads.length} 个系列`);

  const $listContainer = $('#diary-exchange-thread-list');
  const $emptyState = $('#diary-exchange-thread-empty');

  // 清空现有内容
  $listContainer.empty();

  if (threads.length === 0) {
    // 显示空状态
    $listContainer.hide();
    $emptyState.show();
    console.log('[Exchange Diary View] Showing empty thread state');
    return;
  }

  // 隐藏空状态
  $emptyState.hide();
  $listContainer.show();

  threads.forEach(thread => {
    $listContainer.append($(createThreadCardHtml(thread)));
  });

  console.log(`[Exchange Diary View] Rendered ${threads.length} threads`);
}

/**
 * 显示系列重命名对话框
 * @param {string} threadId - 线程ID
 * @param {string} currentName - 当前系列名称
 */
function showThreadRenameDialog(threadId, currentName) {
  console.log(`显示重命名对话框: ${threadId}, 当前名称: ${currentName}`);

  // 使用浏览器原生prompt对话框
  const newName = prompt('请输入新的系列名称:', currentName);

  if (newName === null) {
    // 用户取消
    console.log('用户取消重命名');
    return;
  }

  if (newName.trim() === '') {
    notify.warning('系列名称不能为空');
    return;
  }

  if (newName === currentName) {
    console.log('名称未改变');
    return;
  }

  // 更新线程名称
  const success = exchangeDiaryStorage.updateThread(threadId, {
    threadName: newName.trim(),
  });

  if (success) {
    notify.success(`系列已重命名为: ${newName.trim()}`);
    console.log(`[Exchange Diary View] Thread renamed: ${threadId} -> ${newName.trim()}`);

    // 重新渲染线程列表
    const thread = exchangeDiaryStorage.getThread(threadId);
    if (thread) {
      showExchangeDiaryThreadList(thread.characterName);
    }
  } else {
    notify.error('重命名失败，请重试');
    console.error(`[Exchange Diary View] Failed to rename thread: ${threadId}`);
  }
}

/**
 * 显示交换日记条目列表（日记目录）
 * @param {string} threadId - 线程ID
 */
function showExchangeDiaryEntryList(threadId) {
  console.log(`[Exchange Diary View] Showing entry list: ${threadId}`);

  // 获取线程数据
  const thread = exchangeDiaryStorage.getThread(threadId);
  if (!thread) {
    notify.error('系列不存在');
    return;
  }

  // 切换到条目列表视图
  switchExchangeDiaryView('entry-list');

  // 渲染条目列表
  renderExchangeDiaryEntryList(thread);
}

/**
 * 渲染交换日记条目列表
 * @param {Object} thread - 线程对象
 * @param {number} page - 当前页码（默认为1）
 */
function renderExchangeDiaryEntryList(thread, page = 1) {
  console.log(`[Exchange Diary View] Rendering entry list, page: ${page}`);

  const { totalEntries, totalPages, currentPage, pageEntries } = getEntryListPage(thread, page);

  // 更新标题
  $('#diary-exchange-entry-list-title').text(thread.threadName);
  $('#diary-exchange-entry-list-subtitle').text(`共 ${totalEntries} 个条目`);

  const $listContainer = $('#diary-exchange-entry-list-container');
  const $emptyState = $('#diary-exchange-entry-list-empty');
  const $pagination = $('#diary-exchange-entry-pagination');

  // 保存当前线程ID和分页信息
  $listContainer.data('current-thread-id', thread.threadId);
  $listContainer.data('current-page', currentPage);
  $listContainer.data('total-pages', totalPages);

  // 清空现有内容
  $listContainer.empty();

  if (totalEntries === 0) {
    // 显示空状态
    $listContainer.hide();
    $emptyState.show();
    $pagination.hide();
    console.log('[Exchange Diary View] Showing empty entry state');
    return;
  }

  // 隐藏空状态
  $emptyState.hide();
  $listContainer.show();

  pageEntries.forEach((entry, index) => {
    $listContainer.append(createEntryNode(thread, entry, index, pageEntries.length));
  });

  // 更新分页控件
  if (totalPages > 1) {
    $pagination.show();
    $('#diary-exchange-entry-page-info').text(`第 ${currentPage} 页 / 共 ${totalPages} 页`);
    $('#diary-exchange-entry-prev-page').prop('disabled', currentPage === 1);
    $('#diary-exchange-entry-next-page').prop('disabled', currentPage === totalPages);
  } else {
    $pagination.hide();
  }

  console.log(`[Exchange Diary View] Rendered ${pageEntries.length} entries (${currentPage}/${totalPages})`);
}

/**
 * 显示交换日记条目详情（书本式阅读）
 * @param {string} threadId - 线程ID
 * @param {number} entryNumber - 条目编号
 */
function showExchangeDiaryEntryDetail(threadId, entryNumber) {
  console.log(`[Exchange Diary View] Showing entry detail: ${threadId}, entry ${entryNumber}`);

  // 获取线程数据
  const thread = exchangeDiaryStorage.getThread(threadId);
  if (!thread) {
    notify.error('系列不存在');
    return;
  }

  const normalizedEntryNumber = Number(entryNumber);
  if (!Number.isFinite(normalizedEntryNumber) || normalizedEntryNumber < 1) {
    notify.error('条目编号无效');
    return;
  }

  const pageNumber = getBookPageForEntry(thread, normalizedEntryNumber, window.innerWidth <= 768);
  if (!pageNumber) {
    notify.error('条目不存在');
    return;
  }

  // 切换到阅读视图
  switchExchangeDiaryView('read');

  // 渲染书本视图
  renderExchangeDiaryBookView(thread, pageNumber);
}

/**
 * 显示交换日记书本式阅读界面
 * @param {string} threadId - 线程ID
 */
function showExchangeDiaryBookView(threadId) {
  console.log(`[Exchange Diary View] Showing book view: ${threadId}`);

  // 获取线程数据
  const thread = exchangeDiaryStorage.getThread(threadId);
  if (!thread) {
    notify.error('线程不存在');
    return;
  }

  // 检查是否有条目
  if (thread.entries.length === 0) {
    notify.warning('该线程还没有日记条目');
    return;
  }

  // 切换到阅读视图
  switchExchangeDiaryView('read');

  // 渲染书本视图
  renderExchangeDiaryBookView(thread, 1); // 从第1页开始
}

/**
 * 渲染交换日记书本式阅读界面
 * @param {Object} thread - 线程对象
 * @param {number} currentPage - 当前页码（1-based）
 */
function renderExchangeDiaryBookView(thread, currentPage) {
  console.log(`[Exchange Diary View] Rendering book view: ${thread.threadId}, page: ${currentPage}`);

  // 保存当前线程ID到阅读视图
  $('#diary-exchange-read-view').data('current-thread-id', thread.threadId);

  // 检测是否为移动端（屏幕宽度 <= 768px）
  const isMobile = window.innerWidth <= 768;

  const totalPages = getBookTotalPages(thread, isMobile);
  if (totalPages < 1) {
    notify.warning('该线程还没有日记条目');
    showExchangeDiaryEntryList(thread.threadId);
    return;
  }

  // 确保页码在有效范围内
  currentPage = normalizePageNumber(currentPage, totalPages);

  if (isMobile) {
    // 移动端渲染逻辑
    renderMobileView(thread, currentPage, totalPages);
  } else {
    // PC端渲染逻辑
    renderDesktopView(thread, currentPage, totalPages);
  }

  updateReadViewPager(thread, currentPage, totalPages);
  bindReadViewNavigation(thread, currentPage, totalPages);

  console.log('[Exchange Diary View] Book view rendered');
}

/**
 * PC端渲染：左右分栏显示
 */
function renderDesktopView(thread, currentPage, totalPages) {
  const entryIndex = currentPage - 1;
  const entry = thread.entries[entryIndex];

  setReadViewEntryContext(thread, entry);

  // 显示左右两栏
  $('.diary-exchange-left-page').show();
  $('.diary-exchange-right-page').show();

  // 更新左半边：用户日记
  renderUserDiaryPage(entry);
  updateCharacterReplyPanel(thread, entry);
}

/**
 * 移动端渲染：单页显示
 */
function renderMobileView(thread, currentPage, totalPages) {
  // 计算当前显示的条目和页面类型
  const entryIndex = Math.floor((currentPage - 1) / 2);
  const isUserPage = currentPage % 2 === 1; // 奇数页显示用户日记，偶数页显示角色回复
  const entry = thread.entries[entryIndex];

  setReadViewEntryContext(thread, entry);

  if (isUserPage) {
    // 显示用户日记页
    $('.diary-exchange-left-page').show();
    $('.diary-exchange-right-page').hide();

    renderUserDiaryPage(entry);

    // 隐藏Reroll按钮（用户日记页不需要）
    $('#diary-exchange-reroll-btn').hide();
  } else {
    // 显示角色回复页
    $('.diary-exchange-left-page').hide();
    $('.diary-exchange-right-page').show();
    updateCharacterReplyPanel(thread, entry);
  }
}

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  return formatRelativeDate(date);
}


  return {
    initializeViewDiaryPage,
    loadExchangeDiaryCharacterList,
    renderExchangeDiaryCharacterList,
    showExchangeDiaryThreadList,
    renderExchangeDiaryThreadList,
    showThreadRenameDialog,
    showExchangeDiaryEntryList,
    renderExchangeDiaryEntryList,
    showExchangeDiaryEntryDetail,
    showExchangeDiaryBookView,
    renderExchangeDiaryBookView,
    renderDesktopView,
    renderMobileView,
    formatDate,
  };
}
