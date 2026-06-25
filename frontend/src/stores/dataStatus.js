import { defineStore } from 'pinia'
import { deriveDataSourceStatus, dataSourceLabel } from '../utils/dataSourceStatus.js'

export const useDataStatusStore = defineStore('dataStatus', {
  state: () => ({
    source: 'unknown',
    detail: null,
    lastUpdatedAt: null,
    refreshing: false,
    refreshGeneration: 0,
    _pendingSignals: []
  }),
  getters: {
    label(state) {
      return dataSourceLabel(state.source, state.lastUpdatedAt)
    },
    tooltip(state) {
      if (state.source === 'warning' && state.detail) return state.detail
      if (state.source === 'syncing') {
        return 'Historical transaction sync in progress'
      }
      return null
    }
  },
  actions: {
    report(signals) {
      const list = Array.isArray(signals) ? signals : [signals]
      this._pendingSignals.push(...list.filter(Boolean))
      const { source, detail } = deriveDataSourceStatus(this._pendingSignals)
      this.source = source
      this.detail = detail
      this.lastUpdatedAt = new Date().toISOString()
    },
    clearSignals() {
      this._pendingSignals = []
      this.source = 'unknown'
      this.detail = null
    },
    requestRefresh() {
      this.refreshGeneration += 1
      this.refreshing = true
    },
    finishRefresh() {
      this.refreshing = false
    }
  }
})
