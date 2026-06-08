export function createFloatWindowManager({
  extensionName,
  extensionSettings,
  getCurrentSettings,
  saveSettings,
  notify,
  openDiaryBook,
  startWriteDiary,
  showExchangeDiaryDialog,
  showRecycleBinDialog,
}) {
  const eventNamespace = '.diaryFloatWindow';
  let eventsBound = false;
  let windowAttached = false;

  const floatWindow = {
    element: null,
    isExpanded: false,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
    hasMoved: false,
    lastClickTime: 0,
  };

  function createFloatWindow() {
    const $window = $('#diary-float-window');
    if ($window.length === 0) {
      console.warn('[Float Window] Window element not found.');
      return;
    }

    if (!windowAttached && !$window.parent().is('body')) {
      $window.appendTo('body');
    }

    windowAttached = true;
    floatWindow.element = $window;
    restoreFloatWindowPosition();
    bindFloatWindowEvents();
  }

  function bindFloatWindowEvents() {
    if (eventsBound) {
      return;
    }

    const $mainBtn = $('#diary-float-main-btn');
    const $window = $('#diary-float-window');

    $('#diary-float-book-btn').css({ top: '-60px', left: '4px' });
    $('#diary-float-write-btn').css({ top: '-42px', left: '-42px' });
    $('#diary-float-exchange-btn').css({ top: '60px', left: '0px' });
    $('#diary-float-recycle-btn').css({ top: '-42px', left: '50px' });

    $mainBtn
      .off(`click${eventNamespace} touchend${eventNamespace}`)
      .on(`click${eventNamespace} touchend${eventNamespace}`, function (e) {
        if (e.type === 'touchend' && floatWindow.isDragging) {
          return;
        }

        const now = Date.now();
        if (now - floatWindow.lastClickTime < 300) {
          return;
        }
        floatWindow.lastClickTime = now;

        e.preventDefault();
        e.stopPropagation();

        if (floatWindow.hasMoved) {
          return;
        }

        toggleFloatMenu();
      });

    $('#diary-float-book-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        openDiaryBook();
        closeFloatMenu();
      });

    $('#diary-float-write-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        startWriteDiary();
        closeFloatMenu();
      });

    $('#diary-float-exchange-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        showExchangeDiaryDialog();
        closeFloatMenu();
      });

    $('#diary-float-recycle-btn')
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        showRecycleBinDialog();
        closeFloatMenu();
      });

    $mainBtn
      .off(`mousedown${eventNamespace} touchstart${eventNamespace}`)
      .on(`mousedown${eventNamespace} touchstart${eventNamespace}`, function (e) {
        if (floatWindow.isExpanded) {
          return;
        }

        floatWindow.isDragging = true;
        floatWindow.hasMoved = false;

        const originalEvent = e.originalEvent.touches ? e.originalEvent.touches[0] : e.originalEvent;
        const clientX = originalEvent.clientX;
        const clientY = originalEvent.clientY;
        const rect = $window[0].getBoundingClientRect();

        floatWindow.dragOffset = {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };

        floatWindow.startPos = {
          x: clientX,
          y: clientY,
        };

        if (e.type === 'mousedown') {
          e.preventDefault();
        }
      });

    $(document)
      .off(`mousemove${eventNamespace} touchmove${eventNamespace}`)
      .on(`mousemove${eventNamespace} touchmove${eventNamespace}`, function (e) {
        if (!floatWindow.isDragging) {
          return;
        }

        const originalEvent = e.originalEvent.touches ? e.originalEvent.touches[0] : e.originalEvent;
        const clientX = originalEvent.clientX;
        const clientY = originalEvent.clientY;
        const moveThreshold = e.type === 'touchmove' ? 15 : 5;
        const moveDistance = Math.sqrt(
          Math.pow(clientX - floatWindow.startPos.x, 2) + Math.pow(clientY - floatWindow.startPos.y, 2),
        );

        if (moveDistance > moveThreshold) {
          floatWindow.hasMoved = true;
          if (e.type === 'touchmove') {
            e.preventDefault();
          }
        }

        let newX = clientX - floatWindow.dragOffset.x;
        let newY = clientY - floatWindow.dragOffset.y;

        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const elementWidth = $window.outerWidth();
        const elementHeight = $window.outerHeight();

        newX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
        newY = Math.max(0, Math.min(newY, windowHeight - elementHeight));

        $window.css({
          left: `${newX}px`,
          top: `${newY}px`,
        });

        e.preventDefault();
      });

    $(document)
      .off(`mouseup${eventNamespace} touchend${eventNamespace}`)
      .on(`mouseup${eventNamespace} touchend${eventNamespace}`, function (e) {
        if (!floatWindow.isDragging) {
          return;
        }

        floatWindow.isDragging = false;

        if (floatWindow.hasMoved) {
          saveFloatWindowPosition();

          if (e.type === 'touchend') {
            setTimeout(() => {
              floatWindow.hasMoved = false;
            }, 300);
            return;
          }
        }

        floatWindow.hasMoved = false;
      });

    $(document)
      .off(`click${eventNamespace}`)
      .on(`click${eventNamespace}`, function (e) {
        if (!$(e.target).closest('#diary-float-window').length && floatWindow.isExpanded) {
          closeFloatMenu();
        }
      });

    eventsBound = true;
  }

  function toggleFloatMenu() {
    if (floatWindow.isExpanded) {
      closeFloatMenu();
    } else {
      openFloatMenu();
    }
  }

  function openFloatMenu() {
    $('#diary-float-menu').show();
    $('#diary-float-main-btn').addClass('diary-float-expanded');
    floatWindow.isExpanded = true;
  }

  function closeFloatMenu() {
    $('#diary-float-menu').hide();
    $('#diary-float-main-btn').removeClass('diary-float-expanded');
    floatWindow.isExpanded = false;
  }

  function toggleFloatWindow() {
    const settings = getCurrentSettings();
    const newState = !settings.floatWindowVisible;

    extensionSettings[extensionName].floatWindowVisible = newState;
    saveSettings();

    if (newState) {
      $('#diary-float-window').show();
      notify.info('悬浮窗已显示', '日记本');
    } else {
      $('#diary-float-window').hide();
      closeFloatMenu();
      notify.info('悬浮窗已隐藏', '日记本');
    }
  }

  function resetFloatWindowPosition() {
    if (!floatWindow.element || floatWindow.element.length === 0) {
      notify.error('悬浮窗元素不存在', '重置位置');
      return;
    }

    const wasHidden = !floatWindow.element.is(':visible');
    let originalVisibility = '';

    if (wasHidden) {
      originalVisibility = floatWindow.element.css('visibility');
      floatWindow.element.css('visibility', 'hidden').show();
    }

    floatWindow.element[0].offsetHeight;

    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    let elementWidth = floatWindow.element.outerWidth(true);
    let elementHeight = floatWindow.element.outerHeight(true);

    if (elementWidth <= 0) {
      elementWidth = 60;
    }
    if (elementHeight <= 0) {
      elementHeight = 60;
    }

    const centerX = Math.max(0, Math.floor((windowWidth - elementWidth) / 2));
    const centerY = Math.max(0, Math.floor((windowHeight - elementHeight) / 2));

    floatWindow.element.css({
      left: `${centerX}px`,
      top: `${centerY}px`,
      position: 'fixed',
    });

    if (wasHidden) {
      floatWindow.element.hide().css('visibility', originalVisibility);
    }

    extensionSettings[extensionName].floatWindowPosition = {
      x: centerX,
      y: centerY,
    };
    saveSettings();

    notify.success('悬浮窗位置已重置到屏幕中央', '日记本');
  }

  function saveFloatWindowPosition() {
    if (!floatWindow.element) {
      return;
    }

    const position = {
      x: parseInt(floatWindow.element.css('left')),
      y: parseInt(floatWindow.element.css('top')),
    };

    extensionSettings[extensionName].floatWindowPosition = position;
    saveSettings();
  }

  function restoreFloatWindowPosition() {
    if (!floatWindow.element || floatWindow.element.length === 0) {
      return;
    }

    const settings = getCurrentSettings();
    const savedPosition = settings.floatWindowPosition;

    if (!savedPosition || (savedPosition.x === 0 && savedPosition.y === 0)) {
      resetFloatWindowPosition();
      return;
    }

    floatWindow.element.css({
      left: `${savedPosition.x}px`,
      top: `${savedPosition.y}px`,
      position: 'fixed',
    });

    setTimeout(() => {
      const windowWidth = $(window).width();
      const windowHeight = $(window).height();
      const elementWidth = floatWindow.element.outerWidth(true) || 60;
      const elementHeight = floatWindow.element.outerHeight(true) || 60;

      if (
        savedPosition.x < 0 ||
        savedPosition.y < 0 ||
        savedPosition.x + elementWidth > windowWidth ||
        savedPosition.y + elementHeight > windowHeight
      ) {
        resetFloatWindowPosition();
      }
    }, 100);
  }

  return {
    createFloatWindow,
    bindFloatWindowEvents,
    toggleFloatMenu,
    openFloatMenu,
    closeFloatMenu,
    toggleFloatWindow,
    resetFloatWindowPosition,
    saveFloatWindowPosition,
    restoreFloatWindowPosition,
  };
}
