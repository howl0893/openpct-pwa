import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics, trackPageView } from './analytics.ts'

initAnalytics()
trackPageView({ page_path: '/', route_name: 'map' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
