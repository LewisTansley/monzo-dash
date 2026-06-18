<template>
  <div class="automation-notifier">
    <button
      type="button"
      class="notifier-btn"
      :class="{ running: activity.isAutoRunning }"
      title="Automation history"
      :aria-busy="activity.isAutoRunning"
      @click="openHistory">
      <span v-if="activity.isAutoRunning" class="automation-throbber" aria-hidden="true" />
      <svg
        v-else
        class="notifier-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <path
          d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>

    <AutomationHistoryModal
      :is-open="historyOpen"
      :entries="activity.entries"
      :loading="historyLoading"
      @close="historyOpen = false"
      @refresh="loadHistory" />
  </div>
</template>

<script>
import { useVaultStore } from '@/stores/vault.js'
import { useAutomationActivityStore } from '@/stores/automationActivity.js'
import AutomationHistoryModal from '@/components/automations/AutomationHistoryModal.vue'

export default {
  name: 'AutomationActivityNotifier',
  components: { AutomationHistoryModal },
  data() {
    return {
      historyOpen: false,
      historyLoading: false
    }
  },
  computed: {
    vault() {
      return useVaultStore()
    },
    activity() {
      return useAutomationActivityStore()
    }
  },
  watch: {
    'vault.unlocked'(unlocked) {
      if (unlocked) {
        this.activity.startPolling()
      } else {
        this.activity.stopPolling()
        this.historyOpen = false
      }
    }
  },
  mounted() {
    if (this.vault.unlocked) {
      this.activity.startPolling()
    }
  },
  beforeUnmount() {
    this.activity.stopPolling()
  },
  methods: {
    openHistory() {
      this.historyOpen = true
      this.loadHistory()
    },
    async loadHistory() {
      this.historyLoading = true
      try {
        await this.activity.fetchActivity()
      } finally {
        this.historyLoading = false
      }
    }
  }
}
</script>

<style scoped>
.notifier-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--sw-applet-segmented-bg);
  border: none;
  cursor: pointer;
  color: var(--sw-text-muted);
  transition: color 0.2s ease, background 0.2s ease;
  min-width: 40px;
  min-height: 34px;
}

.notifier-btn:hover {
  color: var(--sw-text-secondary);
  background: var(--sw-panel);
}

.notifier-btn.running {
  color: var(--sw-success);
}

.notifier-icon {
  display: block;
}

.automation-throbber {
  display: block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(114, 219, 114, 0.25);
  border-top-color: var(--sw-success);
  border-radius: 50%;
  animation: automation-throbber-spin 0.8s linear infinite;
}

@keyframes automation-throbber-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
