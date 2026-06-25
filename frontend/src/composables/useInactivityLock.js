import { onMounted, onUnmounted, watch } from 'vue'
import { useVaultStore } from '@/stores/vault.js'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll']
const THROTTLE_MS = 1000

export function useInactivityLock() {
  const vault = useVaultStore()
  let timeoutId = null
  let hiddenAt = null
  let lastActivityAt = Date.now()
  let lastThrottleAt = 0

  function clearTimer() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function getTimeoutMs() {
    const minutes = vault.frontendInactivityTimeoutMinutes
    if (!minutes || minutes <= 0) return null
    return minutes * 60 * 1000
  }

  function lockIfNeeded() {
    if (!vault.unlocked || !vault.uiUnlocked) return
    vault.lockUi()
  }

  function scheduleTimer() {
    clearTimer()
    const timeoutMs = getTimeoutMs()
    if (!timeoutMs || !vault.unlocked || !vault.uiUnlocked) return

    const elapsed = Date.now() - lastActivityAt
    const remaining = Math.max(timeoutMs - elapsed, 0)
    timeoutId = setTimeout(lockIfNeeded, remaining)
  }

  function recordActivity() {
    if (!vault.unlocked || !vault.uiUnlocked) return

    const now = Date.now()
    if (now - lastThrottleAt < THROTTLE_MS) return
    lastThrottleAt = now
    lastActivityAt = now
    scheduleTimer()
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      hiddenAt = Date.now()
      clearTimer()
      return
    }

    if (hiddenAt === null) return

    const timeoutMs = getTimeoutMs()
    if (timeoutMs && Date.now() - lastActivityAt >= timeoutMs) {
      lockIfNeeded()
    } else {
      scheduleTimer()
    }
    hiddenAt = null
  }

  function onActivity() {
    recordActivity()
  }

  watch(
    () => [vault.unlocked, vault.uiUnlocked, vault.frontendInactivityTimeoutMinutes],
    () => {
      if (vault.unlocked && vault.uiUnlocked) {
        lastActivityAt = Date.now()
        scheduleTimer()
      } else {
        clearTimer()
      }
    },
    { immediate: true }
  )

  onMounted(() => {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    clearTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity)
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
}
