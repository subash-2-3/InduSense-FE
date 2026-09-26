import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { IconName } from './shared/ui';

const comingSoon = (path: string, section: string, icon: IconName) => ({
  path,
  title: `${section} · InduSense`,
  data: { section, icon },
  loadComponent: () =>
    import('./features/placeholder/coming-soon-page.component').then(
      (m) => m.ComingSoonPageComponent,
    ),
});

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · InduSense',
    loadComponent: () =>
      import('./features/auth/login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · InduSense',
        data: { section: 'Dashboard' },
        loadComponent: () =>
          import('./features/dashboard/device-summary-page/device-summary-page.component').then(
            (m) => m.DeviceSummaryPageComponent,
          ),
      },
      {
        path: 'devices',
        title: 'Devices · InduSense',
        data: { section: 'Devices' },
        loadComponent: () =>
          import('./features/devices/devices-page.component').then((m) => m.DevicesPageComponent),
      },
      {
        path: 'assets',
        title: 'Assets · InduSense',
        data: { section: 'Assets' },
        loadComponent: () =>
          import('./features/assets/assets-page.component').then((m) => m.AssetsPageComponent),
      },
      {
        path: 'locations',
        title: 'Locations · InduSense',
        data: { section: 'Locations' },
        loadComponent: () =>
          import('./features/locations/locations-page.component').then(
            (m) => m.LocationsPageComponent,
          ),
      },
      comingSoon('maps', 'Maps', 'map'),
      {
        path: 'reports',
        title: 'Reports · InduSense',
        data: { section: 'Reports' },
        loadComponent: () =>
          import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent),
      },
      comingSoon('alarms', 'Alarms', 'bell'),
      comingSoon('more', 'More', 'more-horizontal'),
      comingSoon('quick-start', 'Quick Start', 'wand'),
      {
        path: 'settings',
        title: 'Settings · InduSense',
        data: { section: 'Settings' },
        loadComponent: () =>
          import('./features/settings/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
      comingSoon('help', 'Help', 'help-circle'),
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
