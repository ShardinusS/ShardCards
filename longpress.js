// longpress.js - Long press gesture handler
export function addLongPress(element, onLongPress, onClick, options = {}) {
  const { duration = 500, capture = true } = options;
  let pressTimer = null;
  let isLongPress = false;

  const startPress = (e) => {
    if (e.button !== 0 && e.type === 'mousedown') return;
    isLongPress = false;
    pressTimer = setTimeout(() => {
      isLongPress = true;
      if (element.dataset.disabled !== 'true') {
        onLongPress?.();
      }
    }, duration);
  };

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const endPress = (e) => {
    cancelPress();
    if (!isLongPress && !element.dataset.disabled) {
      onClick?.();
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    cancelPress();
  };

  // Touch events
  element.addEventListener('touchstart', startPress, { passive: true });
  element.addEventListener('touchend', endPress);
  element.addEventListener('touchcancel', cancelPress);

  // Mouse events
  element.addEventListener('mousedown', startPress);
  element.addEventListener('mouseup', endPress);
  element.addEventListener('mouseleave', cancelPress);
  element.addEventListener('contextmenu', handleContextMenu);

  // Cleanup function
  return () => {
    cancelPress();
    element.removeEventListener('touchstart', startPress);
    element.removeEventListener('touchend', endPress);
    element.removeEventListener('touchcancel', cancelPress);
    element.removeEventListener('mousedown', startPress);
    element.removeEventListener('mouseup', endPress);
    element.removeEventListener('mouseleave', cancelPress);
    element.removeEventListener('contextmenu', handleContextMenu);
  };
}

// Swipe gesture helper
export function addSwipeGesture(element, onSwipeLeft, onSwipeRight, onSwipeUp, options = {}) {
  const { threshold = 50 } = options;
  let startX = 0;
  let startY = 0;

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > threshold) onSwipeRight?.();
      else if (dx < -threshold) onSwipeLeft?.();
    } else {
      if (dy < -threshold) onSwipeUp?.();
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd);

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };
}

window.addLongPress = addLongPress;
window.addSwipeGesture = addSwipeGesture;