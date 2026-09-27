import { EditableStatus, IsoDateTime, RecordStatus, StatusFilter } from './common';

// ---------------------------------------------------------------------- Users ----

export interface UserCreate {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  company_id?: number | null;
  role_codes?: string[];
  is_verified?: boolean;
}

export interface UserUpdate {
  first_name?: string | null;
  last_name?: string | null;
  status?: EditableStatus;
  is_verified?: boolean | null;
}

export interface UserRolesUpdate {
  role_codes: string[];
}

export interface PasswordReset {
  new_password: string;
}

export interface UserFilters {
  company_id?: number;
  status?: StatusFilter | null;
  search?: string;
}

// ---------------------------------------------------------------------- Roles ----

export interface Permission {
  code: string;
  description: string | null;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoleCreate {
  code: string;
  name: string;
  description?: string | null;
  permission_codes?: string[];
}

export interface RoleUpdate {
  name?: string | null;
  description?: string | null;
  permission_codes?: string[];
}

// ------------------------------------------------------------------ Companies ----

export interface Company {
  id: number;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
  status: RecordStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Resources a platform administrator can cap per company (InduSense-BE `LimitedResource`). */
export type LimitedResource =
  'plants' | 'areas' | 'machines' | 'meters' | 'gateways' | 'devices' | 'users';

export const LIMITED_RESOURCES: readonly LimitedResource[] = [
  'plants',
  'areas',
  'machines',
  'meters',
  'gateways',
  'devices',
  'users',
];

/** `GET /companies/{id}/limits` row: `limit` null = unlimited; `used` = active + inactive records. */
export interface CompanyLimitUsage {
  resource: LimitedResource;
  limit: number | null;
  used: number;
}

export interface CompanyCreate {
  code: string;
  name: string;
  address?: string | null;
  timezone?: string;
  /** Omitted resources are unlimited. */
  limits?: Partial<Record<LimitedResource, number>>;
  /** Module codes to enable (needs `modules:manage`). */
  module_codes?: string[];
}

export interface CompanyUpdate {
  name?: string | null;
  address?: string | null;
  timezone?: string | null;
  status?: EditableStatus;
}

export interface CompanyFilters {
  status?: StatusFilter | null;
  search?: string;
}

export interface CompanyModulesUpdate {
  module_codes: string[];
}

export interface Module {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: RecordStatus;
}

export interface ModuleCreate {
  code: string;
  name: string;
  description?: string | null;
}

export interface ModuleUpdate {
  name?: string | null;
  description?: string | null;
  status?: EditableStatus;
}

// ---------------------------------------------------------------- DataLoggers ----

export type LoggerHealth = 'HEALTHY' | 'DEGRADED' | 'STALE';

export interface LoggerStatus {
  logger_id: string;
  company_id: number | null;
  hostname: string;
  version: string;
  data_source: string;
  source_connected: boolean;
  database_connected: boolean;
  last_message_at: IsoDateTime | null;
  last_error: string | null;
  last_error_at: IsoDateTime | null;
  buffered_points: number;
  started_at: IsoDateTime;
  updated_at: IsoDateTime;
  health: LoggerHealth;
}

export interface LoggerAssign {
  company_id: number | null;
}

export interface LoggerFilters {
  company_id?: number;
  unassigned?: boolean;
}

// ------------------------------------------------------------------ Audit Logs ----

export interface AuditLog {
  id: number;
  company_id: number | null;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: IsoDateTime;
}

export interface AuditLogFilters {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: number;
  company_id?: number;
  start_time?: IsoDateTime;
  end_time?: IsoDateTime;
}
