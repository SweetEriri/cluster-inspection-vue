import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { provideState } from './store'


const app = createApp(App)
app.use(ElementPlus)
app.use(router)

const store = provideState()
app.provide('state', store)

app.mount('#app')
