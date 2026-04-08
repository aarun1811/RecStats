import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as ChartModuleRegistry, AllEnterpriseModule as AllChartsEnterpriseModule } from 'ag-charts-enterprise'
import { ModuleRegistry as GridModuleRegistry } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// Register AG Charts modules once before any chart renders
ChartModuleRegistry.registerModules([AllChartsEnterpriseModule])

// Register AG Grid Enterprise modules
GridModuleRegistry.registerModules([AllEnterpriseModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
