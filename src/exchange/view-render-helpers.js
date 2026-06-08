import { escapeHtmlText, formatRelativeDate } from '../utils/display.js';

export function escapeHtml(text) {
  return escapeHtmlText(text ?? '');
}

export function escapeHtmlAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatDate(date) {
  return formatRelativeDate(date);
}

export function getSelectedReplyIndex(entry) {
  const replies = Array.isArray(entry?.characterReplies) ? entry.characterReplies : [];
  const selectedIndex = Number(entry?.selectedReplyIndex);

  if (Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < replies.length) {
    return selectedIndex;
  }

  return 0;
}

export function getSelectedCharacterReply(entry) {
  if (!entry?.characterReplies || entry.characterReplies.length === 0) {
    return null;
  }

  return entry.characterReplies[getSelectedReplyIndex(entry)] || entry.characterReplies[0];
}

export function buildCharacterSummaries(threadsById) {
  const characterStats = {};

  Object.values(threadsById || {}).forEach(thread => {
    const charName = thread.characterName;
    if (!characterStats[charName]) {
      characterStats[charName] = {
        characterName: charName,
        threadCount: 0,
        entryCount: 0,
        lastUpdated: thread.updatedAt,
      };
    }

    characterStats[charName].threadCount++;
    characterStats[charName].entryCount += Array.isArray(thread.entries) ? thread.entries.length : 0;

    if (new Date(thread.updatedAt) > new Date(characterStats[charName].lastUpdated)) {
      characterStats[charName].lastUpdated = thread.updatedAt;
    }
  });

  return Object.values(characterStats).sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
}

export function getThreadListStats(thread) {
  const entryCount = Array.isArray(thread.entries) ? thread.entries.length : 0;

  return {
    entryCount,
    pageCount: entryCount * 2,
    formattedDate: formatDate(new Date(thread.updatedAt)),
  };
}

export function getEntryListPage(thread, page = 1, entriesPerPage = 8) {
  const entries = Array.isArray(thread.entries) ? thread.entries : [];
  const totalEntries = entries.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  const currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages || 1));
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = Math.min(startIndex + entriesPerPage, totalEntries);

  return {
    entries,
    totalEntries,
    totalPages,
    currentPage,
    pageEntries: entries.slice(startIndex, endIndex),
  };
}

export function getBookTotalPages(thread, isMobile) {
  const entryCount = Array.isArray(thread.entries) ? thread.entries.length : 0;
  return isMobile ? entryCount * 2 : entryCount;
}

export function getBookPageForEntry(thread, entryNumber, isMobile) {
  const entries = Array.isArray(thread.entries) ? thread.entries : [];
  const normalizedEntryNumber = Number(entryNumber);
  const entryIndex = entries.findIndex(entry => Number(entry.entryNumber) === normalizedEntryNumber);

  if (entryIndex < 0) {
    return null;
  }

  return isMobile ? entryIndex * 2 + 1 : entryIndex + 1;
}

export function normalizePageNumber(page, totalPages) {
  if (totalPages < 1) {
    return 1;
  }

  return Math.max(1, Math.min(Number(page) || 1, totalPages));
}

export function createCharacterCardHtml(character) {
  const formattedDate = formatDate(new Date(character.lastUpdated));
  const characterName = escapeHtml(character.characterName);
  const characterAttribute = escapeHtmlAttribute(character.characterName);

  return `
    <div class="diary-exchange-character-card" data-character="${characterAttribute}">
      <div class="diary-exchange-character-info">
        <div class="diary-exchange-character-name">${characterName}</div>
        <div class="diary-exchange-character-stats">
          <span class="diary-exchange-stat">
            <span class="diary-exchange-stat-text">${character.threadCount} 个系列</span>
          </span>
          <span class="diary-exchange-stat-divider">·</span>
          <span class="diary-exchange-stat">
            <span class="diary-exchange-stat-text">${character.entryCount} 篇日记</span>
          </span>
        </div>
        <div class="diary-exchange-character-date">
          <span class="diary-exchange-date-text">最后更新 ${formattedDate}</span>
        </div>
      </div>
      <div class="diary-exchange-character-arrow">
        <span>→</span>
      </div>
    </div>
  `;
}

