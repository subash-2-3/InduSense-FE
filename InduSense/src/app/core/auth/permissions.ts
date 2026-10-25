/** Permission codes used by the UI (mirrors InduSense-BE `app/core/permissions.py`). */
export const Permission = {
  /** Platform administrators: every company. */
  TenantAll: 'tenant:all',
  CompaniesView: 'companies:view',
  DevicesView: 'devices:view',
  /** Send commands to devices (write PLC registers). */
  DevicesControl: 'devices:control',
  MachinesView: 'machines:view',
  GatewaysView: 'gateways:view',
  BusinessUnitsView: 'business_units:view',
  BusinessUnitsCreate: 'business_units:create',
  BusinessUnitsUpdate: 'business_units:update',
  BusinessUnitsDelete: 'business_units:delete',
  PlantsView: 'plants:view',
  AreasView: 'areas:view',
  TagsView: 'tags:view',
  TagsCreate: 'tags:create',
  TagsUpdate: 'tags:update',
  TagsDelete: 'tags:delete',
  TelemetryView: 'telemetry:view',
  ReportsView: 'reports:view',
  DashboardsView: 'dashboards:view',
  LoggersView: 'loggers:view',
  AlarmsView: 'alarms:view',
  AlarmsManage: 'alarms:manage',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];
