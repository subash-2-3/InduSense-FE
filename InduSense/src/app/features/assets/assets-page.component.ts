import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { LocationsApi } from '../../core/api/resources/locations.api';
import { GatewaysApi, MachinesApi, MetersApi } from '../../core/api/resources/plant-assets.api';
import {
  Area,
  Gateway,
  GatewayCreate,
  Machine,
  MachineCreate,
  Meter,
  MeterCreate,
  Plant,
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
  StatusTone,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';

type AssetTab = 'machines' | 'meters' | 'gateways';

@Component({
  selector: 'app-assets-page',
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
    <div class="assets-page">
      <header class="assets-header">
        <div class="assets-header__titles">
          <h1 class="assets-header__title">Plant Assets</h1>
          <p class="assets-header__subtitle">Manage industrial machinery, submeters, and edge telemetry gateways</p>
        </div>
        <div class="assets-header__actions">
          <button appButton variant="secondary" (click)="loadCurrentTab()">
            <app-icon name="refresh" [size]="14" [class.spinning]="loading()" />
            Refresh
          </button>
          @switch (activeTab()) {
            @case ('machines') {
              <button appButton variant="primary" (click)="openCreateMachineModal()">
                <app-icon name="plus" [size]="14" />
                New Machine
              </button>
            }
            @case ('meters') {
              <button appButton variant="primary" (click)="openCreateMeterModal()">
                <app-icon name="plus" [size]="14" />
                New Meter
              </button>
            }
            @case ('gateways') {
              <button appButton variant="primary" (click)="openCreateGatewayModal()">
                <app-icon name="plus" [size]="14" />
                New Gateway
              </button>
            }
          }
        </div>
      </header>

      <div class="tabs-bar">
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'machines'"
          (click)="setTab('machines')"
        >
          <app-icon name="settings" [size]="16" />
          Machines ({{ machinesTotal() }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'meters'"
          (click)="setTab('meters')"
        >
          <app-icon name="zap" [size]="16" />
          Meters ({{ metersTotal() }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'gateways'"
          (click)="setTab('gateways')"
        >
          <app-icon name="router" [size]="16" />
          Gateways ({{ gatewaysTotal() }})
        </button>
      </div>

      <!-- Toolbar with Search & Status Filter -->
      <div class="assets-toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            class="search-input"
            [placeholder]="'Search ' + activeTab() + ' by name, code, model...'"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
          @if (searchTerm()) {
            <button class="clear-btn" type="button" (click)="searchTerm.set('')">
              <app-icon name="x" [size]="14" />
            </button>
          }
        </div>

        <div class="filter-group">
          <label class="filter-label">Filter:</label>
          <select
            class="filter-select"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >
            <option value="all">All Assets</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>


      <app-card [padded]="false">
        @if (loading()) {
          <div class="assets-skeleton">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <app-skeleton height="48px" />
            }
          </div>
        } @else if (error()) {
          <div class="assets-state">
            <app-error-state
              heading="Failed to load assets"
              [message]="error()!"
              (retry)="loadCurrentTab()"
            />
          </div>
        } @else {
          @switch (activeTab()) {
            @case ('machines') {
              @if (filteredMachines().length === 0) {
                <div class="assets-state">
                  <app-empty-state
                    heading="No machines found"
                    message="No machines match your filter criteria or have been registered."
                  >
                    <button appButton variant="primary" (click)="openCreateMachineModal()">
                      <app-icon name="plus" [size]="14" />
                      Add First Machine
                    </button>
                  </app-empty-state>
                </div>
              } @else {
                <div class="table-container">
                  <table class="assets-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Machine Name / Code</th>
                        <th>Type</th>
                        <th>Manufacturer / Model</th>
                        <th>Serial Number</th>
                        <th>Plant & Area</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of filteredMachines(); track m.id) {
                        <tr>
                          <td>
                            <app-status-pill [label]="m.status" [tone]="machineStatusTone(m.status)" />
                          </td>
                          <td>
                            <div class="cell-name">
                              <span class="cell-name__primary">{{ m.name }}</span>
                              <span class="cell-name__secondary">{{ m.machine_code }}</span>
                            </div>
                          </td>
                          <td>{{ m.machine_type || '—' }}</td>
                          <td>
                            {{ m.manufacturer || '—' }} {{ m.model ? '/ ' + m.model : '' }}
                          </td>
                          <td>
                            <span class="cell-mono">{{ m.serial_number || '—' }}</span>
                          </td>
                          <td>
                            <span class="cell-location">{{ getPlantName(m.plant_id) }}</span>
                          </td>
                          <td class="text-right">
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Deactivate Machine"
                              (click)="deactivateMachine(m.id, m.name)"
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

            @case ('meters') {
              @if (filteredMeters().length === 0) {
                <div class="assets-state">
                  <app-empty-state
                    heading="No energy meters found"
                    message="No energy meters match your filter criteria or have been registered."
                  >
                    <button appButton variant="primary" (click)="openCreateMeterModal()">
                      <app-icon name="plus" [size]="14" />
                      Add First Meter
                    </button>
                  </app-empty-state>
                </div>
              } @else {
                <div class="table-container">
                  <table class="assets-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Meter Name / Code</th>
                        <th>Type</th>
                        <th>Unit</th>
                        <th>Manufacturer / Model</th>
                        <th>Serial Number</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (meter of filteredMeters(); track meter.id) {
                        <tr>
                          <td>
                            <app-status-pill
                              [label]="meter.is_active ? 'Active' : 'Inactive'"
                              [tone]="meter.is_active ? 'running' : 'stopped'"
                            />
                          </td>
                          <td>
                            <div class="cell-name">
                              <span class="cell-name__primary">{{ meter.name }}</span>
                              <span class="cell-name__secondary">{{ meter.meter_code }}</span>
                            </div>
                          </td>
                          <td>{{ meter.meter_type || '—' }}</td>
                          <td>
                            <span class="unit-badge">{{ meter.unit || 'kWh' }}</span>
                          </td>
                          <td>
                            {{ meter.manufacturer || '—' }} {{ meter.model ? '/ ' + meter.model : '' }}
                          </td>
                          <td>
                            <span class="cell-mono">{{ meter.serial_number || '—' }}</span>
                          </td>
                          <td class="text-right">
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Toggle Active Status"
                              (click)="toggleMeterStatus(meter)"
                            >
                              <app-icon name="settings" [size]="14" />
                            </button>
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Deactivate Meter"
                              (click)="deactivateMeter(meter.id, meter.name)"
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

            @case ('gateways') {
              @if (filteredGateways().length === 0) {
                <div class="assets-state">
                  <app-empty-state
                    heading="No gateways found"
                    message="No edge gateways match your filter criteria or have been registered."
                  >
                    <button appButton variant="primary" (click)="openCreateGatewayModal()">
                      <app-icon name="plus" [size]="14" />
                      Add First Gateway
                    </button>
                  </app-empty-state>
                </div>
              } @else {
                <div class="table-container">
                  <table class="assets-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Gateway Name / Code</th>
                        <th>Type</th>
                        <th>IP Address & Port</th>
                        <th>Plant</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (g of filteredGateways(); track g.id) {
                        <tr>
                          <td>
                            <app-status-pill
                              [label]="g.is_active ? 'Active' : 'Inactive'"
                              [tone]="g.is_active ? 'running' : 'stopped'"
                            />
                          </td>
                          <td>
                            <div class="cell-name">
                              <span class="cell-name__primary">{{ g.name }}</span>
                              <span class="cell-name__secondary">{{ g.gateway_code }}</span>
                            </div>
                          </td>
                          <td>
                            <span class="type-badge">{{ g.gateway_type }}</span>
                          </td>
                          <td>
                            <span class="cell-mono">
                              {{ g.ip_address || '—' }}{{ g.port ? ':' + g.port : '' }}
                            </span>
                          </td>
                          <td>{{ getPlantName(g.plant_id) }}</td>
                          <td class="text-right">
                            <button
                              appButton
                              variant="ghost"
                              size="sm"
                              title="Deactivate Gateway"
                              (click)="deactivateGateway(g.id, g.name)"
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
          }
        }
      </app-card>

      <!-- New Machine Modal -->
      <app-modal
        [open]="machineModalOpen()"
        title="Add New Machine"
        subtitle="Register industrial machinery to monitor states and production"
        (close)="machineModalOpen.set(false)"
      >
        <form (ngSubmit)="saveMachine()" class="modal-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Machine Name *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. CNC Milling Unit 1"
                [(ngModel)]="machineForm.name"
                name="name"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Machine Code *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. CNC-01"
                [(ngModel)]="machineForm.machine_code"
                name="machine_code"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Machine Type</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. CNC, Press, Lathe"
                [(ngModel)]="machineForm.machine_type"
                name="machine_type"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Manufacturer</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Haas, Mazak"
                [(ngModel)]="machineForm.manufacturer"
                name="manufacturer"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Model</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. VF-2"
                [(ngModel)]="machineForm.model"
                name="model"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Serial Number</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. SN-883719"
                [(ngModel)]="machineForm.serial_number"
                name="serial_number"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Plant *</label>
              <select
                class="form-select"
                [(ngModel)]="machineForm.plant_id"
                name="plant_id"
                required
              >
                <option [ngValue]="null" disabled>Select Plant</option>
                @for (p of plants(); track p.id) {
                  <option [ngValue]="p.id">{{ p.name }} ({{ p.code }})</option>
                }
              </select>
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Area (Optional)</label>
              <select
                class="form-select"
                [(ngModel)]="machineForm.area_id"
                name="area_id"
              >
                <option [ngValue]="null">None</option>
                @for (a of availableAreasForPlant(machineForm.plant_id); track a.id) {
                  <option [ngValue]="a.id">{{ a.name }} ({{ a.code }})</option>
                }
              </select>
            </div>
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="machineModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !machineForm.name.trim() || !machineForm.machine_code.trim() || !machineForm.plant_id"
            >
              {{ saving() ? 'Creating...' : 'Create Machine' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- New Meter Modal -->
      <app-modal
        [open]="meterModalOpen()"
        title="Add Energy / Utility Meter"
        subtitle="Register power, gas, or water meter for telemetry analysis"
        (close)="meterModalOpen.set(false)"
      >
        <form (ngSubmit)="saveMeter()" class="modal-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Meter Name *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Main Substation Meter 1"
                [(ngModel)]="meterForm.name"
                name="name"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Meter Code *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. MTR-01"
                [(ngModel)]="meterForm.meter_code"
                name="meter_code"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Unit of Measure</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. kWh, kW, V, A"
                [(ngModel)]="meterForm.unit"
                name="unit"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Meter Type</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Energy, Water, Gas"
                [(ngModel)]="meterForm.meter_type"
                name="meter_type"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Plant *</label>
            <select
              class="form-select"
              [(ngModel)]="meterForm.plant_id"
              name="plant_id"
              required
            >
              <option [ngValue]="null" disabled>Select Plant</option>
              @for (p of plants(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }} ({{ p.code }})</option>
              }
            </select>
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="meterModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !meterForm.name.trim() || !meterForm.meter_code.trim() || !meterForm.plant_id"
            >
              {{ saving() ? 'Creating...' : 'Create Meter' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- New Gateway Modal -->
      <app-modal
        [open]="gatewayModalOpen()"
        title="Add Edge Gateway"
        subtitle="Register field gateway collecting sensor / PLC data"
        (close)="gatewayModalOpen.set(false)"
      >
        <form (ngSubmit)="saveGateway()" class="modal-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Gateway Name *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Shopfloor Modbus Gateway"
                [(ngModel)]="gatewayForm.name"
                name="name"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Gateway Code *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. GW-01"
                [(ngModel)]="gatewayForm.gateway_code"
                name="gateway_code"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Gateway Type *</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. Moxa, Advantech, MQTT"
                [(ngModel)]="gatewayForm.gateway_type"
                name="gateway_type"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">IP Address</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. 192.168.1.100"
                [(ngModel)]="gatewayForm.ip_address"
                name="ip_address"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Plant *</label>
            <select
              class="form-select"
              [(ngModel)]="gatewayForm.plant_id"
              name="plant_id"
              required
            >
              <option [ngValue]="null" disabled>Select Plant</option>
              @for (p of plants(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }} ({{ p.code }})</option>
              }
            </select>
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="gatewayModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !gatewayForm.name.trim() || !gatewayForm.gateway_code.trim() || !gatewayForm.plant_id"
            >
              {{ saving() ? 'Creating...' : 'Create Gateway' }}
            </button>
          </div>
        </form>
      </app-modal>
    </div>
  `,
  styles: `
    .assets-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 1400px;
      margin: 0 auto;
    }

    .assets-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .assets-header__title {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .assets-header__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .assets-header__actions {
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

    .assets-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 260px;
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

    .clear-btn:hover {
      color: var(--text-primary);
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .filter-select {
      height: 38px;
      padding: 0 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .table-container {
      overflow-x: auto;
    }

    .assets-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
      text-align: left;
    }

    .assets-table th {
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
    }

    .assets-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }

    .assets-table tr:hover td {
      background: var(--bg-card-hover);
    }

    .text-right {
      text-align: right;
    }

    .cell-name {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cell-name__primary {
      font-weight: 500;
      color: var(--text-primary);
    }

    .cell-name__secondary {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .cell-mono {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .unit-badge,
    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      color: var(--accent-cyan);
    }

    .assets-skeleton {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .assets-state {
      padding: 32px 16px;
    }

    /* Form and Modal Styles */
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
export class AssetsPageComponent implements OnInit {
  private readonly machinesApi = inject(MachinesApi);
  private readonly metersApi = inject(MetersApi);
  private readonly gatewaysApi = inject(GatewaysApi);
  private readonly locationsApi = inject(LocationsApi);

  readonly activeTab = signal<AssetTab>('machines');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  private readonly toast = inject(ToastService);

  readonly machines = signal<Machine[]>([]);
  readonly meters = signal<Meter[]>([]);
  readonly gateways = signal<Gateway[]>([]);
  readonly plants = signal<Plant[]>([]);
  readonly areas = signal<Area[]>([]);

  readonly machinesTotal = signal(0);
  readonly metersTotal = signal(0);
  readonly gatewaysTotal = signal(0);

  // Modal states
  readonly machineModalOpen = signal(false);
  machineForm: {
    name: string;
    machine_code: string;
    machine_type: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    plant_id: number | null;
    area_id: number | null;
  } = {
    name: '',
    machine_code: '',
    machine_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    plant_id: null,
    area_id: null,
  };

  readonly meterModalOpen = signal(false);
  meterForm: {
    name: string;
    meter_code: string;
    meter_type: string;
    unit: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    plant_id: number | null;
  } = {
    name: '',
    meter_code: '',
    meter_type: '',
    unit: 'kWh',
    manufacturer: '',
    model: '',
    serial_number: '',
    plant_id: null,
  };

  readonly gatewayModalOpen = signal(false);
  gatewayForm: {
    name: string;
    gateway_code: string;
    gateway_type: string;
    ip_address: string;
    plant_id: number | null;
  } = {
    name: '',
    gateway_code: '',
    gateway_type: 'EdgeGateway',
    ip_address: '',
    plant_id: null,
  };

  // Filtered views
  readonly filteredMachines = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.machines().filter((m) => {
      const matchesSearch =
        !term ||
        m.name.toLowerCase().includes(term) ||
        m.machine_code.toLowerCase().includes(term) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(term)) ||
        (m.manufacturer && m.manufacturer.toLowerCase().includes(term));

      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && m.is_active) ||
        (filter === 'inactive' && !m.is_active);

      return matchesSearch && matchesStatus;
    });
  });

  readonly filteredMeters = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.meters().filter((m) => {
      const matchesSearch =
        !term ||
        m.name.toLowerCase().includes(term) ||
        m.meter_code.toLowerCase().includes(term) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(term));

      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && m.is_active) ||
        (filter === 'inactive' && !m.is_active);

      return matchesSearch && matchesStatus;
    });
  });

  readonly filteredGateways = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.gateways().filter((g) => {
      const matchesSearch =
        !term ||
        g.name.toLowerCase().includes(term) ||
        g.gateway_code.toLowerCase().includes(term) ||
        (g.ip_address && g.ip_address.toLowerCase().includes(term));

      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && g.is_active) ||
        (filter === 'inactive' && !g.is_active);

      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.loadLookups();
    this.loadCurrentTab();
  }

  loadLookups(): void {
    forkJoin({
      plants: this.locationsApi.listAllPlants().pipe(catchError(() => of([] as Plant[]))),
      areas: this.locationsApi.listAllAreas().pipe(catchError(() => of([] as Area[]))),
    }).subscribe(({ plants, areas }) => {
      this.plants.set(plants);
      this.areas.set(areas);
    });
  }

  setTab(tab: AssetTab): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.loadCurrentTab();
  }

  loadCurrentTab(): void {
    this.loading.set(true);
    this.error.set(null);

    switch (this.activeTab()) {
      case 'machines':
        this.machinesApi.listAll().subscribe({
          next: (items) => {
            this.machines.set(items);
            this.machinesTotal.set(items.length);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load machines.');
            this.loading.set(false);
          },
        });
        break;

      case 'meters':
        this.metersApi.listAll().subscribe({
          next: (items) => {
            this.meters.set(items);
            this.metersTotal.set(items.length);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load energy meters.');
            this.loading.set(false);
          },
        });
        break;

      case 'gateways':
        this.gatewaysApi.listAll().subscribe({
          next: (items) => {
            this.gateways.set(items);
            this.gatewaysTotal.set(items.length);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.message || 'Failed to load gateways.');
            this.loading.set(false);
          },
        });
        break;
    }
  }

  getPlantName(plantId: number): string {
    const plant = this.plants().find((p) => p.id === plantId);
    return plant ? plant.name : `Plant #${plantId}`;
  }

  availableAreasForPlant(plantId: number | null): Area[] {
    if (!plantId) return [];
    return this.areas().filter((a) => a.plant_id === plantId);
  }

  // Machine actions
  openCreateMachineModal(): void {
    this.machineForm = {
      name: '',
      machine_code: '',
      machine_type: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      plant_id: this.plants()[0]?.id ?? null,
      area_id: null,
    };
    this.machineModalOpen.set(true);
  }

  saveMachine(): void {
    if (!this.machineForm.name.trim() || !this.machineForm.machine_code.trim() || !this.machineForm.plant_id) {
      return;
    }
    this.saving.set(true);

    const payload: MachineCreate = {
      name: this.machineForm.name.trim(),
      machine_code: this.machineForm.machine_code.trim(),
      machine_type: this.machineForm.machine_type.trim() || undefined,
      manufacturer: this.machineForm.manufacturer.trim() || undefined,
      model: this.machineForm.model.trim() || undefined,
      serial_number: this.machineForm.serial_number.trim() || undefined,
      plant_id: this.machineForm.plant_id,
      area_id: this.machineForm.area_id || undefined,
    };

    this.machinesApi.create(payload).subscribe({
      next: (created) => {
        this.machines.update((list) => [created, ...list]);
        this.machinesTotal.update((n) => n + 1);
        this.machineModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Machine "${created.name}" created successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create machine.');
      },
    });
  }

  deactivateMachine(id: number, name: string): void {
    if (!confirm(`Are you sure you want to deactivate machine "${name}"?`)) return;

    this.machinesApi.deactivate(id).subscribe({
      next: (updated) => {
        this.machines.update((list) => list.map((m) => (m.id === id ? updated : m)));
        this.toast.success(`Machine "${name}" has been deactivated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to deactivate machine.');
      },
    });
  }

  // Meter actions
  openCreateMeterModal(): void {
    this.meterForm = {
      name: '',
      meter_code: '',
      meter_type: 'Energy',
      unit: 'kWh',
      manufacturer: '',
      model: '',
      serial_number: '',
      plant_id: this.plants()[0]?.id ?? null,
    };
    this.meterModalOpen.set(true);
  }

  saveMeter(): void {
    if (!this.meterForm.name.trim() || !this.meterForm.meter_code.trim() || !this.meterForm.plant_id) {
      return;
    }
    this.saving.set(true);

    const payload: MeterCreate = {
      name: this.meterForm.name.trim(),
      meter_code: this.meterForm.meter_code.trim(),
      meter_type: this.meterForm.meter_type.trim() || undefined,
      unit: this.meterForm.unit.trim() || 'kWh',
      manufacturer: this.meterForm.manufacturer.trim() || undefined,
      model: this.meterForm.model.trim() || undefined,
      serial_number: this.meterForm.serial_number.trim() || undefined,
      plant_id: this.meterForm.plant_id,
    };

    this.metersApi.create(payload).subscribe({
      next: (created) => {
        this.meters.update((list) => [created, ...list]);
        this.metersTotal.update((n) => n + 1);
        this.meterModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Meter "${created.name}" created successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create meter.');
      },
    });
  }

  toggleMeterStatus(meter: Meter): void {
    const newStatus = !meter.is_active;
    this.metersApi.update(meter.id, { is_active: newStatus }).subscribe({
      next: (updated) => {
        this.meters.update((list) => list.map((m) => (m.id === meter.id ? updated : m)));
        this.toast.success(`Meter "${meter.name}" status updated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to update meter status.');
      },
    });
  }

  deactivateMeter(id: number, name: string): void {
    if (!confirm(`Are you sure you want to deactivate meter "${name}"?`)) return;

    this.metersApi.deactivate(id).subscribe({
      next: (updated) => {
        this.meters.update((list) => list.map((m) => (m.id === id ? updated : m)));
        this.toast.success(`Meter "${name}" has been deactivated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to deactivate meter.');
      },
    });
  }

  // Gateway actions
  openCreateGatewayModal(): void {
    this.gatewayForm = {
      name: '',
      gateway_code: '',
      gateway_type: 'EdgeGateway',
      ip_address: '',
      plant_id: this.plants()[0]?.id ?? null,
    };
    this.gatewayModalOpen.set(true);
  }

  saveGateway(): void {
    if (!this.gatewayForm.name.trim() || !this.gatewayForm.gateway_code.trim() || !this.gatewayForm.plant_id) {
      return;
    }
    this.saving.set(true);

    const payload: GatewayCreate = {
      name: this.gatewayForm.name.trim(),
      gateway_code: this.gatewayForm.gateway_code.trim(),
      gateway_type: this.gatewayForm.gateway_type.trim(),
      ip_address: this.gatewayForm.ip_address.trim() || undefined,
      plant_id: this.gatewayForm.plant_id,
    };

    this.gatewaysApi.create(payload).subscribe({
      next: (created) => {
        this.gateways.update((list) => [created, ...list]);
        this.gatewaysTotal.update((n) => n + 1);
        this.gatewayModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Gateway "${created.name}" created successfully.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create gateway.');
      },
    });
  }

  deactivateGateway(id: number, name: string): void {
    if (!confirm(`Are you sure you want to deactivate gateway "${name}"?`)) return;

    this.gatewaysApi.deactivate(id).subscribe({
      next: (updated) => {
        this.gateways.update((list) => list.map((g) => (g.id === id ? updated : g)));
        this.toast.success(`Gateway "${name}" has been deactivated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to deactivate gateway.');
      },
    });
  }

  machineStatusTone(status: string): StatusTone {
    switch (status) {
      case 'RUNNING':
        return 'running';
      case 'IDLE':
      case 'MAINTENANCE':
        return 'warning';
      case 'FAULT':
        return 'fault';
      default:
        return 'stopped';
    }
  }

}
