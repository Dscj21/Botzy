import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppNew from './AppNew'  // Switched to AppNew

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppNew />
  </StrictMode>
)
