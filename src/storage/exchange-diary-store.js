const DEFAULT_EXCHANGE_DIARIES = {
  threads: {},
  config: {
    enableNotifications: true,
    triggerWindowMin: 1,
    triggerWindowMax: 10,
    maxRerollsPerEntry: 5,
    ghostwritePrompt: '',
  },
  threadCounters: {},
  triggeredEntries: {},
};

function createDefaultExchangeDiaries() {
  return {
    threads: {},
    config: { ...DEFAULT_EXCHANGE_DIARIES.config },
    threadCounters: {},
    triggeredEntries: {},
  };
}

function normalizeExchangeDiaries(data) {
  return {
    ...createDefaultExchangeDiaries(),
    ...data,
    threads: data?.threads || {},
    config: {
      ...DEFAULT_EXCHANGE_DIARIES.config,
      ...(data?.config || {}),
    },
    threadCounters: data?.threadCounters || {},
    triggeredEntries: data?.triggeredEntries || {},
  };
}

export function createExchangeDiaryStorage({ extensionSettings, extensionName, saveSettings, fileStorageApi }) {
  function loadAll() {
    try {
      if (fileStorageApi) {
        return normalizeExchangeDiaries(fileStorageApi.loadSync('exchangeDiaries'));
      }

      const settings = extensionSettings[extensionName] || {};
      return normalizeExchangeDiaries(settings.exchangeDiaries || createDefaultExchangeDiaries());
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to load data:', error);
      return createDefaultExchangeDiaries();
    }
  }

  function saveAll(data) {
    try {
      const normalizedData = normalizeExchangeDiaries(data);
      if (fileStorageApi) {
        return fileStorageApi.saveQueued('exchangeDiaries', normalizedData);
      }

      if (!extensionSettings[extensionName]) {
        extensionSettings[extensionName] = {};
      }

      extensionSettings[extensionName].exchangeDiaries = normalizedData;
      saveSettings();
      return true;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to save data:', error);
      return false;
    }
  }

  function withDataUpdate(updateData) {
    const data = loadAll();
    const result = updateData(data);

    if (result === false) {
      return false;
    }

    const saved = saveAll(data);
    return saved ? result : false;
  }

  function getMutableThread(data, threadId) {
    const thread = data.threads[threadId];
    if (!thread) {
      console.error(`[Exchange Diary Storage] Thread not found: ${threadId}`);
      return null;
    }

    if (!Array.isArray(thread.entries)) {
      thread.entries = [];
    }

    return thread;
  }

  function findEntryIndex(thread, entryNumber) {
    return thread.entries.findIndex(entry => Number(entry.entryNumber) === Number(entryNumber));
  }

  function getNextEntryNumber(thread) {
    if (!Array.isArray(thread.entries) || thread.entries.length === 0) {
      return 1;
    }

    return Math.max(...thread.entries.map(entry => Number(entry.entryNumber) || 0)) + 1;
  }

  function getSelectedReplyIndex(entry) {
    const replies = Array.isArray(entry?.characterReplies) ? entry.characterReplies : [];
    const selectedIndex = Number(entry?.selectedReplyIndex);

    if (Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < replies.length) {
      return selectedIndex;
    }

    return 0;
  }

  function getMutableEntry(data, threadId, entryNumber) {
    const thread = getMutableThread(data, threadId);
    if (!thread) {
      return null;
    }

    const entryIndex = findEntryIndex(thread, entryNumber);
    if (entryIndex === -1) {
      console.error(`[Exchange Diary Storage] Entry not found: ${threadId}, entry ${entryNumber}`);
      return null;
    }

    return {
      thread,
      entry: thread.entries[entryIndex],
      entryIndex,
    };
  }

  function touchThread(thread) {
    thread.updatedAt = new Date().toISOString();
  }

  function getNextThreadNumber(data, characterName) {
    const counterNumber = Number(data.threadCounters?.[characterName]) || 1;
    const maxExistingThreadNumber = Object.values(data.threads || {})
      .filter(thread => thread?.characterName === characterName)
      .reduce((maxThreadNumber, thread) => Math.max(maxThreadNumber, Number(thread.threadNumber) || 0), 0);

    let threadNumber = Math.max(counterNumber, maxExistingThreadNumber + 1, 1);
    while (data.threads[`${characterName}-${threadNumber}`]) {
      threadNumber += 1;
    }

    return threadNumber;
  }

  function createThread(characterName, threadName = null) {
    try {
      return withDataUpdate(data => {
        const threadNumber = getNextThreadNumber(data, characterName);
        const threadId = `${characterName}-${threadNumber}`;
        const now = new Date().toISOString();

        const thread = {
          threadId,
          threadName: threadName || `交换日记-${threadNumber}`,
          characterName,
          threadNumber,
          entries: [],
          createdAt: now,
          updatedAt: now,
          status: 'active',
        };

        data.threads[threadId] = thread;
        data.threadCounters[characterName] = threadNumber + 1;
        console.log(`[Exchange Diary Storage] Created thread: ${threadId}`);
        return thread;
      }) || null;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to create thread:', error);
      return null;
    }
  }

  function getThread(threadId) {
    try {
      const data = loadAll();
      return data.threads[threadId] || null;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to get thread:', error);
      return null;
    }
  }

  function getAllThreads(characterName) {
    try {
      const data = loadAll();
      return Object.values(data.threads)
        .filter(thread => thread.characterName === characterName)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to get character threads:', error);
      return [];
    }
  }

  function updateThread(threadId, updates) {
    try {
      return Boolean(withDataUpdate(data => {
        const thread = getMutableThread(data, threadId);
        if (!thread) {
          return false;
        }

        data.threads[threadId] = {
          ...thread,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to update thread:', error);
      return false;
    }
  }

  function deleteThread(threadId) {
    try {
      return Boolean(withDataUpdate(data => {
        if (!data.threads[threadId]) {
          console.error(`[Exchange Diary Storage] Thread not found: ${threadId}`);
          return false;
        }

        delete data.threads[threadId];
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to delete thread:', error);
      return false;
    }
  }

  function addEntry(threadId, userDiary) {
    try {
      return withDataUpdate(data => {
        const thread = getMutableThread(data, threadId);
        if (!thread) {
          return false;
        }

        const now = new Date().toISOString();
        const entryNumber = getNextEntryNumber(thread);
        const entry = {
          entryNumber,
          userDiary: {
            ...userDiary,
            writtenAt: now,
          },
          characterReplies: [],
          selectedReplyIndex: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        };

        thread.entries.push(entry);
        touchThread(thread);
        return entry;
      }) || null;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to add entry:', error);
      return null;
    }
  }

  function getEntry(threadId, entryNumber) {
    try {
      const thread = getThread(threadId);
      if (!thread || !Array.isArray(thread.entries)) {
        return null;
      }

      return thread.entries.find(entry => Number(entry.entryNumber) === Number(entryNumber)) || null;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to get entry:', error);
      return null;
    }
  }

  function updateEntry(threadId, entryNumber, updates) {
    try {
      return Boolean(withDataUpdate(data => {
        const entryData = getMutableEntry(data, threadId, entryNumber);
        if (!entryData) {
          return false;
        }

        entryData.thread.entries[entryData.entryIndex] = {
          ...entryData.entry,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        touchThread(entryData.thread);
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to update entry:', error);
      return false;
    }
  }

  function getPendingEntries(characterName = null) {
    try {
      const data = loadAll();
      const pendingEntries = [];

      Object.entries(data.threads).forEach(([threadId, thread]) => {
        if (characterName && thread.characterName !== characterName) {
          return;
        }

        (thread.entries || []).forEach(entry => {
          if (entry.status === 'pending') {
            pendingEntries.push({
              threadId,
              threadName: thread.threadName,
              characterName: thread.characterName,
              entry,
            });
          }
        });
      });

      return pendingEntries;
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to get pending entries:', error);
      return [];
    }
  }

  function addReply(threadId, entryNumber, reply) {
    try {
      return Boolean(withDataUpdate(data => {
        const entryData = getMutableEntry(data, threadId, entryNumber);
        if (!entryData) {
          return false;
        }

        const { thread, entry } = entryData;
        if (!Array.isArray(entry.characterReplies)) {
          entry.characterReplies = [];
        }

        const replyWithMetadata = {
          ...reply,
          triggeredAt: new Date().toISOString(),
          isReroll: entry.characterReplies.length > 0,
          rerollIndex: entry.characterReplies.length,
        };

        entry.characterReplies.push(replyWithMetadata);
        entry.updatedAt = new Date().toISOString();
        touchThread(thread);
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to add reply:', error);
      return false;
    }
  }

  function selectReply(threadId, entryNumber, rerollIndex) {
    try {
      return Boolean(withDataUpdate(data => {
        const entryData = getMutableEntry(data, threadId, entryNumber);
        if (!entryData) {
          return false;
        }

        const { thread, entry } = entryData;
        if (!Array.isArray(entry.characterReplies)) {
          entry.characterReplies = [];
        }

        const selectedIndex = Number(rerollIndex);
        if (selectedIndex < 0 || selectedIndex >= entry.characterReplies.length) {
          console.error(`[Exchange Diary Storage] Invalid reply index: ${selectedIndex}`);
          return false;
        }

        entry.selectedReplyIndex = selectedIndex;
        entry.updatedAt = new Date().toISOString();
        touchThread(thread);
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to select reply:', error);
      return false;
    }
  }

  function deleteUnselectedReplies(threadId, entryNumber) {
    try {
      return Boolean(withDataUpdate(data => {
        const entryData = getMutableEntry(data, threadId, entryNumber);
        if (!entryData) {
          return false;
        }

        const { thread, entry } = entryData;
        const selectedReply = entry.characterReplies?.[getSelectedReplyIndex(entry)];
        if (!selectedReply) {
          console.error('[Exchange Diary Storage] Selected reply not found');
          return false;
        }

        entry.characterReplies = [selectedReply];
        entry.selectedReplyIndex = 0;
        entry.updatedAt = new Date().toISOString();
        touchThread(thread);
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to delete unselected replies:', error);
      return false;
    }
  }

  function getConfig() {
    return loadAll().config;
  }

  function updateConfig(updates) {
    try {
      return Boolean(withDataUpdate(data => {
        data.config = {
          ...DEFAULT_EXCHANGE_DIARIES.config,
          ...data.config,
          ...updates,
        };
        return true;
      }));
    } catch (error) {
      console.error('[Exchange Diary Storage] Failed to update config:', error);
      return false;
    }
  }

  return {
    loadAll,
    saveAll,
    createThread,
    getThread,
    getAllThreads,
    updateThread,
    deleteThread,
    addEntry,
    getEntry,
    updateEntry,
    getPendingEntries,
    addReply,
    selectReply,
    deleteUnselectedReplies,
    getConfig,
    updateConfig,
  };
}
