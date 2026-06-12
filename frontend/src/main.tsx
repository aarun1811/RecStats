import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as ChartModuleRegistry, AllEnterpriseModule as AllChartsEnterpriseModule, LicenseManager as ChartsLicenseManager } from 'ag-charts-enterprise'
import { ModuleRegistry as GridModuleRegistry } from 'ag-grid-community'
import { AllEnterpriseModule, LicenseManager as GridLicenseManager } from 'ag-grid-enterprise'
import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import './index.css'
import App from './App'

// AG Grid Enterprise and AG Charts Enterprise share a single license key.
// Set it BEFORE registering modules (AG Grid requirement). Mirrors rectrace's
// frontend-react/src/main.tsx: the key comes from the build-time Vite env var
// VITE_AG_GRID_LICENSE_KEY (see .env.local.example). Empty => trial watermark.
const AG_ENTERPRISE_LICENSE_KEY = import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? ''
GridLicenseManager.setLicenseKey(AG_ENTERPRISE_LICENSE_KEY)
ChartsLicenseManager.setLicenseKey(AG_ENTERPRISE_LICENSE_KEY)

// Register AG Charts modules once before any chart renders
ChartModuleRegistry.registerModules([AllChartsEnterpriseModule])

// Register AG Grid Enterprise modules
GridModuleRegistry.registerModules([AllEnterpriseModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
