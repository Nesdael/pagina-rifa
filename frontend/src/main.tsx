import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes instaladas con npm (no dependen de Google Fonts)
import '@fontsource/lilita-one'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/700.css'
import '@fontsource/caveat/600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
