<template>
  <div
    v-if="isBare"
    class="applet-shell applet-shell--bare">
    <slot />
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
    <!-- Per-side edge hover: show rail again when hidden -->
    <div
      v-if="showLeftEdgeReveal"
      class="applet-shell__edge applet-shell__edge--left">
      <button
        type="button"
        class="applet-shell__edge-hit applet-shell__edge-hit--left"
        aria-label="Show left sidebar"
        @click="revealLeft">
        <span class="applet-shell__chevron-wrap" aria-hidden="true">
          <svg
            class="applet-shell__chevron-svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 3L7 6L4 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </span>
      </button>
    </div>
    <div
      v-if="showRightEdgeReveal"
      class="applet-shell__edge applet-shell__edge--right">
      <button
        type="button"
        class="applet-shell__edge-hit applet-shell__edge-hit--right"
        aria-label="Show right sidebar"
        @click="revealRight">
        <span class="applet-shell__chevron-wrap" aria-hidden="true">
          <svg
            class="applet-shell__chevron-svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 3L5 6L8 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<script>
import { useAppletTransitionStore } from '@/stores/appletTransition'

export default {
  name: 'AppletShell',
  props: {
    /** When `bare`, only the default slot is rendered full-size (e.g. embedded galaxy/project). */
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
    /** When false, layout is treated as left + center only (no right column / right edge reveal). */
    hasRightColumn: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:leftVisible', 'update:rightVisible'],
  computed: {
    appletTransition() {
      return useAppletTransitionStore()
    },
    /** Merges parent v-model with global route transition (rails hide during page change). */
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
  methods: {
    hideLeft() {
      this.$emit('update:leftVisible', false)
    },
    hideRight() {
      this.$emit('update:rightVisible', false)
    },
    revealLeft() {
      this.$emit('update:leftVisible', true)
    },
    revealRight() {
      this.$emit('update:rightVisible', true)
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

/* Outer inset for the whole applet row */
.applet-shell--grid.applet-shell--segmented {
  padding: var(--sw-applet-padding, 16px);
  background-color: var(--sw-applet-segmented-bg, #1e1e2e);
}

/*
 * Flex rails/gutters: clip rail width 0 ↔ token while inner pane translates so the
 * sidebar visibly slides off (flex min-size:auto on descendants otherwise snaps width).
 * Margins replace column-gap so collapsed pairs leave no gap bands.
 */
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

/* Inner track stays full rail width; translate slides it out while outer clips */
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

/* Segmented chrome: fill + asymmetric radii (no frame border) */
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

/*
 * Collapsed rail: absolute overlay only (no grid width).
 * At rest: narrow invisible sensor. Hover/focus: width grows to peek so the affordance
 * stays hit-testable while moving onto the chevron (avoids mouseleave gap).
 */
.applet-shell__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 50;
  width: var(--sw-edge-hit-sensor-width, 12px);
  pointer-events: auto;
  overflow: hidden;
  transition: width 0.26s cubic-bezier(0.4, 0, 0.2, 1);
}

.applet-shell__edge--left {
  left: 0;
}

.applet-shell__edge--right {
  right: 0;
}

.applet-shell__edge:hover,
.applet-shell__edge:focus-within {
  width: var(--sw-edge-reveal-peek, 36px);
}

.applet-shell__edge-hit {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: transparent;
  color: var(--sw-text-muted, #6b7280);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, background 0.2s ease, color 0.2s ease;
}

.applet-shell__edge-hit--left {
  border-radius: 0 var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-inner, 8px) 0;
}

.applet-shell__edge-hit--right {
  border-radius: var(--sw-chrome-radius-inner, 8px) 0 0 var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__edge:hover .applet-shell__edge-hit,
.applet-shell__edge:focus-within .applet-shell__edge-hit {
  opacity: 1;
  pointer-events: auto;
  background: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.28);
  color: var(--sw-text-secondary, #a0aec0);
}

.applet-shell__edge-hit:hover {
  background: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.36);
}

.applet-shell__edge-hit:focus-visible {
  outline: 2px solid var(--sw-blue-bright, #66a3ff);
  outline-offset: -1px;
}
</style>
