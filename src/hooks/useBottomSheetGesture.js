/**
 * useBottomSheetGesture -- Native touch gesture hook for bottom sheet.
 *
 * Three snap points: peek, half, full.
 * Velocity-based momentum snapping (threshold 300px/s).
 * Swipe down from peek = dismiss.
 * Uses transform: translateY() for 60fps performance.
 *
 * Usage:
 *   const { sheetRef, handleRef, sheetStyle, snapTo, dismiss } =
 *     useBottomSheetGesture({ onDismiss, peekHeight, halfHeight, fullHeight });
 */

import { useRef, useState, useCallback, useEffect } from 'react';

const VELOCITY_THRESHOLD = 300; // px/s -- fast swipe snaps to next point
const DISMISS_VELOCITY = 500;   // px/s -- fast swipe down from peek = dismiss

/**
 * @param {Object} opts
 * @param {function} opts.onDismiss       -- called when sheet is swiped away
 * @param {number}   [opts.peekHeight=180]  -- peek snap height (px from bottom)
 * @param {number}   [opts.halfHeight]      -- half snap height (defaults to 55vh)
 * @param {number}   [opts.fullHeight]      -- full snap height (defaults to 90vh - 64px header)
 */
export default function useBottomSheetGesture({
  onDismiss,
  peekHeight = 180,
  halfHeight: halfHeightProp,
  fullHeight: fullHeightProp,
} = {}) {
  const sheetRef = useRef(null);
  const handleRef = useRef(null);

  // Track gesture state without re-renders
  const gesture = useRef({
    active: false,
    startY: 0,
    startTranslate: 0,
    currentTranslate: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });

  const [snapIndex, setSnapIndex] = useState(0); // 0=peek, 1=half, 2=full

  // Compute snap points from viewport
  const getSnapPoints = useCallback(() => {
    const vh = window.innerHeight;
    const half = halfHeightProp || Math.round(vh * 0.55);
    const full = fullHeightProp || Math.round(vh * 0.9 - 64);
    return [peekHeight, half, full];
  }, [peekHeight, halfHeightProp, fullHeightProp]);

  // Translate Y for a given snap height (sheet is position:absolute bottom:0)
  // translateY(0) = fully showing; translateY(sheetMaxH - snapH) = peeking
  const getTranslateForSnap = useCallback((snapHeight) => {
    const sheet = sheetRef.current;
    if (!sheet) return 0;
    const sheetH = sheet.scrollHeight;
    return Math.max(0, sheetH - snapHeight);
  }, []);

  // Apply transform directly (no React state for 60fps)
  const applyTransform = useCallback((translateY, animate = false) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (animate) {
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    } else {
      sheet.style.transition = 'none';
    }
    sheet.style.willChange = animate ? 'auto' : 'transform';
    sheet.style.transform = `translateY(${Math.max(0, translateY)}px)`;
  }, []);

  const snapTo = useCallback((index) => {
    const snaps = getSnapPoints();
    const targetSnap = snaps[Math.min(index, snaps.length - 1)];
    const translateY = getTranslateForSnap(targetSnap);
    applyTransform(translateY, true);
    setSnapIndex(index);

    // Enable/disable scroll based on snap position
    const sheet = sheetRef.current;
    if (sheet) {
      const content = sheet.querySelector('[data-sheet-content]');
      if (content) {
        content.style.overflowY = index === 2 ? 'auto' : 'hidden';
      }
    }
  }, [getSnapPoints, getTranslateForSnap, applyTransform]);

  const dismiss = useCallback(() => {
    const sheet = sheetRef.current;
    if (sheet) {
      applyTransform(sheet.scrollHeight, true);
    }
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [applyTransform, onDismiss]);

  // Touch handlers
  const onTouchStart = useCallback((e) => {
    // Only respond to touches on the handle or when scroll is at top
    const handle = handleRef.current;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const content = sheet.querySelector('[data-sheet-content]');
    const isHandle = handle && handle.contains(e.target);
    const isScrolledToTop = !content || content.scrollTop <= 0;

    if (!isHandle && !isScrolledToTop) return;

    const touch = e.touches[0];
    const g = gesture.current;
    g.active = true;
    g.startY = touch.clientY;
    g.lastY = touch.clientY;
    g.lastTime = Date.now();
    g.velocity = 0;

    // Get current translateY from computed style
    const transform = window.getComputedStyle(sheet).transform;
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrix(transform);
      g.startTranslate = matrix.m42;
    } else {
      g.startTranslate = 0;
    }
    g.currentTranslate = g.startTranslate;
  }, []);

  const onTouchMove = useCallback((e) => {
    const g = gesture.current;
    if (!g.active) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - g.startY;
    const now = Date.now();
    const dt = (now - g.lastTime) / 1000;

    if (dt > 0) {
      g.velocity = (touch.clientY - g.lastY) / dt;
    }
    g.lastY = touch.clientY;
    g.lastTime = now;

    g.currentTranslate = g.startTranslate + deltaY;

    // Clamp: don't let sheet go above full snap
    const snaps = getSnapPoints();
    const minTranslate = getTranslateForSnap(snaps[2]);
    g.currentTranslate = Math.max(minTranslate, g.currentTranslate);

    applyTransform(g.currentTranslate, false);

    // Prevent map scroll while dragging
    e.preventDefault();
  }, [getSnapPoints, getTranslateForSnap, applyTransform]);

  const onTouchEnd = useCallback(() => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;

    const snaps = getSnapPoints();
    const velocity = g.velocity; // positive = moving down

    // Fast swipe down from peek = dismiss
    if (snapIndex === 0 && velocity > DISMISS_VELOCITY) {
      dismiss();
      return;
    }

    // Velocity-based snap decision
    let targetIndex = snapIndex;
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      if (velocity > 0) {
        // Swiping down
        targetIndex = Math.max(0, snapIndex - 1);
        // If already at peek and swiping down, dismiss
        if (snapIndex === 0) {
          dismiss();
          return;
        }
      } else {
        // Swiping up
        targetIndex = Math.min(2, snapIndex + 1);
      }
    } else {
      // Position-based: find nearest snap
      let minDist = Infinity;
      snaps.forEach((snapH, i) => {
        const snapTranslate = getTranslateForSnap(snapH);
        const dist = Math.abs(g.currentTranslate - snapTranslate);
        if (dist < minDist) {
          minDist = dist;
          targetIndex = i;
        }
      });
    }

    snapTo(targetIndex);
  }, [snapIndex, getSnapPoints, getTranslateForSnap, snapTo, dismiss]);

  // Attach listeners (passive: false for preventDefault on touchmove)
  useEffect(() => {
    const handle = handleRef.current;
    const sheet = sheetRef.current;
    if (!handle || !sheet) return;

    const opts = { passive: false };
    const passiveOpts = { passive: true };

    handle.addEventListener('touchstart', onTouchStart, passiveOpts);
    sheet.addEventListener('touchstart', onTouchStart, passiveOpts);
    sheet.addEventListener('touchmove', onTouchMove, opts);
    sheet.addEventListener('touchend', onTouchEnd, passiveOpts);

    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // Initialize to peek position when sheet ref is available
  const initSheet = useCallback(() => {
    if (sheetRef.current) {
      snapTo(0);
    }
  }, [snapTo]);

  return {
    sheetRef,
    handleRef,
    snapTo,
    dismiss,
    snapIndex,
    initSheet,
  };
}
