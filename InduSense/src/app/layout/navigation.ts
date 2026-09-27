import { Permission, PermissionCode } from '../core/auth/permissions';
import { IconName } from '../shared/ui';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  /** Shows a chevron: the section has sub-pages. */
  hasChildren?: boolean;
  /** Hidden unless the user has this permission. */
  permission?: PermissionCode;
}

/** Sidebar entries, top to bottom. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'gauge' },
  // Platform administration: every company (tenant:all only).
  { label: 'Companies', path: '/companies', icon: 'building', permission: Permission.TenantAll },
  {
    label: 'Devices',
    path: '/devices',
    icon: 'router',
    hasChildren: true,
    permission: Permission.DevicesView,
  },
  { label: 'Assets', path: '/assets', icon: 'lightbulb', permission: Permission.MachinesView },
  { label: 'Locations', path: '/locations', icon: 'map-pin', permission: Permission.PlantsView },
  { label: 'Energy', path: '/energy', icon: 'zap', permission: Permission.DashboardsView },
  { label: 'Maps', path: '/maps', icon: 'map', permission: Permission.PlantsView },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'line-chart',
    hasChildren: true,
    permission: Permission.ReportsView,
  },
  { label: 'Alarms', path: '/alarms', icon: 'bell', hasChildren: true },
  { label: 'More', path: '/more', icon: 'more-horizontal' },
];

/** Pinned to the bottom of the sidebar. */
export const PINNED_NAV: NavItem = { label: 'Quick Start', path: '/quick-start', icon: 'wand' };
