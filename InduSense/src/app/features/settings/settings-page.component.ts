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
import { Observable, concat, forkJoin, last, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { CompaniesApi, RolesApi, UsersApi } from '../../core/api/resources/admin.api';
import { LocationsApi } from '../../core/api/resources/locations.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import {
  Company,
  Permission as PermissionModel,
  Plant,
  RecordStatus,
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

type SettingsTab = 'users' | 'roles';

interface UserForm {
  company_id: number | null;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  roles: Set<string>;
  /** Empty = every plant of the company. */
  plants: Set<number>;
}

function blankUserForm(): UserForm {
  return {
    company_id: null,
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    roles: new Set<string>(),
    plants: new Set<number>(),
  };
}

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
            Manage organization users, security roles and permissions
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
        @if (activeTab() === 'users') {
          <label class="status-filter">
            Show
            <select
              class="form-select"
              [ngModel]="userStatusView()"
              (ngModelChange)="setUserStatusView($event)"
              aria-label="User status"
            >
              <option value="visible">Active and inactive</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="delete">Deleted</option>
            </select>
          </label>
        }
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
                            @if (u.plant_ids.length) {
                              <div class="perms-summary">Plants: {{ plantNames(u.plant_ids) }}</div>
                            }
                          </td>
                          <td class="cell-time">{{ formatTime(u.last_login_at) }}</td>
                          <td class="text-right">
                            @if (u.status === 'delete') {
                              <button appButton variant="ghost" size="sm" (click)="restoreUser(u)">
                                Restore
                              </button>
                            } @else {
                              <button
                                appButton
                                variant="ghost"
                                size="sm"
                                title="Edit user"
                                [attr.aria-label]="'Edit ' + u.email"
                                (click)="openEditUserModal(u)"
                              >
                                <app-icon name="edit" [size]="14" />
                              </button>
                              <button
                                appButton
                                variant="ghost"
                                size="sm"
                                title="Reset password"
                                [attr.aria-label]="'Reset password of ' + u.email"
                                (click)="openPasswordModal(u)"
                              >
                                <app-icon name="lock" [size]="14" />
                              </button>
                              <button
                                appButton
                                variant="ghost"
                                size="sm"
                                [title]="
                                  u.status === 'active' ? 'Deactivate user' : 'Activate user'
                                "
                                [attr.aria-label]="
                                  (u.status === 'active' ? 'Deactivate ' : 'Activate ') + u.email
                                "
                                (click)="toggleUserStatus(u)"
                              >
                                <app-icon name="settings" [size]="14" />
                              </button>
                              <button
                                appButton
                                variant="ghost"
                                size="sm"
                                title="Delete user"
                                [attr.aria-label]="'Delete ' + u.email"
                                (click)="deleteUser(u.id, u.email)"
                              >
                                <app-icon name="x" [size]="14" />
                              </button>
                            }
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
                        <th class="text-right">Actions</th>
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
                          <td class="text-right">
                            @if (!role.is_system) {
                              <button
                                appButton
                                variant="ghost"
                                size="sm"
                                title="Edit role"
                                [attr.aria-label]="'Edit role ' + role.name"
                                (click)="openEditRoleModal(role)"
                              >
                                <app-icon name="edit" [size]="14" />
                              </button>
                            }
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
        [title]="editingUser() ? 'Edit ' + editingUser()!.email : 'Add New User'"
        subtitle="Roles decide what the user may do; plants limit where"
        (close)="userModalOpen.set(false)"
      >
        <form (ngSubmit)="saveUser()" class="modal-form">
          @if (isPlatformAdmin() && !editingUser()) {
            <div class="form-group">
              <label class="form-label">Company *</label>
              <select
                class="form-select"
                [(ngModel)]="userForm.company_id"
                name="company_id"
                required
              >
                <option [ngValue]="null" disabled>Select the company</option>
                @for (c of companies(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }} ({{ c.code }})</option>
                }
              </select>
            </div>
          }
          @if (!editingUser()) {
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
          }

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

          @if (!editingUser()) {
            <div class="form-group">
              <label class="form-label">Initial Password *</label>
              <input
                type="password"
                class="form-input"
                placeholder="At least 12 characters, with upper and lower case letters and a digit"
                autocomplete="new-password"
                [(ngModel)]="userForm.password"
                name="password"
                required
              />
            </div>
          }
          <div class="form-group">
            <span class="form-label">Roles * ({{ userForm.roles.size }} selected)</span>
            <div class="perms-picker">
              @for (r of roles(); track r.id) {
                <label class="perm-checkbox-item">
                  <input
                    type="checkbox"
                    [checked]="userForm.roles.has(r.code)"
                    (change)="toggleInSet(userForm.roles, r.code)"
                  />
                  <span>{{ r.name }} ({{ r.code }})</span>
                </label>
              }
            </div>
          </div>
          @if (plantsForUserForm().length) {
            <div class="form-group">
              <span class="form-label">
                Plant access ({{
                  userForm.plants.size ? userForm.plants.size + ' selected' : 'all plants'
                }})
              </span>
              <div class="perms-picker">
                @for (pl of plantsForUserForm(); track pl.id) {
                  <label class="perm-checkbox-item">
                    <input
                      type="checkbox"
                      [checked]="userForm.plants.has(pl.id)"
                      (change)="toggleInSet(userForm.plants, pl.id)"
                    />
                    <span>{{ pl.name }} ({{ pl.code }})</span>
                  </label>
                }
              </div>
            </div>
          }

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
                userForm.roles.size === 0 ||
                (!editingUser() &&
                  (!userForm.email.trim() ||
                    !userForm.password.trim() ||
                    (isPlatformAdmin() && !userForm.company_id)))
              "
            >
              {{ saving() ? 'Saving...' : editingUser() ? 'Save User' : 'Create User' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- Password Reset Modal -->
      <app-modal
        [open]="passwordUser() !== null"
        [title]="'Reset password: ' + (passwordUser()?.email ?? '')"
        subtitle="The user's sessions end; they sign in with the new password"
        (close)="passwordUser.set(null)"
      >
        <form (ngSubmit)="resetPassword()" class="modal-form">
          <div class="form-group">
            <label class="form-label" for="newPassword">New password *</label>
            <input
              id="newPassword"
              type="password"
              class="form-input"
              autocomplete="new-password"
              [(ngModel)]="newPassword"
              name="newPassword"
              required
            />
          </div>
          <div class="modal-actions">
            <button appButton variant="secondary" type="button" (click)="passwordUser.set(null)">
              Cancel
            </button>
            <button appButton variant="primary" type="submit" [disabled]="saving() || !newPassword">
              {{ saving() ? 'Saving...' : 'Reset password' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- Role Create Modal -->
      <app-modal
        [open]="roleModalOpen()"
        [title]="editingRoleId() ? 'Edit Custom Role' : 'Create Custom Role'"
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
                [disabled]="editingRoleId() !== null"
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
              {{ saving() ? 'Saving...' : editingRoleId() ? 'Save Role' : 'Create Role' }}
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

    .status-filter {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      white-space: nowrap;
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
  readonly allPermissions = signal<PermissionModel[]>([]);

  readonly usersTotal = signal(0);

  private readonly auth = inject(AuthService);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly locationsApi = inject(LocationsApi);
  protected readonly isPlatformAdmin = computed(() =>
    this.auth.hasPermission(Permission.TenantAll),
  );
  readonly companies = signal<Company[]>([]);
  readonly plants = signal<Plant[]>([]);
  readonly userStatusView = signal<'visible' | RecordStatus>('visible');

  // Modals
  readonly userModalOpen = signal(false);
  readonly editingUser = signal<User | null>(null);
  userForm: UserForm = blankUserForm();

  readonly passwordUser = signal<User | null>(null);
  newPassword = '';

  readonly roleModalOpen = signal(false);
  readonly editingRoleId = signal<number | null>(null);
  roleForm = {
    code: '',
    name: '',
    description: '',
  };
  readonly selectedPermissions = signal<Set<string>>(new Set());

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

  ngOnInit(): void {
    this.loadLookups();
    this.loadCurrentTab();
  }

  loadLookups(): void {
    forkJoin({
      roles: this.rolesApi.list().pipe(catchError(() => of([] as Role[]))),
      perms: this.rolesApi.listPermissions().pipe(catchError(() => of([] as PermissionModel[]))),
      plants: this.locationsApi.listAllPlants().pipe(catchError(() => of([] as Plant[]))),
    }).subscribe(({ roles, perms, plants }) => {
      this.roles.set(roles);
      this.allPermissions.set(perms);
      this.plants.set(plants);
    });
    if (this.isPlatformAdmin()) {
      this.companiesApi.listAll().subscribe({
        next: (companies) => this.companies.set(companies),
        error: (err) => this.toast.error(err, 'Unable to load companies.'),
      });
    }
  }

  setUserStatusView(view: 'visible' | RecordStatus): void {
    this.userStatusView.set(view);
    this.loadCurrentTab();
  }

  /** Plants of the company the user in the form belongs to (platform admins see every company). */
  plantsForUserForm(): Plant[] {
    const companyId = this.editingUser()?.company_id ?? this.userForm.company_id;
    return companyId ? this.plants().filter((p) => p.company_id === companyId) : this.plants();
  }

  plantNames(ids: number[]): string {
    return ids.map((id) => this.plants().find((p) => p.id === id)?.name ?? `#${id}`).join(', ');
  }

  toggleInSet<T>(set: Set<T>, value: T): void {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
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
      case 'users': {
        const view = this.userStatusView();
        this.usersApi.listAll({ status: view === 'visible' ? VISIBLE_STATUSES : view }).subscribe({
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
      }

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
    }
  }

  // User actions
  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.userForm = blankUserForm();
    this.userModalOpen.set(true);
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.userForm = {
      ...blankUserForm(),
      company_id: user.company_id,
      email: user.email,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      roles: new Set(user.roles),
      plants: new Set(user.plant_ids),
    };
    this.userModalOpen.set(true);
  }

  saveUser(): void {
    const editing = this.editingUser();
    if (editing) {
      this.updateUser(editing);
      return;
    }
    if (!this.userForm.email.trim() || !this.userForm.password || !this.userForm.roles.size) {
      return;
    }
    this.saving.set(true);

    const payload: UserCreate = {
      email: this.userForm.email.trim(),
      password: this.userForm.password,
      first_name: this.userForm.first_name.trim() || null,
      last_name: this.userForm.last_name.trim() || null,
      role_codes: [...this.userForm.roles],
      company_id: this.isPlatformAdmin() ? this.userForm.company_id : undefined,
    };
    const plantIds = [...this.userForm.plants];

    this.usersApi
      .create(payload)
      .pipe(
        switchMap((created) =>
          plantIds.length ? this.usersApi.setPlants(created.id, plantIds) : of(created),
        ),
      )
      .subscribe({
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

  /** Names, roles and plant access are separate endpoints; only what changed is sent. */
  private updateUser(user: User): void {
    if (!this.userForm.roles.size) return;
    const steps: Observable<User>[] = [];
    const firstName = this.userForm.first_name.trim() || null;
    const lastName = this.userForm.last_name.trim() || null;
    if (firstName !== user.first_name || lastName !== user.last_name) {
      steps.push(this.usersApi.update(user.id, { first_name: firstName, last_name: lastName }));
    }
    const roles = [...this.userForm.roles].sort();
    if (roles.join() !== [...user.roles].sort().join()) {
      steps.push(this.usersApi.setRoles(user.id, roles));
    }
    const plants = [...this.userForm.plants].sort((a, b) => a - b);
    if (plants.join() !== [...user.plant_ids].sort((a, b) => a - b).join()) {
      steps.push(this.usersApi.setPlants(user.id, plants));
    }
    if (!steps.length) {
      this.userModalOpen.set(false);
      return;
    }
    this.saving.set(true);
    concat(...steps)
      .pipe(last())
      .subscribe({
        next: (updated) => {
          this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
          this.userModalOpen.set(false);
          this.saving.set(false);
          this.toast.success(`User "${updated.email}" updated.`);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'Failed to update user.');
          this.loadCurrentTab(); // some steps may have been saved
        },
      });
  }

  openPasswordModal(user: User): void {
    this.newPassword = '';
    this.passwordUser.set(user);
  }

  resetPassword(): void {
    const user = this.passwordUser();
    if (!user || !this.newPassword) return;
    this.saving.set(true);
    this.usersApi.resetPassword(user.id, this.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.passwordUser.set(null);
        this.toast.success(`Password of "${user.email}" reset; their sessions ended.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to reset the password.');
      },
    });
  }

  restoreUser(user: User): void {
    this.usersApi.update(user.id, { status: 'active' }).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.toast.success(`User "${user.email}" restored.`);
      },
      error: (err) => this.toast.error(err, 'Failed to restore user.'),
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
  openEditRoleModal(role: Role): void {
    this.editingRoleId.set(role.id);
    this.roleForm = { code: role.code, name: role.name, description: role.description ?? '' };
    this.selectedPermissions.set(new Set(role.permissions));
    this.roleModalOpen.set(true);
  }

  openCreateRoleModal(): void {
    this.editingRoleId.set(null);
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

    const editingId = this.editingRoleId();
    if (editingId) {
      this.rolesApi
        .update(editingId, {
          name: this.roleForm.name.trim(),
          description: this.roleForm.description.trim() || null,
          permission_codes: Array.from(this.selectedPermissions()),
        })
        .subscribe({
          next: (updated) => {
            this.roles.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
            this.roleModalOpen.set(false);
            this.saving.set(false);
            this.toast.success(`Role "${updated.name}" updated.`);
          },
          error: (err) => {
            this.saving.set(false);
            this.toast.error(err, 'Failed to update role.');
          },
        });
      return;
    }

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

  formatTime(iso: string | null): string {
    return iso ? formatDateTime(iso) : 'Never';
  }
}
