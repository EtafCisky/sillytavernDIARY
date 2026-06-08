export function createImportExportManager({
  pluginVersion,
  loadAllDiaries,
  saveAllDiaries,
  loadAllRecycleBin,
  saveAllRecycleBin,
  exchangeDiaryStorage,
  loadLegacyStorageSnapshot = () => ({ diaries: {}, recycleBin: {}, exchangeDiaries: {} }),
  getFileStorageStatus = () => ({}),
  notify,
  confirmImport = message => confirm(message),
}) {
  function getExchangeDiaryStats(exchangeDiaries) {
    const threads = exchangeDiaries?.threads || {};
    return {
      exchangeDiaryThreads: Object.keys(threads).length,
      exchangeDiaryEntries: Object.values(threads).reduce((sum, thread) => sum + (thread.entries?.length || 0), 0),
    };
  }

  function downloadJson(exportData) {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportDiaryData() {
    try {
      console.log('[导出数据] 开始导出...');

      const diaries = await loadAllDiaries();
      const recycleBin = await loadAllRecycleBin();
      const exchangeDiaries = exchangeDiaryStorage.loadAll();
      const settingsBackup = loadLegacyStorageSnapshot();
      const exchangeStats = getExchangeDiaryStats(exchangeDiaries);

      const exportData = {
        version: pluginVersion,
        exportTime: new Date().toISOString(),
        exportTimeReadable: new Date().toLocaleString('zh-CN'),
        data: {
          diaries,
          recycleBin,
          exchangeDiaries,
        },
        storageBackup: {
          note: 'data 是当前插件正在读取的数据；settings 是 extension_settings 中残留的旧仓库备份，用于迁移前后兜底。',
          activeSourceStatus: getFileStorageStatus(),
          settings: settingsBackup,
        },
        statistics: {
          totalDiaries: Object.values(diaries).reduce((sum, arr) => sum + arr.length, 0),
          totalRecycleBin: Object.values(recycleBin).reduce((sum, arr) => sum + arr.length, 0),
          characters: Object.keys(diaries).length,
          ...exchangeStats,
        },
      };

      downloadJson(exportData);

      console.log('[导出数据] 导出成功');
      notify.success(
        `导出完成！\n\n` +
          `日记: ${exportData.statistics.totalDiaries} 篇\n` +
          `回收站: ${exportData.statistics.totalRecycleBin} 条\n` +
          `角色: ${exportData.statistics.characters} 个\n` +
          `交换日记线程: ${exportData.statistics.exchangeDiaryThreads} 个\n` +
          `交换日记条目: ${exportData.statistics.exchangeDiaryEntries} 条\n\n` +
          `本次备份已同时包含：当前读取数据 + settings 旧仓库备份。`,
        '数据导出',
        { timeOut: 5000 },
      );
    } catch (error) {
      console.error('[导出数据] 导出失败:', error);
      notify.error(`导出失败: ${error.message}`, '数据导出');
    }
  }

  function buildImportConfirmMessage(importData) {
    return (
      `确认导入数据？\n\n` +
      `导出版本: ${importData.version}\n` +
      `导出时间: ${importData.exportTimeReadable || '未知'}\n` +
      `日记: ${importData.statistics?.totalDiaries || 0} 篇\n` +
      `回收站: ${importData.statistics?.totalRecycleBin || 0} 条\n` +
      `角色: ${importData.statistics?.characters || 0} 个\n` +
      `交换日记线程: ${importData.statistics?.exchangeDiaryThreads || 0} 个\n` +
      `交换日记条目: ${importData.statistics?.exchangeDiaryEntries || 0} 条\n\n` +
      `导入的数据会与现有数据合并（不会覆盖）`
    );
  }

  function getMaxNumericId(items) {
    return (Array.isArray(items) ? items : []).reduce((maxId, item) => Math.max(maxId, Number(item?.id) || 0), 0);
  }

  function mergeDiaries(existingDiaries, importedDiaries = {}) {
    const mergedDiaries = { ...existingDiaries };

    for (const characterName in importedDiaries) {
      if (!mergedDiaries[characterName]) {
        mergedDiaries[characterName] = [];
      }

      const maxId = getMaxNumericId(mergedDiaries[characterName]);

      const remappedDiaries = importedDiaries[characterName].map((diary, index) => ({
        ...diary,
        id: maxId + index + 1,
        createTime: diary.createTime || new Date().toISOString(),
      }));

      mergedDiaries[characterName].push(...remappedDiaries);
    }

    return mergedDiaries;
  }

  function mergeRecycleBin(existingRecycleBin, importedRecycleBinData = {}) {
    const mergedRecycleBin = { ...existingRecycleBin };

    for (const characterName in importedRecycleBinData) {
      if (!mergedRecycleBin[characterName]) {
        mergedRecycleBin[characterName] = [];
      }

      const maxId = getMaxNumericId(mergedRecycleBin[characterName]);

      const remappedRecycleBin = importedRecycleBinData[characterName].map((item, index) => ({
        ...item,
        id: maxId + index + 1,
        saveTime: item.saveTime || new Date().toLocaleString('zh-CN'),
      }));

      mergedRecycleBin[characterName].push(...remappedRecycleBin);
    }

    return mergedRecycleBin;
  }

  function getNextExchangeThreadNumber(exchangeDiaries, characterName) {
    const counterNumber = Number(exchangeDiaries.threadCounters?.[characterName]) || 1;
    const maxExistingThreadNumber = Object.values(exchangeDiaries.threads || {})
      .filter(thread => thread?.characterName === characterName)
      .reduce((maxThreadNumber, thread) => Math.max(maxThreadNumber, Number(thread.threadNumber) || 0), 0);

    return Math.max(counterNumber, maxExistingThreadNumber + 1, 1);
  }

  function allocateExchangeThreadId(exchangeDiaries, characterName) {
    let threadNumber = getNextExchangeThreadNumber(exchangeDiaries, characterName);
    let threadId = `${characterName}-${threadNumber}`;

    while (exchangeDiaries.threads[threadId]) {
      threadNumber += 1;
      threadId = `${characterName}-${threadNumber}`;
    }

    exchangeDiaries.threadCounters[characterName] = threadNumber + 1;
    return { threadId, threadNumber };
  }

  function updateExchangeThreadCounter(exchangeDiaries, characterName, threadNumber) {
    const nextThreadNumber = (Number(threadNumber) || 0) + 1;
    exchangeDiaries.threadCounters[characterName] = Math.max(
      Number(exchangeDiaries.threadCounters[characterName]) || 1,
      nextThreadNumber,
    );
  }

  function mergeExchangeDiaries(existingExchangeDiaries, importedExchangeDiaries) {
    const mergedExchangeDiaries = { ...existingExchangeDiaries };
    if (!mergedExchangeDiaries.threads) {
      mergedExchangeDiaries.threads = {};
    }
    if (!mergedExchangeDiaries.threadCounters) {
      mergedExchangeDiaries.threadCounters = {};
    }

    if (!importedExchangeDiaries) {
      return mergedExchangeDiaries;
    }

    if (importedExchangeDiaries.threads) {
      for (const threadId in importedExchangeDiaries.threads) {
        const importedThread = importedExchangeDiaries.threads[threadId];
        const characterName = importedThread.characterName;

        if (mergedExchangeDiaries.threads[threadId]) {
          const { threadId: newThreadId, threadNumber: newThreadNumber } = allocateExchangeThreadId(
            mergedExchangeDiaries,
            characterName,
          );

          mergedExchangeDiaries.threads[newThreadId] = {
            ...importedThread,
            threadId: newThreadId,
            threadNumber: newThreadNumber,
          };

          console.log(`[导入数据] 线程ID冲突，重新分配: ${threadId} -> ${newThreadId}`);
        } else {
          mergedExchangeDiaries.threads[threadId] = {
            ...importedThread,
            threadId,
          };
          updateExchangeThreadCounter(mergedExchangeDiaries, characterName, importedThread.threadNumber);
        }
      }
    }

    if (importedExchangeDiaries.config) {
      mergedExchangeDiaries.config = {
        ...importedExchangeDiaries.config,
        ...mergedExchangeDiaries.config,
      };
    }

    return mergedExchangeDiaries;
  }

  async function processImportData(importData) {
    if (!importData.version || !importData.data) {
      throw new Error('无效的数据格式');
    }

    if (!confirmImport(buildImportConfirmMessage(importData))) {
      notify.info('已取消导入', '数据导入');
      return;
    }

    const existingDiaries = await loadAllDiaries();
    const existingRecycleBin = await loadAllRecycleBin();
    const existingExchangeDiaries = exchangeDiaryStorage.loadAll();

    const mergedDiaries = mergeDiaries(existingDiaries, importData.data.diaries);
    const mergedRecycleBin = mergeRecycleBin(existingRecycleBin, importData.data.recycleBin);
    const mergedExchangeDiaries = mergeExchangeDiaries(existingExchangeDiaries, importData.data.exchangeDiaries);

    await saveAllDiaries(mergedDiaries);
    await saveAllRecycleBin(mergedRecycleBin);
    exchangeDiaryStorage.saveAll(mergedExchangeDiaries);

    const totalDiaries = Object.values(mergedDiaries).reduce((sum, arr) => sum + arr.length, 0);
    const totalRecycleBin = Object.values(mergedRecycleBin).reduce((sum, arr) => sum + arr.length, 0);
    const exchangeStats = getExchangeDiaryStats(mergedExchangeDiaries);

    console.log('[导入数据] 导入成功');
    notify.success(
      `导入完成！\n\n` +
        `当前日记总数: ${totalDiaries} 篇\n` +
        `当前回收站总数: ${totalRecycleBin} 条\n` +
        `当前交换日记线程: ${exchangeStats.exchangeDiaryThreads} 个\n` +
        `当前交换日记条目: ${exchangeStats.exchangeDiaryEntries} 条`,
      '数据导入',
      { timeOut: 5000 },
    );
  }

  async function importDiaryData(event) {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      console.log('[导入数据] 开始导入:', file.name);

      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const importData = JSON.parse(e.target.result);
          await processImportData(importData);
        } catch (error) {
          console.error('[导入数据] 解析或保存失败:', error);
          notify.error(`导入失败: ${error.message}`, '数据导入');
        }
      };

      reader.onerror = () => {
        console.error('[导入数据] 文件读取失败');
        notify.error('文件读取失败', '数据导入');
      };

      reader.readAsText(file);
      event.target.value = '';
    } catch (error) {
      console.error('[导入数据] 导入失败:', error);
      notify.error(`导入失败: ${error.message}`, '数据导入');
    }
  }

  return {
    exportDiaryData,
    importDiaryData,
    processImportData,
    mergeDiaries,
    mergeRecycleBin,
    mergeExchangeDiaries,
  };
}
