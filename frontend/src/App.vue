<template>
  <div id="app">
    <TitleBar />
    <main class="app-main">
      <div class="applet-view">
        <div class="applet-route-shell">
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import TitleBar from '@/components/TitleBar.vue'

export default {
  name: 'App',
  components: { TitleBar }
}
</script>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100vh;
  background: var(--sw-app-canvas);
  color: var(--sw-text-primary);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
}

#app {
  display: flex;
  flex-direction: column;
}

a {
  color: var(--sw-blue-bright);
  text-decoration: none;
}

main.app-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  background-color: var(--sw-app-canvas);
  display: flex;
  flex-direction: column;
  border-radius: 16px
}

.applet-view,
.applet-route-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.applet-route-shell > * {
  flex: 1;
  min-height: 0;
}
</style>
