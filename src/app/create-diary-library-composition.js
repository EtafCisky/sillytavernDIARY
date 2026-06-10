import { createDiaryBookManager } from '../ui/diary-book-manager.js';
import { createSaveSuccessDialogManager } from '../ui/save-success-dialog-manager.js';

export function createDiaryLibraryComposition({
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
  const {
    showDiaryBookDialog,
    showDiaryBookCover,
    updateDiaryBookCover,
    createDiaryBookDialog,
    bindDiaryBookDialogEvents,
    showDiaryBookCharacterList,
    showDiaryBookDiaryList,
    showDiaryBookDetail,
    deleteDiary,
  } = createDiaryBookManager({
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
  });

  const {
    showSaveSuccessDialog,
    hideSaveSuccessDialog,
    viewSavedDiary,
    createSaveSuccessDialog,
    bindSaveSuccessDialogEvents,
  } = createSaveSuccessDialogManager({
    showDiaryBookDialog,
    showDiaryBookDetail,
  });

  return {
    showDiaryBookDialog,
    showDiaryBookCover,
    updateDiaryBookCover,
    createDiaryBookDialog,
    bindDiaryBookDialogEvents,
    showDiaryBookCharacterList,
    showDiaryBookDiaryList,
    showDiaryBookDetail,
    deleteDiary,
    showSaveSuccessDialog,
    hideSaveSuccessDialog,
    viewSavedDiary,
    createSaveSuccessDialog,
    bindSaveSuccessDialogEvents,
  };
}
