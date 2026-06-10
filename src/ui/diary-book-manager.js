import { escapeHtmlText } from '../utils/display.js';

export function createDiaryBookManager({
  getAllCharacters,
  getCharacterDiaries,
  loadDiaryFromFile,
  deleteDiaryFromFile,
  updateDiaryRemark,
  getDiaryGroups,
  createDiaryGroup,
  updateDiaryGroup,
  deleteDiaryGroup,
  notify,
}) {
  const diaryBookEventNamespace = '.diaryBookDialog';
  let diaryBookEventsBound = false;
  let diaryBookDialogAttached = false;

  const characterListState = {
    characters: [],
    currentPage: 1,
    pageSize: 8,
    totalPages: 1,
  };

  const diaryListState = {
    currentCharacter: '',
    diaries: [],
    currentPage: 1,
    pageSize: 8,
    totalPages: 1,
    deleteMode: false,
    groupAssignMode: false,
    groupMenuOpen: false,
    groupSelectorMode: '',
    groupSelectorQuery: '',
    groups: [],
    activeGroupFilter: '',
    targetGroup: '',
    groupAssignSubmitting: false,
    selectedDiaryIds: new Set(),
  };

  const diaryDetailState = {
    currentEntry: null,
    currentIndex: -1,
    moreActionsOpen: false,
  };

  function escapeHtml(value) {
    return escapeHtmlText(value ?? '');
  }

  function escapeHtmlAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeText(value) {
    return String(value ?? '');
  }

  function formatDiaryCount(count) {
    return `${Number(count) || 0}`;
  }

  function formatPageInfo(currentPage, totalPages) {
    return `第 ${currentPage} 页，共 ${totalPages} 页`;
  }

  function normalizeRemark(value) {
    return String(value ?? '').trim();
  }

  function normalizeGroupName(value) {
    return String(value ?? '').trim();
  }

  function switchDiaryBookView(targetViewId) {
    const allViews = [
      '#diary-book-cover-view',
      '#diary-book-character-list-view',
      '#diary-book-diary-list-view',
      '#diary-book-detail-view',
    ];

    allViews.forEach(viewId => {
      $(viewId).hide();
    });

    $(targetViewId).css('display', 'block').show();
  }

  function showDiaryBookDialog() {
    $('#diary-book-dialog').show();
    showDiaryBookCover();
  }

  function hideDiaryBookDialog() {
    $('#diary-book-dialog').hide();
  }

  function showDiaryBookCover() {
    setMoreActionsOpen(false);
    switchDiaryBookView('#diary-book-cover-view');
    void updateDiaryBookCover();
  }

  async function updateDiaryBookCover() {
    try {
      const characters = await getAllCharacters();

      if (!characters.length) {
        $('#diary-book-total-count').text('0');
        $('#diary-book-character-count').text('0');
        return;
      }

      let totalDiaries = 0;
      for (const characterName of characters) {
        const diaries = await getCharacterDiaries(characterName);
        totalDiaries += diaries.length;
      }

      $('#diary-book-total-count').text(totalDiaries);
      $('#diary-book-character-count').text(characters.length);
    } catch (error) {
      console.error('[Diary Plugin] Failed to update diary book cover:', error);
      $('#diary-book-total-count').text('?');
      $('#diary-book-character-count').text('?');
    }
  }

  function createDiaryBookDialog() {
    const $dialog = $('#diary-book-dialog');
    if ($dialog.length === 0) {
      return;
    }

    if (!diaryBookDialogAttached) {
      if (!$dialog.parent().is('body')) {
        $dialog.appendTo('body');
      }
      diaryBookDialogAttached = true;
    }
  }

  function bindDiaryBookDialogEvents() {
    if (diaryBookEventsBound) {
      return;
    }

    $(document)
      .off(`click${diaryBookEventNamespace}`, '#diary-book-close-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-close-btn', function (event) {
        event.preventDefault();
        hideDiaryBookDialog();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-dialog')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-dialog', function (event) {
        if (event.target === this) {
          hideDiaryBookDialog();
        }
      })
      .off(`keydown${diaryBookEventNamespace}`)
      .on(`keydown${diaryBookEventNamespace}`, function (event) {
        if (event.keyCode === 27 && $('#diary-book-dialog').is(':visible')) {
          hideDiaryBookDialog();
        }
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-enter-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-enter-btn', function (event) {
        event.preventDefault();
        void showDiaryBookCharacterList();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-back-to-cover')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-back-to-cover', function (event) {
        event.preventDefault();
        showDiaryBookCover();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-prev-page')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-prev-page', function (event) {
        event.preventDefault();
        goToPreviousCharacterPage();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-next-page')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-next-page', function (event) {
        event.preventDefault();
        goToNextCharacterPage();
      })
      .off(`click${diaryBookEventNamespace}`, '.diary-book-character-card')
      .on(`click${diaryBookEventNamespace}`, '.diary-book-character-card', function (event) {
        event.preventDefault();
        const characterName = $(this).data('character');
        void showDiaryBookDiaryList(characterName);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-back-to-character-list')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-back-to-character-list', function (event) {
        event.preventDefault();
        setMoreActionsOpen(false);
        setDiaryListDeleteMode(false);
        setDiaryGroupMenuOpen(false);
        void showDiaryBookCharacterList();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-group-menu-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-group-menu-btn', async function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (diaryListState.groupAssignMode) {
          await assignSelectedDiariesToGroup();
          return;
        }

        setDiaryListDeleteMode(false);
        setDiaryGroupMenuOpen(!diaryListState.groupMenuOpen);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-group-menu')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-group-menu', function (event) {
        event.stopPropagation();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-create-group-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-create-group-btn', async function (event) {
        event.preventDefault();
        await promptCreateDiaryGroup();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-assign-group-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-assign-group-btn', async function (event) {
        event.preventDefault();
        openDiaryGroupSelector('assign');
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-filter-group-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-filter-group-btn', async function (event) {
        event.preventDefault();
        openDiaryGroupSelector('filter');
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-delete-group-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-delete-group-btn', async function (event) {
        event.preventDefault();
        openDiaryGroupSelector('delete');
      })
      .off(`input${diaryBookEventNamespace}`, '#diary-book-group-search-input')
      .on(`input${diaryBookEventNamespace}`, '#diary-book-group-search-input', function () {
        diaryListState.groupSelectorQuery = $(this).val();
        renderDiaryGroupSelectorList();
      })
      .off(`click${diaryBookEventNamespace}`, '.diary-book-group-selector-item')
      .on(`click${diaryBookEventNamespace}`, '.diary-book-group-selector-item', async function (event) {
        event.preventDefault();
        const groupName = normalizeGroupName($(this).attr('data-group'));
        await selectDiaryGroupFromSelector(groupName);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-delete-mode-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-delete-mode-btn', function (event) {
        event.preventDefault();
        setDiaryGroupMenuOpen(false);

        if (diaryListState.deleteMode) {
          void deleteSelectedDiaries();
          return;
        }

        setDiaryListDeleteMode(true);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-cancel-delete-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-cancel-delete-btn', function (event) {
        event.preventDefault();
        setDiaryListDeleteMode(false);
        setDiaryGroupAssignMode(false);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-prev-page')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-prev-page', function (event) {
        event.preventDefault();
        goToPreviousDiaryPage();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-next-page')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-next-page', function (event) {
        event.preventDefault();
        goToNextDiaryPage();
      })
      .off(`click${diaryBookEventNamespace}`, '.diary-book-diary-card')
      .on(`click${diaryBookEventNamespace}`, '.diary-book-diary-card', function (event) {
        const diaryId = $(this).data('diary-id');
        const characterName = $(this).data('character-name');

        if (diaryListState.deleteMode || diaryListState.groupAssignMode) {
          if ($(event.target).closest('.diary-book-diary-checkbox-container').length > 0) {
            return;
          }

          event.preventDefault();
          toggleDiarySelection(diaryId);
          return;
        }

        event.preventDefault();
        void showDiaryBookDetail(characterName, diaryId);
      })
      .off(`change${diaryBookEventNamespace}`, '.diary-book-diary-checkbox')
      .on(`change${diaryBookEventNamespace}`, '.diary-book-diary-checkbox', function (event) {
        event.stopPropagation();
        updateDiarySelection($(this).data('diary-id'), $(this).prop('checked'));
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-back-to-diary-list')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-back-to-diary-list', function (event) {
        event.preventDefault();
        setMoreActionsOpen(false);

        if (diaryListState.currentCharacter) {
          void showDiaryBookDiaryList(diaryListState.currentCharacter);
        }
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-delete-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-delete-btn', async function (event) {
        event.preventDefault();

        const confirmed = confirm('确定要删除这篇日记吗？此操作无法撤销。');
        if (!confirmed) {
          return;
        }

        await deleteDiary();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-detail-prev-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-detail-prev-btn', function (event) {
        event.preventDefault();
        void showPreviousDiaryDetail();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-detail-next-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-detail-next-btn', function (event) {
        event.preventDefault();
        void showNextDiaryDetail();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-more-actions-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-more-actions-btn', function (event) {
        event.preventDefault();
        event.stopPropagation();
        setMoreActionsOpen(!diaryDetailState.moreActionsOpen);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-edit-remark-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-edit-remark-btn', async function (event) {
        event.preventDefault();
        await promptEditDiaryRemark();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-clear-remark-btn')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-clear-remark-btn', async function (event) {
        event.preventDefault();
        await clearDiaryRemark();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-more-actions-menu')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-more-actions-menu', function (event) {
        event.stopPropagation();
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-detail-view')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-detail-view', function () {
        if (diaryDetailState.moreActionsOpen) {
          setMoreActionsOpen(false);
        }
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-diary-list-view')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-diary-list-view', function (event) {
        if ($(event.target).closest('.diary-book-nav-actions').length === 0 && diaryListState.groupMenuOpen) {
          setDiaryGroupMenuOpen(false);
        }
      });

    diaryBookEventsBound = true;
  }

  async function showDiaryBookCharacterList() {
    setMoreActionsOpen(false);
    switchDiaryBookView('#diary-book-character-list-view');
    await loadCharacterData();
    renderCharacterList();
  }

  async function loadCharacterData() {
    try {
      characterListState.characters = [];

      const characterNames = await getAllCharacters();
      if (!characterNames?.length) {
        characterListState.totalPages = 1;
        characterListState.currentPage = 1;
        return;
      }

      const characterStats = [];
      for (const characterName of characterNames) {
        const diaries = await getCharacterDiaries(characterName);
        characterStats.push({
          name: characterName,
          count: diaries.length,
        });
      }

      characterListState.characters = characterStats.sort((left, right) => right.count - left.count);
      characterListState.totalPages = Math.max(
        1,
        Math.ceil(characterListState.characters.length / characterListState.pageSize),
      );
      characterListState.currentPage = 1;
    } catch (error) {
      console.error('[Diary Plugin] Failed to load character data:', error);
      characterListState.characters = [];
      characterListState.totalPages = 1;
      characterListState.currentPage = 1;
    }
  }

  function renderCharacterList() {
    const $grid = $('#diary-book-character-grid');
    const $empty = $('#diary-book-character-empty');

    $grid.empty();

    if (!characterListState.characters.length) {
      $grid.hide();
      $empty.show();
      updateCharacterPagination();
      return;
    }

    $empty.hide();
    $grid.show();

    const startIndex = (characterListState.currentPage - 1) * characterListState.pageSize;
    const endIndex = Math.min(startIndex + characterListState.pageSize, characterListState.characters.length);
    const currentPageCharacters = characterListState.characters.slice(startIndex, endIndex);

    currentPageCharacters.forEach(character => {
      $grid.append(createCharacterCard(character));
    });

    updateCharacterPagination();
  }

  function createCharacterCard(character) {
    const characterName = safeText(character.name);
    const avatar = characterName.charAt(0).toUpperCase();

    return `
      <div class="diary-book-character-card" data-character="${escapeHtmlAttribute(characterName)}">
        <div class="diary-book-character-avatar">${escapeHtml(avatar)}</div>
        <div class="diary-book-character-info">
          <div class="diary-book-character-name">${escapeHtml(characterName)}</div>
          <div class="diary-book-character-stats">
            <span class="diary-book-character-count">${escapeHtml(formatDiaryCount(character.count))}</span>
            <span class="diary-book-character-count-label">篇日记</span>
          </div>
        </div>
        <div class="diary-book-character-arrow">></div>
      </div>
    `;
  }

  function updateCharacterPagination() {
    $('#diary-book-page-info').text(formatPageInfo(characterListState.currentPage, characterListState.totalPages));
    $('#diary-book-prev-page').prop('disabled', characterListState.currentPage <= 1);
    $('#diary-book-next-page').prop('disabled', characterListState.currentPage >= characterListState.totalPages);
  }

  function goToPreviousCharacterPage() {
    if (characterListState.currentPage > 1) {
      characterListState.currentPage -= 1;
      renderCharacterList();
    }
  }

  function goToNextCharacterPage() {
    if (characterListState.currentPage < characterListState.totalPages) {
      characterListState.currentPage += 1;
      renderCharacterList();
    }
  }

  async function showDiaryBookDiaryList(characterName) {
    const isSwitchingCharacter = diaryListState.currentCharacter !== characterName;
    diaryListState.currentCharacter = characterName;
    if (isSwitchingCharacter) {
      diaryListState.activeGroupFilter = '';
    }
    setMoreActionsOpen(false);
    resetDiaryListModes();
    setDiaryGroupMenuOpen(false);
    switchDiaryBookView('#diary-book-diary-list-view');

    await loadDiaryData(characterName);
    await loadDiaryGroups(characterName);
    updateDiaryListTitle();
    renderDiaryList();
  }

  async function loadDiaryData(characterName) {
    try {
      diaryListState.diaries = [];

      const diaries = await getCharacterDiaries(characterName);
      if (!diaries?.length) {
        diaryListState.totalPages = 1;
        diaryListState.currentPage = 1;
        return;
      }

      diaryListState.diaries = diaries.map(diary => ({
        id: diary.id,
        title: diary.title,
        time: diary.time,
        content: diary.content,
        remark: normalizeRemark(diary.remark),
        group: normalizeGroupName(diary.group),
        originalTitle: diary.title,
      }));

      updateDiaryListPaginationState();
      diaryListState.currentPage = 1;
    } catch (error) {
      console.error('[Diary Plugin] Failed to load diary data:', error);
      diaryListState.diaries = [];
      diaryListState.totalPages = 1;
      diaryListState.currentPage = 1;
    }
  }

  function updateDiaryListTitle() {
    const title = diaryListState.activeGroupFilter
      ? `${diaryListState.currentCharacter} · ${diaryListState.activeGroupFilter}`
      : diaryListState.currentCharacter;
    $('#diary-book-character-name').text(title);
  }

  function renderDiaryList() {
    const $grid = $('#diary-book-diary-grid');
    const $empty = $('#diary-book-diary-empty');
    const visibleDiaries = getVisibleDiaries();

    $grid.empty();

    if (!visibleDiaries.length) {
      $grid.hide();
      $empty.show();
      updateDiaryListPaginationState();
      updateDiaryListDeleteControls();
      updateDiaryListGroupControls();
      updateDiaryPagination();
      return;
    }

    $empty.hide();
    $grid.show();
    updateDiaryListPaginationState();

    const startIndex = (diaryListState.currentPage - 1) * diaryListState.pageSize;
    const endIndex = Math.min(startIndex + diaryListState.pageSize, visibleDiaries.length);
    const currentPageDiaries = visibleDiaries.slice(startIndex, endIndex);

    currentPageDiaries.forEach(diary => {
      $grid.append(createDiaryCard(diary));
    });

    updateDiaryPagination();
    updateDiaryListDeleteControls();
    updateDiaryListGroupControls();
  }

  function createDiaryCard(diary) {
    const diaryId = safeText(diary.id);
    const title = safeText(diary.title);
    const truncatedTitle = truncateTitle(title, 7);
    const remark = normalizeRemark(diary.remark);
    const group = normalizeGroupName(diary.group);
    const characterName = safeText(diaryListState.currentCharacter);
    const isSelected = diaryListState.selectedDiaryIds.has(diaryId);
    const selectionModeClass = diaryListState.deleteMode || diaryListState.groupAssignMode ? ' is-delete-mode' : '';
    const selectedClass = isSelected ? ' is-selected' : '';
    const checkboxDisplay = diaryListState.deleteMode || diaryListState.groupAssignMode ? 'flex' : 'none';
    const remarkHtml = remark
      ? `<div class="diary-book-diary-remark" title="${escapeHtmlAttribute(remark)}">${escapeHtml(remark)}</div>`
      : '';
    const groupHtml = group
      ? `<div class="diary-book-diary-group-badge" title="${escapeHtmlAttribute(group)}">${escapeHtml(group)}</div>`
      : '';

    return `
      <div class="diary-book-diary-card${selectionModeClass}${selectedClass}" data-diary-id="${escapeHtmlAttribute(diaryId)}" data-character-name="${escapeHtmlAttribute(characterName)}" data-diary-title="${escapeHtmlAttribute(title)}">
        <label class="diary-book-diary-checkbox-container" style="display: ${checkboxDisplay};" aria-label="选择日记">
          <input type="checkbox" class="diary-book-diary-checkbox" data-diary-id="${escapeHtmlAttribute(diaryId)}" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="diary-book-diary-header">
          <div class="diary-book-diary-meta">
            <div class="diary-book-diary-title" title="${escapeHtmlAttribute(title)}">${escapeHtml(truncatedTitle)}</div>
            ${remarkHtml}
            ${groupHtml}
            <div class="diary-book-diary-time">${escapeHtml(diary.time)}</div>
          </div>
        </div>
        <div class="diary-book-diary-arrow">></div>
      </div>
    `;
  }

  function truncateTitle(title, maxLength) {
    title = safeText(title);
    if (title.length <= maxLength) {
      return title;
    }

    return `${title.substring(0, maxLength)}...`;
  }

  function updateDiaryPagination() {
    $('#diary-book-diary-page-info').text(formatPageInfo(diaryListState.currentPage, diaryListState.totalPages));
    $('#diary-book-diary-prev-page').prop('disabled', diaryListState.currentPage <= 1);
    $('#diary-book-diary-next-page').prop('disabled', diaryListState.currentPage >= diaryListState.totalPages);
  }

  function getVisibleDiaries() {
    const activeGroupFilter = normalizeGroupName(diaryListState.activeGroupFilter);
    if (!activeGroupFilter) {
      return diaryListState.diaries;
    }

    return diaryListState.diaries.filter(diary => normalizeGroupName(diary.group) === activeGroupFilter);
  }

  function updateDiaryListPaginationState() {
    const visibleCount = getVisibleDiaries().length;
    diaryListState.totalPages = Math.max(1, Math.ceil(visibleCount / diaryListState.pageSize));

    if (diaryListState.currentPage > diaryListState.totalPages) {
      diaryListState.currentPage = diaryListState.totalPages;
    }
  }

  function goToPreviousDiaryPage() {
    if (diaryListState.currentPage > 1) {
      diaryListState.currentPage -= 1;
      renderDiaryList();
    }
  }

  function goToNextDiaryPage() {
    if (diaryListState.currentPage < diaryListState.totalPages) {
      diaryListState.currentPage += 1;
      renderDiaryList();
    }
  }

  function resetDiaryListModes() {
    diaryListState.deleteMode = false;
    diaryListState.groupAssignMode = false;
    diaryListState.groupMenuOpen = false;
    diaryListState.groupSelectorMode = '';
    diaryListState.groupSelectorQuery = '';
    diaryListState.targetGroup = '';
    diaryListState.groupAssignSubmitting = false;
    diaryListState.selectedDiaryIds.clear();
  }

  function setDiaryListDeleteMode(enabled) {
    diaryListState.deleteMode = Boolean(enabled);

    if (diaryListState.deleteMode) {
      diaryListState.groupAssignMode = false;
      diaryListState.groupMenuOpen = false;
      diaryListState.targetGroup = '';
    } else {
      diaryListState.groupAssignSubmitting = false;
      diaryListState.selectedDiaryIds.clear();
    }

    renderDiaryList();
  }

  function updateDiaryListDeleteControls() {
    const hasDiaries = diaryListState.diaries.length > 0;
    const selectedCount = diaryListState.selectedDiaryIds.size;

    $('#diary-book-diary-delete-mode-btn')
      .toggle(hasDiaries)
      .toggleClass('active', diaryListState.deleteMode)
      .prop('disabled', diaryListState.groupAssignMode)
      .attr('title', diaryListState.deleteMode ? `删除选中的 ${selectedCount} 篇日记` : '批量删除日记')
      .attr('aria-label', diaryListState.deleteMode ? `删除选中的 ${selectedCount} 篇日记` : '批量删除日记');
    $('#diary-book-diary-cancel-delete-btn').toggle(diaryListState.deleteMode || diaryListState.groupAssignMode);
  }

  function updateDiarySelection(diaryId, isSelected) {
    const normalizedDiaryId = safeText(diaryId);

    if (isSelected) {
      diaryListState.selectedDiaryIds.add(normalizedDiaryId);
    } else {
      diaryListState.selectedDiaryIds.delete(normalizedDiaryId);
    }

    $('.diary-book-diary-card')
      .filter((_, element) => safeText($(element).data('diary-id')) === normalizedDiaryId)
      .toggleClass('is-selected', Boolean(isSelected));
    updateDiaryListDeleteControls();
    updateDiaryListGroupControls();
  }

  function toggleDiarySelection(diaryId) {
    const normalizedDiaryId = safeText(diaryId);
    const shouldSelect = !diaryListState.selectedDiaryIds.has(normalizedDiaryId);
    updateDiarySelection(normalizedDiaryId, shouldSelect);
    $('.diary-book-diary-checkbox')
      .filter((_, element) => safeText($(element).data('diary-id')) === normalizedDiaryId)
      .prop('checked', shouldSelect);
  }

  async function deleteSelectedDiaries() {
    const selectedDiaryIds = Array.from(diaryListState.selectedDiaryIds);

    if (!selectedDiaryIds.length) {
      notify.warning('请先选择要删除的日记', '批量删除');
      return;
    }

    const confirmed = confirm(`确定要删除选中的 ${selectedDiaryIds.length} 篇日记吗？此操作无法撤销。`);
    if (!confirmed) {
      return;
    }

    const characterName = diaryListState.currentCharacter;
    let successCount = 0;

    for (const diaryId of selectedDiaryIds) {
      const result = await deleteDiaryFromFile(characterName, diaryId);
      if (result?.success) {
        successCount += 1;
      }
    }

    if (successCount === 0) {
      notify.error('批量删除失败', '批量删除');
      return;
    }

    notify.success(`已删除 ${successCount} 篇日记`, '私人日记');
    diaryListState.diaries = diaryListState.diaries.filter(
      diary => !selectedDiaryIds.some(selectedId => Number(selectedId) === Number(diary.id)),
    );
    setDiaryListDeleteMode(false);

    if (characterName) {
      await showDiaryBookDiaryList(characterName);
    } else {
      await showDiaryBookCharacterList();
    }
  }

  async function loadDiaryGroups(characterName) {
    if (typeof getDiaryGroups !== 'function') {
      diaryListState.groups = [];
      return;
    }

    diaryListState.groups = (await getDiaryGroups(characterName)).map(normalizeGroupName).filter(Boolean);
  }

  function setDiaryGroupMenuOpen(isOpen) {
    diaryListState.groupMenuOpen = Boolean(isOpen);
    if (!diaryListState.groupMenuOpen) {
      diaryListState.groupSelectorMode = '';
      diaryListState.groupSelectorQuery = '';
    }
    updateDiaryListGroupControls();
  }

  function setDiaryGroupAssignMode(enabled, targetGroup = diaryListState.targetGroup) {
    diaryListState.groupAssignMode = Boolean(enabled);
    diaryListState.targetGroup = diaryListState.groupAssignMode ? normalizeGroupName(targetGroup) : '';

    if (diaryListState.groupAssignMode) {
      diaryListState.deleteMode = false;
      diaryListState.groupMenuOpen = false;
      diaryListState.groupSelectorMode = '';
      diaryListState.groupSelectorQuery = '';
    } else {
      diaryListState.groupAssignSubmitting = false;
      diaryListState.selectedDiaryIds.clear();
    }

    renderDiaryList();
  }

  function updateDiaryListGroupControls() {
    const selectedCount = diaryListState.selectedDiaryIds.size;
    const activeGroupFilter = normalizeGroupName(diaryListState.activeGroupFilter);
    const targetGroup = normalizeGroupName(diaryListState.targetGroup);

    $('#diary-book-diary-group-menu').toggle(diaryListState.groupMenuOpen);
    updateDiaryGroupSelectorPanel();
    $('#diary-book-diary-group-menu-btn')
      .toggleClass('active', diaryListState.groupAssignMode || Boolean(activeGroupFilter))
      .prop('disabled', diaryListState.groupAssignSubmitting)
      .attr(
        'title',
        diaryListState.groupAssignMode
          ? `将 ${selectedCount} 篇日记加入「${targetGroup}」`
          : activeGroupFilter
            ? `当前筛选：${activeGroupFilter}`
            : '日记分组',
      )
      .attr(
        'aria-label',
        diaryListState.groupAssignMode
          ? `将 ${selectedCount} 篇日记加入${targetGroup}`
          : activeGroupFilter
            ? `当前筛选${activeGroupFilter}`
            : '日记分组',
      )
      .text(diaryListState.groupAssignSubmitting ? '...' : diaryListState.groupAssignMode ? '✓' : activeGroupFilter ? '🔎' : '📁');
  }

  async function refreshDiaryListAfterGroupChange() {
    const characterName = diaryListState.currentCharacter;
    await loadDiaryData(characterName);
    await loadDiaryGroups(characterName);

    if (
      diaryListState.activeGroupFilter &&
      !diaryListState.groups.some(group => group === diaryListState.activeGroupFilter)
    ) {
      diaryListState.activeGroupFilter = '';
    }

    renderDiaryList();
  }

  async function promptCreateDiaryGroup() {
    const groupName = normalizeGroupName(prompt('请输入新分组名称：', ''));
    if (!groupName) {
      setDiaryGroupMenuOpen(false);
      return;
    }

    const result = await createDiaryGroup(diaryListState.currentCharacter, groupName);
    if (!result.success) {
      notify.error(`创建分组失败：${result.error}`, '日记分组');
      return;
    }

    diaryListState.groups = result.groups.map(normalizeGroupName).filter(Boolean);
    setDiaryGroupMenuOpen(false);
    updateDiaryListGroupControls();
    notify.success(`已创建分组「${groupName}」`, '日记分组');
  }

  function openDiaryGroupSelector(mode) {
    const selectorMode = safeText(mode);
    if (!['assign', 'filter', 'delete'].includes(selectorMode)) {
      return;
    }

    if (selectorMode === 'assign' && !diaryListState.groups.length) {
      notify.warning('请先创建分组', '日记分组');
      setDiaryGroupMenuOpen(false);
      return;
    }

    if (selectorMode === 'delete' && !diaryListState.groups.length) {
      notify.warning('暂无可删除的分组', '日记分组');
      setDiaryGroupMenuOpen(false);
      return;
    }

    diaryListState.groupSelectorMode =
      diaryListState.groupSelectorMode === selectorMode ? '' : selectorMode;
    diaryListState.groupSelectorQuery = '';
    updateDiaryGroupSelectorPanel();

    if (diaryListState.groupSelectorMode) {
      setTimeout(() => $('#diary-book-group-search-input').trigger('focus'), 0);
    }
  }

  function updateDiaryGroupSelectorPanel() {
    const selectorMode = diaryListState.groupSelectorMode;
    const isOpen = diaryListState.groupMenuOpen && Boolean(selectorMode);
    const titleMap = {
      assign: '选择要加入的分组',
      filter: '选择筛选分组',
      delete: '选择要删除的分组',
    };

    $('#diary-book-group-selector-panel').toggle(isOpen);
    $('#diary-book-assign-group-btn').toggleClass('active', selectorMode === 'assign');
    $('#diary-book-filter-group-btn').toggleClass('active', selectorMode === 'filter');
    $('#diary-book-delete-group-btn').toggleClass('active', selectorMode === 'delete');

    if (!isOpen) {
      return;
    }

    $('#diary-book-group-selector-title').text(titleMap[selectorMode] || '选择分组');
    $('#diary-book-group-search-input').val(diaryListState.groupSelectorQuery);
    renderDiaryGroupSelectorList();
  }

  function getFilteredDiaryGroups() {
    const query = normalizeGroupName(diaryListState.groupSelectorQuery).toLowerCase();
    if (!query) {
      return diaryListState.groups;
    }

    return diaryListState.groups.filter(group => group.toLowerCase().includes(query));
  }

  function renderDiaryGroupSelectorList() {
    const selectorMode = diaryListState.groupSelectorMode;
    const filteredGroups = getFilteredDiaryGroups();
    const $list = $('#diary-book-group-selector-list');
    const items = [];

    if (selectorMode === 'filter') {
      const isActive = !normalizeGroupName(diaryListState.activeGroupFilter);
      items.push(`
        <button type="button" class="diary-book-group-selector-item${isActive ? ' active' : ''}" data-group="">
          <span class="diary-book-group-selector-name">全部日记</span>
        </button>
      `);
    }

    filteredGroups.forEach(group => {
      const isActive = selectorMode === 'filter' && group === diaryListState.activeGroupFilter;
      items.push(`
        <button type="button" class="diary-book-group-selector-item${isActive ? ' active' : ''}" data-group="${escapeHtmlAttribute(group)}">
          <span class="diary-book-group-selector-name">${escapeHtml(group)}</span>
        </button>
      `);
    });

    if (!items.length) {
      $list.html('<div class="diary-book-group-selector-empty">没有找到分组</div>');
      return;
    }

    $list.html(items.join(''));
  }

  async function selectDiaryGroupFromSelector(groupName) {
    const selectorMode = diaryListState.groupSelectorMode;

    if (selectorMode === 'assign') {
      if (!groupName) {
        notify.warning('未选择目标分组', '日记分组');
        return;
      }

      setDiaryGroupAssignMode(true, groupName);
      return;
    }

    if (selectorMode === 'filter') {
      diaryListState.activeGroupFilter = groupName;
      diaryListState.currentPage = 1;
      setDiaryGroupMenuOpen(false);
      updateDiaryListTitle();
      renderDiaryList();
      notify.success(groupName ? `正在查看「${groupName}」` : '已显示全部日记', '日记分组');
      return;
    }

    if (selectorMode === 'delete') {
      if (!groupName) {
        notify.warning('未选择要删除的分组', '日记分组');
        return;
      }

      const confirmed = confirm(`确定要删除分组「${groupName}」吗？这不会删除其中的日记。`);
      if (!confirmed) {
        return;
      }

      const result = await deleteDiaryGroup(diaryListState.currentCharacter, groupName);
      if (!result.success) {
        notify.error(`删除分组失败：${result.error}`, '日记分组');
        return;
      }

      if (diaryListState.activeGroupFilter === groupName) {
        diaryListState.activeGroupFilter = '';
      }

      setDiaryGroupMenuOpen(false);
      updateDiaryListTitle();
      notify.success(`已删除分组「${groupName}」`, '日记分组');
      await refreshDiaryListAfterGroupChange();
    }
  }

  async function assignSelectedDiariesToGroup() {
    if (diaryListState.groupAssignSubmitting) {
      return;
    }

    const selectedDiaryIds = Array.from(diaryListState.selectedDiaryIds);
    const targetGroup = normalizeGroupName(diaryListState.targetGroup);

    if (!selectedDiaryIds.length) {
      notify.warning('请先选择要加入分组的日记', '日记分组');
      return;
    }

    if (!targetGroup) {
      notify.error('未选择目标分组', '日记分组');
      setDiaryGroupAssignMode(false);
      return;
    }

    try {
      diaryListState.groupAssignSubmitting = true;
      updateDiaryListGroupControls();

      const result = await updateDiaryGroup(diaryListState.currentCharacter, selectedDiaryIds, targetGroup);
      if (!result.success) {
        notify.error(`加入分组失败：${result.error}`, '日记分组');
        return;
      }

      notify.success(`已将 ${result.updatedCount} 篇日记加入「${targetGroup}」`, '日记分组');
      setDiaryGroupAssignMode(false);
      await refreshDiaryListAfterGroupChange();
    } catch (error) {
      console.error('[Diary Plugin] Failed to assign selected diaries to group:', error);
      notify.error(`加入分组失败：${error.message || error}`, '日记分组');
    } finally {
      diaryListState.groupAssignSubmitting = false;
      updateDiaryListGroupControls();
    }
  }

  async function showDiaryBookDetail(characterName, diaryId) {
    try {
      if (diaryListState.currentCharacter !== characterName || !diaryListState.diaries.length) {
        diaryListState.currentCharacter = characterName;
        await loadDiaryData(characterName);
      }

      diaryDetailState.currentIndex = getVisibleDiaries().findIndex(diary => Number(diary.id) === Number(diaryId));
      const diaryData = await loadDiaryDetailData(characterName, diaryId);
      if (!diaryData) {
        notify.error('加载日记详情失败', '私人日记');
        return;
      }

      diaryDetailState.currentEntry = diaryData;
      switchDiaryBookView('#diary-book-detail-view');
      renderDiaryDetail(diaryData);
    } catch (error) {
      console.error('[Diary Plugin] Failed to show diary detail:', error);
      notify.error('显示日记详情失败', '私人日记');
    }
  }

  async function loadDiaryDetailData(characterName, diaryId) {
    try {
      const diary = await loadDiaryFromFile(characterName, diaryId);
      if (!diary) {
        return null;
      }

      return {
        id: diary.id,
        title: diary.title,
        time: diary.time,
        content: diary.content || '暂无内容',
        remark: normalizeRemark(diary.remark),
        character: characterName,
        originalTitle: diary.title,
      };
    } catch (error) {
      console.error('[Diary Plugin] Failed to load diary detail data:', error);
      return null;
    }
  }

  function renderDiaryDetail(diaryData) {
    try {
      $('#diary-book-detail-title').text(diaryData.title);
      $('#diary-book-detail-time').text(diaryData.time);
      $('#diary-book-detail-text').html(formatDiaryContent(diaryData.content));
      updateRemarkActionLabels(diaryData.remark);
      setMoreActionsOpen(false);
      updateDiaryDetailNavigation();
    } catch (error) {
      console.error('[Diary Plugin] Failed to render diary detail:', error);
      $('#diary-book-detail-title').text('加载失败');
      $('#diary-book-detail-time').text('');
      $('#diary-book-detail-text').text('无法显示日记内容');
      updateRemarkActionLabels('');
      setMoreActionsOpen(false);
      updateDiaryDetailNavigation();
    }
  }

  function updateRemarkActionLabels(remark) {
    const hasRemark = Boolean(normalizeRemark(remark));
    $('#diary-book-edit-remark-btn').text(hasRemark ? '修改备注' : '设置备注');
    $('#diary-book-clear-remark-btn').prop('disabled', !hasRemark);
  }

  function setMoreActionsOpen(isOpen) {
    diaryDetailState.moreActionsOpen = Boolean(isOpen);
    $('#diary-book-more-actions-menu').toggle(diaryDetailState.moreActionsOpen);
    $('#diary-book-more-actions-btn').toggleClass('is-open', diaryDetailState.moreActionsOpen);
  }

  function updateDiaryDetailNavigation() {
    const visibleDiaries = getVisibleDiaries();
    const currentIndex = diaryDetailState.currentIndex;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < visibleDiaries.length - 1;

    $('#diary-book-detail-prev-btn').prop('disabled', !hasPrevious);
    $('#diary-book-detail-next-btn').prop('disabled', !hasNext);
  }

  async function showDiaryDetailByIndex(targetIndex) {
    const visibleDiaries = getVisibleDiaries();
    if (targetIndex < 0 || targetIndex >= visibleDiaries.length) {
      return;
    }

    const targetDiary = visibleDiaries[targetIndex];
    if (!targetDiary || !diaryListState.currentCharacter) {
      return;
    }

    await showDiaryBookDetail(diaryListState.currentCharacter, targetDiary.id);
  }

  async function showPreviousDiaryDetail() {
    if (diaryDetailState.currentIndex <= 0) {
      return;
    }

    setMoreActionsOpen(false);
    await showDiaryDetailByIndex(diaryDetailState.currentIndex - 1);
  }

  async function showNextDiaryDetail() {
    const visibleDiaries = getVisibleDiaries();
    if (diaryDetailState.currentIndex < 0 || diaryDetailState.currentIndex >= visibleDiaries.length - 1) {
      return;
    }

    setMoreActionsOpen(false);
    await showDiaryDetailByIndex(diaryDetailState.currentIndex + 1);
  }

  async function deleteDiary() {
    try {
      if (!diaryDetailState.currentEntry) {
        notify.error('未选择要删除的日记', '删除日记');
        return;
      }

      const { id: diaryId, character: characterName } = diaryDetailState.currentEntry;
      const result = await deleteDiaryFromFile(characterName, diaryId);

      if (!result.success) {
        notify.error(`删除日记失败：${result.error}`, '删除日记');
        return;
      }

      notify.success('日记已删除', '私人日记');
      setMoreActionsOpen(false);
      diaryDetailState.currentEntry = null;
      diaryDetailState.currentIndex = -1;

      if (characterName) {
        await showDiaryBookDiaryList(characterName);
      } else {
        await showDiaryBookCharacterList();
      }
    } catch (error) {
      console.error('[Diary Plugin] Failed to delete diary:', error);
      notify.error(`删除日记失败：${error.message}`, '删除日记');
    }
  }

  function updateDiaryListRemark(diaryId, remark) {
    const targetDiary = diaryListState.diaries.find(diary => Number(diary.id) === Number(diaryId));
    if (targetDiary) {
      targetDiary.remark = normalizeRemark(remark);
    }
  }

  async function applyDiaryRemark(remark) {
    if (!diaryDetailState.currentEntry) {
      notify.error('未选择要备注的日记', '备注');
      return false;
    }

    const { id: diaryId, character: characterName } = diaryDetailState.currentEntry;
    const result = await updateDiaryRemark(characterName, diaryId, remark);
    if (!result.success) {
      notify.error(`备注保存失败：${result.error}`, '备注');
      return false;
    }

    const normalizedRemark = normalizeRemark(result.diary?.remark ?? remark);
    diaryDetailState.currentEntry.remark = normalizedRemark;
    updateDiaryListRemark(diaryId, normalizedRemark);
    updateRemarkActionLabels(normalizedRemark);
    renderDiaryDetail(diaryDetailState.currentEntry);
    renderDiaryList();
    notify.success(normalizedRemark ? '备注已保存' : '备注已清除', '备注');
    return true;
  }

  async function promptEditDiaryRemark() {
    if (!diaryDetailState.currentEntry) {
      notify.error('未选择要备注的日记', '备注');
      return;
    }

    const currentRemark = normalizeRemark(diaryDetailState.currentEntry.remark);
    const input = prompt('请输入这篇日记的备注副标题（仅在目录页显示）：', currentRemark);
    if (input === null) {
      return;
    }

    const nextRemark = normalizeRemark(input);
    if (nextRemark === currentRemark) {
      setMoreActionsOpen(false);
      return;
    }

    await applyDiaryRemark(nextRemark);
  }

  async function clearDiaryRemark() {
    if (!diaryDetailState.currentEntry) {
      notify.error('未选择要备注的日记', '备注');
      return;
    }

    if (!normalizeRemark(diaryDetailState.currentEntry.remark)) {
      setMoreActionsOpen(false);
      return;
    }

    await applyDiaryRemark('');
  }

  function formatDiaryContent(content) {
    const escapedContent = escapeHtml(content);
    if (!escapedContent || !safeText(content).trim()) {
      return '<p class="diary-book-detail-empty">暂无内容。</p>';
    }

    let formattedContent = escapedContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    if (!formattedContent.startsWith('<p>')) {
      formattedContent = `<p>${formattedContent}`;
    }
    if (!formattedContent.endsWith('</p>')) {
      formattedContent = `${formattedContent}</p>`;
    }
    return formattedContent;
  }

  return {
    switchDiaryBookView,
    showDiaryBookDialog,
    hideDiaryBookDialog,
    showDiaryBookCover,
    updateDiaryBookCover,
    createDiaryBookDialog,
    bindDiaryBookDialogEvents,
    showDiaryBookCharacterList,
    loadCharacterData,
    renderCharacterList,
    createCharacterCard,
    updateCharacterPagination,
    goToPreviousCharacterPage,
    goToNextCharacterPage,
    showDiaryBookDiaryList,
    loadDiaryData,
    renderDiaryList,
    createDiaryCard,
    truncateTitle,
    updateDiaryPagination,
    goToPreviousDiaryPage,
    goToNextDiaryPage,
    showDiaryBookDetail,
    showPreviousDiaryDetail,
    showNextDiaryDetail,
    loadDiaryDetailData,
    renderDiaryDetail,
    updateDiaryDetailNavigation,
    deleteDiary,
    promptEditDiaryRemark,
    clearDiaryRemark,
    formatDiaryContent,
  };
}
