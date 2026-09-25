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
      comingSoon('devices', 'Devices', 'router'),
      comingSoon('assets', 'Assets', 'lightbulb'),
      comingSoon('locations', 'Locations', 'map-pin'),
      comingSoon('maps', 'Maps', 'map'),
      comingSoon('reports', 'Reports', 'line-chart'),
      comingSoon('alarms', 'Alarms', 'bell'),
      comingSoon('more', 'More', 'more-horizontal'),
      comingSoon('quick-start', 'Quick Start', 'wand'),
      comingSoon('settings', 'Settings', 'settings'),
      comingSoon('help', 'Help', 'help-circle'),
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
