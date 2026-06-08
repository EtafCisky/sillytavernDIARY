export function createDiaryWritingManager({
  getChat,
  getCurrentCharacterFromHost,
  getContext,
  parseDiaryBlock,
  executeSlashCommandsWithOptions,
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
    console.log('提示词:', prompt);
    console.log('角色名:', characterName || '(未指定)');

    try {
      console.log('尝试获取 SillyTavern 上下文...');
      const context = getSillyTavernContext();

      if (!context) {
        console.error('无法获取 SillyTavern 上下文');
        return null;
      }

      console.log(' SillyTavern 上下文获取成功');

      const slashCommandsFunc = context.executeSlashCommandsWithOptions;

      if (!slashCommandsFunc || typeof slashCommandsFunc !== 'function') {
        console.error(' executeSlashCommandsWithOptions 函数不存在');
        console.log('尝试使用备用方法...');

        const executeSlashCommands = getFallbackSlashCommandExecutor();
        if (typeof executeSlashCommands === 'function') {
          console.log('找到 executeSlashCommands 函数，使用备用方法');
          const slashCommand = `/gen ${prompt}`;
          console.log('执行斜杠命令:', slashCommand);

          const rawResult = await executeSlashCommands(slashCommand);
          return normalizeGeneratedResult(rawResult);
        }

        console.error('executeSlashCommands 函数也不存在');
        return null;
      }

      const slashCommand = `/gen ${prompt}`;
      console.log('执行斜杠命令:', slashCommand);

      const rawResult = await executeSlashCommandsWithOptions(slashCommand, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        source: 'diary-plugin-step1',
      });

      return normalizeGeneratedResult(rawResult);
    } catch (error) {
      console.error('错误类型:', error.name);
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
      console.error('═══════════════════════════════════════════');

      return null;
    }
  }

  function normalizeGeneratedResult(rawResult) {
    console.log('原始返回值类型:', typeof rawResult);
    console.log('原始返回值:', rawResult);

    let result = null;
    if (typeof rawResult === 'string') {
      result = rawResult;
    } else if (rawResult && typeof rawResult === 'object') {
      result = rawResult.pipe || rawResult.text || rawResult.content || JSON.stringify(rawResult);
      console.log('从对象提取内容，字段:', Object.keys(rawResult));
    } else {
      result = String(rawResult || '');
    }

    console.log('AI回复成功');
    console.log('回复长度:', result?.length || 0, '字符');
    console.log('回复内容预览:', result?.substring(0, 200) || '(空)');
    console.log('═══════════════════════════════════════════');

    return result || null;
  }

  async function continueWriteDiary() {
    const customCharacterName = $('#diary-character-input').val().trim();
    console.log('用户输入的角色名:', customCharacterName || '(空，使用默认角色名)');

    hideCustomCharacterDialog();

    const finalCharacterName = customCharacterName || getCurrentCharacterName();
    console.log('最终使用的角色名:', finalCharacterName);

    let originalPreset = null;
    let shouldRestorePreset = false;
    let aiResponse;

    try {
      const result = await switchToDiaryPreset();
      originalPreset = result.originalPreset;
      shouldRestorePreset = result.switched;
    } catch (error) {
      console.error('预设切换失败，继续使用当前预设:', error);
    }

    try {
      console.log('构建日记提示词...');
      let diaryPrompt =
        '以{{char}}的口吻写一则日记，日记内容字数不得少于500字，日记格式为：\n<日记>\n标题：{{标题}}\n时间：{{时间}}\n内容：{{内容}}\n</日记>\n\n日记正确格式示例如下：\n<日记>\n标题：我想你了\n时间：2025年11月11日 11:11\n内容：我今天特别想你……你还好吗？\n</日记>';

      if (customCharacterName) {
        diaryPrompt = diaryPrompt.replace(/\{\{char\}\}/g, customCharacterName);
        notify.info(`使用角色名：${customCharacterName}`);
      } else {
        notify.info(`使用角色名：${finalCharacterName}`);
      }

      console.log('提示词:', diaryPrompt);

      aiResponse = await generateDiaryInBackground(diaryPrompt, finalCharacterName);

      if (!aiResponse) {
        console.error('后台生成失败');
        notify.error('AI生成失败，请重试');

        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      console.log('回复长度:', aiResponse.length, '字符');

      const diaryData = parseDiaryContent(aiResponse);

      if (!diaryData) {
        console.error('未能解析出有效的日记内容');
        console.log('AI回复内容:', aiResponse.substring(0, 500));
        console.log('日记解析失败，保存到回收站...');

        try {
          const recycleBinResult = await saveToRecycleBinFile(aiResponse, finalCharacterName, '解析失败');

          if (recycleBinResult.success) {
            console.log('AI输出已保存到回收站，文件名:', recycleBinResult.filename);
            notify.error(`未能解析出有效的日记内容，AI输出已保存到回收站（${recycleBinResult.filename}）`);
          } else {
            console.error('保存到回收站也失败了:', recycleBinResult.error);
          }
        } catch (recycleBinError) {
          console.error('回收站保存过程中发生错误:', recycleBinError);
          notify.error('未能解析出有效的日记内容');
        }

        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      console.log('日记内容解析完成');
      console.log('日记标题:', diaryData.title);
      console.log('日记时间:', diaryData.time);
      console.log('日记内容长度:', diaryData.content.length, '字符');
      notify.success(`成功解析日记："${diaryData.title}"`);

      console.log('开始保存日记到文件系统...');

      const saveResult = await saveDiaryToFile(diaryData, finalCharacterName);

      if (shouldRestorePreset) {
        console.log('恢复原预设...');
        schedulePresetRestore(async () => {
          await restoreOriginalPreset(originalPreset);
        });
      }

      if (saveResult.success) {
        console.log('写日记流程完成！');
        console.log('日记ID:', saveResult.diaryId);

        showSaveSuccessDialog({
          success: true,
          diaryId: saveResult.diaryId,
          title: diaryData.title,
          characterName: finalCharacterName,
        });
      } else {
        console.error('保存失败');
        console.log('错误信息:', saveResult.error);
        console.log('日记保存失败，保存到回收站...');

        try {
          const recycleBinResult = await saveToRecycleBinFile(aiResponse, finalCharacterName, '保存失败');

          if (recycleBinResult.success) {
            console.log('日记内容已保存到回收站，文件名:', recycleBinResult.filename);
            notify.error(
              `保存日记失败: ${saveResult.error}。内容已保存到回收站（${recycleBinResult.filename}）`,
              '新写日记流程',
            );
          } else {
            console.error('保存到回收站也失败了:', recycleBinResult.error);
          }
        } catch (recycleBinError) {
          console.error('回收站保存过程中发生错误:', recycleBinError);
          notify.error(`保存日记失败: ${saveResult.error}`);
        }
      }
    } catch (error) {
      console.error('写日记功能错误');
      console.error('错误类型:', error.name);
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);

      try {
        console.log('系统错误，尝试保存到回收站...');

        const errorContent = typeof aiResponse !== 'undefined' ? aiResponse : `系统错误：${error.message}`;
        const recycleBinResult = await saveToRecycleBinFile(errorContent, finalCharacterName || '系统错误', '系统错误');

        if (recycleBinResult.success) {
          console.log('错误信息已保存到回收站，文件名:', recycleBinResult.filename);
          notify.error(`写日记功能出错: ${error.message}。错误信息已保存到回收站（${recycleBinResult.filename}）`);
        } else {
          console.error('保存错误信息到回收站也失败了:', recycleBinResult.error);
          notify.error(`写日记功能出错: ${error.message}`);
        }
      } catch (recycleBinError) {
        console.error('回收站保存错误信息时发生异常:', recycleBinError);
        notify.error(`写日记功能出错: ${error.message}`);
      }

      if (shouldRestorePreset) {
        await restoreOriginalPreset(originalPreset);
      }
    }
  }

  async function startWriteDiary() {
    closeFloatMenu();

    try {
      showCustomCharacterDialog();
    } catch (error) {
      console.error('❌ 写日记功能错误:', error);
      notify.error(`写日记功能出错: ${error.message}`, '写日记错误');
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
        console.warn('⚠️ 聊天记录为空');
        return null;
      }

      const latestMessage = chat[chat.length - 1];
      console.log('📨 获取到最新消息:', {
        index: chat.length - 1,
        content: latestMessage.mes ? latestMessage.mes.substring(0, 100) + '...' : '无内容',
        name: latestMessage.name || '未知发送者',
      });

      return latestMessage;
    } catch (error) {
      console.error('❌ 获取最新消息失败:', error);
      return null;
    }
  }

  function parseDiaryContent(messageContent) {
    try {
      if (!messageContent || typeof messageContent !== 'string') {
        console.warn('⚠️ 消息内容为空或不是字符串');
        return null;
      }

      console.log('🔍 开始解析日记内容...');
      console.log('📝 原始消息内容:', messageContent.substring(0, 200) + '...');

      const parseResult = parseDiaryBlock(messageContent);

      if (!parseResult.success) {
        console.log('❌ 未找到符合格式的日记内容');
        if (parseResult.isTemplate) {
          console.log('⚠️ 检测到模板内容，跳过保存');
          notify.warning('检测到模板格式内容，请让AI生成真实的日记内容', '日记解析');
        } else if (parseResult.error === '日记内容不完整（标题、时间或内容为空）') {
          console.log('❌ 日记内容不完整');
          notify.warning('日记内容不完整，请检查格式', '日记解析');
        }
        return null;
      }

      const { title, time, content } = parseResult;

      console.log('🎯 解析到的日记内容:', {
        标题: title,
        时间: time,
        内容长度: content?.length || 0,
      });

      console.log('✅ 日记内容解析成功');
      return {
        title,
        time,
        content,
      };
    } catch (error) {
      console.error('❌ 解析日记内容失败:', error);
      return null;
    }
  }

  function getCurrentCharacterName() {
    try {
      const currentCharacter = getCurrentCharacterFromHost();

      if (currentCharacter && typeof currentCharacter === 'string' && currentCharacter.trim() !== '') {
        console.log('📝 使用name2获取角色名称:', currentCharacter);
        return currentCharacter.trim();
      }

      const context = getContext();
      if (context && context.name2) {
        console.log('📝 通过context获取角色名称:', context.name2);
        return context.name2.trim();
      }

      console.warn('⚠️ 无法获取角色名称，使用默认值');
      return 'Unknown';
    } catch (error) {
      console.error('❌ 获取角色名称失败:', error);
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
