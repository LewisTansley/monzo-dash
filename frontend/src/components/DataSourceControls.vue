<template>
  <div v-if="vault.uiUnlocked" class="data-source-controls">
    <button
      type="button"
      class="data-source-refresh"
      title="Refresh data"
      :disabled="dataStatus.refreshing"
      :aria-busy="dataStatus.refreshing"
      @click="onRefresh">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        :class="{ spinning: dataStatus.refreshing }"
        aria-hidden="true">
        <path
          d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3016 3 18.1885 4.77814 19.7559 7.42909"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round" />
        <path
          d="M21 3V7H17"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>
    <span
      class="data-source-label"
      :class="`data-source-label--${dataStatus.source}`"
      :title="dataStatus.tooltip">
      {{ dataStatus.label }}
    </span>
  </div>
</template>

<script>
import { useVaultStore } from '@/stores/vault.js'
import { useDataStatusStore } from '@/stores/dataStatus.js'
import { monzoApi } from '@/services/api.js'

const SYNC_POLL_MS = 30_000

export default {
  name: 'DataSourceControls',
  data() {
    return {
      syncPollId: null
    }
  },
  computed: {
    vault() {
      return useVaultStore()
    },
    dataStatus() {
      return useDataStatusStore()
    }
  },
  watch: {
    'vault.uiUnlocked'(unlocked) {
      if (unlocked) {
        this.pollSyncStatus()
        this.startSyncPoll()
      } else {
        this.stopSyncPoll()
        this.dataStatus.clearSignals()
      }
    }
  },
  mounted() {
    if (this.vault.uiUnlocked) {
      this.pollSyncStatus()
      this.startSyncPoll()
    }
  },
  beforeUnmount() {
    this.stopSyncPoll()
  },
  methods: {
    async onRefresh() {
      this.dataStatus.requestRefresh()
      try {
        await this.vault.refreshStatus()
      } catch {
        // connection pill may be stale; page refresh handlers still run
      }
    },
    async pollSyncStatus() {
      if (!this.vault.uiUnlocked) return
      try {
        const { data } = await monzoApi.transactionSyncStatus()
        this.dataStatus.report({ syncInProgress: Boolean(data.running) })
      } catch {
        // ignore when vault locked or API unavailable
      }
    },
    startSyncPoll() {
      this.stopSyncPoll()
      if (!this.vault.uiUnlocked) return
      this.syncPollId = window.setInterval(() => {
        this.pollSyncStatus()
      }, SYNC_POLL_MS)
    },
    stopSyncPoll() {
      if (this.syncPollId) {
        clearInterval(this.syncPollId)
        this.syncPollId = null
      }
    }
  }
}
</script>

<style scoped>
.data-source-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.data-source-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--sw-text-muted);
  white-space: nowrap;
  user-select: none;
}

.data-source-label--warning {
  color: var(--sw-warning);
}

.data-source-label--syncing {
  color: var(--sw-blue-muted);
}

.data-source-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  background: var(--sw-panel);
  color: var(--sw-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.2s ease;
}

.data-source-refresh:hover:not(:disabled) {
  background: var(--sw-panel-raised);
  border-color: var(--sw-border-strong);
  color: var(--sw-text-tertiary);
  transform: translateY(-1px);
}

.data-source-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.data-source-refresh svg.spinning {
  animation: data-source-spin 0.8s linear infinite;
}

@keyframes data-source-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .data-source-label {
    font-size: 0.62rem;
  }
}
</style>
