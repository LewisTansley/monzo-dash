<template>
  <div
    v-if="isBare"
    class="applet-shell applet-shell--bare">
    <slot />
  </div>
  <div
    v-else-if="isMobileGrid && mobileFoldWide"
    class="applet-shell applet-shell--mobile applet-shell--fold-wide">
    <div class="applet-shell__fold-rail applet-shell__fold-rail--left">
      <slot name="left" />
    </div>
    <div class="applet-shell__mobile-center applet-shell__chrome">
      <slot />
    </div>
    <div v-if="hasRightColumn" class="applet-shell__fold-rail applet-shell__fold-rail--right">
      <slot name="right" />
    </div>
  </div>
  <div
    v-else-if="isMobileGrid && mobileFoldDual"
    class="applet-shell applet-shell--mobile applet-shell--fold-dual"
    @touchstart.passive="onSwipeTouchStart"
    @touchmove.passive="onSwipeTouchMove"
    @touchend.passive="onSwipeTouchEnd">
    <div class="applet-shell__fold-rail applet-shell__fold-rail--left">
      <slot name="left" />
    </div>
    <div class="applet-shell__mobile-center applet-shell__chrome">
      <slot />
    </div>
    <div
      v-if="mobileDrawerScrim"
      class="applet-shell__scrim"
      aria-hidden="true"
      @click="hideRight" />
    <aside
      v-if="hasRightColumn"
      class="applet-shell__drawer applet-shell__drawer--right"
      :class="{ 'is-open': effectiveRightVisible }"
      aria-hidden="false">
      <button
        type="button"
        class="applet-shell__drawer-close"
        aria-label="Close sidebar"
        @click="hideRight">
        ×
      </button>
      <div class="applet-shell__drawer-body">
        <slot name="right" />
      </div>
    </aside>
    <AppletShellEdgeReveal
      v-if="showRightEdgeReveal"
      side="right"
      @reveal="revealRight" />
  </div>
  <div
    v-else-if="isMobileGrid"
    class="applet-shell applet-shell--mobile"
    :class="{ 'applet-shell--drawer-open': mobileDrawerScrim }"
    @touchstart.passive="onSwipeTouchStart"
    @touchmove.passive="onSwipeTouchMove"
    @touchend.passive="onSwipeTouchEnd">
    <div class="applet-shell__mobile-center applet-shell__chrome">
      <slot />
    </div>
    <div
      v-if="mobileDrawerScrim"
      class="applet-shell__scrim"
      aria-hidden="true"
      @click="closeAllDrawers" />
    <aside
      class="applet-shell__drawer applet-shell__drawer--left"
      :class="{ 'is-open': effectiveLeftVisible }"
      aria-hidden="false">
      <button
        type="button"
        class="applet-shell__drawer-close"
        aria-label="Close sidebar"
        @click="hideLeft">
        ×
      </button>
      <div class="applet-shell__drawer-body">
        <slot name="left" />
      </div>
    </aside>
    <aside
      v-if="hasRightColumn"
      class="applet-shell__drawer applet-shell__drawer--right"
      :class="{ 'is-open': effectiveRightVisible }"
      aria-hidden="false">
      <button
        type="button"
        class="applet-shell__drawer-close"
        aria-label="Close sidebar"
        @click="hideRight">
        ×
      </button>
      <div class="applet-shell__drawer-body">
        <slot name="right" />
      </div>
    </aside>
    <AppletShellEdgeReveal
      v-if="showLeftEdgeReveal"
      side="left"
      @reveal="revealLeft" />
    <AppletShellEdgeReveal
      v-if="showRightEdgeReveal"
      side="right"
      @reveal="revealRight" />
  </div>
  <div
    v-else
    class="applet-shell applet-shell--grid"
    :class="{ 'applet-shell--segmented': gridSegmented }">
    <div
      class="applet-shell__cell applet-shell__cell--left applet-shell__flex-rail"
      :class="{ 'is-collapsed': !effectiveLeftVisible }">
      <div class="applet-shell__rail-pane applet-shell__rail-pane--left">
        <slot name="left" />
      </div>
    </div>
    <div
      class="applet-shell__cell applet-shell__cell--gutter applet-shell__cell--gutter-left applet-shell__flex-gutter"
      :class="{ 'is-collapsed': !effectiveLeftVisible }">
      <button
        type="button"
        class="applet-shell__gutter-hit applet-shell__gutter-hit--left"
        aria-label="Hide left sidebar"
        aria-expanded="true"
        @click="hideLeft">
        <span class="applet-shell__chevron-wrap" aria-hidden="true">
          <svg
            class="applet-shell__chevron-svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M7 3L4 6L7 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </span>
      </button>
    </div>
    <div
      class="applet-shell__cell applet-shell__center"
      :class="centerChromeClass">
      <slot />
    </div>
    <template v-if="hasRightColumn">
      <div
        class="applet-shell__cell applet-shell__cell--gutter applet-shell__cell--gutter-right applet-shell__flex-gutter"
        :class="{ 'is-collapsed': !effectiveRightVisible }">
        <button
          type="button"
          class="applet-shell__gutter-hit applet-shell__gutter-hit--right"
          aria-label="Hide right sidebar"
          aria-expanded="true"
          @click="hideRight">
          <span class="applet-shell__chevron-wrap" aria-hidden="true">
            <svg
              class="applet-shell__chevron-svg"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 3L8 6L5 9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
      <div
        class="applet-shell__cell applet-shell__cell--right applet-shell__flex-rail"
        :class="{ 'is-collapsed': !effectiveRightVisible }">
        <div class="applet-shell__rail-pane applet-shell__rail-pane--right">
          <slot name="right" />
        </div>
      </div>
    </template>
    <AppletShellEdgeReveal
      v-if="showLeftEdgeReveal"
      side="left"
      @reveal="revealLeft" />
    <AppletShellEdgeReveal
      v-if="showRightEdgeReveal"
      side="right"
      @reveal="revealRight" />
  </div>
