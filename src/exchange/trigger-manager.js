export function createTriggerManager({
  isAIGenerating,
  getCurrentCharacter,
  getCurrentFloor,
  getContext,
  exchangeDiaryStorage,
  formatValidator,
  promptBuilder,
  executeSlashCommandsWithOptions,
  customApiClient,
  saveToRecycleBinFile,
  loadAllRecycleBin,
  saveAllRecycleBin,
  notify = () => {},
  scheduleInterval = setInterval,
  cancelInterval = clearInterval,
}) {
  const TRIGGER_CHECK_INTERVAL_MS = 3000;
  const LEGACY_TRIGGER_PROBABILITY = 0.2;

  class TriggerManager {
    constructor() {
      this.checkInterval = null;
      this.isChecking = false;
      this.lastCheckedChatLength = 0;
      this.pendingCheck = false;
      this.lastAIGeneratingState = false;
    }

    start() {
      if (this.checkInterval) {
        console.log('[TriggerManager] Already running');
        return;
      }

      console.log('[TriggerManager] Started polling for exchange diary triggers');
      this.checkInterval = scheduleInterval(() => {
        void this.checkAndTrigger();
      }, TRIGGER_CHECK_INTERVAL_MS);
    }

    stop() {
      if (!this.checkInterval) {
        return;
      }

      cancelInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[TriggerManager] Stopped polling for exchange diary triggers');
    }

    async checkAndTrigger() {
      if (this.handleAIGenerationState(isAIGenerating())) {
        return;
      }

      if (this.isChecking) {
        return;
      }

      try {
        this.isChecking = true;

        const currentFloor = this.getCurrentFloor();
        if (this.shouldSkipCurrentFloor(currentFloor)) {
          return;
        }

        const currentCharacter = getCurrentCharacter();
        if (!this.canCheckCharacter(currentCharacter, currentFloor)) {
          return;
        }

        const context = getContext();
        const chatMetadata = this.ensureExchangeDiaryMetadata(context);
        const chatPendingEntries = this.getChatPendingEntries(currentCharacter, chatMetadata);

        if (chatPendingEntries.length === 0) {
          return;
        }

        this.logPendingEntries(currentCharacter, currentFloor, chatPendingEntries.length);

        const triggeredEntries = this.getTriggeredEntries();
        for (const pendingEntry of chatPendingEntries) {
          const { threadId, entry } = pendingEntry;
          const entryKey = this.getEntryKey(threadId, entry.entryNumber);

          if (triggeredEntries[entryKey]) {
            console.log(`[TriggerManager] Entry already triggered, skipping: ${entryKey}`);
            continue;
          }

          if (!this.checkTriggerConditions(entry, currentFloor)) {
            continue;
          }

          console.log(`[TriggerManager] Trigger conditions met: ${threadId}, entry ${entry.entryNumber}`);
          this.markAsTriggered(entryKey);
          this.removePendingEntry(chatMetadata, entryKey);
          context.saveMetadata();
          await this.executeTrigger(threadId, entry);
          break;
        }
      } catch (error) {
        console.error('[TriggerManager] Failed while checking triggers:', error);
      } finally {
        this.isChecking = false;
      }
    }

    handleAIGenerationState(currentAIGenerating) {
      if (currentAIGenerating) {
        if (!this.lastAIGeneratingState) {
          console.log('[TriggerManager] AI generation detected, deferring trigger check');
        }

        this.pendingCheck = true;
        this.lastAIGeneratingState = true;
        return true;
      }

      if (this.lastAIGeneratingState) {
        console.log('[TriggerManager] AI generation finished, resuming pending trigger check');
        this.pendingCheck = false;
      }

      this.lastAIGeneratingState = false;
      return false;
    }

    shouldSkipCurrentFloor(currentFloor) {
      if (currentFloor === this.lastCheckedChatLength && !this.pendingCheck) {
        return true;
      }

      this.lastCheckedChatLength = currentFloor;
      this.pendingCheck = false;
      return false;
    }

    canCheckCharacter(currentCharacter, currentFloor) {
      return Boolean(currentCharacter) && currentFloor !== 0;
    }

    ensureExchangeDiaryMetadata(context) {
      const chatMetadata = context.chatMetadata ?? (context.chatMetadata = {});

      if (!chatMetadata.exchangeDiary) {
        chatMetadata.exchangeDiary = {
          pendingEntries: [],
        };
      }

      return chatMetadata;
    }

    getChatPendingEntries(currentCharacter, chatMetadata) {
      const allPendingEntries = exchangeDiaryStorage.getPendingEntries(currentCharacter);
      if (allPendingEntries.length === 0) {
        return [];
      }

      const pendingEntryKeys = new Set(chatMetadata.exchangeDiary.pendingEntries || []);

      return allPendingEntries.filter(pendingEntry => {
        const { threadId, entry } = pendingEntry;
        return pendingEntryKeys.has(this.getEntryKey(threadId, entry.entryNumber));
      });
    }

    logPendingEntries(currentCharacter, currentFloor, pendingCount) {
      console.log(
        `[TriggerManager] Character: ${currentCharacter}, floor: ${currentFloor}, pending entries: ${pendingCount}`,
      );
    }

    getEntryKey(threadId, entryNumber) {
      return `${threadId}-${entryNumber}`;
    }

    removePendingEntry(chatMetadata, entryKey) {
      const pendingEntries = chatMetadata.exchangeDiary.pendingEntries;
      const index = pendingEntries.indexOf(entryKey);

      if (index > -1) {
        pendingEntries.splice(index, 1);
      }
    }

    getCurrentFloor() {
      try {
        return getCurrentFloor();
      } catch (error) {
        console.error('[TriggerManager] Failed to get current floor:', error);
        return 0;
      }
    }

    getTriggeredEntries() {
      try {
        const data = exchangeDiaryStorage.loadAll();
        if (!data.triggeredEntries) {
          data.triggeredEntries = {};
          exchangeDiaryStorage.saveAll(data);
        }

        return data.triggeredEntries;
      } catch (error) {
        console.error('[TriggerManager] Failed to load triggered entries:', error);
        return {};
      }
    }

    markAsTriggered(entryKey) {
      try {
        const data = exchangeDiaryStorage.loadAll();
        if (!data.triggeredEntries) {
          data.triggeredEntries = {};
        }

        data.triggeredEntries[entryKey] = Date.now();
        exchangeDiaryStorage.saveAll(data);
        console.log(`[TriggerManager] Marked entry as triggered: ${entryKey}`);
      } catch (error) {
        console.error('[TriggerManager] Failed to mark entry as triggered:', error);
      }
    }

    checkTriggerConditions(entry, currentFloor) {
      try {
        const triggerWindow = entry?.userDiary?.triggerWindow;
        if (!triggerWindow) {
          return false;
        }

        if (triggerWindow.targetFloor !== undefined) {
          return this.checkTargetFloorTrigger(triggerWindow.targetFloor, currentFloor);
        }

        return this.checkLegacyWindowTrigger(triggerWindow, currentFloor);
      } catch (error) {
        console.error('[TriggerManager] Failed to evaluate trigger conditions:', error);
        return false;
      }
    }

    checkTargetFloorTrigger(targetFloor, currentFloor) {
      const shouldTrigger = currentFloor >= targetFloor;
      if (!shouldTrigger) {
        return false;
      }

      if (currentFloor === targetFloor) {
        console.log(`[TriggerManager] Reached target floor ${targetFloor}`);
      } else {
        console.log(`[TriggerManager] Passed target floor ${targetFloor}, triggering immediately`);
      }

      return true;
    }

    checkLegacyWindowTrigger(triggerWindow, currentFloor) {
      const inWindow = currentFloor >= triggerWindow.start && currentFloor <= triggerWindow.end;
      if (!inWindow) {
        return false;
      }

      const shouldTrigger = Math.random() < LEGACY_TRIGGER_PROBABILITY;
      if (shouldTrigger) {
        console.log(
          `[TriggerManager] Legacy window trigger hit at floor ${currentFloor}, window [${triggerWindow.start}, ${triggerWindow.end}]`,
        );
      }

      return shouldTrigger;
    }

    async executeTrigger(threadId, entry) {
      try {
        console.log(`[TriggerManager] Executing trigger: ${threadId}, entry ${entry.entryNumber}`);
        this.updateEntryStatus(threadId, entry.entryNumber, {
          status: 'triggered',
        });

        const thread = exchangeDiaryStorage.getThread(threadId);
        if (!thread) {
          console.error(`[TriggerManager] Thread not found: ${threadId}`);
          return;
        }

        const prompt = this.buildPrompt(thread, entry);
        console.log('[TriggerManager] Sending prompt to AI');
        const response = await this.sendPrompt(prompt);

        if (!response) {
          console.error('[TriggerManager] AI response was empty');
          await this.handleFailedTrigger(threadId, entry, '', 'AI response was empty');
          return;
        }

        console.log('[TriggerManager] Received AI response, length:', response.length);
        const extractResult = formatValidator.validateAndExtract(response);

        if (!extractResult.success) {
          console.error('[TriggerManager] Diary format validation failed:', extractResult.error);
          await this.handleFailedTrigger(threadId, entry, response, extractResult.error);
          return;
        }

        const currentFloor = this.getCurrentFloor();
        const addReplySuccess = exchangeDiaryStorage.addReply(
          threadId,
          entry.entryNumber,
          this.createReplyPayload(extractResult, response, currentFloor),
        );

        if (!addReplySuccess) {
          console.error('[TriggerManager] Failed to save reply');
          return;
        }

        this.updateEntryStatus(threadId, entry.entryNumber, {
          status: 'completed',
          canUseReroll: true,
        });

        console.log(`[TriggerManager] Trigger completed: ${threadId}, entry ${entry.entryNumber}`);
        this.notifyTriggerCompleted(thread);
      } catch (error) {
        console.error('[TriggerManager] Trigger execution failed:', error);
        this.updateEntryStatus(threadId, entry.entryNumber, {
          status: 'failed',
        });
      }
    }

    updateEntryStatus(threadId, entryNumber, updates) {
      exchangeDiaryStorage.updateEntry(threadId, entryNumber, updates);
    }

    async handleFailedTrigger(threadId, entry, response, reason) {
      await this.saveToRecycleBin(threadId, entry, response, reason);
      this.updateEntryStatus(threadId, entry.entryNumber, {
        status: 'failed',
      });
    }

    createReplyPayload(extractResult, response, currentFloor) {
      return {
        title: extractResult.title,
        time: extractResult.time,
        content: extractResult.content,
        rawResponse: response,
        floorNumber: currentFloor,
        parsed: true,
      };
    }

    notifyTriggerCompleted(thread) {
      const config = exchangeDiaryStorage.getConfig();
      if (!config.enableNotifications) {
        return;
      }

      notify(`${thread.characterName} replied to your exchange diary`, 'Exchange Diary', {
        timeOut: 4000,
      });
    }

    buildPrompt(thread, entry) {
      try {
        const previousReply = this.getPreviousReply(thread, entry.entryNumber);
        if (previousReply) {
          return promptBuilder.buildExchangeDiaryPrompt(entry.userDiary.content, previousReply.content);
        }

        return promptBuilder.buildExchangeDiaryPromptFirst(entry.userDiary.content);
      } catch (error) {
        console.error('[TriggerManager] Failed to build prompt:', error);
        return promptBuilder.buildExchangeDiaryPromptFirst(entry.userDiary.content);
      }
    }

    getPreviousReply(thread, entryNumber) {
      const entries = Array.isArray(thread.entries) ? thread.entries : [];
      const entryIndex = entries.findIndex(item => Number(item.entryNumber) === Number(entryNumber));
      const previousEntry = entryIndex > 0 ? entries[entryIndex - 1] : null;
      if (!previousEntry || !previousEntry.characterReplies || previousEntry.characterReplies.length === 0) {
        return null;
      }

      const selectedIndex = Number(previousEntry.selectedReplyIndex);
      const safeSelectedIndex =
        Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < previousEntry.characterReplies.length
          ? selectedIndex
          : 0;

      return previousEntry.characterReplies[safeSelectedIndex];
    }

    async sendPrompt(prompt) {
      try {
        if (customApiClient?.isReady?.()) {
          console.log('[Custom API] Using diary-specific API for exchange trigger generation');
          return await customApiClient.generate(prompt);
        }

        const result = await executeSlashCommandsWithOptions(`/gen ${prompt}`, {
          handleParserErrors: true,
          handleExecutionErrors: true,
          parserFlags: {},
          abortController: null,
        });

        return this.normalizeCommandResponse(result);
      } catch (error) {
        console.error('[TriggerManager] Failed to send prompt:', error);
        return '';
      }
    }

    normalizeCommandResponse(result) {
      if (result && typeof result === 'string') {
        return result;
      }

      if (result && result.pipe) {
        return result.pipe || '';
      }

      if (result) {
        return String(result);
      }

      return '';
    }

    async saveToRecycleBin(threadId, entry, response, reason) {
      try {
        const thread = exchangeDiaryStorage.getThread(threadId);
        if (!thread) {
          console.error('[TriggerManager] Thread not found while saving to recycle bin:', threadId);
          return;
        }

        const characterName = thread.characterName;
        const result = await saveToRecycleBinFile(response, characterName, reason);

        if (!result.success) {
          console.error('[TriggerManager] Failed to save recycle bin file:', result.error);
          return;
        }

        console.log(`[TriggerManager] Saved failed reply to recycle bin: ${characterName}_${result.id}`);

        const allRecycleBin = await loadAllRecycleBin();
        const characterRecycleBin = allRecycleBin[characterName] || [];
        const item = characterRecycleBin.find(recycleItem => Number(recycleItem.id) === Number(result.id));

        if (!item) {
          return;
        }

        item.type = 'exchange_diary';
        item.threadId = threadId;
        item.entryNumber = entry.entryNumber;
        item.originalPrompt = this.buildPrompt(thread, entry);

        await saveAllRecycleBin(allRecycleBin);
        console.log('[TriggerManager] Attached exchange diary metadata to recycle bin item');
      } catch (error) {
        console.error('[TriggerManager] Failed to save reply to recycle bin:', error);
      }
    }
  }

  return new TriggerManager();
}