export function createThreadCardHtml(thread) {
  const { entryCount, pageCount, formattedDate } = getThreadListStats(thread);
  const threadIdAttribute = escapeHtmlAttribute(thread.threadId);

  return `
    <div class="diary-exchange-thread-card" data-thread-id="${threadIdAttribute}">
      <div class="diary-exchange-thread-checkbox-container" style="display: none;">
        <input type="checkbox" class="diary-exchange-thread-checkbox" data-thread-id="${threadIdAttribute}">
      </div>
      <div class="diary-exchange-thread-info">
        <div class="diary-exchange-thread-name-row">
          <div class="diary-exchange-thread-name" data-thread-id="${threadIdAttribute}">
            ${escapeHtml(thread.threadName)}
          </div>
          <button class="diary-exchange-thread-rename-btn" data-thread-id="${threadIdAttribute}" title="重命名系列">
            <span>✎</span>
          </button>
        </div>
        <div class="diary-exchange-thread-stats">
          <span class="diary-exchange-stat">
            <span class="diary-exchange-stat-text">共 ${pageCount} 页</span>
          </span>
          <span class="diary-exchange-stat-divider">·</span>
          <span class="diary-exchange-stat">
            <span class="diary-exchange-stat-text">${entryCount} 个条目</span>
          </span>
        </div>
        <div class="diary-exchange-thread-date">
          <span class="diary-exchange-date-text">最后更新 ${formattedDate}</span>
        </div>
      </div>
      <div class="diary-exchange-thread-arrow">
        <span>→</span>
      </div>
    </div>
  `;
}

export function createEntryNode(thread, entry, index, pageEntriesLength) {
  const entryNumber = entry.entryNumber;
  const userDiary = entry.userDiary || {};
  const characterReply = getSelectedCharacterReply(entry);
  const userContent = userDiary.content || '';
  const replyContent = characterReply?.content || '';

  const $entryNode = $('<div class="diary-exchange-entry-node"></div>');
  const $checkbox = $(`
    <div class="diary-exchange-entry-checkbox-container" style="display: none;">
      <input type="checkbox" class="diary-exchange-entry-checkbox" data-entry-number="${escapeHtmlAttribute(entryNumber)}">
    </div>
  `);

  const $entryCard = $(`
    <div class="diary-exchange-entry-card" data-thread-id="${escapeHtmlAttribute(thread.threadId)}" data-entry-number="${escapeHtmlAttribute(entryNumber)}">
      <div class="diary-exchange-entry-header">
        <div class="diary-exchange-entry-number">条目 ${escapeHtml(entryNumber)}</div>
        <div class="diary-exchange-entry-date">${formatDate(new Date(userDiary.writtenAt))}</div>
      </div>
      <div class="diary-exchange-entry-body">
        <div class="diary-exchange-entry-section">
          <div class="diary-exchange-entry-label">我的日记</div>
          <div class="diary-exchange-entry-preview">${escapeHtml(userContent.substring(0, 12))}${userContent.length > 12 ? '...' : ''}</div>
        </div>
        ${
          characterReply
            ? `
        <div class="diary-exchange-entry-section">
          <div class="diary-exchange-entry-label">${escapeHtml(thread.characterName)}的回复</div>
          <div class="diary-exchange-entry-preview">${escapeHtml(replyContent.substring(0, 12))}${replyContent.length > 12 ? '...' : ''}</div>
        </div>
        `
            : `
        <div class="diary-exchange-entry-section diary-exchange-entry-pending">
          <div class="diary-exchange-entry-label">等待回复</div>
          <div class="diary-exchange-entry-preview">暂无回复</div>
        </div>
        `
        }
      </div>
    </div>
  `);

  $entryNode.append($checkbox);
  $entryNode.append($entryCard);

  if (index < pageEntriesLength - 1) {
    $entryNode.append($('<div class="diary-exchange-entry-connector"></div>'));
  }

  return $entryNode;
}
