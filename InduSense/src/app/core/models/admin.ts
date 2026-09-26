import { IsoDateTime } from './common';

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
  is_active?: boolean | null;
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
  is_active?: boolean;
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
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CompanyCreate {
  code: string;
  name: string;
  address?: string | null;
  timezone?: string;
}

export interface CompanyUpdate {
  name?: string | null;
  address?: string | null;
  timezone?: string | null;
  is_active?: boolean | null;
}

export interface CompanyFilters {
  is_active?: boolean;
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
  is_active: boolean;
}

export interface ModuleCreate {
  code: string;
  name: string;
  description?: string | null;
}

export interface ModuleUpdate {
  name?: string | null;
  description?: string | null;
  is_active?: boolean | null;
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
