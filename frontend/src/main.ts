import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { LicenseManager } from 'ag-grid-enterprise';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Set ag-grid enterprise license key from environment
LicenseManager.setLicenseKey(environment.agGridLicenseKey);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
