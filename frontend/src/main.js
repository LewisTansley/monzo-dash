import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './pinia'
import { initLayoutFromLocation } from './composables/useLayoutMode.js'
import './assets/design-tokens.css'
import './assets/scrollbar.css'
import './assets/applet-content.css'
import './assets/mobile-layout.css'

const app = createApp(App)
app.use(pinia)
initLayoutFromLocation()
app.use(router).mount('#app')
