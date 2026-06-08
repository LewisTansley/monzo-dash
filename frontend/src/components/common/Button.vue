<template>
  <button
    class="base-button"
    :type="buttonType"
    :disabled="disabled"
    :class="[variant, { active: isActive }]"
    @click.stop="handleClick">
    <img v-if="icon" :src="icon" :alt="text || 'icon'" class="button-icon" />
    <span v-if="text" class="button-text">{{ text }}</span>
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: 'BaseButton',
  props: {
    text: {
      type: String,
      default: ''
    },
    variant: {
      type: String,
      default: 'primary',
      validator: value => ['primary', 'secondary', 'danger', 'icon'].includes(value)
    },
    icon: {
      type: String,
      default: ''
    },
    faIcon: {
      type: Object,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    },
    nativeType: {
      type: String,
      default: 'button'
    },
    type: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  computed: {
    buttonType() {
      return this.type || this.nativeType
    }
  },
  methods: {
    handleClick(event) {
      if (this.disabled) {
        event.preventDefault()
        return
      }
      if (this.buttonType !== 'submit') {
        event.preventDefault()
      }
      this.$emit('click')
    }
  }
}
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background: var(--sw-applet-segmented-bg);
  border: none;
  border-radius: var(--sw-chrome-radius-inner);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  gap: 8px;
  min-height: 44px;
  font-family: inherit;
  color: var(--sw-text-secondary);
}

.base-button:hover:not([disabled]) {
  background: var(--sw-panel-raised);
  color: var(--sw-text-primary);
}

.base-button:active:not([disabled]) {
  background: var(--sw-panel);
  color: var(--sw-text-primary);
}

.primary.active {
  background: rgba(var(--sw-blue-muted-rgb), 0.28);
  color: var(--sw-white);
}

.danger {
  color: var(--sw-danger-soft);
}

.danger:hover:not([disabled]) {
  background: rgba(var(--sw-danger-rgb), 0.2);
  color: var(--sw-white);
}

.icon {
  padding: 12px;
  min-width: 44px;
}

.icon.active {
  background: rgba(var(--sw-blue-muted-rgb), 0.28);
  color: var(--sw-white);
}

.button-icon {
  width: 20px;
  height: 20px;
  filter: brightness(0) saturate(100%) invert(52%) sepia(8%) saturate(1016%) hue-rotate(202deg) brightness(92%) contrast(86%);
}

.base-button:hover .button-icon {
  filter: brightness(0) saturate(100%) invert(64%) sepia(8%) saturate(1016%) hue-rotate(202deg) brightness(102%) contrast(96%);
}

.icon.active .button-icon,
.primary.active .button-icon {
  filter: brightness(0) saturate(100%) invert(100%);
}

.button-text {
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.base-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button[disabled]:hover {
  background: var(--sw-applet-segmented-bg);
  color: var(--sw-text-secondary);
}
</style>
