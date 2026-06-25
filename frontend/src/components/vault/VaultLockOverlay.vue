<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="vault-lock-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-lock-title">
      <div class="vault-lock-overlay__panel">
        <div class="vault-lock-overlay__avatar">
          <img src="@/assets/logo-mark.svg" alt="" />
        </div>
        <h1 id="vault-lock-title" class="vault-lock-overlay__title">Dashboard locked</h1>
        <form class="vault-lock-overlay__form" @submit.prevent="handleSubmit">
          <div class="vault-lock-overlay__input-row">
            <input
              ref="passphraseInput"
              v-model="passphrase"
              type="password"
              placeholder="Password"
              autocomplete="current-password"
              required
              :disabled="vault.loading" />
            <button
              type="submit"
              class="vault-lock-overlay__submit"
              :disabled="vault.loading || !passphrase"
              aria-label="Unlock dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <p v-if="error" class="vault-lock-overlay__error">{{ error }}</p>
        </form>
        <p class="vault-lock-overlay__hint">Automations continue running in the background.</p>
      </div>
    </div>
  </teleport>
</template>

<script>
import { useVaultStore } from '@/stores/vault.js'

export default {
  name: 'VaultLockOverlay',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      passphrase: '',
      error: ''
    }
  },
  computed: {
    vault() {
      return useVaultStore()
    }
  },
  watch: {
    isOpen(open) {
      if (open) {
        this.passphrase = ''
        this.error = ''
        document.body.style.overflow = 'hidden'
        this.$nextTick(() => {
          this.$refs.passphraseInput?.focus()
        })
      } else {
        document.body.style.overflow = ''
      }
    }
  },
  beforeUnmount() {
    document.body.style.overflow = ''
  },
  methods: {
    async handleSubmit() {
      this.error = ''
      try {
        await this.vault.unlockUi(this.passphrase)
        this.passphrase = ''
        const redirect = this.$route?.query?.redirect
        if (redirect) {
          this.$router.push(redirect)
        }
      } catch {
        this.error = this.vault.error || 'Invalid passphrase'
      }
    }
  }
}
</script>

<style scoped>
.vault-lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 17, 20, 0.35);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  animation: vault-lock-fade-in 0.2s ease-out;
}

@keyframes vault-lock-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.vault-lock-overlay__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(400px, calc(100vw - 48px));
  text-align: center;
}

.vault-lock-overlay__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  margin-bottom: 1.25rem;
}

.vault-lock-overlay__avatar img {
  width: 48px;
  height: 48px;
}

.vault-lock-overlay__title {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--sw-white);
  letter-spacing: 0.01em;
}

.vault-lock-overlay__form {
  width: 100%;
}

.vault-lock-overlay__input-row {
  display: flex;
  align-items: center;
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid var(--sw-blue-bright);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.vault-lock-overlay__input-row input {
  flex: 1;
  min-width: 0;
  padding: 0.85rem 1rem;
  background: transparent;
  border: none;
  color: var(--sw-white);
  font-size: 1rem;
  outline: none;
}

.vault-lock-overlay__input-row input::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.vault-lock-overlay__input-row input:disabled {
  opacity: 0.6;
}

.vault-lock-overlay__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin-right: 4px;
  background: transparent;
  border: none;
  color: var(--sw-white);
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

.vault-lock-overlay__submit:hover:not(:disabled) {
  opacity: 1;
}

.vault-lock-overlay__submit:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.vault-lock-overlay__error {
  margin: 0.75rem 0 0;
  color: var(--sw-danger-soft);
  font-size: 0.9rem;
}

.vault-lock-overlay__hint {
  margin: 1.25rem 0 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
  line-height: 1.5;
}
</style>
