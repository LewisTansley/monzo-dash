<template>
  <teleport to="body">
    <div class="modal-overlay" v-if="isOpen" @click="handleOverlayClick">
      <div class="modal-container" :class="$props.class" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">{{ title }}</h2>
          <button class="modal-close" @click="close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-content">
          <slot></slot>
        </div>

        <div class="modal-footer" v-if="$slots.footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
export default {
  name: 'BaseModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      required: true
    },
    closeOnOverlay: {
      type: Boolean,
      default: true
    },
    class: {
      type: String,
      default: ''
    }
  },
  emits: ['close'],
  methods: {
    close() {
      this.$emit('close')
    },
    handleOverlayClick() {
      if (this.closeOnOverlay) {
        this.close()
      }
    }
  },
  mounted() {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden'
    }
  },
  beforeUnmount() {
    document.body.style.overflow = ''
  },
  watch: {
    isOpen(newValue) {
      document.body.style.overflow = newValue ? 'hidden' : ''
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background-color: var(--sw-app-canvas);
  border: 1px solid var(--sw-border);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  max-width: 600px;
  width: 100%;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--sw-border);
  background-color: var(--sw-blue-space);
}

.modal-title {
  color: var(--sw-text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--sw-border);
  border-radius: 6px;
  color: var(--sw-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--sw-panel);
  border-color: var(--sw-border-strong);
  color: var(--sw-text-tertiary);
}

.modal-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--sw-border);
  background-color: var(--sw-blue-space);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .modal-container {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }

  .modal-overlay {
    padding: 0;
  }
}
</style>