</template>

<script>
import { useAppletTransitionStore } from '@/stores/appletTransition'
import { useLayoutStore } from '@/stores/layout.js'
import { createSwipeDrawerHandlers } from '@/composables/useSwipeDrawer.js'
import AppletShellEdgeReveal from './AppletShellEdgeReveal.vue'

export default {
  name: 'AppletShell',
  components: { AppletShellEdgeReveal },
  props: {
    variant: {
      type: String,
      default: 'grid',
      validator: (v) => ['grid', 'bare'].includes(v)
    },
    leftVisible: {
      type: Boolean,
      default: true
    },
    rightVisible: {
      type: Boolean,
      default: true
    },
    hasRightColumn: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:leftVisible', 'update:rightVisible'],
  data() {
    return {
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 640,
      swipeHandlers: null
    }
  },
  computed: {
    layoutStore() {
      return useLayoutStore()
    },
    appletTransition() {
      return useAppletTransitionStore()
    },
    effectiveLeftVisible() {
      return this.leftVisible && !this.appletTransition.railsCollapsedForRoute
    },
    effectiveRightVisible() {
      if (!this.hasRightColumn) return false
      return this.rightVisible && !this.appletTransition.railsCollapsedForRoute
    },
    isBare() {
      return this.variant === 'bare'
    },
    isMobileGrid() {
      return this.variant === 'grid' && this.layoutStore.isMobileLayout
    },
    mobileFoldWide() {
      return this.isMobileGrid && this.layoutStore.foldableWide
    },
    mobileFoldDual() {
      return (
        this.isMobileGrid &&
        this.layoutStore.foldableSpanning &&
        !this.layoutStore.foldableWide &&
        this.viewportWidth >= 640
      )
    },
    mobileDrawerScrim() {
      if (this.mobileFoldWide) return false
      if (this.mobileFoldDual) return this.effectiveRightVisible
      return this.effectiveLeftVisible || this.effectiveRightVisible
    },
    gridSegmented() {
      if (!this.hasRightColumn) return this.effectiveLeftVisible
      return this.effectiveLeftVisible || this.effectiveRightVisible
    },
    showLeftEdgeReveal() {
      return !this.effectiveLeftVisible && !this.appletTransition.railsCollapsedForRoute
    },
    showRightEdgeReveal() {
      return (
        this.hasRightColumn &&
        !this.effectiveRightVisible &&
        !this.appletTransition.railsCollapsedForRoute
      )
    },
    centerChromeClass() {
      if (!this.gridSegmented) return null
      return {
        'applet-shell__chrome': true,
        'applet-shell__chrome-center': true,
        'applet-shell__chrome-center--left-open': this.effectiveLeftVisible,
        'applet-shell__chrome-center--right-open': this.hasRightColumn && this.effectiveRightVisible
      }
    }
  },
  watch: {
    mobileFoldDual: {
      immediate: true,
      handler(isDual) {
        if (!this.isMobileGrid || this.mobileFoldWide) return
        if (isDual) {
          this.$emit('update:leftVisible', true)
          this.$emit('update:rightVisible', false)
        } else {
          this.$emit('update:leftVisible', false)
          this.$emit('update:rightVisible', false)
        }
      }
    },
    mobileFoldWide: {
      immediate: true,
      handler(isWide) {
        if (!this.isMobileGrid) return
        if (isWide) {
          this.$emit('update:leftVisible', true)
          if (this.hasRightColumn) this.$emit('update:rightVisible', true)
        } else if (!this.mobileFoldDual) {
          this.$emit('update:leftVisible', false)
          this.$emit('update:rightVisible', false)
        }
      }
    },
    isMobileGrid: {
      immediate: true,
      handler(isMobile) {
        if (isMobile && !this.mobileFoldDual && !this.mobileFoldWide) {
          this.$emit('update:leftVisible', false)
          this.$emit('update:rightVisible', false)
        }
      }
    }
  },
  mounted() {
    this.initSwipeHandlers()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onViewportResize)
    }
  },
  beforeUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onViewportResize)
    }
  },
  methods: {
    onViewportResize() {
      this.viewportWidth = window.innerWidth
    },
    initSwipeHandlers() {
      this.swipeHandlers = createSwipeDrawerHandlers({
        edgeWidth: 40,
        openThreshold: 36,
        isLeftOpen: () => (this.mobileFoldDual ? false : this.effectiveLeftVisible),
        isRightOpen: () => this.effectiveRightVisible,
        onOpenLeft: () => {
          if (!this.mobileFoldDual) this.revealLeft()
        },
        onOpenRight: () => this.revealRight(),
        onCloseLeft: () => {
          if (!this.mobileFoldDual) this.hideLeft()
        },
        onCloseRight: () => this.hideRight()
      })
    },
    onSwipeTouchStart(e) {
      if (this.mobileFoldWide) return
      this.swipeHandlers?.onTouchStart(e)
    },
    onSwipeTouchMove(e) {
      if (this.mobileFoldWide) return
      if (this.mobileFoldDual && this.effectiveLeftVisible && !this.effectiveRightVisible) {
        this.swipeHandlers?.onTouchMove(e)
        return
      }
      if (!this.mobileFoldDual) {
        this.swipeHandlers?.onTouchMove(e)
      }
    },
    onSwipeTouchEnd(e) {
      this.swipeHandlers?.onTouchEnd(e)
    },
    hideLeft() {
      this.$emit('update:leftVisible', false)
    },
    hideRight() {
      this.$emit('update:rightVisible', false)
    },
    revealLeft() {
      if (this.mobileFoldDual) return
      this.$emit('update:leftVisible', true)
    },
    revealRight() {
      this.$emit('update:rightVisible', true)
    },
    closeAllDrawers() {
      this.hideLeft()
      this.hideRight()
    }
  }
}
</script>

