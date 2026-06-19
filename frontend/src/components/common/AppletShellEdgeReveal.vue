<template>
  <div
    class="applet-shell__edge"
    :class="side === 'left' ? 'applet-shell__edge--left' : 'applet-shell__edge--right'">
    <button
      type="button"
      class="applet-shell__edge-hit"
      :class="side === 'left' ? 'applet-shell__edge-hit--left' : 'applet-shell__edge-hit--right'"
      :aria-label="side === 'left' ? 'Show left sidebar' : 'Show right sidebar'"
      @click="$emit('reveal')">
      <span class="applet-shell__chevron-wrap" aria-hidden="true">
        <svg
          class="applet-shell__chevron-svg"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path
            v-if="side === 'left'"
            d="M4 3L7 6L4 9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round" />
          <path
            v-else
            d="M8 3L5 6L8 9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'AppletShellEdgeReveal',
  props: {
    side: {
      type: String,
      required: true,
      validator: (v) => ['left', 'right'].includes(v)
    }
  },
  emits: ['reveal']
}
</script>

<style scoped>
.applet-shell__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 50;
  width: var(--sw-edge-hit-sensor-width, 12px);
  pointer-events: auto;
  overflow: hidden;
  transition: width 0.26s cubic-bezier(0.4, 0, 0.2, 1);
}

.applet-shell__edge--left {
  left: 0;
}

.applet-shell__edge--right {
  right: 0;
}

.applet-shell__edge:hover,
.applet-shell__edge:focus-within {
  width: var(--sw-edge-reveal-peek, 36px);
}

.applet-shell__edge-hit {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: transparent;
  color: var(--sw-text-muted, #6b7280);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, background 0.2s ease, color 0.2s ease;
}

.applet-shell__edge-hit--left {
  border-radius: 0 var(--sw-chrome-radius-inner, 8px) var(--sw-chrome-radius-inner, 8px) 0;
}

.applet-shell__edge-hit--right {
  border-radius: var(--sw-chrome-radius-inner, 8px) 0 0 var(--sw-chrome-radius-inner, 8px);
}

.applet-shell__edge:hover .applet-shell__edge-hit,
.applet-shell__edge:focus-within .applet-shell__edge-hit {
  opacity: 1;
  pointer-events: auto;
  background: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.28);
  color: var(--sw-text-secondary, #a0aec0);
}

.applet-shell__edge-hit:hover {
  background: rgba(var(--sw-blue-muted-rgb, 105 115 156), 0.36);
}

.applet-shell__edge-hit:focus-visible {
  outline: 2px solid var(--sw-blue-bright, #66a3ff);
  outline-offset: -1px;
}

.applet-shell__chevron-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.applet-shell__chevron-svg {
  display: block;
  flex-shrink: 0;
}
</style>
