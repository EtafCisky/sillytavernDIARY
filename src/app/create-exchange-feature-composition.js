import { createGhostwriteManager } from '../ai/ghostwrite-manager.js';
import { createRerollManager } from '../ai/reroll-manager.js';
import { createExchangeDiaryComposition } from '../app/create-exchange-diary-composition.js';
import { createTriggerManager } from '../exchange/trigger-manager.js';
import { ExchangeDiaryFormatValidator } from '../parser/diary-parser.js';
import { PromptBuilder } from '../prompts/prompt-builder.js';

export function createExchangeFeatureComposition({
  executeSlashCommandsWithOptions,
  customApiClient,
  exchangeDiaryStorage,
  getCurrentFloor,
  isAIGenerating,
  getCurrentCharacter,
  getContext,
  saveToRecycleBinFile,
  loadAllRecycleBin,
  saveAllRecycleBin,
  getDefaultCharacterName,
  notify,
}) {
  const ghostwriteManager = createGhostwriteManager({
    executeSlashCommandsWithOptions,
    customApiClient,
  });

  class FormatValidator extends ExchangeDiaryFormatValidator {}

  const rerollManager = createRerollManager({
    exchangeDiaryStorage,
    formatValidator: FormatValidator,
    executeSlashCommandsWithOptions,
    customApiClient,
    getCurrentFloor,
  });

  const triggerManager = createTriggerManager({
    isAIGenerating,
    getCurrentCharacter,
    getCurrentFloor,
    getContext,
    exchangeDiaryStorage,
    formatValidator: FormatValidator,
    promptBuilder: PromptBuilder,
    executeSlashCommandsWithOptions,
    customApiClient,
    saveToRecycleBinFile,
    loadAllRecycleBin,
    saveAllRecycleBin,
    notify: (message, title, options) => notify.info(message, title, options),
  });

  const {
    createExchangeDiaryDialog,
    bindExchangeDiaryDialogEvents,
    showExchangeDiaryDialog,
  } = createExchangeDiaryComposition({
    exchangeDiaryStorage,
    ghostwriteManager,
    rerollManager,
    getContext,
    getDefaultCharacterName,
    getCurrentFloor,
    notify,
  });

  return {
    formatValidator: FormatValidator,
    triggerManager,
    createExchangeDiaryDialog,
    bindExchangeDiaryDialogEvents,
    showExchangeDiaryDialog,
  };
}
