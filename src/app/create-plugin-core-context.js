import { createPluginStorage } from '../storage/storage-facade.js';
import { createSillyTavernRuntime } from '../st/create-sillytavern-runtime.js';

export function createPluginCoreContext({ extensionName }) {
  const runtime = createSillyTavernRuntime({ extensionName });

  const storage = createPluginStorage({
    extensionSettings: runtime.extensionSettings,
    extensionName,
    saveSettings: runtime.saveSettings,
    getRequestHeaders: runtime.getRequestHeaders,
  });

  return {
    runtime,
    storage,
  };
}
