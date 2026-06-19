import { defineStore } from 'pinia'
import { detectMobileLayout, usesMobilePathPrefix } from '../utils/appPaths.js'

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    isMobileLayout: detectMobileLayout(),
    usePathPrefix: usesMobilePathPrefix(),
    foldableSpanning: false,
    foldableWide: false
  }),
  actions: {
    syncFromLocation(location = window.location) {
      this.isMobileLayout = detectMobileLayout(location)
      this.usePathPrefix = usesMobilePathPrefix(location)
      const layout = this.isMobileLayout ? 'mobile' : 'desktop'
      document.documentElement.dataset.layout = layout
    },
    setFoldableState({ spanning, wide }) {
      this.foldableSpanning = Boolean(spanning)
      this.foldableWide = Boolean(wide)
      if (spanning) {
        document.documentElement.dataset.foldSpanning = wide ? 'wide' : 'dual'
      } else {
        delete document.documentElement.dataset.foldSpanning
      }
    }
  }
})
