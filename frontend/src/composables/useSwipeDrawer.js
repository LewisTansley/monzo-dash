const DEFAULT_EDGE = 24
const OPEN_THRESHOLD = 48
const CLOSE_THRESHOLD = 64
const MAX_VERTICAL_DRIFT = 80

/**
 * Touch handlers for edge-swipe drawer open/close on mobile AppletShell.
 * Returns passive-friendly handlers to attach to the mobile shell root.
 */
export function createSwipeDrawerHandlers({
  edgeWidth = DEFAULT_EDGE,
  openThreshold = OPEN_THRESHOLD,
  getViewportWidth = () => window.innerWidth,
  isLeftOpen,
  isRightOpen,
  onOpenLeft,
  onOpenRight,
  onCloseLeft,
  onCloseRight,
  prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}) {
  let startX = 0
  let startY = 0
  let tracking = null // 'left-edge' | 'right-edge' | 'left-drawer' | 'right-drawer' | null

  function onTouchStart(e) {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    const w = getViewportWidth()

    if (isLeftOpen()) {
      tracking = 'left-drawer'
      return
    }
    if (isRightOpen()) {
      tracking = 'right-drawer'
      return
    }

    if (startX <= edgeWidth) {
      tracking = 'left-edge'
    } else if (startX >= w - edgeWidth) {
      tracking = 'right-edge'
    } else {
      tracking = null
    }
  }

  function onTouchMove(e) {
    if (!tracking || e.touches.length !== 1) return
    const touch = e.touches[0]
    const dx = touch.clientX - startX
    const dy = Math.abs(touch.clientY - startY)
    if (dy > MAX_VERTICAL_DRIFT) {
      tracking = null
      return
    }

    if (tracking === 'left-edge' && dx >= openThreshold) {
      onOpenLeft()
      tracking = null
    } else if (tracking === 'right-edge' && dx <= -openThreshold) {
      onOpenRight()
      tracking = null
    } else if (tracking === 'left-drawer' && dx <= -CLOSE_THRESHOLD) {
      onCloseLeft()
      tracking = null
    } else if (tracking === 'right-drawer' && dx >= CLOSE_THRESHOLD) {
      onCloseRight()
      tracking = null
    }
  }

  function onTouchEnd() {
    tracking = null
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    prefersReducedMotion
  }
}
