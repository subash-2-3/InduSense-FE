/** Permission codes used by the UI (mirrors InduSense-BE `app/core/permissions.py`). */
export const Permission = {
  DevicesView: 'devices:view',
  MachinesView: 'machines:view',
  GatewaysView: 'gateways:view',
  PlantsView: 'plants:view',
  AreasView: 'areas:view',
  TagsView: 'tags:view',
  TelemetryView: 'telemetry:view',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];
