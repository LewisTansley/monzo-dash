import { onMounted, onUnmounted } from 'vue'
import { useLayoutStore } from '../stores/layout.js'

function readFoldableState() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { spanning: false, wide: false }
  }
  const segments = window.matchMedia('(horizontal-viewport-segments: 2)')
  const spanning = segments.matches
  const wide = spanning && window.innerWidth >= 900
  return { spanning, wide }
}

export function useLayoutMode() {
  const layoutStore = useLayoutStore()

  function sync() {
    layoutStore.syncFromLocation()
    layoutStore.setFoldableState(readFoldableState())
  }

  let segmentMql = null
  let onSegmentChange = null

  onMounted(() => {
    sync()
    if (typeof window !== 'undefined' && window.matchMedia) {
      segmentMql = window.matchMedia('(horizontal-viewport-segments: 2)')
      onSegmentChange = () => layoutStore.setFoldableState(readFoldableState())
      segmentMql.addEventListener('change', onSegmentChange)
      window.addEventListener('resize', onSegmentChange)
    }
  })

  onUnmounted(() => {
    if (segmentMql && onSegmentChange) {
      segmentMql.removeEventListener('change', onSegmentChange)
      window.removeEventListener('resize', onSegmentChange)
    }
  })

  return { layoutStore, sync }
}

export function initLayoutFromLocation() {
  const layoutStore = useLayoutStore()
  layoutStore.syncFromLocation()
  layoutStore.setFoldableState(readFoldableState())
}
