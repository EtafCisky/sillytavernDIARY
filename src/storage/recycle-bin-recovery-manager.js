export function createRecycleBinRecoveryManager({
  loadAllRecycleBin,
  saveAllRecycleBin,
  parseDiaryContent,
  saveDiaryToFile,
  loadDiaryFromFile,
  deleteRecycleBinItem,
  exchangeDiaryStorage,
  formatValidator,
  getCurrentFloor,
}) {
  function parseRecycleBinFilename(filename) {
    const match = filename.match(/^(.+)_(\d+)$/);
    if (!match) {
      throw new Error('无效的文件名格式');
    }

    return {
      characterName: match[1],
      id: parseInt(match[2], 10),
    };
  }

  function getMetadataValue(metadata, englishKey, chineseKey) {
    return metadata?.[englishKey] ?? metadata?.[chineseKey];
  }

  async function saveRecycleBinAsDiary(filename, editedContent) {
    try {
      console.log('[回收站] 将回收站条目保存为日记...');
      console.log('[回收站] 文件名:', filename);

      const { characterName, id } = parseRecycleBinFilename(filename);

      const allRecycleBin = await loadAllRecycleBin();
      const characterRecycleBin = allRecycleBin[characterName] || [];
      const itemIndex = characterRecycleBin.findIndex(r => Number(r.id) === Number(id));

      if (itemIndex === -1) {
        throw new Error('无法找到回收站条目');
      }

      characterRecycleBin[itemIndex].content = editedContent;
      allRecycleBin[characterName] = characterRecycleBin;

      const saveSuccess = await saveAllRecycleBin(allRecycleBin);
      if (!saveSuccess) {
        throw new Error('保存编辑内容失败');
      }
      console.log('[回收站] 编辑内容已保存');

      const diaryData = parseDiaryContent(editedContent);
      if (!diaryData) {
        throw new Error('无法解析日记格式');
      }

      console.log('[回收站] 日记解析成功:', diaryData.title);

      const saveResult = await saveDiaryToFile(diaryData, characterName);
      if (!saveResult.success) {
        throw new Error(saveResult.error || '保存日记失败');
      }

      console.log('[回收站] 日记保存成功, ID:', saveResult.diaryId);

      const savedDiary = await loadDiaryFromFile(characterName, saveResult.diaryId);
      if (!savedDiary) {
        throw new Error('日记文件创建失败');
      }

      console.log('[回收站] 日记文件已确认存在，删除回收站条目');

      const deleteResult = await deleteRecycleBinItem(characterName, id);
      if (!deleteResult.success) {
        console.warn('[回收站] 删除回收站条目失败，但日记已保存:', deleteResult.error);
      }

      console.log('[回收站] 保存为日记流程完成');
      return { success: true, diaryId: saveResult.diaryId };
    } catch (error) {
      console.error('[回收站] 保存为日记失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function restoreExchangeDiaryFromRecycleBin(recycleBinItem, editedContent) {
    try {
      console.log('[回收站] 恢复交换日记...');

      const threadId = getMetadataValue(recycleBinItem.metadata, 'threadId', '线程ID');
      const entryNumber = getMetadataValue(recycleBinItem.metadata, 'entryNumber', '条目编号');
      const characterName = recycleBinItem.characterName;

      if (!threadId || !entryNumber) {
        throw new Error('缺少线程ID或条目编号');
      }

      console.log(`[回收站] 线程ID: ${threadId}, 条目编号: ${entryNumber}`);

      const thread = exchangeDiaryStorage.getThread(threadId);
      if (!thread) {
        throw new Error(`线程不存在: ${threadId}`);
      }

      const entry = exchangeDiaryStorage.getEntry(threadId, entryNumber);
      if (!entry) {
        throw new Error(`条目不存在: ${threadId}, 条目${entryNumber}`);
      }

      const extractResult = formatValidator.validateAndExtract(editedContent);

      if (!extractResult.success) {
        throw new Error(`格式验证失败: ${extractResult.error}`);
      }

      console.log('[回收站] 日记格式验证成功');

      const reply = {
        title: extractResult.title,
        time: extractResult.time,
        content: extractResult.content,
        rawResponse: editedContent,
        floorNumber: getCurrentFloor(),
        parsed: true,
        isReroll: false,
        rerollIndex: 0,
      };

      const addSuccess = exchangeDiaryStorage.addReply(threadId, entryNumber, reply);

      if (!addSuccess) {
        throw new Error('添加回复失败');
      }

      exchangeDiaryStorage.updateEntry(threadId, entryNumber, {
        status: 'completed',
      });

      console.log('[回收站] 交换日记回复已添加');

      try {
        const { id } = parseRecycleBinFilename(recycleBinItem.filename);
        const deleteResult = await deleteRecycleBinItem(characterName, id);
        if (!deleteResult.success) {
          console.warn('[回收站] 删除回收站条目失败:', deleteResult.error);
        }
      } catch (deleteError) {
        console.warn('[回收站] 无法解析回收站文件名，跳过删除:', deleteError);
      }

      console.log('[回收站] 交换日记恢复完成');
      return { success: true };
    } catch (error) {
      console.error('[回收站] 恢复交换日记失败:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    saveRecycleBinAsDiary,
    restoreExchangeDiaryFromRecycleBin,
  };
}
