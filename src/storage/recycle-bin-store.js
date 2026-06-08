export function createRecycleBinStore(dataStorageApi) {
  function getCharacterItems(allRecycleBin, characterName) {
    if (!Array.isArray(allRecycleBin[characterName])) {
      allRecycleBin[characterName] = [];
    }

    return allRecycleBin[characterName];
  }

  function getNextNumber(items) {
    if (items.length === 0) {
      return 1;
    }

    return Math.max(...items.map(item => Number(item.id) || 0)) + 1;
  }

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

  function createRecycleBinItem(content, id, failureReason) {
    return {
      id,
      content,
      failureReason,
      saveTime: new Date().toLocaleString('zh-CN'),
    };
  }

  function toRecycleBinFile(characterName, item) {
    return {
      filename: `${characterName}_${item.id}`,
      characterName,
      number: item.id,
      content: item.content,
      type: item.type || 'normal',
      metadata: {
        角色名: characterName,
        序号: item.id,
        失败原因: item.failureReason,
        保存时间: item.saveTime,
        类型: item.type || 'normal',
        ...(item.type === 'exchange_diary' && {
          线程ID: item.threadId,
          条目编号: item.entryNumber,
          原始提示词: item.originalPrompt,
        }),
      },
    };
  }

  async function loadAllRecycleBin() {
    try {
      const data = await dataStorageApi.loadRecycleBin();
      console.log('[回收站] 成功加载回收站数据');
      return data;
    } catch (error) {
      console.error('[回收站] 加载回收站数据失败:', error);
      return {};
    }
  }

  async function saveAllRecycleBin(data) {
    try {
      const success = await dataStorageApi.saveRecycleBin(data);
      console.log('[回收站] 成功保存回收站数据');
      return success;
    } catch (error) {
      console.error('[回收站] 保存回收站数据失败:', error);
      return false;
    }
  }

  async function getNextRecycleBinNumber(characterName) {
    try {
      const allRecycleBin = await loadAllRecycleBin();
      return getNextNumber(getCharacterItems(allRecycleBin, characterName));
    } catch (error) {
      console.error('[回收站] 获取下一个序号失败:', error);
      return 1;
    }
  }

  async function saveToRecycleBinFile(content, characterName, failureReason = '未知原因') {
    try {
      console.log('[回收站] 保存到回收站...');
      console.log('[回收站] 角色名:', characterName);
      console.log('[回收站] 失败原因:', failureReason);

      const allRecycleBin = await loadAllRecycleBin();
      const characterRecycleBin = getCharacterItems(allRecycleBin, characterName);
      const id = getNextNumber(characterRecycleBin);
      console.log('[回收站] 序号:', id);

      characterRecycleBin.push(createRecycleBinItem(content, id, failureReason));

      const success = await saveAllRecycleBin(allRecycleBin);
      if (!success) {
        throw new Error('保存文件失败');
      }

      console.log('[回收站] 保存成功, ID:', id);
      return { success: true, id: id };
    } catch (error) {
      console.error('[回收站] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function loadRecycleBinItem(characterName, id) {
    try {
      const allRecycleBin = await loadAllRecycleBin();
      const characterRecycleBin = allRecycleBin[characterName] || [];

      const item = characterRecycleBin.find(r => Number(r.id) === Number(id));
      if (item) {
        console.log('[回收站] 条目加载成功:', id);
        return {
          ...item,
          characterName: characterName,
        };
      }

      console.log('[回收站] 未找到条目:', characterName, id);
      return null;
    } catch (error) {
      console.error('[回收站] 加载条目失败:', error);
      return null;
    }
  }

  async function getAllRecycleBinFiles() {
    try {
      const allRecycleBin = await loadAllRecycleBin();
      const groupedFiles = {};

      for (const characterName in allRecycleBin) {
        const characterRecycleBin = Array.isArray(allRecycleBin[characterName]) ? allRecycleBin[characterName] : [];
        groupedFiles[characterName] = characterRecycleBin.map(item => toRecycleBinFile(characterName, item));

        groupedFiles[characterName].sort((a, b) => a.number - b.number);
      }

      const totalCount = Object.values(groupedFiles).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`[回收站] 加载了 ${totalCount} 个条目`);
      return groupedFiles;
    } catch (error) {
      console.error('[回收站] 获取文件列表失败:', error);
      return {};
    }
  }

  async function deleteRecycleBinItem(characterName, id) {
    try {
      console.log('[回收站] 删除条目:', characterName, id);

      const allRecycleBin = await loadAllRecycleBin();
      const characterRecycleBin = allRecycleBin[characterName] || [];
      const filteredRecycleBin = characterRecycleBin.filter(r => Number(r.id) !== Number(id));

      if (filteredRecycleBin.length === characterRecycleBin.length) {
        console.log('[回收站] 未找到要删除的条目');
        return { success: false, error: '条目不存在' };
      }

      if (filteredRecycleBin.length === 0) {
        delete allRecycleBin[characterName];
      } else {
        allRecycleBin[characterName] = filteredRecycleBin;
      }

      const success = await saveAllRecycleBin(allRecycleBin);
      if (!success) {
        throw new Error('保存文件失败');
      }

      console.log('[回收站] 条目删除成功');
      return { success: true };
    } catch (error) {
      console.error('[回收站] 删除条目失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function deleteRecycleBinFile(filename) {
    try {
      const { characterName, id } = parseRecycleBinFilename(filename);

      return await deleteRecycleBinItem(characterName, id);
    } catch (error) {
      console.error('[回收站] 删除文件失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function clearRecycleBinFiles() {
    try {
      console.log('[回收站] 清空回收站...');

      const allRecycleBin = await loadAllRecycleBin();
      const totalCount = Object.values(allRecycleBin).reduce((sum, arr) => sum + arr.length, 0);

      const success = await saveAllRecycleBin({});
      if (!success) {
        throw new Error('保存文件失败');
      }

      console.log(`[回收站] 清空完成, 删除了 ${totalCount} 个条目`);
      return { success: true, deletedCount: totalCount };
    } catch (error) {
      console.error('[回收站] 清空失败:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    loadAllRecycleBin,
    saveAllRecycleBin,
    getNextRecycleBinNumber,
    saveToRecycleBinFile,
    loadRecycleBinItem,
    getAllRecycleBinFiles,
    deleteRecycleBinItem,
    deleteRecycleBinFile,
    clearRecycleBinFiles,
  };
}
