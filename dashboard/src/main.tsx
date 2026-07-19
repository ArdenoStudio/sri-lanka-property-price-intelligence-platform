import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/cal-sans/400.css'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'
import { CurrencyProvider } from './contexts/CurrencyContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </BrowserRouter>
  </StrictMode>,
)
