<!-- eslint-disable vue/no-mutating-props -- autoTrigger is a mutable draft owned by the parent -->
<template>
  <div class="auto-trigger-panel sw-form-section">
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
        Per
        <select v-model="autoTrigger.frequency">
          <option v-if="showSchedule" value="once_per_window">Schedule window</option>
          <option value="once_per_day">Calendar day</option>
        </select>
      </label>

      <label>
        Run at most
        <select v-model="runLimitMode" @change="onRunLimitModeChange">
          <option value="once">Once</option>
          <option value="count">A specific number of times</option>
          <option value="unlimited">Unlimited times</option>
        </select>
      </label>

      <template v-if="runLimitMode === 'count'">
        <label>
          Number of times
          <input
            v-model.number="autoTrigger.runLimit.max"
            type="number"
            min="2" />
        </label>
        <label>
          Count toward limit
          <select v-model="autoTrigger.runLimit.countAttempts">
            <option value="all">All auto-run attempts</option>
            <option value="successful">Successful transfers only</option>
          </select>
        </label>
      </template>

      <p class="mode-hint">{{ frequencyHint }}</p>
      <p v-if="summary" class="auto-summary">{{ summary }}</p>
    </template>
  </div>
</template>

<script>
import {
  DAY_LABELS,
  defaultRunLimitForm,
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
    runLimitMode: {
      get() {
        return this.autoTrigger.runLimit?.mode || 'once'
      },
      set(mode) {
        if (!this.autoTrigger.runLimit) {
          // eslint-disable-next-line vue/no-mutating-props
          this.autoTrigger.runLimit = defaultRunLimitForm()
        }
        // eslint-disable-next-line vue/no-mutating-props
        this.autoTrigger.runLimit.mode = mode
      }
    },
    windowLabel() {
      return this.autoTrigger.frequency === 'once_per_window'
        ? 'schedule window'
        : 'calendar day'
    },
    frequencyHint() {
      const windowLabel = this.windowLabel
      const mode = this.runLimitMode

      if (mode === 'once') {
        if (this.autoTrigger.frequency === 'once_per_window') {
          return 'After one automatic attempt in the current window (e.g. this Friday), further checks that day will not re-run — even if you refresh the dashboard.'
        }
        return 'At most one automatic attempt per calendar day.'
      }

      if (mode === 'count') {
        const max = this.autoTrigger.runLimit?.max || 2
        const countLabel =
          this.autoTrigger.runLimit?.countAttempts === 'successful'
            ? 'successful transfers'
            : 'auto-run attempts'
        return `Up to ${max} ${countLabel} per ${windowLabel}. Further attempts wait until the next ${windowLabel}.`
      }

      return `No limit on automatic attempts per ${windowLabel}. The scheduler may re-run whenever conditions are met.`
    },
    summary() {
      return formatAutoTrigger(this.autoTrigger)
    }
  },
  created() {
    if (!this.autoTrigger.runLimit) {
      // eslint-disable-next-line vue/no-mutating-props
      this.autoTrigger.runLimit = defaultRunLimitForm()
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
    onRunLimitModeChange() {
      if (!this.autoTrigger.runLimit) {
        // eslint-disable-next-line vue/no-mutating-props
        this.autoTrigger.runLimit = defaultRunLimitForm()
      }
      if (this.autoTrigger.runLimit.mode === 'count' && !this.autoTrigger.runLimit.max) {
        // eslint-disable-next-line vue/no-mutating-props
        this.autoTrigger.runLimit.max = 3
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
