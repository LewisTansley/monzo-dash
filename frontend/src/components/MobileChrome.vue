<template>
  <div class="mobile-chrome">
    <header class="mobile-top-bar">
      <div class="mobile-top-bar__brand">
        <img src="@/assets/logo-mark.svg" alt="" class="mobile-top-bar__logo" />
        <h1 class="mobile-top-bar__title">{{ pageTitle }}</h1>
      </div>
      <div class="mobile-top-bar__actions">
        <AutomationActivityNotifier v-if="vault.unlocked" />
        <span class="status-pill" :class="statusClass">{{ statusLabel }}</span>
      </div>
    </header>

    <nav class="mobile-tab-bar" aria-label="Main navigation">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="mobile-tab"
        :class="{ active: isActive(tab) }">
        <span class="mobile-tab__icon" v-html="tab.icon" />
        <span class="mobile-tab__label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script>
import { useVaultStore } from '@/stores/vault.js'
import { resolveAppPath } from '@/utils/appPaths.js'
import AutomationActivityNotifier from '@/components/automations/AutomationActivityNotifier.vue'

const ROUTE_TITLES = {
  Dashboard: 'Dashboard',
  Transactions: 'Transactions',
  Automations: 'Automations',
  AffordabilityChecker: 'Budget',
  Settings: 'Settings',
  AutomationNew: 'Edit',
  AutomationEditor: 'Edit',
  AutomationGroupNew: 'Edit',
  AutomationGroupEditor: 'Edit',
  MobileDashboard: 'Dashboard',
  MobileTransactions: 'Transactions',
  MobileAutomations: 'Automations',
  MobileAffordabilityChecker: 'Budget',
  MobileSettings: 'Settings',
  MobileAutomationGroupNew: 'Edit',
  MobileAutomationGroupEditor: 'Edit'
}

const NAV_ICON = {
  dashboard:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  transactions:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6H20M8 12H20M8 18H20M4 6H4.01M4 12H4.01M4 18H4.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  automations:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  budget:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 7H16M8 11H10M12 11H14M16 11H16.01M8 15H10M12 15H14M16 15H16.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  settings:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 15C19.1277 15.6175 18.6736 16.1373 18.1 16.48L18.04 16.54C17.8046 16.7718 17.6205 17.0502 17.5 17.357V17.357C17.3795 17.6638 17.3248 17.9925 17.34 18.32V18.38C17.34 19.4469 16.4769 20.31 15.41 20.31H15.35C15.0225 20.3248 14.6938 20.2701 14.387 20.15V20.15C14.0802 20.0295 13.8018 19.8454 13.57 19.61L13.51 19.55C13.1373 19.1764 12.6175 18.7223 12 18.45H11.94C11.3225 18.1777 10.8027 17.7236 10.45 17.15L10.39 17.09C10.1582 16.8546 9.97383 16.5762 9.85333 16.2694V16.2694C9.73283 15.9626 9.67812 15.6339 9.69333 15.306V15.246C9.69333 14.1791 8.83043 13.3162 7.76357 13.3162H7.70357C7.37567 13.301 7.04697 13.3557 6.74017 13.4762V13.4762C6.43337 13.5967 6.15497 13.7808 5.92317 14.015L5.86317 14.075C5.48957 14.4477 5.03547 14.9018 4.76317 15.519H4.70317C4.43087 16.1365 3.97677 16.5906 3.50317 16.963L3.44317 17.023C3.20837 17.2548 3.02427 17.5332 2.90377 17.84V17.84C2.78327 18.1468 2.72857 18.4755 2.74377 18.8034V18.8634C2.74377 19.9303 3.60667 20.7932 4.67357 20.7932H4.73357" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
}

export default {
  name: 'MobileChrome',
  components: { AutomationActivityNotifier },
  computed: {
    vault() {
      return useVaultStore()
    },
    pageTitle() {
      return ROUTE_TITLES[this.$route.name] || 'Monzo Dash'
    },
    tabs() {
      return [
        { path: resolveAppPath('/'), label: 'Home', icon: NAV_ICON.dashboard, names: ['Dashboard', 'MobileDashboard'] },
        {
          path: resolveAppPath('/transactions'),
          label: 'Txns',
          icon: NAV_ICON.transactions,
          names: ['Transactions', 'MobileTransactions']
        },
        {
          path: resolveAppPath('/automations'),
          label: 'Auto',
          icon: NAV_ICON.automations,
          names: ['Automations', 'MobileAutomations', 'AutomationGroupNew', 'AutomationGroupEditor', 'MobileAutomationGroupNew', 'MobileAutomationGroupEditor']
        },
        {
          path: resolveAppPath('/budget'),
          label: 'Budget',
          icon: NAV_ICON.budget,
          names: ['AffordabilityChecker', 'MobileAffordabilityChecker']
        },
        {
          path: resolveAppPath('/settings'),
          label: 'Settings',
          icon: NAV_ICON.settings,
          names: ['Settings', 'MobileSettings']
        }
      ]
    },
    statusLabel() {
      if (!this.vault.unlocked) return 'locked'
      if (this.vault.isMonzoConnected) return 'connected'
      if (this.vault.hasMonzoTokens) return 'pending'
      return 'offline'
    },
    statusClass() {
      if (!this.vault.unlocked) return 'locked'
      if (this.vault.isMonzoConnected) return 'connected'
      if (this.vault.hasMonzoTokens) return 'pending'
      return 'disconnected'
    }
  },
  mounted() {
    this.vault.refreshStatus().catch(() => {})
  },
  methods: {
    isActive(tab) {
      if (tab.names.includes(this.$route.name)) return true
      if (tab.path === resolveAppPath('/automations')) {
        return String(this.$route.name || '').includes('Automation')
      }
      return false
    }
  }
}
</script>

<style scoped>
.mobile-chrome {
  flex-shrink: 0;
}

.mobile-top-bar {
  height: var(--sw-mobile-topbar-height, 48px);
  padding: 0 12px;
  padding-top: env(safe-area-inset-top, 0px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--sw-app-canvas);
  border-bottom: 1px solid var(--sw-border);
  z-index: 200;
}

.mobile-top-bar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mobile-top-bar__logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.mobile-top-bar__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-blue-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-top-bar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-pill {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--sw-applet-segmented-bg);
}

.status-pill.connected {
  color: var(--sw-success);
}

.status-pill.pending {
  color: var(--sw-warning);
}

.status-pill.locked {
  color: var(--sw-text-secondary);
}

.mobile-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  gap: 2px;
  padding: 6px 4px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  background: var(--sw-app-canvas);
  border-top: 1px solid var(--sw-border);
}

.mobile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px;
  min-width: 44px;
  padding: 4px 2px;
  border-radius: 8px;
  color: var(--sw-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease, background 0.15s ease;
}

.mobile-tab.active {
  color: var(--sw-white);
  background: rgba(var(--sw-blue-muted-rgb), 0.25);
}

.mobile-tab__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.mobile-tab__label {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
