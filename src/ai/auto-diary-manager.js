const AUTO_DIARY_PROMPT =
  '以{{char}}的口吻写一则日记，日记内容字数不得少于500字，日记格式为：\n<日记>\n标题：{{标题}}\n时间：{{时间}}\n内容：{{内容}}</日记>\n\n日记正确格式示例如下：\n<日记>\n标题：我想你了\n时间：2025年11月11日 11:11\n内容：我今天特别想你……你还好吗？</日记>';

const AUTO_DIARY_COOLDOWN_MS = 10 * 60 * 1000;

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
      return {
        interval: 0,
      };
    }
    return settings.autoDiary;
  }

  function saveAutoDiaryInterval(interval) {
    const settings = getCurrentSettings();
    if (!settings.autoDiary) {
      settings.autoDiary = {
        interval: 0,
      };
    }

    const newInterval = parseInt(interval) || 0;
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

      console.log(`[自动写日记] 已保存触发间隔: ${newInterval}，起始楼层: ${currentFloor}（${characterName}）`);
    } else {
      console.log('[自动写日记] 已禁用自动写日记功能');
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

    console.log(`[自动写日记] 已更新"${characterName}"的触发楼层: ${floor}`);
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
      updateStatusText(`已达触发条件（间隔${interval}条）`);
    } else {
      updateStatusText(`已启用，还需${remaining}条消息触发（间隔${interval}条）`);
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
      const remainingCooldown = Math.ceil((AUTO_DIARY_COOLDOWN_MS - timeSinceLastTrigger) / 1000 / 60);
      console.log(`[自动写日记] 冷却中，还需等待 ${remainingCooldown} 分钟`);
      return;
    }

    console.log(`[自动写日记] 检查触发条件 - 当前楼层:${currentFloor}, 上次触发:${lastTriggerFloor}, 间隔:${interval}`);

    if (currentFloor - lastTriggerFloor >= interval) {
      console.log('[自动写日记] 已达到触发条件，开始自动写日记');

      const { saveMetadata } = context;
      if (!chatMetadata.sillytavernDIARY) {
        chatMetadata.sillytavernDIARY = {};
      }
      chatMetadata.sillytavernDIARY.lastTriggerTime = Date.now();
      saveMetadata();
      console.log('[自动写日记] 已设置冷却时间，10分钟内不会再次触发');

      notify.info(`自动写日记触发（${characterName}）`, '日记本');
      await triggerAutoDiary(characterName, currentFloor);
    }

    updateAutoDiaryStatus();
  }

  function extractGeneratedText(genResult) {
    if (genResult && typeof genResult === 'string') {
      return genResult;
    }

    if (genResult && genResult.pipe) {
      return genResult.pipe || '';
    }

    console.error('[自动写日记] /gen 命令返回格式异常:', genResult);
    return null;
  }

  async function saveFailedContent(content, characterName, reason, userMessage) {
    try {
      await saveToRecycleBinFile(content, characterName, reason);
      notify.error(userMessage, '自动写日记错误');
    } catch (recycleBinError) {
      console.error('[自动写日记] 保存到回收站也失败了:', recycleBinError);
      notify.error(`${userMessage.replace('，已保存到回收站', '')}，且保存到回收站失败`, '自动写日记错误');
    }
  }

  async function triggerAutoDiary(characterName, currentFloor) {
    let generatedContent = '';

    try {
      let originalPreset = null;
      let shouldRestorePreset = false;

      if (!customApiClient?.isReady?.()) {
        try {
          const result = await switchToDiaryPreset();
          originalPreset = result.originalPreset;
          shouldRestorePreset = result.switched;
        } catch (error) {
          console.error('[自动写日记] 预设切换失败，继续使用当前预设:', error);
        }
      }

      console.log('[自动写日记] 开始后台生成日记内容...');

      let genResult = null;
      try {
        if (customApiClient?.isReady?.()) {
          console.log('[Custom API] Using diary-specific API for auto diary generation');
          genResult = await customApiClient.generate(AUTO_DIARY_PROMPT);
        } else {
          genResult = await executeSlashCommandsWithOptions(`/gen ${AUTO_DIARY_PROMPT}`, {
            handleExecutionErrors: true,
            handleParserErrors: true,
            abortController: null,
          });
        }

        console.log('[自动写日记] 后台生成完成');

        if (shouldRestorePreset) {
          schedulePresetRestore(async () => {
            await restoreOriginalPreset(originalPreset);
          });
        }
      } catch (error) {
        console.error('[自动写日记] 后台生成失败:', error);
        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        notify.error('后台生成日记失败', '自动写日记错误');
        return;
      }

      generatedContent = extractGeneratedText(genResult);
      if (generatedContent === null) {
        notify.error('后台生成结果格式异常', '自动写日记错误');
        return;
      }

      if (!generatedContent) {
        notify.error('后台生成内容为空', '自动写日记错误');
        return;
      }

      console.log('[自动写日记] 获取到生成内容，长度:', generatedContent.length);
      const diaryData = parseDiaryContent(generatedContent);
      if (!diaryData) {
        console.log('[自动写日记] 日记内容解析失败，保存到回收站');
        await saveFailedContent(
          generatedContent,
          characterName,
          '自动写日记 - 正则匹配失败',
          '日记内容解析失败，已保存到回收站',
        );
        return;
      }

      console.log('[自动写日记] 日记内容解析完成:', diaryData.title);

      const saveResult = await saveDiaryToFile(diaryData, characterName);
      if (!saveResult.success) {
        console.log('[自动写日记] 日记保存失败，保存到回收站');
        await saveFailedContent(
          generatedContent,
          characterName,
          '自动写日记 - 文件保存失败',
          '保存日记失败，已保存到回收站',
        );
        return;
      }

      updateLastTriggerFloor(characterName, currentFloor);

      notify.success(`自动写日记完成："${diaryData.title}"`, '日记本', { timeOut: 5000 });
      console.log('[自动写日记] 全部流程完成');
    } catch (error) {
      console.error('[自动写日记] 发生错误:', error);

      if (typeof generatedContent === 'string' && generatedContent.length > 0) {
        try {
          await saveToRecycleBinFile(generatedContent, characterName, `自动写日记 - 系统错误: ${error.message}`);
          notify.error('自动写日记出错，内容已保存到回收站', '自动写日记错误');
        } catch (recycleBinError) {
          console.error('[自动写日记] 保存到回收站也失败了:', recycleBinError);
          notify.error(`自动写日记出错: ${error.message}`, '自动写日记错误');
        }
      } else {
        notify.error(`自动写日记出错: ${error.message}`, '自动写日记错误');
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
