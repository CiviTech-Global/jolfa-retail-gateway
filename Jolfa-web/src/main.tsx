import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Product pages arrive with their meta tags already in the HTML, for crawlers
// that do not run JavaScript. From here on the app owns the head, and tags left
// in place would describe the first product on every page navigated to after.
document.querySelectorAll('[data-server-head]').forEach((element) => element.remove())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
