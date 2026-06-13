<template>
  <div class="section-nav-bar" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="section-nav-tab"
      :class="{ active: modelValue === tab.id }"
      role="tab"
      :aria-selected="modelValue === tab.id"
      @click="$emit('update:modelValue', tab.id)">
      {{ tab.label }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'SectionNavBar',
  props: {
    tabs: {
      type: Array,
      required: true
      /* [{ id, label }, ...] */
    },
    modelValue: {
      type: String,
      required: true
    }
  },
  emits: ['update:modelValue']
}
</script>

<style scoped>
.section-nav-bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--sw-applet-segmented-bg);
  border: 1px solid var(--sw-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.section-nav-tab {
  margin: 0;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--sw-text-secondary);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
}

.section-nav-tab:focus-visible {
  outline: 2px solid var(--sw-border-strong);
  outline-offset: 2px;
}

.section-nav-tab:not(.active):hover {
  color: var(--sw-text-primary);
  background: rgba(var(--sw-blue-muted-rgb), 0.12);
}

.section-nav-tab.active {
  background: var(--sw-panel-raised);
  color: var(--sw-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
</style>
