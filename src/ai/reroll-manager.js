import { PromptBuilder } from '../prompts/prompt-builder.js';

export function createRerollManager({
  exchangeDiaryStorage,
  formatValidator,
  executeSlashCommandsWithOptions,
  customApiClient,
  getCurrentFloor,
}) {
  async function callGenCommand(prompt) {
    try {
      if (customApiClient?.isReady?.()) {
        console.log('[Custom API] Using diary-specific API for reroll generation');
        return await customApiClient.generate(prompt);
      }

      const result = await executeSlashCommandsWithOptions(`/gen ${prompt}`, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        parserFlags: {},
        abortController: null,
      });

      if (typeof result === 'string') {
        return result;
      }

      if (result?.pipe) {
        return result.pipe || '';
      }

      return result ? String(result) : '';
    } catch (error) {
      console.error('[Reroll] Failed to execute /gen command:', error);
      throw error;
    }
  }

  function getPreviousSelectedReply(thread, entry) {
    const entries = Array.isArray(thread.entries) ? thread.entries : [];
    const entryIndex = entries.findIndex(item => Number(item.entryNumber) === Number(entry.entryNumber));
    if (entryIndex <= 0) {
      return null;
    }

    const previousEntry = entries[entryIndex - 1];
    if (!previousEntry?.characterReplies?.length) {
      return null;
    }

    const selectedIndex = Number(previousEntry.selectedReplyIndex);
    const safeSelectedIndex =
      Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < previousEntry.characterReplies.length
        ? selectedIndex
        : 0;

    return previousEntry.characterReplies[safeSelectedIndex] || null;
  }

  function buildRerollPrompt(thread, entry) {
    const previousReply = getPreviousSelectedReply(thread, entry);
    if (!previousReply) {
      return PromptBuilder.buildExchangeDiaryPromptFirst(entry.userDiary.content);
    }

    const previousReplyText =
      `标题：${previousReply.title}\n` +
      `时间：${previousReply.time}\n` +
      `内容：${previousReply.content}`;

    return PromptBuilder.buildExchangeDiaryPrompt(entry.userDiary.content, previousReplyText);
  }

  function getCurrentReplyCount(entry) {
    return Array.isArray(entry.characterReplies) ? entry.characterReplies.length : 0;
  }

  async function generateReroll(threadId, entryNumber) {
    try {
      const thread = exchangeDiaryStorage.getThread(threadId);
      if (!thread) {
        throw new Error(`系列不存在: ${threadId}`);
      }

      const entry = exchangeDiaryStorage.getEntry(threadId, entryNumber);
      if (!entry) {
        throw new Error(`条目不存在: ${threadId}, 条目 ${entryNumber}`);
      }

      const config = exchangeDiaryStorage.getConfig();
      const maxRerolls = config.maxRerollsPerEntry || 5;
      const currentReplyCount = getCurrentReplyCount(entry);

      if (currentReplyCount >= maxRerolls) {
        throw new Error(`已达到最大 Reroll 次数限制 (${maxRerolls})`);
      }

      const prompt = buildRerollPrompt(thread, entry);
      const response = await callGenCommand(prompt);

      if (!response.trim()) {
        throw new Error('AI 回复为空');
      }

      const extractResult = formatValidator.validateAndExtract(response);
      if (!extractResult.success) {
        throw new Error(`格式验证失败: ${extractResult.error}`);
      }

      const reply = {
        title: extractResult.title,
        time: extractResult.time,
        content: extractResult.content,
        rawResponse: response,
        floorNumber: getCurrentFloor(),
        parsed: true,
        isReroll: currentReplyCount > 0,
        rerollIndex: currentReplyCount,
      };

      return { success: true, reply };
    } catch (error) {
      console.error('[Reroll] Failed to generate reroll:', error);
      return { success: false, error: error.message };
    }
  }

  function saveRerollVersion(threadId, entryNumber, reply) {
    try {
      return exchangeDiaryStorage.addReply(threadId, entryNumber, reply);
    } catch (error) {
      console.error('[Reroll] Failed to save reroll version:', error);
      return false;
    }
  }

  function selectReply(threadId, entryNumber, rerollIndex) {
    try {
      return exchangeDiaryStorage.selectReply(threadId, entryNumber, rerollIndex);
    } catch (error) {
      console.error('[Reroll] Failed to select reply version:', error);
      return false;
    }
  }

  function deleteUnselectedReplies(threadId, entryNumber) {
    try {
      return exchangeDiaryStorage.deleteUnselectedReplies(threadId, entryNumber);
    } catch (error) {
      console.error('[Reroll] Failed to delete unselected replies:', error);
      return false;
    }
  }

  return {
    generateReroll,
    buildRerollPrompt,
    callGenCommand,
    saveRerollVersion,
    selectReply,
    deleteUnselectedReplies,
  };
}
