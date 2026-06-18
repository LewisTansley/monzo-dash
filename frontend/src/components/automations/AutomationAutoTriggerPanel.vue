<!-- eslint-disable vue/no-mutating-props -- autoTrigger is a mutable draft owned by the parent -->
<template>
  <div class="auto-trigger-panel">
    <label class="checkbox">
      <input v-model="autoTrigger.enabled" type="checkbox" />
      Enable automatic runs
    </label>

    <template v-if="autoTrigger.enabled">
      <label>
        Run when
        <select v-model="autoTrigger.mode" @change="onModeChange">
          <option value="conditions">Balance conditions are met</option>
          <option value="schedule">On a schedule (time-based)</option>
          <option value="schedule_and_conditions">On schedule and conditions met</option>
        </select>
      </label>

      <label v-if="showSchedule">
        Schedule type
        <select v-model="autoTrigger.schedule.type">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="interval_days">Every N days</option>
        </select>
      </label>

      <label v-if="showSchedule">
        Time
        <input v-model="autoTrigger.schedule.time" type="time" />
      </label>

      <div v-if="showSchedule && autoTrigger.schedule.type === 'weekly'" class="day-picker">
        <span class="field-label">Days</span>
        <div class="day-picker__buttons">
          <button
            v-for="(label, idx) in dayLabels"
            :key="idx"
            type="button"
            class="day-btn"
            :class="{ active: autoTrigger.schedule.daysOfWeek.includes(idx) }"
            @click="toggleDay(idx)">
            {{ label }}
          </button>
        </div>
      </div>

      <label v-if="showSchedule && autoTrigger.schedule.type === 'monthly'">
        Day of month
        <input
          v-model.number="autoTrigger.schedule.dayOfMonth"
          type="number"
          min="1"
          max="31" />
      </label>

      <template v-if="showSchedule && autoTrigger.schedule.type === 'interval_days'">
        <label>
          Every (days)
          <input
            v-model.number="autoTrigger.schedule.intervalDays"
            type="number"
            min="1" />
        </label>
        <label>
          Anchor date
          <input v-model="autoTrigger.schedule.anchorDate" type="date" />
        </label>
      </template>

      <label>
        Run at most
        <select v-model="autoTrigger.frequency">
          <option value="once_per_window">Once per schedule window</option>
          <option value="once_per_day">Once per day</option>
        </select>
      </label>

      <p class="mode-hint">{{ frequencyHint }}</p>
      <p v-if="summary" class="auto-summary">{{ summary }}</p>
    </template>
  </div>
</template>

<script>
import {
  DAY_LABELS,
  toggleDayOfWeek
} from '../../utils/automationTriggerForm.js'
import { formatAutoTrigger } from '../../utils/automationDisplay.js'

export default {
  name: 'AutomationAutoTriggerPanel',
  props: {
    autoTrigger: {
      type: Object,
      required: true
    }
  },
  computed: {
    dayLabels() {
      return DAY_LABELS
    },
    showSchedule() {
      return (
        this.autoTrigger.mode === 'schedule' ||
        this.autoTrigger.mode === 'schedule_and_conditions'
      )
    },
    frequencyHint() {
      if (this.autoTrigger.frequency === 'once_per_window') {
        return 'After one automatic attempt in the current window (e.g. this Friday), further checks that day will not re-run — even if you refresh the dashboard.'
      }
      return 'At most one automatic attempt per calendar day.'
    },
    summary() {
      return formatAutoTrigger(this.autoTrigger)
    }
  },
  methods: {
    onModeChange() {
      if (this.showSchedule && this.autoTrigger.frequency === 'once_per_day') {
        // eslint-disable-next-line vue/no-mutating-props
        this.autoTrigger.frequency = 'once_per_window'
      }
      if (!this.showSchedule && this.autoTrigger.frequency === 'once_per_window') {
        // eslint-disable-next-line vue/no-mutating-props
        this.autoTrigger.frequency = 'once_per_day'
      }
    },
    toggleDay(day) {
      // eslint-disable-next-line vue/no-mutating-props
      this.autoTrigger.schedule.daysOfWeek = toggleDayOfWeek(
        this.autoTrigger.schedule.daysOfWeek,
        day
      )
    }
  }
}
</script>

<style scoped>
.auto-trigger-panel label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--sw-text-secondary);
}

.auto-trigger-panel label.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-trigger-panel input,
.auto-trigger-panel select {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  border-radius: 6px;
  color: var(--sw-text-primary);
}

.day-picker {
  margin-bottom: 0.75rem;
}

.field-label {
  display: block;
  font-size: 0.9rem;
  color: var(--sw-text-secondary);
  margin-bottom: 0.35rem;
}

.day-picker__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.day-btn {
  background: var(--sw-panel-inset);
  border: 1px solid var(--sw-border);
  color: var(--sw-text-secondary);
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
}

.day-btn.active {
  border-color: var(--sw-blue);
  color: var(--sw-blue-bright);
}

.mode-hint,
.auto-summary {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--sw-text-muted);
  line-height: 1.4;
}

.auto-summary {
  color: var(--sw-blue-bright);
}
</style>
