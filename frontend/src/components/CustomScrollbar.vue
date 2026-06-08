<template>
  <div class="custom-scrollbar-container" :class="{ 'overflow-visible': allowOverflow }" ref="container">
    <div class="custom-scrollbar-content" ref="content" @scroll="handleScroll">
      <slot></slot>
    </div>
    <div
      class="custom-scrollbar-track"
      ref="track"
      v-show="showScrollbar"
      @mousedown="handleTrackClick">
      <div
        class="custom-scrollbar-thumb"
        ref="thumb"
        @mousedown="handleThumbMouseDown"
        :style="thumbStyle"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CustomScrollbar',
  props: {
    allowOverflow: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showScrollbar: false,
      thumbHeight: 0,
      thumbTop: 0,
      isDragging: false,
      dragStartY: 0,
      dragStartScrollTop: 0
    }
  },
  computed: {
    thumbStyle() {
      return {
        height: `${this.thumbHeight}px`,
        top: `${this.thumbTop}px`
      }
    }
  },
  mounted() {
    this.updateScrollbar()
    window.addEventListener('resize', this.updateScrollbar)

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.updateScrollbar())
      })
      this.resizeObserver.observe(this.$refs.content)
    }

    this.mutationObserver = new MutationObserver(this.updateScrollbar)
    this.mutationObserver.observe(this.$refs.content, {
      childList: true,
      subtree: true,
      attributes: true
    })
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateScrollbar)
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
    }
  },
  methods: {
    updateScrollbar() {
      this.$nextTick(() => {
        const content = this.$refs.content
        if (!content) return

        const contentHeight = content.scrollHeight
        const containerHeight = content.clientHeight
        this.showScrollbar = contentHeight > containerHeight

        if (this.showScrollbar) {
          const thumbHeightRatio = containerHeight / contentHeight
          this.thumbHeight = Math.max(40, containerHeight * thumbHeightRatio)
          this.updateThumbPosition()
        }
      })
    },
    updateThumbPosition() {
      const content = this.$refs.content
      if (!content) return

      const scrollPercentage = content.scrollTop / (content.scrollHeight - content.clientHeight)
      const maxThumbTop = content.clientHeight - this.thumbHeight
      this.thumbTop = scrollPercentage * maxThumbTop
    },
    handleScroll() {
      this.updateThumbPosition()
      this.$emit('scroll', this.$refs.content.scrollTop)
    },
    handleThumbMouseDown(e) {
      e.preventDefault()
      e.stopPropagation()

      this.isDragging = true
      this.dragStartY = e.clientY
      this.dragStartScrollTop = this.$refs.content.scrollTop

      document.addEventListener('mousemove', this.handleMouseMove)
      document.addEventListener('mouseup', this.handleMouseUp)
      document.body.style.userSelect = 'none'
    },
    handleMouseMove(e) {
      if (!this.isDragging) return

      const deltaY = e.clientY - this.dragStartY
      const content = this.$refs.content
      const scrollRatio = (content.scrollHeight - content.clientHeight) / (content.clientHeight - this.thumbHeight)
      content.scrollTop = this.dragStartScrollTop + deltaY * scrollRatio
    },
    handleMouseUp() {
      this.isDragging = false
      document.removeEventListener('mousemove', this.handleMouseMove)
      document.removeEventListener('mouseup', this.handleMouseUp)
      document.body.style.userSelect = ''
    },
    handleTrackClick(e) {
      if (e.target !== this.$refs.track) return

      const track = this.$refs.track
      const content = this.$refs.content
      const rect = track.getBoundingClientRect()
      const clickY = e.clientY - rect.top
      const scrollPercentage = clickY / content.clientHeight
      const targetScrollTop = scrollPercentage * (content.scrollHeight - content.clientHeight)

      content.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    }
  }
}
</script>

<style scoped>
.custom-scrollbar-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.custom-scrollbar-container.overflow-visible {
  overflow: visible !important;
}

.custom-scrollbar-content {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.custom-scrollbar-content::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar-track {
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  width: 6px;
  background: transparent;
  border-radius: 3px;
  z-index: 1000;
  pointer-events: all;
}

.custom-scrollbar-thumb {
  position: absolute;
  left: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s ease;
  min-height: 40px;
}

.custom-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.custom-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.4);
}
</style>
