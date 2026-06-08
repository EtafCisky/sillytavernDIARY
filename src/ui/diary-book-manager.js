import { escapeHtmlText } from '../utils/display.js';

export function createDiaryBookManager({
  getAllCharacters,
  getCharacterDiaries,
  loadDiaryFromFile,
  deleteDiaryFromFile,
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
  };

  const diaryDetailState = {
    currentEntry: null,
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
        void showDiaryBookCharacterList();
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
        event.preventDefault();
        const diaryId = $(this).data('diary-id');
        const characterName = $(this).data('character-name');
        void showDiaryBookDetail(characterName, diaryId);
      })
      .off(`click${diaryBookEventNamespace}`, '#diary-book-back-to-diary-list')
      .on(`click${diaryBookEventNamespace}`, '#diary-book-back-to-diary-list', function (event) {
        event.preventDefault();

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
      });

    diaryBookEventsBound = true;
  }

  async function showDiaryBookCharacterList() {
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
    diaryListState.currentCharacter = characterName;
    switchDiaryBookView('#diary-book-diary-list-view');
    $('#diary-book-character-name').text(characterName);

    await loadDiaryData(characterName);
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
        originalTitle: diary.title,
      }));

      diaryListState.totalPages = Math.max(1, Math.ceil(diaryListState.diaries.length / diaryListState.pageSize));
      diaryListState.currentPage = 1;
    } catch (error) {
      console.error('[Diary Plugin] Failed to load diary data:', error);
      diaryListState.diaries = [];
      diaryListState.totalPages = 1;
      diaryListState.currentPage = 1;
    }
  }

  function renderDiaryList() {
    const $grid = $('#diary-book-diary-grid');
    const $empty = $('#diary-book-diary-empty');

    $grid.empty();

    if (!diaryListState.diaries.length) {
      $grid.hide();
      $empty.show();
      updateDiaryPagination();
      return;
    }

    $empty.hide();
    $grid.show();

    const startIndex = (diaryListState.currentPage - 1) * diaryListState.pageSize;
    const endIndex = Math.min(startIndex + diaryListState.pageSize, diaryListState.diaries.length);
    const currentPageDiaries = diaryListState.diaries.slice(startIndex, endIndex);

    currentPageDiaries.forEach(diary => {
      $grid.append(createDiaryCard(diary));
    });

    updateDiaryPagination();
  }

  function createDiaryCard(diary) {
    const title = safeText(diary.title);
    const truncatedTitle = truncateTitle(title, 7);
    const characterName = safeText(diaryListState.currentCharacter);

    return `
      <div class="diary-book-diary-card" data-diary-id="${escapeHtmlAttribute(diary.id)}" data-character-name="${escapeHtmlAttribute(characterName)}" data-diary-title="${escapeHtmlAttribute(title)}">
        <div class="diary-book-diary-header">
          <div class="diary-book-diary-meta">
            <div class="diary-book-diary-title" title="${escapeHtmlAttribute(title)}">${escapeHtml(truncatedTitle)}</div>
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

  async function showDiaryBookDetail(characterName, diaryId) {
    try {
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
    } catch (error) {
      console.error('[Diary Plugin] Failed to render diary detail:', error);
      $('#diary-book-detail-title').text('加载失败');
      $('#diary-book-detail-time').text('');
      $('#diary-book-detail-text').text('无法显示日记内容');
    }
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
      diaryDetailState.currentEntry = null;

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
    loadDiaryDetailData,
    renderDiaryDetail,
    deleteDiary,
    formatDiaryContent,
  };
}
