import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-enterprise'
import './index.css'
import App from './App'

// Register AG Charts modules once before any chart renders
ModuleRegistry.registerModules([AllCommunityModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
