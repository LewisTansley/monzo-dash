<template>
  <div class="title-bar">
    <div class="left-section">
      <div class="logo">
        <img src="@/assets/logo-mark.svg" alt="Monzo Dash" />
      </div>
      <router-link
        to="/"
        class="nav-btn"
        :class="{ active: $route.name === 'Dashboard' }"
        title="Dashboard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </router-link>
      <router-link
        to="/transactions"
        class="nav-btn"
        :class="{ active: $route.name === 'Transactions' }"
        title="Transactions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6H20M8 12H20M8 18H20M4 6H4.01M4 12H4.01M4 18H4.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </router-link>
      <router-link
        to="/automations"
        class="nav-btn"
        :class="{ active: isAutomationsRoute }"
        title="Automations">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </router-link>
      <router-link
        to="/budget"
        class="nav-btn"
        :class="{ active: $route.name === 'AffordabilityChecker' }"
        title="Affordability checker">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 7H16M8 11H10M12 11H14M16 11H16.01M8 15H10M12 15H14M16 15H16.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </router-link>
      <router-link
        to="/settings"
        class="nav-btn"
        :class="{ active: $route.name === 'Settings' }"
        title="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </router-link>
    </div>

    <div class="center-section">
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>

    <div class="right-section">
      <span class="status-pill" :class="statusClass">{{ statusLabel }}</span>
    </div>
  </div>
</template>

<script>
import { useVaultStore } from '@/stores/vault.js'

const ROUTE_TITLES = {
  Dashboard: 'DASHBOARD',
  Transactions: 'TRANSACTIONS',
  Automations: 'AUTOMATIONS',
  AffordabilityChecker: 'AFFORDABILITY CHECKER',
  Settings: 'SETTINGS',
  AutomationNew: 'EDIT',
  AutomationEditor: 'EDIT',
  AutomationGroupNew: 'EDIT',
  AutomationGroupEditor: 'EDIT'
}

export default {
  name: 'TitleBar',
  computed: {
    vault() {
      return useVaultStore()
    },
    pageTitle() {
      return ROUTE_TITLES[this.$route.name] || 'MONZO DASH'
    },
    isAutomationsRoute() {
      return String(this.$route.name || '').startsWith('Automation')
    },
    statusLabel() {
      if (!this.vault.unlocked) return 'vault locked'
      if (this.vault.isMonzoConnected) return 'monzo connected'
      if (this.vault.hasMonzoTokens) return 'awaiting approval'
      return 'not connected'
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
  }
}
</script>

<style scoped>
.title-bar {
  height: var(--sw-titlebar-height);
  background-color: var(--sw-app-canvas);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: center;
  margin-right: 4px;
}

.logo img {
  height: 40px;
  width: 40px;
}

.nav-btn {
  background: var(--sw-panel);
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  color: var(--sw-text-secondary);
  text-decoration: none;
}

.nav-btn:hover {
  background: var(--sw-panel-raised);
  border-color: var(--sw-border-strong);
  color: var(--sw-text-tertiary);
  transform: translateY(-1px);
}

.nav-btn.active {
  background: var(--sw-blue-muted);
  border-color: rgba(105, 115, 156, 0.5);
  color: var(--sw-white);
}

.center-section {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.page-title {
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--sw-blue-muted);
  margin: 0;
  text-transform: uppercase;
  text-align: center;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sw-text-muted);
  padding: 8px 12px;
  border-radius: 8px;
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

.status-pill.disconnected {
  color: var(--sw-text-muted);
}
</style>
