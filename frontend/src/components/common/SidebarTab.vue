<template>
  <div
    v-if="tabs && tabs.length > 1"
    class="sidebar-tabs"
    :class="{ right: isRight, collapsed: isCollapsed, embedded: embedded }"
    role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="sidebar-tab sidebar-tab-button"
      :class="{
        active: activeTab === tab.id,
        right: isRight
      }"
      role="tab"
      :aria-selected="activeTab === tab.id"
      @click="$emit('tab-change', tab.id)">
      <span class="tab-text">{{ tab.text }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'SidebarTab',
  props: {
    tabs: {
      type: Array,
      required: true
      /* [{ id, text }, ...] */
    },
    activeTab: {
      type: String,
      required: true
    },
    isRight: {
      type: Boolean,
      default: false
    },
    isCollapsed: {
      type: Boolean,
      default: false
    },
    embedded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['tab-change']
}
</script>

<style scoped>
.sidebar-tabs {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  align-items: stretch;
  width: 100%;
  gap: 3px;
  padding: 0;
  box-sizing: border-box;
  z-index: 2;
  background-color: var(--sw-applet-segmented-bg);
}

.sidebar-tab-button {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 12px 6px;
  border: none;
  border-radius: var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-inner, 8px) 0 0;
  background-color: var(--sw-tab-inactive-bg);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  font: inherit;
}

.sidebar-tab-button:focus-visible {
  outline: 2px solid var(--sw-border-strong, #4a5063);
  outline-offset: 2px;
}

.sidebar-tab-button:not(.active):hover {
  background-color: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.12);
}

.sidebar-tab-button.active {
  background-color: var(--sw-tab-active-bg);
}

.sidebar-tab-button .tab-text {
  color: var(--sw-text-secondary, #a0aec0);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.2;
}

.sidebar-tab-button.active .tab-text {
  color: var(--sw-text-secondary, #a0aec0);
}

.sidebar-tabs.collapsed {
  opacity: 0;
  pointer-events: none;
}
</style>
