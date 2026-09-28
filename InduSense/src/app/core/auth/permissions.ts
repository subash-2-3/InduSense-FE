/** Permission codes used by the UI (mirrors InduSense-BE `app/core/permissions.py`). */
export const Permission = {
  /** Platform administrators: every company. */
  TenantAll: 'tenant:all',
  CompaniesView: 'companies:view',
  DevicesView: 'devices:view',
  MachinesView: 'machines:view',
  GatewaysView: 'gateways:view',
  PlantsView: 'plants:view',
  AreasView: 'areas:view',
  TagsView: 'tags:view',
  TagsCreate: 'tags:create',
  TagsUpdate: 'tags:update',
  TagsDelete: 'tags:delete',
  TelemetryView: 'telemetry:view',
  ReportsView: 'reports:view',
  DashboardsView: 'dashboards:view',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];
