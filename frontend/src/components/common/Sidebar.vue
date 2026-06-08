<template>
  <div
    class="sidebar-container"
    :class="{ right: isRight, collapsed: isCollapsed, embedded: embedded }">
    <!-- Toggle: toward applet (inner edge); in legacy float mode, same outward notch -->
    <div
      class="toggle-notch"
      :class="{
        right: isRight,
        collapsed: isCollapsed,
        embedded: embedded
      }"
      @click="toggleCollapsed">
      <div class="notch-icon">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          :class="{ rotated: isCollapsed && !isRight, 'rotated-right': isCollapsed && isRight }">
          <path
            d="M4 3L7 6L4 9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <div class="sidebar-panel" :class="{ right: isRight, embedded: embedded }">
      <SidebarTab
        v-if="showSidebarTabs"
        :tabs="effectiveTabs"
        :activeTab="activeTab"
        :isRight="isRight"
        :isCollapsed="isCollapsed"
        :embedded="embedded"
        @tab-change="handleTabChange" />
      <div class="sidebar-panel__body">
        <Transition
          name="sw-sidebar-body"
          mode="out-in"
          @before-enter="onBeforeBodyEnter"
          @enter="onBodyEnter"
          @after-enter="onAfterBodyEnter">
          <div
            :key="bodyTransitionKey"
            class="sw-sidebar-body-inner"
            :class="{ right: isRight }">
            <CustomScrollbar ref="contentScroll" class="sidebar-content" @scroll="onContentScroll">
              <h2 class="sidebar-title">{{ currentTitle }}</h2>

              <div v-if="tabs && tabs.length > 0" class="tabbed-content">
                <slot :name="activeTab" :activeTab="activeTab"></slot>
              </div>

              <div v-else class="legacy-content">
                <slot></slot>
              </div>
            </CustomScrollbar>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script>
import SidebarTab from './SidebarTab.vue'
import CustomScrollbar from '../CustomScrollbar.vue'

const MAX_STAGGER_ITEMS = 16

