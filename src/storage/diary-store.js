export function createDiaryStore(dataStorageApi, diaryGroupStore = null) {
  function getCharacterDiariesList(allDiaries, characterName) {
    if (!Array.isArray(allDiaries[characterName])) {
      allDiaries[characterName] = [];
    }

    return allDiaries[characterName];
  }

  function getNextId(items) {
    if (items.length === 0) {
      return 1;
    }

    return Math.max(...items.map(item => Number(item.id) || 0)) + 1;
  }

  function normalizeRemark(remark) {
    return String(remark ?? '').trim();
  }

  function normalizeGroupName(groupName) {
    return String(groupName ?? '').trim();
  }

  function createDiary(diaryData, characterName, diaryId) {
    const remark = normalizeRemark(diaryData.remark);

    return {
      id: diaryId,
      title: diaryData.title,
      time: diaryData.time,
      content: diaryData.content,
      remark,
      author: characterName,
      createTime: new Date().toISOString(),
    };
  }

  async function loadStoredGroups(characterName) {
    if (typeof diaryGroupStore?.getDiaryGroups !== 'function') {
      return [];
    }

    return diaryGroupStore.getDiaryGroups(characterName);
  }

  async function loadStoredGroupAssignments(characterName) {
    if (typeof diaryGroupStore?.getDiaryGroupAssignments !== 'function') {
      return {};
    }

    return diaryGroupStore.getDiaryGroupAssignments(characterName);
  }

  async function addGroupsToDiaries(characterName, diaries) {
    const assignments = await loadStoredGroupAssignments(characterName);

    return diaries.map(diary => ({
      ...diary,
      group: normalizeGroupName(assignments[String(diary.id)]),
    }));
  }

  async function addGroupToDiary(characterName, diary) {
    if (!diary) {
      return null;
    }

    const group = typeof diaryGroupStore?.getDiaryGroup === 'function'
      ? await diaryGroupStore.getDiaryGroup(characterName, diary.id)
      : '';

    return {
      ...diary,
      group: normalizeGroupName(group),
    };
  }

  async function loadAllDiaries() {
    try {
      const data = await dataStorageApi.loadDiaries();
      console.log('[日记存储] 成功加载日记数据');
      return data;
    } catch (error) {
      console.error('[日记存储] 加载日记数据失败:', error);
      return {};
    }
  }

  async function saveAllDiaries(data) {
    try {
      const success = await dataStorageApi.saveDiaries(data);
      console.log('[日记存储] 成功保存日记数据');
      return success;
    } catch (error) {
      console.error('[日记存储] 保存日记数据失败:', error);
      return false;
    }
  }

  async function getNextDiaryId(characterName) {
    try {
      const allDiaries = await loadAllDiaries();
      return getNextId(getCharacterDiariesList(allDiaries, characterName));
    } catch (error) {
      console.error('[日记存储] 获取下一个日记 ID 失败:', error);
      return 1;
    }
  }

  async function saveDiaryToFile(diaryData, characterName) {
    try {
      console.log('[日记存储] 开始保存日记...');
      console.log('[日记存储] 角色名:', characterName);
      console.log('[日记存储] 日记标题:', diaryData.title);

      const allDiaries = await loadAllDiaries();
      const characterDiaries = getCharacterDiariesList(allDiaries, characterName);
      const diaryId = getNextId(characterDiaries);
      console.log('[日记存储] 日记 ID:', diaryId);

      characterDiaries.push(createDiary(diaryData, characterName, diaryId));

      const success = await saveAllDiaries(allDiaries);
      if (!success) {
        throw new Error('保存文件失败');
      }

      console.log('[日记存储] 日记保存成功, ID:', diaryId);
      return { success: true, diaryId: diaryId };
    } catch (error) {
      console.error('[日记存储] 保存日记失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function loadDiaryFromFile(characterName, diaryId) {
    try {
      const allDiaries = await loadAllDiaries();
      const characterDiaries = allDiaries[characterName] || [];

      const diary = characterDiaries.find(d => Number(d.id) === Number(diaryId));
      if (diary) {
        console.log('[日记存储] 日记加载成功:', diary.title);
        return addGroupToDiary(characterName, diary);
      }

      console.log('[日记存储] 未找到日记:', characterName, diaryId);
      return null;
    } catch (error) {
      console.error('[日记存储] 加载日记失败:', error);
      return null;
    }
  }

  async function getCharacterDiaries(characterName) {
    try {
      const allDiaries = await loadAllDiaries();
      const characterDiaries = allDiaries[characterName] || [];

      characterDiaries.sort((a, b) => Number(b.id) - Number(a.id));

      console.log(`[日记存储] 加载了 ${characterDiaries.length} 篇日记 (${characterName})`);
      return addGroupsToDiaries(characterName, characterDiaries);
    } catch (error) {
      console.error('[日记存储] 获取角色日记失败:', error);
      return [];
    }
  }

  async function getAllCharacters() {
    try {
      const allDiaries = await loadAllDiaries();
      const characters = Object.keys(allDiaries).filter(characterName => Array.isArray(allDiaries[characterName]));

      console.log(`[日记存储] 找到 ${characters.length} 个角色`, characters);
      return characters;
    } catch (error) {
      console.error('[日记存储] 获取角色列表失败:', error);
      return [];
    }
  }

  async function deleteDiaryFromFile(characterName, diaryId) {
    try {
      console.log('[日记存储] 删除日记:', characterName, diaryId);

      const allDiaries = await loadAllDiaries();
      const characterDiaries = allDiaries[characterName] || [];
      const filteredDiaries = characterDiaries.filter(d => Number(d.id) !== Number(diaryId));

      if (filteredDiaries.length === characterDiaries.length) {
        console.log('[日记存储] 未找到要删除的日记');
        return { success: false, error: '日记不存在' };
      }

      if (filteredDiaries.length === 0) {
        delete allDiaries[characterName];
      } else {
        allDiaries[characterName] = filteredDiaries;
      }

      const success = await saveAllDiaries(allDiaries);
      if (!success) {
        throw new Error('保存文件失败');
      }

      if (typeof diaryGroupStore?.removeDiaryGroupAssignments === 'function') {
        await diaryGroupStore.removeDiaryGroupAssignments(characterName, diaryId);
      }

      console.log('[日记存储] 日记删除成功');
      return { success: true };
    } catch (error) {
      console.error('[日记存储] 删除日记失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function updateDiaryRemark(characterName, diaryId, remark) {
    try {
      console.log('[日记存储] 更新日记备注:', characterName, diaryId);

      const allDiaries = await loadAllDiaries();
      const characterDiaries = allDiaries[characterName] || [];
      const targetDiary = characterDiaries.find(d => Number(d.id) === Number(diaryId));

      if (!targetDiary) {
        return { success: false, error: '日记不存在' };
      }

      const normalizedRemark = normalizeRemark(remark);
      targetDiary.remark = normalizedRemark;

      const success = await saveAllDiaries(allDiaries);
      if (!success) {
        throw new Error('保存文件失败');
      }

      return {
        success: true,
        diary: {
          ...targetDiary,
          remark: normalizedRemark,
        },
      };
    } catch (error) {
      console.error('[日记存储] 更新日记备注失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function getDiaryGroups(characterName) {
    try {
      return await loadStoredGroups(characterName);
    } catch (error) {
      console.error('[日记存储] 获取日记分组失败:', error);
      return [];
    }
  }

  async function createDiaryGroup(characterName, groupName) {
    try {
      const normalizedGroupName = normalizeGroupName(groupName);
      if (!normalizedGroupName) {
        return { success: false, error: '分组名不能为空' };
      }

      if (typeof diaryGroupStore?.createDiaryGroup !== 'function') {
        return { success: false, error: '分组设置存储不可用' };
      }

      return diaryGroupStore.createDiaryGroup(characterName, normalizedGroupName);
    } catch (error) {
      console.error('[日记存储] 创建日记分组失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function updateDiaryGroup(characterName, diaryIds, groupName) {
    try {
      const normalizedGroupName = normalizeGroupName(groupName);
      if (!normalizedGroupName) {
        return { success: false, error: '分组名不能为空' };
      }

      const normalizedDiaryIds = new Set((Array.isArray(diaryIds) ? diaryIds : [diaryIds]).map(id => Number(id)));
      if (!normalizedDiaryIds.size) {
        return { success: false, error: '未选择日记' };
      }

      const allDiaries = await loadAllDiaries();
      const characterDiaries = allDiaries[characterName] || [];
      const existingDiaryIds = new Set(characterDiaries.map(diary => Number(diary.id)));
      const existingSelectedDiaryIds = [...normalizedDiaryIds].filter(diaryId => existingDiaryIds.has(diaryId));

      if (!existingSelectedDiaryIds.length) {
        return { success: false, error: '未找到要加入分组的日记' };
      }

      if (typeof diaryGroupStore?.assignDiaryGroup !== 'function') {
        return { success: false, error: '分组设置存储不可用' };
      }

      return diaryGroupStore.assignDiaryGroup(characterName, existingSelectedDiaryIds, normalizedGroupName);
    } catch (error) {
      console.error('[日记存储] 更新日记分组失败:', error);
      return { success: false, error: error.message };
    }
  }

  async function deleteDiaryGroup(characterName, groupName) {
    try {
      const normalizedGroupName = normalizeGroupName(groupName);
      if (!normalizedGroupName) {
        return { success: false, error: '分组名不能为空' };
      }

      if (typeof diaryGroupStore?.deleteDiaryGroup === 'function') {
        return diaryGroupStore.deleteDiaryGroup(characterName, normalizedGroupName);
      }

      return { success: false, error: '分组设置存储不可用' };
    } catch (error) {
      console.error('[日记存储] 删除日记分组失败:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    loadAllDiaries,
    saveAllDiaries,
    getNextDiaryId,
    saveDiaryToFile,
    loadDiaryFromFile,
    getCharacterDiaries,
    getAllCharacters,
    deleteDiaryFromFile,
    updateDiaryRemark,
    getDiaryGroups,
    createDiaryGroup,
    updateDiaryGroup,
    deleteDiaryGroup,
  };
}
