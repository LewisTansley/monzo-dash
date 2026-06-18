import { defineStore } from 'pinia'
import { automationsApi } from '../services/api.js'

const POLL_MS = 3000

export const useAutomationActivityStore = defineStore('automationActivity', {
  state: () => ({
    running: false,
    startedAt: null,
    current: null,
    entries: [],
    pollTimer: null,
    wasRunning: false
  }),
  getters: {
    isAutoRunning: (state) => state.running
  },
  actions: {
    async fetchSchedulerStatus() {
      try {
        const { data } = await automationsApi.schedulerStatus()
        const wasRunning = this.running
        this.running = Boolean(data.running)
        this.startedAt = data.startedAt || null
        this.current = data.current || null

        if (wasRunning && !this.running) {
          await this.fetchActivity()
        }
        this.wasRunning = this.running
      } catch {
        // Ignore polling errors (vault locked, network, etc.)
      }
    },
    async fetchActivity() {
      try {
        const { data } = await automationsApi.activity()
        this.entries = data.entries || []
      } catch {
        this.entries = []
      }
    },
    startPolling() {
      if (this.pollTimer) return
      this.fetchSchedulerStatus()
      this.fetchActivity()
      this.pollTimer = setInterval(() => {
        this.fetchSchedulerStatus()
      }, POLL_MS)
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      this.running = false
      this.startedAt = null
      this.current = null
      this.wasRunning = false
    }
  }
})
