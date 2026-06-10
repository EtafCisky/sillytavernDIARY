export const DEFAULT_DIARY_GROUP_DATA = {
  groups: {},
  assignments: {},
};

function normalizeGroupName(groupName) {
  return String(groupName ?? '').trim();
}

function normalizeDiaryId(diaryId) {
  return String(diaryId ?? '').trim();
}

function normalizeDiaryGroups(diaryGroups) {
  if (!diaryGroups || typeof diaryGroups !== 'object' || Array.isArray(diaryGroups)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(diaryGroups)
      .map(([characterName, groups]) => [
        String(characterName || '').trim(),
        [...new Set((Array.isArray(groups) ? groups : []).map(normalizeGroupName).filter(Boolean))],
      ])
      .filter(([characterName, groups]) => characterName && groups.length),
  );
}

function normalizeDiaryGroupAssignments(assignments) {
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(assignments)
      .map(([characterName, diaryAssignments]) => {
        const key = String(characterName || '').trim();
        if (!key || !diaryAssignments || typeof diaryAssignments !== 'object' || Array.isArray(diaryAssignments)) {
          return [key, {}];
        }

        return [
          key,
          Object.fromEntries(
            Object.entries(diaryAssignments)
              .map(([diaryId, groupName]) => [normalizeDiaryId(diaryId), normalizeGroupName(groupName)])
              .filter(([diaryId, groupName]) => diaryId && groupName),
          ),
        ];
      })
      .filter(([characterName, diaryAssignments]) => characterName && Object.keys(diaryAssignments).length),
  );
}

function collectGroupsFromAssignments(assignments) {
  const groupsByCharacter = {};

  for (const [characterName, diaryAssignments] of Object.entries(assignments)) {
    const groups = [...new Set(Object.values(diaryAssignments).map(normalizeGroupName).filter(Boolean))];
    if (groups.length) {
      groupsByCharacter[characterName] = groups;
    }
  }

  return groupsByCharacter;
}

function mergeDiaryGroupLists(existingGroups = {}, importedGroups = {}) {
  const mergedGroups = normalizeDiaryGroups(existingGroups);
  const normalizedImportedGroups = normalizeDiaryGroups(importedGroups);

  for (const [characterName, groups] of Object.entries(normalizedImportedGroups)) {
    mergedGroups[characterName] = [...new Set([...(mergedGroups[characterName] || []), ...groups])];
  }

  return mergedGroups;
}

export function normalizeDiaryGroupData(data = {}) {
  const normalized = {
    ...DEFAULT_DIARY_GROUP_DATA,
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
  };

  normalized.groups = mergeDiaryGroupLists(
    normalizeDiaryGroups(normalized.groups),
    collectGroupsFromAssignments(normalizeDiaryGroupAssignments(normalized.assignments)),
  );
  normalized.assignments = normalizeDiaryGroupAssignments(normalized.assignments);

  return normalized;
}

