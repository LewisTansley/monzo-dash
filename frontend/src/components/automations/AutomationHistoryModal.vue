<template>
  <BaseModal
    :is-open="isOpen"
    title="Automation history"
    class="modal-history"
    @close="$emit('close')">
    <div class="history-modal">
      <p v-if="loading" class="sw-empty">Loading…</p>
      <p v-else-if="!entries.length" class="sw-empty">No automation runs yet</p>
      <ul v-else class="history-list">
        <li v-for="entry in entries" :key="entry.id" class="history-item">
          <div class="history-item__header">
            <span class="history-item__name">{{ entry.name }}</span>
            <span class="sw-badge" :class="runStatusClass(entry.status)">
              {{ runStatusLabel(entry.status) }}
            </span>
          </div>
          <div class="history-item__meta">
            <span class="history-item__kind">{{ kindLabel(entry.kind) }}</span>
            <span class="history-item__dot">·</span>
            <span class="history-item__source">{{ sourceLabel(entry.source) }}</span>
            <span class="history-item__dot">·</span>
            <span class="history-item__time">{{ formatRunTime(entry.at) }}</span>
          </div>
          <p v-if="entrySummary(entry)" class="history-item__summary" :class="runStatusClass(entry.status)">
            {{ entrySummary(entry).label }}
          </p>
          <ul v-if="pointSteps(entry).length" class="run-history-steps">
            <li v-for="(step, i) in pointSteps(entry)" :key="i">{{ step }}</li>
          </ul>
        </li>
      </ul>
    </div>
    <template #footer>
      <router-link to="/automations" class="history-link" @click="$emit('close')">
        View automations
      </router-link>
    </template>
  </BaseModal>
</template>

<script>
import BaseModal from '@/components/common/Modal.vue'
import {
  formatRunTime,
  summarizeActivityEntry,
  runStatusClass,
  runStatusLabel
} from '@/utils/automationRuns.js'

export default {
  name: 'AutomationHistoryModal',
  components: { BaseModal },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    entries: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  watch: {
    isOpen(open) {
      if (open) {
        this.$emit('refresh')
      }
    }
  },
  methods: {
    formatRunTime,
    runStatusClass,
    runStatusLabel,
    kindLabel(kind) {
      return kind === 'group' ? 'Group' : 'Rule'
    },
    sourceLabel(source) {
      return source === 'auto' ? 'Auto' : 'Manual'
    },
    entrySummary(entry) {
      return summarizeActivityEntry(entry)
    },
    pointSteps(entry) {
      const summary = summarizeActivityEntry(entry)
      return summary?.steps || []
    }
  }
}
</script>

<style scoped>
.history-modal {
  min-height: 120px;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  padding: 0.75rem;
  border-radius: var(--sw-chrome-radius-inner);
  background: var(--sw-applet-segmented-bg);
}

.history-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.history-item__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--sw-text-primary);
}

.history-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  font-size: 0.68rem;
  color: var(--sw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.history-item__dot {
  opacity: 0.6;
}

.history-item__summary {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
}

.history-item__summary.run-success {
  color: var(--sw-success);
}

.history-item__summary.run-skipped {
  color: var(--sw-accent-orange);
}

.history-item__summary.run-error {
  color: var(--sw-danger-soft);
}

.history-link {
  color: var(--sw-blue-muted);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
}

.history-link:hover {
  text-decoration: underline;
}
</style>

<style>
.modal-history .modal-container {
  max-width: 560px;
}
</style>
