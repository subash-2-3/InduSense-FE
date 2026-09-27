import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CompaniesApi, RolesApi, UsersApi } from '../../core/api/resources/admin.api';
import {
  Company,
  CompanyCreate,
  Permission,
  Role,
  RoleCreate,
  User,
  UserCreate,
} from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  ModalComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  VISIBLE_STATUSES,
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';
import { formatDateTime } from '../../shared/utils/format';

type SettingsTab = 'users' | 'roles' | 'companies';

@Component({
  selector: 'app-settings-page',
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    IconComponent,
    StatusPillComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
  ],
  template: `
    <div class="settings-page">
      <header class="settings-header">
        <div class="settings-header__titles">
          <h1 class="settings-header__title">Administration & Settings</h1>
          <p class="settings-header__subtitle">
            Manage organization users, security roles, permissions, and tenant companies
          </p>
        </div>
        <div class="settings-header__actions">
          <button appButton variant="secondary" (click)="loadCurrentTab()">
            <app-icon name="refresh" [size]="14" [class.spinning]="loading()" />
            Refresh
          </button>
          @switch (activeTab()) {
            @case ('users') {
              <button appButton variant="primary" (click)="openCreateUserModal()">
                <app-icon name="plus" [size]="14" />
                New User
              </button>
            }
            @case ('roles') {
              <button appButton variant="primary" (click)="openCreateRoleModal()">
                <app-icon name="plus" [size]="14" />
                New Role
              </button>
            }
            @case ('companies') {
              <button appButton variant="primary" (click)="openCreateCompanyModal()">
                <app-icon name="plus" [size]="14" />
                New Company
              </button>
            }
          }
        </div>
      </header>

      <!-- Tabs Bar -->
      <div class="tabs-bar">
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'users'"
          (click)="setTab('users')"
        >
          <app-icon name="user" [size]="16" />
          Users & Access ({{ usersTotal() }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'roles'"
          (click)="setTab('roles')"
        >
          <app-icon name="lock" [size]="16" />
          Roles & Permissions ({{ roles().length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'companies'"
          (click)="setTab('companies')"
        >
          <app-icon name="building" [size]="16" />
          Companies ({{ companies().length }})
        </button>
      </div>

      <!-- Action Feedback Banner -->

      <div class="settings-toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            class="search-input"
            [placeholder]="'Search ' + activeTab() + '...'"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
          @if (searchTerm()) {
            <button class="clear-btn" type="button" (click)="searchTerm.set('')">
              <app-icon name="x" [size]="14" />
            </button>
          }
        </div>
      </div>

      <app-card [padded]="false">
        @if (loading()) {
          <div class="settings-skeleton">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <app-skeleton height="48px" />
            }
          </div>
        } @else if (error()) {
          <div class="settings-state">
            <app-error-state
              heading="Failed to load administrative records"
              [message]="error()!"
              (retry)="loadCurrentTab()"
            />
          </div>
        } @else {
          @switch (activeTab()) {
            @case ('users') {
              @if (filteredUsers().length === 0) {
                <div class="settings-state">
                  <app-empty-state
                    heading="No users found"
                    message="No users match the search criteria or have been created."
                  >
                    <button appButton variant="primary" (click)="openCreateUserModal()">
                      <app-icon name="plus" [size]="14" />
                      Add First User
                    </button>
                  </app-empty-state>
                </div>
              } @else {
                <div class="table-container">
                  <table class="settings-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>User / Email</th>
                        <th>Full Name</th>
                        <th>Assigned Roles</th>
                        <th>Last Login</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (u of filteredUsers(); track u.id) {
                        <tr>
                          <td>
                            <app-status-pill
                              [label]="statusLabel(u.status)"
                              [tone]="statusTone(u.status)"
                            />
                          </td>
                          <td>
                            <strong>{{ u.email }}</strong>
                          </td>
                          <td>
                            {{ u.first_name ? u.first_name + ' ' + (u.last_name || '') : '—' }}
                          </td>
                          <td>
                            <div class="roles-chips">
                              @for (roleCode of u.roles; track roleCode) {
                                <span class="role-badge">{{ roleCode }}</span>
                              }
                            </div>
                          </td>
                          <td class="cell-time">{{ formatTime(u.last_login_at) }}</td>
                          <td class="text-right">
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Toggle User Status"
                              (click)="toggleUserStatus(u)"
                            >
                              <app-icon name="settings" [size]="14" />
                            </button>
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Delete User"
                              (click)="deleteUser(u.id, u.email)"
                            >
                              <app-icon name="x" [size]="14" />
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }

            @case ('roles') {
              @if (filteredRoles().length === 0) {
                <div class="settings-state">
                  <app-empty-state heading="No roles found" message="No security roles defined." />
                </div>
              } @else {
                <div class="table-container">
                  <table class="settings-table">
                    <thead>
                      <tr>
                        <th>Role Code</th>
                        <th>Role Name</th>
                        <th>Description</th>
                        <th>Permissions</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (role of filteredRoles(); track role.id) {
                        <tr>
                          <td class="cell-mono">{{ role.code }}</td>
                          <td>
                            <strong>{{ role.name }}</strong>
                          </td>
                          <td>{{ role.description || '—' }}</td>
                          <td>
                            <div class="perms-summary" [title]="role.permissions.join(', ')">
                              {{ role.permissions.length }} permissions granted
                            </div>
                          </td>
                          <td>
                            <span class="role-type-badge" [class.badge-system]="role.is_system">
                              {{ role.is_system ? 'System' : 'Custom' }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }

            @case ('companies') {
              @if (filteredCompanies().length === 0) {
                <div class="settings-state">
                  <app-empty-state
                    heading="No companies found"
                    message="No companies configured."
                  />
                </div>
              } @else {
                <div class="table-container">
                  <table class="settings-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Company Code</th>
                        <th>Company Name</th>
                        <th>Created</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of filteredCompanies(); track c.id) {
                        <tr>
                          <td>
                            <app-status-pill
                              [label]="statusLabel(c.status)"
                              [tone]="statusTone(c.status)"
                            />
                          </td>
                          <td class="cell-mono">{{ c.code }}</td>
                          <td>
                            <strong>{{ c.name }}</strong>
                          </td>
                          <td class="cell-time">{{ formatTime(c.created_at) }}</td>
                          <td class="text-right">
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Toggle Company Status"
                              (click)="toggleCompanyStatus(c)"
                            >
                              <app-icon name="settings" [size]="14" />
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
          }
        }
      </app-card>

      <!-- User Create Modal -->
      <app-modal
        [open]="userModalOpen()"
        title="Add New User"
        subtitle="Invite a team member or administrator with assigned roles"
        (close)="userModalOpen.set(false)"
      >
        <form (ngSubmit)="saveUser()" class="modal-form">
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input
              type="email"
              class="form-input"
              placeholder="e.g. operator@company.com"
              [(ngModel)]="userForm.email"
              name="email"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">First Name</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. John"
                [(ngModel)]="userForm.first_name"
                name="first_name"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Last Name</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Doe"
                [(ngModel)]="userForm.last_name"
                name="last_name"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Initial Password *</label>
            <input
              type="password"
              class="form-input"
              placeholder="Enter strong password (minimum 8 characters)"
              [(ngModel)]="userForm.password"
              name="password"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Assign Role *</label>
            <select
              class="form-select"
              [(ngModel)]="userForm.selectedRoleCode"
              name="selectedRoleCode"
              required
            >
              <option [ngValue]="null" disabled>Select Role</option>
              @for (r of roles(); track r.id) {
                <option [ngValue]="r.code">{{ r.name }} ({{ r.code }})</option>
              }
            </select>
          </div>

          <div class="modal-actions">
            <button appButton variant="secondary" type="button" (click)="userModalOpen.set(false)">
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="
                saving() ||
                !userForm.email.trim() ||
                !userForm.password.trim() ||
                !userForm.selectedRoleCode
              "
            >
              {{ saving() ? 'Creating...' : 'Create User' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- Role Create Modal -->
      <app-modal
        [open]="roleModalOpen()"
        title="Create Custom Role"
        subtitle="Define fine-grained permission assignments"
        (close)="roleModalOpen.set(false)"
      >
        <form (ngSubmit)="saveRole()" class="modal-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Role Code *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. SHIFT_SUPERVISOR"
                [(ngModel)]="roleForm.code"
                name="code"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Role Name *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Shift Supervisor"
                [(ngModel)]="roleForm.name"
                name="name"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <input
              type="text"
              class="form-input"
              placeholder="Responsibilities and access scope..."
              [(ngModel)]="roleForm.description"
              name="description"
            />
          </div>

          <div class="form-group">
            <label class="form-label"
              >Permissions ({{ selectedPermissions().size }} selected)</label
            >
            <div class="perms-picker">
              @for (perm of allPermissions(); track perm.code) {
                <label class="perm-checkbox-item">
                  <input
                    type="checkbox"
                    [checked]="selectedPermissions().has(perm.code)"
                    (change)="togglePermission(perm.code)"
                  />
                  <span>{{ perm.description || perm.code }}</span>
                </label>
              }
            </div>
          </div>

          <div class="modal-actions">
            <button appButton variant="secondary" type="button" (click)="roleModalOpen.set(false)">
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !roleForm.code.trim() || !roleForm.name.trim()"
            >
              {{ saving() ? 'Creating...' : 'Create Role' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- Company Create Modal -->
      <app-modal
        [open]="companyModalOpen()"
        title="Register New Company / Tenant"
        subtitle="Multi-tenant workspace isolation for industrial clients"
        (close)="companyModalOpen.set(false)"
      >
        <form (ngSubmit)="saveCompany()" class="modal-form">
          <div class="form-group">
            <label class="form-label">Company Name *</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g. Apex Manufacturing Solutions"
              [(ngModel)]="companyForm.name"
              name="name"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Company Code *</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g. APEX-IND"
              [(ngModel)]="companyForm.code"
              name="code"
              required
            />
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="companyModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !companyForm.name.trim() || !companyForm.code.trim()"
            >
              {{ saving() ? 'Registering...' : 'Register Company' }}
            </button>
          </div>
        </form>
      </app-modal>
    </div>
  `,
  styles: `
    .settings-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 1400px;
      margin: 0 auto;
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .settings-header__title {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .settings-header__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .settings-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .tabs-bar {
      display: flex;
      gap: var(--space-2);
      border-bottom: 1px solid var(--border-light);
      padding-bottom: var(--space-2);
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background: var(--bg-card-hover);
    }

    .tab-btn--active {
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.1);
      border-color: rgba(6, 182, 212, 0.3);
    }

    .settings-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .search-box {
      position: relative;
      flex: 1;
      max-width: 440px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 38px;
      padding: 0 34px 0 36px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-cyan);
    }

    .clear-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .table-container {
      overflow-x: auto;
    }

    .settings-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
      text-align: left;
    }

    .settings-table th {
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
    }

    .settings-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }

    .settings-table tr:hover td {
      background: var(--bg-card-hover);
    }

    .text-right {
      text-align: right;
    }

    .roles-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .role-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      background: rgba(6, 182, 212, 0.1);
      color: var(--accent-cyan);
      border: 1px solid rgba(6, 182, 212, 0.2);
    }

    .role-type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      color: var(--text-secondary);
    }

    .badge-system {
      color: var(--status-running);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .perms-summary {
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .cell-mono {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .cell-time {
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .settings-skeleton {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .settings-state {
      padding: 32px 16px;
    }

    /* Modal Form Styles */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .flex-1 {
      flex: 1;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-input,
    .form-select {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px var(--accent-cyan);
    }

    .perms-picker {
      max-height: 200px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-topbar);
    }

    .perm-checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--text-xs);
      color: var(--text-primary);
      cursor: pointer;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent implements OnInit {
  private readonly usersApi = inject(UsersApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly companiesApi = inject(CompaniesApi);

  readonly activeTab = signal<SettingsTab>('users');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly searchTerm = signal('');
  private readonly toast = inject(ToastService);
  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;

  readonly users = signal<User[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly companies = signal<Company[]>([]);
  readonly allPermissions = signal<Permission[]>([]);

  readonly usersTotal = signal(0);

  // Modals
  readonly userModalOpen = signal(false);
  userForm: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    selectedRoleCode: string | null;
  } = {
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    selectedRoleCode: null,
  };

  readonly roleModalOpen = signal(false);
  roleForm = {
    code: '',
    name: '',
    description: '',
  };
  readonly selectedPermissions = signal<Set<string>>(new Set());

  readonly companyModalOpen = signal(false);
  companyForm = {
    code: '',
    name: '',
  };

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.users().filter(
      (u) =>
        !term ||
        u.email.toLowerCase().includes(term) ||
        (u.first_name && u.first_name.toLowerCase().includes(term)) ||
        (u.last_name && u.last_name.toLowerCase().includes(term)),
    );
  });

  readonly filteredRoles = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.roles().filter(
      (r) => !term || r.code.toLowerCase().includes(term) || r.name.toLowerCase().includes(term),
    );
  });

  readonly filteredCompanies = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.companies().filter(
      (c) => !term || c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    this.loadLookups();
    this.loadCurrentTab();
  }

  loadLookups(): void {
    forkJoin({
      roles: this.rolesApi.list().pipe(catchError(() => of([] as Role[]))),
      perms: this.rolesApi.listPermissions().pipe(catchError(() => of([] as Permission[]))),
    }).subscribe(({ roles, perms }) => {
      this.roles.set(roles);
      this.allPermissions.set(perms);
    });
  }

  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.loadCurrentTab();
  }

  loadCurrentTab(): void {
    this.loading.set(true);
    this.error.set(null);

    switch (this.activeTab()) {
      case 'users':
        this.usersApi.listAll({ status: VISIBLE_STATUSES }).subscribe({
          next: (items) => {
            this.users.set(items);
            this.usersTotal.set(items.length);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load users.');
            this.loading.set(false);
          },
        });
        break;

      case 'roles':
        this.rolesApi.list().subscribe({
          next: (list) => {
            this.roles.set(list);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load roles.');
            this.loading.set(false);
          },
        });
        break;

      case 'companies':
        this.companiesApi.listAll({ status: VISIBLE_STATUSES }).subscribe({
          next: (items) => {
            this.companies.set(items);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load companies.');
            this.loading.set(false);
          },
        });
        break;
    }
  }

  // User actions
  openCreateUserModal(): void {
    this.userForm = {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      selectedRoleCode: this.roles()[0]?.code ?? null,
    };
    this.userModalOpen.set(true);
  }

  saveUser(): void {
    if (
      !this.userForm.email.trim() ||
      !this.userForm.password.trim() ||
      !this.userForm.selectedRoleCode
    ) {
      return;
    }
    this.saving.set(true);

    const payload: UserCreate = {
      email: this.userForm.email.trim(),
      password: this.userForm.password.trim(),
      first_name: this.userForm.first_name.trim() || undefined,
      last_name: this.userForm.last_name.trim() || undefined,
      role_codes: [this.userForm.selectedRoleCode],
    };

    this.usersApi.create(payload).subscribe({
      next: (created) => {
        this.users.update((list) => [created, ...list]);
        this.usersTotal.update((n) => n + 1);
        this.userModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`User "${created.email}" created successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create user.');
      },
    });
  }

  toggleUserStatus(user: User): void {
    const newStatus = toggledStatus(user.status);
    this.usersApi.update(user.id, { status: newStatus }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === user.id ? updated : u)));
        this.toast.success(`User "${user.email}" status updated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to update user status.');
      },
    });
  }

  deleteUser(id: number, email: string): void {
    if (!confirm(`Are you sure you want to delete user "${email}"?`)) return;

    this.usersApi.delete(id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== id));
        this.toast.success(`User \"${email}\" deleted.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to delete user.');
      },
    });
  }

  // Role actions
  openCreateRoleModal(): void {
    this.roleForm = {
      code: '',
      name: '',
      description: '',
    };
    this.selectedPermissions.set(new Set());
    this.roleModalOpen.set(true);
  }

  togglePermission(code: string): void {
    this.selectedPermissions.update((set) => {
      const next = new Set(set);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  saveRole(): void {
    if (!this.roleForm.code.trim() || !this.roleForm.name.trim()) return;
    this.saving.set(true);

    const payload: RoleCreate = {
      code: this.roleForm.code.trim().toUpperCase(),
      name: this.roleForm.name.trim(),
      description: this.roleForm.description.trim() || undefined,
      permission_codes: Array.from(this.selectedPermissions()),
    };

    this.rolesApi.create(payload).subscribe({
      next: (created) => {
        this.roles.update((list) => [...list, created]);
        this.roleModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Role "${created.name}" created successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create role.');
      },
    });
  }

  // Company actions
  openCreateCompanyModal(): void {
    this.companyForm = { code: '', name: '' };
    this.companyModalOpen.set(true);
  }

  saveCompany(): void {
    if (!this.companyForm.code.trim() || !this.companyForm.name.trim()) return;
    this.saving.set(true);

    const payload: CompanyCreate = {
      code: this.companyForm.code.trim().toUpperCase(),
      name: this.companyForm.name.trim(),
    };

    this.companiesApi.create(payload).subscribe({
      next: (created) => {
        this.companies.update((list) => [created, ...list]);
        this.companyModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Company "${created.name}" registered successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to register company.');
      },
    });
  }

  toggleCompanyStatus(company: Company): void {
    const newStatus = toggledStatus(company.status);
    this.companiesApi.update(company.id, { status: newStatus }).subscribe({
      next: (updated) => {
        this.companies.update((list) => list.map((c) => (c.id === company.id ? updated : c)));
        this.toast.success(`Company "${company.name}" status updated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to update company status.');
      },
    });
  }

  formatTime(iso: string | null): string {
    return iso ? formatDateTime(iso) : 'Never';
  }
}