<style scoped>
.applet-shell--bare {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* --- Mobile shell --- */
.applet-shell--mobile {
  --applet-shell-dur: 0.28s;
  --applet-shell-ease: cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  touch-action: pan-y;
}

.applet-shell--mobile.applet-shell--fold-dual,
.applet-shell--mobile.applet-shell--fold-wide {
  padding: var(--sw-applet-padding, 8px);
  gap: var(--sw-applet-gap, 8px);
  background: var(--sw-applet-segmented-bg, #1e1e2e);
}

.applet-shell__mobile-center {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__fold-rail {
  flex: 0 0 auto;
  width: var(--sw-mobile-drawer-width, min(88vw, 320px));
  max-width: var(--sw-mobile-drawer-width, min(88vw, 320px));
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--sw-chrome-radius-inner, 8px);
  background: var(--sw-sidebar-stack-overlay, #00000020);
}

.applet-shell__fold-rail--right {
  border-radius: var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__scrim {
  position: absolute;
  inset: 0;
  z-index: 140;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.applet-shell__drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 150;
  width: var(--sw-mobile-drawer-width, min(88vw, 320px));
  max-width: var(--sw-mobile-drawer-width, min(88vw, 320px));
  display: flex;
  flex-direction: column;
  background: var(--sw-applet-segmented-bg, #1e1e2e);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.35);
  transition: transform var(--applet-shell-dur) var(--applet-shell-ease);
  will-change: transform;
}

.applet-shell__drawer--left {
  left: 0;
  transform: translate3d(-100%, 0, 0);
  border-radius: 0 var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-inner, 8px) 0;
}

.applet-shell__drawer--right {
  right: 0;
  transform: translate3d(100%, 0, 0);
  border-radius: var(--sw-chrome-radius-inner, 8px) 0 0 var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__drawer.is-open {
  transform: translate3d(0, 0, 0);
}

.applet-shell__drawer-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.2);
  color: var(--sw-text-primary);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.applet-shell__drawer--right .applet-shell__drawer-close {
  right: auto;
  left: 8px;
}

.applet-shell__drawer-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (prefers-reduced-motion: reduce) {
  .applet-shell__drawer {
    transition-duration: 1ms;
  }
}

/* --- Desktop grid (unchanged) --- */
.applet-shell--grid {
  --applet-shell-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --applet-shell-dur: 0.38s;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
  gap: 0;
  transition:
    padding var(--applet-shell-dur) var(--applet-shell-ease),
    background-color var(--applet-shell-dur) var(--applet-shell-ease);
}

.applet-shell--grid.applet-shell--segmented {
  padding: var(--sw-applet-padding, 16px);
  background-color: var(--sw-applet-segmented-bg, #1e1e2e);
}

.applet-shell__flex-rail {
  flex: 0 0 auto;
  min-width: 0;
  width: var(--sw-sidebar-rail-width, 300px);
  max-width: var(--sw-sidebar-rail-width, 300px);
  margin-inline-end: 0;
  margin-inline-start: 0;
  overflow: hidden;
  transition:
    width var(--applet-shell-dur) var(--applet-shell-ease),
    max-width var(--applet-shell-dur) var(--applet-shell-ease),
    margin-inline-end var(--applet-shell-dur) var(--applet-shell-ease),
    margin-inline-start var(--applet-shell-dur) var(--applet-shell-ease);
}

.applet-shell__flex-gutter {
  flex: 0 0 auto;
  min-width: 0;
  width: var(--sw-applet-rail-gutter-width, 22px);
  max-width: var(--sw-applet-rail-gutter-width, 22px);
  margin-inline-end: 0;
  margin-inline-start: 0;
  overflow: hidden;
  transition:
    width var(--applet-shell-dur) var(--applet-shell-ease),
    max-width var(--applet-shell-dur) var(--applet-shell-ease),
    margin-inline-end var(--applet-shell-dur) var(--applet-shell-ease),
    margin-inline-start var(--applet-shell-dur) var(--applet-shell-ease);
}

.applet-shell__flex-rail.is-collapsed,
.applet-shell__flex-gutter.is-collapsed {
  width: 0;
  max-width: 0;
  pointer-events: none;
}

.applet-shell__rail-pane {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: var(--sw-sidebar-rail-width, 300px);
  max-width: var(--sw-sidebar-rail-width, 300px);
  height: 100%;
  transform: translate3d(0, 0, 0);
  transition: transform var(--applet-shell-dur) var(--applet-shell-ease);
}

.applet-shell__flex-rail.is-collapsed .applet-shell__rail-pane--left {
  transform: translate3d(-100%, 0, 0);
}

.applet-shell__flex-rail.is-collapsed .applet-shell__rail-pane--right {
  transform: translate3d(100%, 0, 0);
}

@supports (interpolate-size: allow-keywords) {
  .applet-shell__flex-rail,
  .applet-shell__flex-gutter {
    interpolate-size: allow-keywords;
  }
}

.applet-shell__cell {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.applet-shell__cell--gutter {
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.applet-shell__gutter-hit {
  flex: 1;
  align-self: stretch;
  min-height: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--sw-chrome-radius-inner, 8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--sw-text-secondary, #a0aec0);
  transition: background 0.2s ease, color 0.2s ease;
  pointer-events: auto;
}

.applet-shell__gutter-hit:hover {
  background: transparent;
  color: var(--sw-text-primary, #e5e7eb);
}

.applet-shell__gutter-hit:focus-visible {
  outline: 2px solid var(--sw-blue-bright, #66a3ff);
  outline-offset: 2px;
}

.applet-shell__chevron-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.applet-shell__chevron-svg {
  display: block;
  flex-shrink: 0;
}

.applet-shell__center {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: inherit;
  transition: border-radius var(--applet-shell-dur) var(--applet-shell-ease);
}

.applet-shell__chrome {
  box-sizing: border-box;
  border: none;
  background-color: var(--sw-space, #14141f);
}

.applet-shell__chrome-center {
  border-radius: var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__chrome-center--left-open:not(.applet-shell__chrome-center--right-open) {
  border-radius: var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-outer, 20px)
    var(--sw-chrome-radius-outer, 20px) var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__chrome-center--right-open:not(.applet-shell__chrome-center--left-open) {
  border-radius: var(--sw-chrome-radius-outer, 20px) var(--sw-chrome-radius-inner, 8px)
    var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-outer, 20px);
}

.applet-shell__chrome-center--left-open.applet-shell__chrome-center--right-open {
  border-radius: var(--sw-chrome-radius-inner, 8px);
}
</style>

<style>
[data-layout='mobile'] .applet-shell__drawer .sidebar-container.embedded,
[data-layout='mobile'] .applet-shell__fold-rail .sidebar-container.embedded {
  width: 100%;
  max-width: none;
}

[data-layout='mobile'] .applet-shell__drawer .sidebar-panel.embedded,
[data-layout='mobile'] .applet-shell__fold-rail .sidebar-panel.embedded {
  max-width: none;
}
</style>
