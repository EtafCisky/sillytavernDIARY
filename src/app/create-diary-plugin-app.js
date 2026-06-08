import { createPluginBootstrapComposition } from '../app/create-plugin-bootstrap-composition.js';
import { createDiaryPluginCompositions } from '../app/create-diary-plugin-compositions.js';
import { createPluginCoreContext } from '../app/create-plugin-core-context.js';
import { defaultSettings, extensionFolderPath, extensionName, PLUGIN_AUTHOR } from '../config/plugin-config.js';
import { createFileStorageProbe } from '../storage/file-storage-probe.js';

export function createDiaryPluginApp() {
  const { runtime, storage } = createPluginCoreContext({ extensionName });
  window.diaryFileStorageProbe = createFileStorageProbe({
    getRequestHeaders: runtime.getRequestHeaders,
  }).run;
  window.diaryFileStorageStatus = storage.getFileStorageStatus;

  const pluginCompositions = createDiaryPluginCompositions({
    extensionName,
    extensionFolderPath,
    defaultSettings,
    pluginVersion: PLUGIN_AUTHOR.version,
    runtime,
    storage,
    notify: toastr,
  });

  return createPluginBootstrapComposition({
    extensionFolderPath,
    pluginAuthor: PLUGIN_AUTHOR,
    authorVerificationPassword: 'f79c37ae83c384635192f92452788ee2ebd5963b2455166930ca193eb0a070c8',
    getDisplayedAuthor: () => $('#diary-plugin-author').text().trim(),
    ...pluginCompositions,
    notify: toastr,
  });
}
