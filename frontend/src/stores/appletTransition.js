import { defineStore } from 'pinia'

const RESTORE_DELAY_MS = 420

export const useAppletTransitionStore = defineStore('appletTransition', {
  state: () => ({
    railsCollapsedForRoute: false,
    _restoreTimer: null
  }),
  actions: {
    beginRouteChange() {
      if (this._restoreTimer) {
        clearTimeout(this._restoreTimer)
        this._restoreTimer = null
      }
      this.railsCollapsedForRoute = true
    },
    scheduleRailsRestore() {
      if (this._restoreTimer) {
        clearTimeout(this._restoreTimer)
        this._restoreTimer = null
      }
      this._restoreTimer = setTimeout(() => {
        this.railsCollapsedForRoute = false
        this._restoreTimer = null
      }, RESTORE_DELAY_MS)
    }
  }
})