export default {
  name: 'SidebarPanel',
  components: {
    SidebarTab,
    CustomScrollbar
  },
  props: {
    title: {
      type: String,
      required: true
    },
    tabText: {
      type: String,
      default: ''
    },
    isRight: {
      type: Boolean,
      default: false
    },
    /** When true, panel lives in AppletShell grid (no absolute overlay / slide-off transform). */
    embedded: {
      type: Boolean,
      default: false
    },
    tabs: {
      type: Array,
      default: () => []
    },
    defaultTab: {
      type: String,
      default: null
    },
    /** Bump to replay body enter animation without changing tab id (e.g. async reload). */
    contentKey: {
      type: [String, Number],
      default: ''
    }
  },
  data() {
    return {
      isCollapsed: false,
      activeTab: this.getInitialTab()
    }
  },
  computed: {
    currentTitle() {
      return this.title
    },
    effectiveTabs() {
      if (!this.tabs || this.tabs.length === 0) {
        return [{
          id: 'default',
          text: this.tabText || this.title.toUpperCase(),
          title: this.title
        }]
      }
      return this.tabs
    },
    showSidebarTabs() {
      return this.effectiveTabs.length > 1
    },
    bodyTransitionKey() {
      return `${this.activeTab}::${this.contentKey}`
    }
  },
  methods: {
    getInitialTab() {
      if (this.tabs && this.tabs.length > 0) {
        return this.defaultTab || this.tabs[0].id
      }
      return 'default'
    },
    handleTabChange(tabId) {
      this.activeTab = tabId
      this.$emit('tab-change', tabId)
    },
    toggleCollapsed() {
      this.isCollapsed = !this.isCollapsed
      // true = user hid the sidebar (same as legacy “collapsed”)
      this.$emit('sidebar-toggle', this.isCollapsed)
    },
    getScrollElement() {
      return this.$refs.contentScroll?.$refs?.content ?? null
    },
    onContentScroll(scrollTop) {
      this.$emit('content-scroll', { scrollTop, el: this.getScrollElement() })
    },
    prefersReducedMotion() {
      if (typeof window === 'undefined' || !window.matchMedia) return false
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    readTokenPx(name, fallback) {
      if (typeof document === 'undefined') return fallback
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      if (!raw) return fallback
      const n = parseFloat(raw)
      return Number.isFinite(n) ? n : fallback
    },
    readTokenMs(name, fallback) {
      if (typeof document === 'undefined') return fallback
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      if (!raw) return fallback
      const num = parseFloat(raw)
      if (!Number.isFinite(num)) return fallback
      if (raw.endsWith('ms')) return num
      if (raw.endsWith('s')) return num * 1000
      return num
    },
    getStaggerTargets(el) {
      const panel = el.querySelector('.tabbed-content, .legacy-content')
      const staggerRoot = el.querySelector('[data-sidebar-stagger-root]')
      let targets = []
      if (staggerRoot) {
        targets = [...staggerRoot.children].filter(n => n.nodeType === Node.ELEMENT_NODE)
      } else if (panel) {
        targets = [...panel.children].filter(n => n.nodeType === Node.ELEMENT_NODE)
      }
      return { panel, targets: targets.slice(0, MAX_STAGGER_ITEMS) }
    },
    primeEnterHidden(el) {
      const slide = this.readTokenPx('--sw-sidebar-body-slide', 20)
      const fromX = this.isRight ? slide : -slide
      const tx = `translateX(${fromX}px)`
      const { panel, targets } = this.getStaggerTargets(el)
      if (panel) {
        panel.style.opacity = '0'
      }
      const title = el.querySelector('.sidebar-title')
      if (title) {
        title.style.opacity = '0'
        title.style.transform = tx
      }
      targets.forEach(node => {
        node.style.opacity = '0'
        node.style.transform = tx
      })
    },
    clearPrimedStyles(el) {
      const { panel, targets } = this.getStaggerTargets(el)
      if (panel) {
        panel.style.opacity = ''
      }
      const title = el.querySelector('.sidebar-title')
      if (title) {
        title.style.opacity = ''
        title.style.transform = ''
      }
      targets.forEach(node => {
        node.style.opacity = ''
        node.style.transform = ''
      })
    },
    onBeforeBodyEnter(el) {
      if (this.prefersReducedMotion()) return
      this.primeEnterHidden(el)
    },
    onBodyEnter(el, done) {
      if (this.prefersReducedMotion()) {
        this.clearPrimedStyles(el)
        done()
        return
      }

      const slide = this.readTokenPx('--sw-sidebar-body-slide', 20)
      const fromX = this.isRight ? slide : -slide
      const containerMs = this.readTokenMs('--sw-sidebar-body-duration-panel', 160)
      const itemMs = this.readTokenMs('--sw-sidebar-body-item-duration', 340)
      const stepMs = this.readTokenMs('--sw-sidebar-body-stagger-step', 42)
      const staggerStart = this.readTokenMs('--sw-sidebar-body-stagger-start', 90)

      const { panel, targets } = this.getStaggerTargets(el)
      const title = el.querySelector('.sidebar-title')

      const promises = []

      if (panel) {
        const a = panel.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: containerMs, easing: 'ease', fill: 'forwards' }
        )
        promises.push(a.finished)
      }

      if (title) {
        const a = title.animate(
          [
            { opacity: 0, transform: `translateX(${fromX}px)` },
            { opacity: 1, transform: 'translateX(0)' }
          ],
          { duration: itemMs, delay: staggerStart, easing: 'ease', fill: 'forwards' }
        )
        promises.push(a.finished)
      }

      const titleBump = title ? 24 : 0
      targets.forEach((node, i) => {
        const delay = staggerStart + titleBump + i * stepMs
        const a = node.animate(
          [
            { opacity: 0, transform: `translateX(${fromX}px)` },
            { opacity: 1, transform: 'translateX(0)' }
          ],
          { duration: itemMs, delay, easing: 'ease', fill: 'forwards' }
        )
        promises.push(a.finished)
      })

      Promise.all(promises)
        .then(() => done())
        .catch(() => done())
    },
    onAfterBodyEnter(el) {
      this.clearPrimedStyles(el)
    }
  },
  watch: {
    tabs: {
      immediate: true,
      handler(newTabs) {
        if (newTabs && newTabs.length > 0 && !this.activeTab) {
          this.activeTab = this.defaultTab || newTabs[0].id
        } else if (!newTabs || newTabs.length === 0) {
          this.activeTab = 'default'
        }
      }
    },
    defaultTab: {
      immediate: false,
      handler(newDefaultTab) {
        if (newDefaultTab && this.tabs && this.tabs.some(tab => tab.id === newDefaultTab)) {
          this.activeTab = newDefaultTab
        }
      }
    }
  },
  emits: ['tab-change', 'sidebar-toggle', 'content-scroll']
}
</script>

