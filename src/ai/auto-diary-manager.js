const AUTO_DIARY_PROMPT = `以{{char}}的口吻写一则日记，日记内容字数不得少于500字，日记格式如下：
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

const AUTO_DIARY_COOLDOWN_MS = 10 * 60 * 1000;

function extractGeneratedText(genResult) {
  if (typeof genResult === 'string') {
    return genResult;
  }

  if (genResult?.pipe) {
    return genResult.pipe || '';
  }

  if (genResult?.text) {
    return genResult.text || '';
  }

  if (genResult?.content) {
    return genResult.content || '';
  }

  console.error('[Auto Diary] Unexpected /gen result:', genResult);
  return null;
}

export function createAutoDiaryManager({
  getCurrentSettings,
  saveSettings,
  getContext,
  getCurrentCharacterName,
  getCurrentFloor,
  isAIGenerating,
  switchToDiaryPreset,
  restoreOriginalPreset,
  executeSlashCommandsWithOptions,
  customApiClient,
  parseDiaryContent,
  saveDiaryToFile,
  saveToRecycleBinFile,
  updateStatusText,
  notify,
  schedulePresetRestore = callback => setTimeout(callback, 10000),
}) {
  let lastCheckedChatLength = 0;

  function getAutoDiaryConfig() {
    const settings = getCurrentSettings();
    if (!settings.autoDiary) {
      return { interval: 0 };
    }

    return settings.autoDiary;
  }

  function saveAutoDiaryInterval(interval) {
    const settings = getCurrentSettings();
    if (!settings.autoDiary) {
      settings.autoDiary = { interval: 0 };
    }

    const newInterval = parseInt(interval, 10) || 0;
    settings.autoDiary.interval = newInterval;

    if (newInterval > 0) {
      const context = getContext();
      const { chatMetadata, saveMetadata } = context;
      const characterName = getCurrentCharacterName();
      const currentFloor = getCurrentFloor();

      if (!chatMetadata.sillytavernDIARY) {
        chatMetadata.sillytavernDIARY = {};
      }

      chatMetadata.sillytavernDIARY.lastTriggerFloor = currentFloor;
      chatMetadata.sillytavernDIARY.characterName = characterName;
      chatMetadata.sillytavernDIARY.lastTriggerTime = 0;
      saveMetadata();

      console.log(
        `[Auto Diary] Enabled, interval=${newInterval}, startFloor=${currentFloor}, character=${characterName}`,
      );
    } else {
      console.log('[Auto Diary] Disabled.');
    }

    saveSettings();
  }

  function updateLastTriggerFloor(characterName, floor) {
    const context = getContext();
    const { chatMetadata, saveMetadata } = context;

    if (!chatMetadata.sillytavernDIARY) {
      chatMetadata.sillytavernDIARY = {};
    }

    chatMetadata.sillytavernDIARY.lastTriggerFloor = floor;
    chatMetadata.sillytavernDIARY.characterName = characterName;
    saveMetadata();
  }

  function updateAutoDiaryStatus() {
    const config = getAutoDiaryConfig();
    const interval = config.interval;

    if (!interval || interval <= 0) {
      updateStatusText('功能未启用');
      return;
    }

    const context = getContext();
    const { chatMetadata } = context;
    const currentFloor = getCurrentFloor();
    const lastFloor = chatMetadata?.sillytavernDIARY?.lastTriggerFloor || 0;
    const remaining = interval - (currentFloor - lastFloor);

    if (remaining <= 0) {
      updateStatusText(`已达到触发条件（间隔 ${interval} 楼）`);
    } else {
      updateStatusText(`已启用，还需 ${remaining} 条消息触发（间隔 ${interval} 楼）`);
    }
  }

  async function checkAndTriggerAutoDiary() {
    if (isAIGenerating()) {
      return;
    }

    const currentLength = getCurrentFloor();
    if (currentLength === lastCheckedChatLength) {
      return;
    }
    lastCheckedChatLength = currentLength;

    const config = getAutoDiaryConfig();
    const interval = config.interval;

    if (!interval || interval <= 0) {
      return;
    }

    const context = getContext();
    const { chatMetadata } = context;
    const characterName = getCurrentCharacterName();
    const currentFloor = currentLength;
    const lastTriggerFloor = chatMetadata?.sillytavernDIARY?.lastTriggerFloor || 0;
    const lastTriggerTime = chatMetadata?.sillytavernDIARY?.lastTriggerTime || 0;
    const currentTime = Date.now();
    const timeSinceLastTrigger = currentTime - lastTriggerTime;

    if (lastTriggerTime > 0 && timeSinceLastTrigger < AUTO_DIARY_COOLDOWN_MS) {
      return;
    }

    if (currentFloor - lastTriggerFloor >= interval) {
      console.log('[Auto Diary] Trigger condition met.');

      const { saveMetadata } = context;
      if (!chatMetadata.sillytavernDIARY) {
        chatMetadata.sillytavernDIARY = {};
      }
      chatMetadata.sillytavernDIARY.lastTriggerTime = Date.now();
      saveMetadata();

      notify.info(`自动写日记已触发：${characterName}`, '日记');
      await triggerAutoDiary(characterName, currentFloor);
    }

    updateAutoDiaryStatus();
  }

  async function saveFailedContent(content, characterName, reason, userMessage) {
    try {
      await saveToRecycleBinFile(content, characterName, reason);
      notify.error(userMessage, '自动写日记');
    } catch (recycleBinError) {
      console.error('[Auto Diary] Failed to save recycle bin item:', recycleBinError);
      notify.error(userMessage, '自动写日记');
    }
  }

  async function triggerAutoDiary(characterName, currentFloor) {
    let generatedContent = '';
    let originalPreset = null;
    let shouldRestorePreset = false;

    try {
      try {
        const result = await switchToDiaryPreset();
        originalPreset = result.originalPreset;
        shouldRestorePreset = result.switched;
      } catch (error) {
        console.error('[Auto Diary] Failed to switch preset, continue with current preset:', error);
      }

      let genResult = null;
      if (customApiClient?.isReady?.()) {
        console.log('[Custom API] Using diary-specific API for auto diary generation');
        genResult = await customApiClient.generate(AUTO_DIARY_PROMPT);
      } else {
        genResult = await executeSlashCommandsWithOptions(`/gen ${AUTO_DIARY_PROMPT}`, {
          handleExecutionErrors: true,
          handleParserErrors: true,
          abortController: null,
          source: 'diary-plugin-auto',
        });
      }

      if (shouldRestorePreset) {
        schedulePresetRestore(async () => {
          await restoreOriginalPreset(originalPreset);
        });
      }

      generatedContent = extractGeneratedText(genResult);
      if (generatedContent === null) {
        notify.error('后台生成结果格式异常', '自动写日记');
        return;
      }

      if (!generatedContent) {
        notify.error('后台生成内容为空', '自动写日记');
        return;
      }

      const diaryData = parseDiaryContent(generatedContent);
      if (!diaryData) {
        await saveFailedContent(
          generatedContent,
          characterName,
          '自动写日记解析失败',
          '日记内容解析失败，已保存到回收站',
        );
        return;
      }

      const saveResult = await saveDiaryToFile(diaryData, characterName);
      if (!saveResult.success) {
        await saveFailedContent(
          generatedContent,
          characterName,
          '自动写日记文件保存失败',
          '保存日记失败，已保存到回收站',
        );
        return;
      }

      updateLastTriggerFloor(characterName, currentFloor);
      notify.success(`自动写日记完成：${diaryData.title}`, '日记', { timeOut: 5000 });
    } catch (error) {
      console.error('[Auto Diary] Failed:', error);

      if (shouldRestorePreset) {
        await restoreOriginalPreset(originalPreset);
      }

      if (generatedContent) {
        try {
          await saveToRecycleBinFile(generatedContent, characterName, `自动写日记系统错误: ${error.message}`);
          notify.error('自动写日记出错，内容已保存到回收站', '自动写日记');
        } catch (recycleBinError) {
          console.error('[Auto Diary] Failed to save error content:', recycleBinError);
          notify.error(`自动写日记出错：${error.message}`, '自动写日记');
        }
      } else {
        notify.error(`自动写日记出错：${error.message}`, '自动写日记');
      }
    }
  }

  return {
    getAutoDiaryConfig,
    saveAutoDiaryInterval,
    updateLastTriggerFloor,
    updateAutoDiaryStatus,
    checkAndTriggerAutoDiary,
    triggerAutoDiary,
  };
}
