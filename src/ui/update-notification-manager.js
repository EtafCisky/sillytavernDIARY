export function createUpdateNotificationManager({ pluginVersion, extensionFolderPath, getCurrentSettings, saveSettings }) {
  const eventNamespace = '.diaryUpdateNotification';
  let eventsBound = false;

  async function checkAndShowUpdateNotification() {
    try {
      const settings = getCurrentSettings();
      const lastSeenVersion = settings.lastSeenVersion || '0.0.0';

      console.log(`[Update Notification] current=${pluginVersion}, lastSeen=${lastSeenVersion}`);

      if (pluginVersion !== lastSeenVersion) {
        console.log('[Update Notification] New plugin version detected.');
        await showUpdateNotification();
      }
    } catch (error) {
      console.error('[Update Notification] Failed to check version state:', error);
    }
  }

  function buildUpdateMessage(changelog) {
    const formatNoticeLabel = changelog.formatNoticeLabel || '格式提醒';
    let message = `<p><strong>${escapeHtml(changelog.date)}</strong></p>`;

    if (changelog.diaryFormat) {
      message += `<p style="color: #dc3545; font-weight: 600; margin-top: 16px;">${escapeHtml(formatNoticeLabel)}：${escapeHtml(changelog.diaryFormat.title)}</p>`;
      message += `<pre style="color: #dc3545; background: #fff5f5; padding: 12px; border-radius: 4px; border-left: 3px solid #dc3545; font-size: 13px; line-height: 1.6; margin: 8px 0 16px 0; white-space: pre-wrap;">${escapeHtml(changelog.diaryFormat.content)}</pre>`;
    }

    if (changelog.exchangeDiaryFormat) {
      message += `<p style="color: #dc3545; font-weight: 600; margin-top: 16px;">${escapeHtml(formatNoticeLabel)}：${escapeHtml(changelog.exchangeDiaryFormat.title)}</p>`;
      message += `<pre style="color: #dc3545; background: #fff5f5; padding: 12px; border-radius: 4px; border-left: 3px solid #dc3545; font-size: 13px; line-height: 1.6; margin: 8px 0 16px 0; white-space: pre-wrap;">${escapeHtml(changelog.exchangeDiaryFormat.content)}</pre>`;
    }

    if (changelog.details && changelog.details.length > 0) {
      changelog.details.forEach(detail => {
        message += `<p><strong>${escapeHtml(detail.category)}</strong></p><ul>`;
        detail.items.forEach(item => {
          message += `<li>${escapeHtml(item)}</li>`;
        });
        message += '</ul>';
      });
    }

    if (changelog.migration && changelog.migration.required) {
      message += `<p><strong>需要迁移：${escapeHtml(changelog.migration.message)}</strong></p><ol>`;
      changelog.migration.steps.forEach(step => {
        message += `<li>${escapeHtml(step)}</li>`;
      });
      message += '</ol>';
    }

    return message;
  }

  async function showUpdateNotification() {
    try {
      const changelogPath = `${extensionFolderPath}/changelog.json`;
      const response = await fetch(changelogPath);
      if (!response.ok) {
        throw new Error('Unable to load changelog.');
      }

      const changelog = await response.json();
      $('#diary-update-version-title').text(changelog.title || '更新说明');
      $('#diary-update-message').html(buildUpdateMessage(changelog));
      $('#diary-update-notification').fadeIn(300);

      console.log('[Update Notification] Dialog shown.');
    } catch (error) {
      console.error('[Update Notification] Failed to show dialog:', error);
    }
  }

  function escapeHtml(value) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return String(value ?? '').replace(/[&<>"']/g, char => htmlEscapes[char]);
  }

  function closeUpdateNotification() {
    $('#diary-update-notification').fadeOut(300);

    const settings = getCurrentSettings();
    settings.lastSeenVersion = pluginVersion;
    saveSettings();
    console.log('[Update Notification] Version marked as seen.');
  }

  function bindUpdateNotificationEvents() {
    if (eventsBound) {
      return;
    }

    $('#diary-update-close-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, () => closeUpdateNotification());

    $('#diary-update-confirm-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, () => closeUpdateNotification());

    $('#diary-update-never-show-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, () => closeUpdateNotification());

    $('#diary-update-notification')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        if (e.target === this) {
          closeUpdateNotification();
        }
      });

    $(document)
      .off(`keydown${eventNamespace}`)
      .on(`keydown${eventNamespace}`, function (e) {
        if (e.key === 'Escape' && $('#diary-update-notification').is(':visible')) {
          closeUpdateNotification();
        }
      });

    eventsBound = true;
  }

  return {
    checkAndShowUpdateNotification,
    showUpdateNotification,
    closeUpdateNotification,
    bindUpdateNotificationEvents,
    buildUpdateMessage,
  };
}