<style scoped>
.sidebar-container {
  position: relative;
  width: var(--sw-sidebar-rail-width, 300px);
  height: 100%;
  background-color: transparent;
  transition: transform 0.3s ease;
}

.sidebar-container.embedded {
  width: 100%;
  max-width: var(--sw-sidebar-panel-max, 300px);
  min-width: 0;
  height: 100%;
  min-height: 0;
  background-color: transparent;
}

.sidebar-container.collapsed:not(.embedded) {
  transform: translateX(calc(-1 * var(--sw-sidebar-rail-width, 300px)));
}

.sidebar-container.right {
  width: var(--sw-sidebar-rail-width, 300px);
}

.sidebar-container.right.collapsed:not(.embedded) {
  transform: translateX(var(--sw-sidebar-rail-width, 300px));
}

.toggle-notch {
  position: absolute;
  bottom: 20px;
  right: -40px;
  width: 40px;
  height: 60px;
  background-color: var(--sw-panel-inset, #1a1d24);
  border: none;
  border-radius: 0 var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-inner, 8px) 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 100000;
  backdrop-filter: blur(10px);
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.2);
}

.toggle-notch.embedded {
  /* Collapse/expand lives on AppletShell gutter; avoid duplicate control */
  display: none;
}

.toggle-notch.right {
  right: auto;
  left: -40px;
  border-radius: var(--sw-chrome-radius-inner, 8px) 0 0 var(--sw-chrome-radius-inner, 8px);
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.2);
}

.toggle-notch:hover {
  background-color: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.12);
}

