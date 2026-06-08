export function createSettingsTabsManager() {
  const eventNamespace = '.diarySettingsTabs';
  let eventsBound = false;

  function switchSettingsTab(targetTab) {
    try {
      $('.diary-tab-btn').removeClass('active');
      $('.diary-tab-pane').removeClass('active');

      $(`.diary-tab-btn[data-tab="${targetTab}"]`).addClass('active');
      $(`#diary-tab-${targetTab}`).addClass('active');
    } catch (error) {
      console.error('Failed to switch settings tab:', error);
    }
  }

  function bindSettingsTabEvents() {
    if (!eventsBound) {
      $(document)
        .off(`click${eventNamespace}`, '.diary-tab-btn')
        .on(`click${eventNamespace}`, '.diary-tab-btn', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const targetTab = $(this).data('tab');
          if (targetTab) {
            switchSettingsTab(targetTab);
          }
        });

      eventsBound = true;
    }

    switchSettingsTab('config');
  }

  return {
    switchSettingsTab,
    bindSettingsTabEvents,
  };
}
