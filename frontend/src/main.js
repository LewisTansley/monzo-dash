import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './pinia'
import './assets/design-tokens.css'
import './assets/scrollbar.css'
import './assets/applet-content.css'

createApp(App).use(pinia).use(router).mount('#app')
