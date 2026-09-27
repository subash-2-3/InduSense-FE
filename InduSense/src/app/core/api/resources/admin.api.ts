import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AuditLog,
  AuditLogFilters,
  Company,
  CompanyCreate,
  CompanyFilters,
  CompanyUpdate,
  LoggerAssign,
  LoggerFilters,
  LoggerStatus,
  Module,
  ModuleCreate,
  ModuleUpdate,
  PasswordReset,
  Permission,
  Role,
  RoleCreate,
  RoleUpdate,
  User,
  UserCreate,
  UserFilters,
  UserRolesUpdate,
  UserUpdate,
} from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService, queryOf } from '../api.service';

/** `/users` (requires `users:view`). */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiService);

  list(filters: UserFilters & PageParams = {}): Observable<Page<User>> {
    return this.api.getPage<User>('/users', queryOf(filters));
  }

  listAll(filters: UserFilters = {}): Observable<User[]> {
    return this.api.getAllPages<User>('/users', queryOf(filters));
  }

  get(id: number): Observable<User> {
    return this.api.get<User>(`/users/${id}`);
  }

  create(body: UserCreate): Observable<User> {
    return this.api.post<User>('/users', body);
  }

  update(id: number, body: UserUpdate): Observable<User> {
    return this.api.patch<User>(`/users/${id}`, body);
  }

  deactivate(id: number): Observable<User> {
    return this.api.delete<User>(`/users/${id}`);
  }

  setRoles(id: number, roleCodes: string[]): Observable<User> {
    const body: UserRolesUpdate = { role_codes: roleCodes };
    return this.api.put<User>(`/users/${id}/roles`, body);
  }

  /** Limits the user to these plants; an empty list gives access to every plant of the company. */
  setPlants(id: number, plantIds: number[]): Observable<User> {
    return this.api.put<User>(`/users/${id}/plants`, { plant_ids: plantIds });
  }

  resetPassword(id: number, newPassword: string): Observable<void> {
    const body: PasswordReset = { new_password: newPassword };
    return this.api.post<void>(`/users/${id}/password`, body);
  }
}

/** `/roles` and `/permissions` (requires `roles:view`). */
@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly api = inject(ApiService);

  list(): Observable<Role[]> {
    return this.api.get<Role[]>('/roles');
  }

  get(id: number): Observable<Role> {
    return this.api.get<Role>(`/roles/${id}`);
  }

  create(body: RoleCreate): Observable<Role> {
    return this.api.post<Role>('/roles', body);
  }

  update(id: number, body: RoleUpdate): Observable<Role> {
    return this.api.patch<Role>(`/roles/${id}`, body);
  }

  listPermissions(): Observable<Permission[]> {
    return this.api.get<Permission[]>('/permissions');
  }
}

/** `/companies` and `/modules` (requires `companies:view`). */
@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  private readonly api = inject(ApiService);

  list(filters: CompanyFilters & PageParams = {}): Observable<Page<Company>> {
    return this.api.getPage<Company>('/companies', queryOf(filters));
  }

  listAll(filters: CompanyFilters = {}): Observable<Company[]> {
    return this.api.getAllPages<Company>('/companies', queryOf(filters));
  }

  get(id: number): Observable<Company> {
    return this.api.get<Company>(`/companies/${id}`);
  }

  create(body: CompanyCreate): Observable<Company> {
    return this.api.post<Company>('/companies', body);
  }

  update(id: number, body: CompanyUpdate): Observable<Company> {
    return this.api.patch<Company>(`/companies/${id}`, body);
  }

  deactivate(id: number): Observable<Company> {
    return this.api.delete<Company>(`/companies/${id}`);
  }

  modules(companyId: number): Observable<string[]> {
    return this.api.get<string[]>(`/companies/${companyId}/modules`);
  }

  setModules(companyId: number, moduleCodes: string[]): Observable<string[]> {
    return this.api.put<string[]>(`/companies/${companyId}/modules`, {
      module_codes: moduleCodes,
    });
  }

  listProductModules(): Observable<Module[]> {
    return this.api.get<Module[]>('/modules');
  }

  createProductModule(body: ModuleCreate): Observable<Module> {
    return this.api.post<Module>('/modules', body);
  }

  updateProductModule(id: number, body: ModuleUpdate): Observable<Module> {
    return this.api.patch<Module>(`/modules/${id}`, body);
  }
}

/** `/loggers` (requires `loggers:view`). */
@Injectable({ providedIn: 'root' })
export class LoggersApi {
  private readonly api = inject(ApiService);

  list(filters: LoggerFilters & PageParams = {}): Observable<Page<LoggerStatus>> {
    return this.api.getPage<LoggerStatus>('/loggers', queryOf(filters));
  }

  listAll(filters: LoggerFilters = {}): Observable<LoggerStatus[]> {
    return this.api.getAllPages<LoggerStatus>('/loggers', queryOf(filters));
  }

  get(loggerId: string): Observable<LoggerStatus> {
    return this.api.get<LoggerStatus>(`/loggers/${loggerId}`);
  }

  assign(loggerId: string, companyId: number | null): Observable<LoggerStatus> {
    const body: LoggerAssign = { company_id: companyId };
    return this.api.patch<LoggerStatus>(`/loggers/${loggerId}`, body);
  }
}

/** `/audit-logs` (requires `audit:view`). */
@Injectable({ providedIn: 'root' })
export class AuditLogsApi {
  private readonly api = inject(ApiService);

  list(filters: AuditLogFilters & PageParams = {}): Observable<Page<AuditLog>> {
    return this.api.getPage<AuditLog>('/audit-logs', queryOf(filters));
  }

  listAll(filters: AuditLogFilters = {}): Observable<AuditLog[]> {
    return this.api.getAllPages<AuditLog>('/audit-logs', queryOf(filters));
  }
}
