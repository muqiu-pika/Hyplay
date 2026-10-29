import { defineClientConfig } from 'vuepress/client'
import HyplayEntry from './components/HyplayEntry.vue'
import HyplayIcon from './components/HyplayIcon.vue'
import HyplayServer from './components/HyplayServer.vue'
import './styles/index.css'
import { setupCursor } from './utils/cursor'
import { setupReveal } from './utils/reveal'
import { setupTilt } from './utils/tilt'

export default defineClientConfig({
  enhance({ app, router }) {
    app.component('HyplayEntry', HyplayEntry)
    app.component('HyplayIcon', HyplayIcon)
    app.component('HyplayServer', HyplayServer)
    setupTilt(router)
    setupCursor(router)
    setupReveal(router)
  },
})