.toggle-notch.collapsed {
  background-color: var(--sw-blue-muted, #69739c);
}

.toggle-notch.collapsed:hover {
  background-color: var(--sw-blue-muted-alpha50, rgba(105, 115, 156, 0.5));
}

.notch-icon {
  color: var(--sw-text-secondary, #a0aec0);
  transition: all 0.3s ease;
}

.toggle-notch.collapsed .notch-icon {
  color: var(--sw-white, #ffffff);
}

.notch-icon svg {
  transition: transform 0.3s ease;
}

.notch-icon svg.rotated {
  transform: rotate(180deg);
}

.notch-icon svg.rotated-right {
  transform: rotate(0deg);
}

.sidebar-panel {
  position: relative;
  width: var(--sw-sidebar-rail-width, 300px);
  height: 100%;
  min-height: 0;
  border-radius: var(--sw-chrome-radius-inner, 8px);
  transition: transform 0.3s ease;
  box-sizing: border-box;
  background-color: var(--sw-sidebar-stack-overlay, #00000020);
  display: flex;
  flex-direction: column;
}

.sidebar-panel__body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sw-sidebar-body-inner {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sw-sidebar-body-leave-active {
  transition:
    opacity var(--sw-sidebar-body-duration-leave, 240ms) ease,
    transform var(--sw-sidebar-body-duration-leave, 240ms) ease;
}

.sw-sidebar-body-leave-from {
  opacity: 1;
}

.sw-sidebar-body-leave-to {
  opacity: 0;
}

.sw-sidebar-body-inner:not(.right).sw-sidebar-body-leave-to {
  transform: translateX(calc(-1 * var(--sw-sidebar-body-slide, 20px)));
}

.sw-sidebar-body-inner.right.sw-sidebar-body-leave-to {
  transform: translateX(var(--sw-sidebar-body-slide, 20px));
}

@media (prefers-reduced-motion: reduce) {
  .sw-sidebar-body-leave-active {
    transition-duration: 1ms;
  }
}

.sidebar-panel.embedded {
  width: 100%;
  max-width: var(--sw-sidebar-panel-max, 300px);
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex: 1;
  backdrop-filter: blur(24px);
  border: none;
}

.sidebar-panel.embedded:not(.right) {
  border-radius: var(--sw-chrome-radius-outer, 20px) var(--sw-chrome-radius-inner, 8px)
    var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-outer, 20px);
}

.sidebar-panel.embedded.right {
  border-radius: var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-outer, 20px)
    var(--sw-chrome-radius-outer, 20px) var(--sw-chrome-radius-inner, 8px);
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: var(--sw-applet-padding, 16px);
  background-color: transparent;
}

/* Slot content: no frame borders; leave native form fields as authored */
.sidebar-panel .sidebar-content :deep(*:not(input):not(textarea):not(select):not(option)) {
  border-width: 0 !important;
  border-style: none !important;
}

/*
 * Interactable surfaces that were #2a2d3a in view styles → match inset card tone (#1e1e2e).
 * Scoped to sidebar body only (not modals / main canvas). !important wins over scoped SFC rules.
 */
.sidebar-panel .sidebar-content :deep(.hierarchy-card:not(.active)),
.sidebar-panel .sidebar-content :deep(.planet-item),
.sidebar-panel .sidebar-content :deep(.galaxy-item:not(.active)),
.sidebar-panel .sidebar-content :deep(.constellation-item),
.sidebar-panel .sidebar-content :deep(.project-item),
.sidebar-panel .sidebar-content :deep(.flight-card:not(.active)),
.sidebar-panel .sidebar-content :deep(.new-team-btn),
.sidebar-panel .sidebar-content :deep(.conversation-row:not(.active)),
.sidebar-panel .sidebar-content :deep(.cancel-search-btn),
.sidebar-panel .sidebar-content :deep(.user-row:not(.active)),
.sidebar-panel .sidebar-content :deep(.filter-item:not(.active)),
.sidebar-panel .sidebar-content :deep(.flight-item:not(.active)),
.sidebar-panel .sidebar-content :deep(.new-item-btn),
.sidebar-panel .sidebar-content :deep(.new-galaxy-btn),
.sidebar-panel .sidebar-content :deep(.new-star-btn),
.sidebar-panel .sidebar-content :deep(.goto-galaxy-btn),
.sidebar-panel .sidebar-content :deep(.department-group),
.sidebar-panel .sidebar-content :deep(.team-item:not(.active)),
.sidebar-panel .sidebar-content :deep(.department-item:not(.active)),
.sidebar-panel .sidebar-content :deep(.action-btn.secondary),
.sidebar-panel .sidebar-content :deep(.form-select),
.sidebar-panel .sidebar-content :deep(.form-select option),
.sidebar-panel .sidebar-content :deep(.form-input),
.sidebar-panel .sidebar-content :deep(.moon-card:hover:not(.active)),
.sidebar-panel .sidebar-content :deep(.team-item-nested:hover),
.sidebar-panel .sidebar-content :deep(.constellation-star-item:hover:not(.active)),
.sidebar-panel .sidebar-content :deep(.detail-input:focus),
.sidebar-panel .sidebar-content :deep(.detail-select:focus),
.sidebar-panel .sidebar-content :deep(.detail-textarea:focus),
.sidebar-panel .sidebar-content :deep(.thread-input input) {
  background-color: var(--sw-applet-segmented-bg, #1e1e2e) !important;
}

.sidebar-title {
  color: var(--sw-text-muted, #6b7280);
  font-size: 1.2rem;
  margin-bottom: 20px;
}

.tabbed-content,
.legacy-content {
  min-height: 0;
  padding: var(--sw-sidebar-interactable-padding, 8px);
  background-color: var(--sw-sidebar-stack-overlay, #00000020);
  border-radius: var(--sw-chrome-radius-inner, 8px);
}

/* Legacy overlay sidebars: parent adds class floating-sidebar on the same root */
.sidebar-container.floating-sidebar:not(.embedded) {
  position: absolute;
  top: 20px;
  width: 300px;
  height: calc(100vh - 140px);
  backdrop-filter: blur(128px);
  border: none;
  border-radius: var(--sw-chrome-radius-inner, 8px);
  z-index: 100000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
</style>
