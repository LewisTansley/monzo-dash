<template>
  <div 
    class="sidebar-item" 
    :class="{ 
      'active': isActive,
      'clickable': !isDisabled
    }"
    @click="!isDisabled && $emit('click')"
  >
    <div class="item-icon" v-if="icon">
      <img :src="icon" :alt="iconAlt || text" />
    </div>
    <span class="item-text">{{ text }}</span>
    <slot name="right"></slot>
  </div>
</template>

<script>
export default {
  name: 'SidebarItem',
  props: {
    text: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: null
    },
    iconAlt: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isDisabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click']
}
</script>

<style scoped>
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.sidebar-item.clickable {
  cursor: pointer;
}

.sidebar-item.clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.sidebar-item.active {
  background-color: rgba(255, 255, 255, 0.1);
}

.item-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-text {
  flex: 1;
  font-size: 0.9rem;
  color: #fff;
  opacity: 0.8;
}

.sidebar-item.active .item-text {
  opacity: 1;
}

.sidebar-item:not(.clickable) {
  opacity: 0.5;
  cursor: not-allowed;
}
</style> 