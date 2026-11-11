import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes } from './app/routes'
import './app/styles/fonts.css'
import './app/styles/tokens.css'
import './app/styles/base.css'
import './app/styles/buttons.css'
import './app/styles/header.css'
import './app/styles/footer.css'
import './app/styles/tool.css'
import './app/styles/docs.css'
import './app/styles/result.css'
import './app/styles/article.css'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
  undefined,
  { hydration: import.meta.env.PROD },
)
