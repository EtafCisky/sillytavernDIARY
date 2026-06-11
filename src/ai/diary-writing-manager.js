const DIARY_PROMPT_TEMPLATE = `以{{char}}的口吻写一则日记，日记内容字数不得少于500字，日记格式如下：
<日记>
标题：{{标题}}
时间：{{时间}}
内容：{{内容}}
</日记>

日记正确格式示例如下：
<日记>
标题：我想你了
时间：2025年1月1日 11:11
内容：我今天特别想你……
</日记>`;

function normalizeGeneratedResult(rawResult) {
  if (typeof rawResult === 'string') {
    return rawResult || null;
  }

  if (rawResult && typeof rawResult === 'object') {
    return rawResult.pipe || rawResult.text || rawResult.content || rawResult.message?.content || null;
  }

  return rawResult == null ? null : String(rawResult);
}

function buildDiaryPrompt(characterName) {
  return DIARY_PROMPT_TEMPLATE.replace(/\{\{char\}\}/g, characterName);
}

export function createDiaryWritingManager({
  getChat,
  getCurrentCharacterFromHost,
  getContext,
  parseDiaryBlock,
  executeSlashCommandsWithOptions,
  customApiClient,
  saveDiaryToFile,
  saveToRecycleBinFile,
  showSaveSuccessDialog,
  showCustomCharacterDialog,
  hideCustomCharacterDialog,
  closeFloatMenu,
  switchToDiaryPreset,
  restoreOriginalPreset,
  notify,
  getSillyTavernContext = () => globalThis.SillyTavern?.getContext?.() || null,
  getFallbackSlashCommandExecutor = () => globalThis.executeSlashCommands,
  schedulePresetRestore = callback => setTimeout(callback, 1000),
}) {
  async function generateDiaryInBackground(prompt, characterName) {
    console.log('[Diary] Prompt:', prompt);
    console.log('[Diary] Character:', characterName || '(unknown)');

    try {
      if (customApiClient?.isReady?.()) {
        console.log('[Custom API] Using diary-specific API for diary generation');
        return normalizeGeneratedResult(await customApiClient.generate(prompt));
      }

      const context = getSillyTavernContext();
      const slashCommandsFunc = context?.executeSlashCommandsWithOptions || executeSlashCommandsWithOptions;

      if (typeof slashCommandsFunc === 'function') {
        return normalizeGeneratedResult(
          await slashCommandsFunc(`/gen ${prompt}`, {
            handleParserErrors: true,
            handleExecutionErrors: true,
            abortController: null,
            source: 'diary-plugin-write',
          }),
        );
      }

      const fallbackExecutor = getFallbackSlashCommandExecutor();
      if (typeof fallbackExecutor === 'function') {
        return normalizeGeneratedResult(await fallbackExecutor(`/gen ${prompt}`));
      }

      console.error('[Diary] No slash command executor available.');
      return null;
    } catch (error) {
      console.error('[Diary] Generation failed:', error);
      return null;
    }
  }

  async function continueWriteDiary() {
    const customCharacterName = $('#diary-character-input').val().trim();
    hideCustomCharacterDialog();

    const finalCharacterName = customCharacterName || getCurrentCharacterName();
    let originalPreset = null;
    let shouldRestorePreset = false;
    let aiResponse = '';

    try {
      const presetResult = await switchToDiaryPreset();
      originalPreset = presetResult.originalPreset;
      shouldRestorePreset = presetResult.switched;
    } catch (error) {
      console.error('[Diary] Failed to switch preset, continue with current preset:', error);
    }

    try {
      const diaryPrompt = buildDiaryPrompt(finalCharacterName);
      notify.info(`使用角色名：${finalCharacterName}`, '日记');

      aiResponse = await generateDiaryInBackground(diaryPrompt, finalCharacterName);
      if (!aiResponse) {
        notify.error('AI生成失败，请重试', '写日记');
        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      const diaryData = parseDiaryContent(aiResponse);
      if (!diaryData) {
        const recycleBinResult = await saveToRecycleBinFile(aiResponse, finalCharacterName, '解析失败');
        if (recycleBinResult?.success) {
          notify.error(`日记解析失败，原始内容已保存到回收站：${recycleBinResult.filename}`, '写日记');
        } else {
          notify.error('日记解析失败，且保存到回收站失败', '写日记');
        }

        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      const saveResult = await saveDiaryToFile(diaryData, finalCharacterName);
      if (shouldRestorePreset) {
        schedulePresetRestore(async () => {
          await restoreOriginalPreset(originalPreset);
        });
      }

      if (!saveResult.success) {
        const recycleBinResult = await saveToRecycleBinFile(aiResponse, finalCharacterName, '保存失败');
        if (recycleBinResult?.success) {
          notify.error(`日记保存失败，原始内容已保存到回收站：${recycleBinResult.filename}`, '写日记');
        } else {
          notify.error(`日记保存失败：${saveResult.error}`, '写日记');
        }
        return;
      }

      showSaveSuccessDialog({
        success: true,
        diaryId: saveResult.diaryId,
        title: diaryData.title,
        characterName: finalCharacterName,
      });
    } catch (error) {
      console.error('[Diary] Writing failed:', error);

      try {
        if (aiResponse) {
          await saveToRecycleBinFile(aiResponse, finalCharacterName, `系统错误: ${error.message}`);
        }
      } catch (recycleBinError) {
        console.error('[Diary] Failed to save error content to recycle bin:', recycleBinError);
      }

      if (shouldRestorePreset) {
        await restoreOriginalPreset(originalPreset);
      }

      notify.error(`写日记失败：${error.message}`, '写日记');
    }
  }

  async function startWriteDiary() {
    closeFloatMenu();

    try {
      showCustomCharacterDialog();
    } catch (error) {
      console.error('[Diary] Failed to open custom character dialog:', error);
      notify.error(`写日记失败：${error.message}`, '写日记');
    }
  }

  function isMobileDevice() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }

  function getLatestMessage() {
    try {
      const chat = getChat();
      if (!chat || chat.length === 0) {
        return null;
      }

      return chat[chat.length - 1];
    } catch (error) {
      console.error('[Diary] Failed to read latest message:', error);
      return null;
    }
  }

  function parseDiaryContent(messageContent) {
    try {
      if (!messageContent || typeof messageContent !== 'string') {
        return null;
      }

      const parseResult = parseDiaryBlock(messageContent);
      if (!parseResult.success) {
        if (parseResult.isTemplate) {
          notify.warning('检测到模板格式内容，请让 AI 生成真实的日记内容', '日记解析');
        } else if (parseResult.error === '日记内容不完整（标题、时间或内容为空）') {
          notify.warning('日记内容不完整，请检查格式', '日记解析');
        }
        return null;
      }

      return {
        title: parseResult.title,
        time: parseResult.time,
        content: parseResult.content,
      };
    } catch (error) {
      console.error('[Diary] Failed to parse diary content:', error);
      return null;
    }
  }

  function getCurrentCharacterName() {
    try {
      const currentCharacter = getCurrentCharacterFromHost();
      if (typeof currentCharacter === 'string' && currentCharacter.trim()) {
        return currentCharacter.trim();
      }

      const context = getContext();
      if (typeof context?.name2 === 'string' && context.name2.trim()) {
        return context.name2.trim();
      }

      return 'Unknown';
    } catch (error) {
      console.error('[Diary] Failed to get current character name:', error);
      return 'Unknown';
    }
  }

  return {
    generateDiaryInBackground,
    continueWriteDiary,
    startWriteDiary,
    isMobileDevice,
    getLatestMessage,
    parseDiaryContent,
    getCurrentCharacterName,
  };
}