export function createDiaryGroupStore(fileStorageApi) {
  async function loadDiaryGroupData() {
    return normalizeDiaryGroupData(await fileStorageApi.load('diaryGroups'));
  }

  function loadDiaryGroupDataSync() {
    return normalizeDiaryGroupData(fileStorageApi.loadSync('diaryGroups'));
  }

  async function saveDiaryGroupData(data) {
    return fileStorageApi.save('diaryGroups', normalizeDiaryGroupData(data));
  }

  async function getDiaryGroups(characterName) {
    const data = await loadDiaryGroupData();
    const key = String(characterName || '').trim();
    return key ? [...(data.groups[key] || [])] : [];
  }

  async function getDiaryGroupAssignments(characterName) {
    const data = await loadDiaryGroupData();
    const key = String(characterName || '').trim();
    return key ? { ...(data.assignments[key] || {}) } : {};
  }

  async function getDiaryGroup(characterName, diaryId) {
    const assignments = await getDiaryGroupAssignments(characterName);
    return assignments[normalizeDiaryId(diaryId)] || '';
  }

  async function createDiaryGroup(characterName, groupName) {
    const key = String(characterName || '').trim();
    const normalizedGroupName = normalizeGroupName(groupName);
    if (!key || !normalizedGroupName) {
      return { success: false, error: '分组名不能为空' };
    }

    const data = await loadDiaryGroupData();
    const groups = data.groups[key] || [];

    if (!groups.includes(normalizedGroupName)) {
      data.groups[key] = [...groups, normalizedGroupName];
      const success = await saveDiaryGroupData(data);
      if (!success) {
        return { success: false, error: '保存分组设置失败' };
      }
    }

    return { success: true, groups: data.groups[key] || groups };
  }

  async function assignDiaryGroup(characterName, diaryIds, groupName) {
    const key = String(characterName || '').trim();
    const normalizedGroupName = normalizeGroupName(groupName);
    const normalizedDiaryIds = [
      ...new Set((Array.isArray(diaryIds) ? diaryIds : [diaryIds]).map(normalizeDiaryId).filter(Boolean)),
    ];

    if (!key || !normalizedGroupName) {
      return { success: false, error: '分组名不能为空' };
    }

    if (!normalizedDiaryIds.length) {
      return { success: false, error: '未选择日记' };
    }

    const data = await loadDiaryGroupData();
    const groups = data.groups[key] || [];

    if (!groups.includes(normalizedGroupName)) {
      data.groups[key] = [...groups, normalizedGroupName];
    }

    data.assignments[key] = {
      ...(data.assignments[key] || {}),
      ...Object.fromEntries(normalizedDiaryIds.map(diaryId => [diaryId, normalizedGroupName])),
    };

    const success = await saveDiaryGroupData(data);

    return success
      ? {
          success: true,
          updatedCount: normalizedDiaryIds.length,
          groups: data.groups[key] || [],
          assignments: { ...(data.assignments[key] || {}) },
        }
      : { success: false, error: '保存分组设置失败' };
  }

  async function deleteDiaryGroup(characterName, groupName) {
    const key = String(characterName || '').trim();
    const normalizedGroupName = normalizeGroupName(groupName);
    if (!key || !normalizedGroupName) {
      return { success: false, error: '分组名不能为空' };
    }

    const data = await loadDiaryGroupData();
    const groups = data.groups[key] || [];
    data.groups[key] = groups.filter(group => group !== normalizedGroupName);

    if (data.groups[key].length === 0) {
      delete data.groups[key];
    }

    if (data.assignments[key]) {
      data.assignments[key] = Object.fromEntries(
        Object.entries(data.assignments[key]).filter(([, group]) => group !== normalizedGroupName),
      );

      if (Object.keys(data.assignments[key]).length === 0) {
        delete data.assignments[key];
      }
    }

    const success = await saveDiaryGroupData(data);
    return success
      ? { success: true, groups: data.groups[key] || [] }
      : { success: false, error: '保存分组设置失败' };
  }

  async function removeDiaryGroupAssignments(characterName, diaryIds) {
    const key = String(characterName || '').trim();
    const normalizedDiaryIds = [
      ...new Set((Array.isArray(diaryIds) ? diaryIds : [diaryIds]).map(normalizeDiaryId).filter(Boolean)),
    ];

    if (!key || !normalizedDiaryIds.length) {
      return { success: true, removedCount: 0 };
    }

    const data = await loadDiaryGroupData();
    const assignments = data.assignments[key] || {};
    let removedCount = 0;

    normalizedDiaryIds.forEach(diaryId => {
      if (assignments[diaryId]) {
        delete assignments[diaryId];
        removedCount += 1;
      }
    });

    if (Object.keys(assignments).length) {
      data.assignments[key] = assignments;
    } else {
      delete data.assignments[key];
    }

    const success = await saveDiaryGroupData(data);

    return success
      ? { success: true, removedCount }
      : { success: false, error: '保存分组设置失败' };
  }

  return {
    loadDiaryGroupData,
    loadDiaryGroupDataSync,
    saveDiaryGroupData,
    getDiaryGroups,
    getDiaryGroupAssignments,
    getDiaryGroup,
    createDiaryGroup,
    assignDiaryGroup,
    deleteDiaryGroup,
    removeDiaryGroupAssignments,
  };
}
