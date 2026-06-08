const EVENT_NAMESPACE = '.exchangeDiaryWriteForm';

export function createExchangeWriteFormManager({
  exchangeDiaryStorage,
  ghostwriteManager,
  getContext,
  getDefaultCharacterName,
  getCurrentFloor,
  hideExchangeDiaryDialog,
  notify,
}) {
  function getSelectedCharacterName() {
    return $('#diary-exchange-character-name').val().trim() || getDefaultCharacterName();
  }

  function getThreadSelect() {
    return $('#diary-exchange-thread-select');
  }

  function updateGhostwriteButtonState({ disabled, text }) {
    $('#diary-exchange-ghostwrite-btn').prop('disabled', disabled).text(text);
  }

  function ensureExchangeDiaryMetadata(chatMetadata) {
    if (!chatMetadata.exchangeDiary) {
      chatMetadata.exchangeDiary = {
        pendingEntries: [],
      };
    }

    if (!Array.isArray(chatMetadata.exchangeDiary.pendingEntries)) {
      chatMetadata.exchangeDiary.pendingEntries = [];
    }

    return chatMetadata.exchangeDiary.pendingEntries;
  }

  function initializeWriteDiaryForm() {
    const currentCharacter = getDefaultCharacterName();

    console.log('[Exchange Diary Write Form] Initializing form');
    console.log(`[Exchange Diary Write Form] Current character: ${currentCharacter || '(none)'}`);

    $('#diary-exchange-character-name').attr('placeholder', currentCharacter || '留空则使用当前角色名');

    loadThreadList(currentCharacter);
    bindWriteDiaryFormEvents();

    console.log('[Exchange Diary Write Form] Form initialized');
  }

  function loadThreadList(characterName) {
    const $threadSelect = getThreadSelect();
    $threadSelect.find('option:not([value="new"])').remove();

    console.log(`[Exchange Diary Write Form] Loading threads for: ${characterName || '(none)'}`);

    if (!characterName) {
      toggleThreadNameInput(true);
      return;
    }

    const threads = exchangeDiaryStorage.getAllThreads(characterName);

    threads.forEach(thread => {
      const entryCount = thread.entries.length;
      const optionText = `${thread.threadName} (${entryCount}篇)`;
      $threadSelect.append($('<option>').val(thread.threadId).text(optionText));
    });

    $threadSelect.val('new');
    toggleThreadNameInput(true);
  }

  function toggleThreadNameInput(show) {
    const $threadNameGroup = $('#diary-exchange-thread-name-group');
    if (show) {
      $threadNameGroup.show();
    } else {
      $threadNameGroup.hide();
    }
  }

  function bindWriteDiaryFormEvents() {
    $('#diary-exchange-character-name')
      .off(`blur${EVENT_NAMESPACE}`)
      .on(`blur${EVENT_NAMESPACE}`, function () {
        const characterName = $(this).val().trim() || getDefaultCharacterName();
        loadThreadList(characterName);
      });

    getThreadSelect()
      .off(`change${EVENT_NAMESPACE}`)
      .on(`change${EVENT_NAMESPACE}`, function () {
        toggleThreadNameInput($(this).val() === 'new');
      });

    $('#diary-exchange-ghostwrite-btn')
      .off(`click${EVENT_NAMESPACE}`)
      .on(`click${EVENT_NAMESPACE}`, function (e) {
        e.preventDefault();
        handleGhostwrite();
      });

    $('#diary-exchange-write-form')
      .off(`submit${EVENT_NAMESPACE}`)
      .on(`submit${EVENT_NAMESPACE}`, function (e) {
        e.preventDefault();
        handleWriteDiarySubmit();
      });
  }

  async function handleGhostwrite() {
    const originalText = $('#diary-exchange-ghostwrite-btn').text();
    const characterName = getSelectedCharacterName();

    console.log('[Exchange Diary Write Form] Starting ghostwrite');

    if (!characterName) {
      notify.error('请先输入角色名或使用当前角色');
      return;
    }

    try {
      notify.info('正在生成日记，请稍候...', 'AI 代写');
      updateGhostwriteButtonState({
        disabled: true,
        text: '生成中...',
      });

      const context = getContext();
      const chatHistory = context.chat || [];

      if (chatHistory.length === 0) {
        notify.warning('当前没有聊天记录，无法生成日记', 'AI 代写');
        return;
      }

      const result = await ghostwriteManager.generateGhostwrittenDiary(chatHistory, characterName);
      if (!result.success) {
        notify.error(`生成失败: ${result.error}`, 'AI 代写');
        return;
      }

      $('#diary-exchange-content').val(result.content);
      notify.success('日记生成成功，可以编辑后再提交', 'AI 代写', { timeOut: 3000 });
    } catch (error) {
      console.error('[Exchange Diary Write Form] Ghostwrite failed:', error);
      notify.error(`AI 代写失败: ${error.message}`, 'AI 代写');
    } finally {
      updateGhostwriteButtonState({
        disabled: false,
        text: originalText || 'AI 代写',
      });
    }
  }

  function createUserDiaryPayload(content, customTime) {
    const currentFloor = getCurrentFloor();
    const config = exchangeDiaryStorage.getConfig();
    const triggerWindowStart = currentFloor + config.triggerWindowMin;
    const triggerWindowEnd = currentFloor + config.triggerWindowMax;
    const targetFloor =
      Math.floor(Math.random() * (triggerWindowEnd - triggerWindowStart + 1)) + triggerWindowStart;

    return {
      userDiary: {
        content,
        time: customTime || generateDefaultTimeDescription(),
        floorNumber: currentFloor,
        isGhostwritten: false,
        triggerWindow: {
          start: triggerWindowStart,
          end: triggerWindowEnd,
          targetFloor,
        },
      },
      triggerWindowStart,
      triggerWindowEnd,
      targetFloor,
    };
  }

  function resolveThreadId(characterName, threadSelect, threadName) {
    if (threadSelect !== 'new') {
      return threadSelect;
    }

    const thread = exchangeDiaryStorage.createThread(characterName, threadName || null);
    if (!thread) {
      return null;
    }

    return thread.threadId;
  }

  function addPendingEntryToCurrentChat(entryKey) {
    const context = getContext();
    const { chatMetadata, saveMetadata } = context;
    const pendingEntries = ensureExchangeDiaryMetadata(chatMetadata);

    if (!pendingEntries.includes(entryKey)) {
      pendingEntries.push(entryKey);
      saveMetadata();
      console.log(`[Exchange Diary Write Form] Added pending entry: ${entryKey}`);
    }
  }

  function handleWriteDiarySubmit() {
    const characterName = getSelectedCharacterName();
    const threadSelect = getThreadSelect().val();
    const threadName = $('#diary-exchange-thread-name').val().trim();
    const content = $('#diary-exchange-content').val().trim();
    const customTime = $('#diary-exchange-time').val().trim();

    console.log('[Exchange Diary Write Form] Submitting diary entry');

    if (!characterName) {
      notify.error('请输入角色名或使用当前角色');
      return;
    }

    if (!content) {
      notify.error('请输入日记内容');
      $('#diary-exchange-content').focus();
      return;
    }

    const threadId = resolveThreadId(characterName, threadSelect, threadName);
    if (!threadId) {
      notify.error('创建系列失败');
      return;
    }

    const {
      userDiary,
      triggerWindowStart,
      triggerWindowEnd,
      targetFloor,
    } = createUserDiaryPayload(content, customTime);

    const entry = exchangeDiaryStorage.addEntry(threadId, userDiary);
    if (!entry) {
      notify.error('保存日记失败');
      return;
    }

    const entryKey = `${threadId}-${entry.entryNumber}`;
    addPendingEntryToCurrentChat(entryKey);

    notify.success(
      `日记已保存，将在第 ${targetFloor} 层触发（窗口：${triggerWindowStart}-${triggerWindowEnd} 层）`,
    );

    resetWriteDiaryForm();
    hideExchangeDiaryDialog();
  }

  function generateDefaultTimeDescription() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();

    let period = '深夜';
    if (hours >= 5 && hours < 8) {
      period = '清晨';
    } else if (hours >= 8 && hours < 11) {
      period = '上午';
    } else if (hours >= 11 && hours < 13) {
      period = '中午';
    } else if (hours >= 13 && hours < 17) {
      period = '下午';
    } else if (hours >= 17 && hours < 19) {
      period = '傍晚';
    } else if (hours >= 19 && hours < 22) {
      period = '晚上';
    }

    return `${year}年${month}月${day}日 ${period}`;
  }

  function resetWriteDiaryForm() {
    $('#diary-exchange-character-name').val('');
    getThreadSelect().val('new');
    $('#diary-exchange-thread-name').val('');
    $('#diary-exchange-content').val('');
    $('#diary-exchange-time').val('');
    toggleThreadNameInput(true);
  }

  return {
    initializeWriteDiaryForm,
    loadThreadList,
    toggleThreadNameInput,
    bindWriteDiaryFormEvents,
    handleGhostwrite,
    handleWriteDiarySubmit,
    generateDefaultTimeDescription,
    resetWriteDiaryForm,
  };
}
