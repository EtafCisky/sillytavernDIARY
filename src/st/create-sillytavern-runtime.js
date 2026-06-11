import {
  chat,
  eventSource,
  event_types,
  getRequestHeaders,
  is_send_press,
  name2,
  saveSettingsDebounced,
} from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { getPresetManager } from '../../../../../preset-manager.js';
import { executeSlashCommandsWithOptions } from '../../../../../slash-commands.js';

export function createSillyTavernRuntime({ extensionName }) {
  function saveSettings() {
    saveSettingsDebounced();
  }

  function getCurrentSettings() {
    return extension_settings[extensionName] || {};
  }

  function getChat() {
    return chat;
  }

  function getCurrentFloor() {
    return chat.length;
  }

  function getCurrentCharacter() {
    return name2;
  }

  function getDefaultCharacterName() {
    return name2 || '';
  }

  function isAIGenerating() {
    return is_send_press;
  }

  return {
    extensionSettings: extension_settings,
    eventSource,
    eventTypes: event_types,
    getContext,
    getRequestHeaders,
    getPresetManager,
    executeSlashCommandsWithOptions,
    saveSettingsDebounced,
    saveSettings,
    getCurrentSettings,
    getChat,
    getCurrentFloor,
    getCurrentCharacter,
    getDefaultCharacterName,
    isAIGenerating,
  };
}
