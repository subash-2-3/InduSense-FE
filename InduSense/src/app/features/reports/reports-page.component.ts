import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ReportsApi } from '../../core/api/resources/reports.api';
import { DeviceHealthResponse, EnergyReportFilters, ReportResponse } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  ErrorStateComponent,
  IconComponent,
  PaginationComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { SortDirection, sortData, toggleSort } from '../../shared/utils/sort';

type ReportTab = 'energy' | 'production' | 'device-health';

@Component({
  selector: 'app-reports-page',
  imports: [
    CommonModule,
    DecimalPipe,
    CardComponent,
    ButtonComponent,
    IconComponent,
    StatusPillComponent,
    SkeletonComponent,
    ErrorStateComponent,
    PaginationComponent,
  ],
  template: `
    <div class="reports-page">
      <header class="reports-header">
        <div class="reports-header__titles">
          <h1 class="reports-header__title">Industrial Reports & Analytics</h1>
          <p class="reports-header__subtitle">Periodic energy audits, production counts, and fleet diagnostics</p>
        </div>
        <div class="reports-header__actions">
          <button appButton variant="secondary" (click)="loadReport()">
            <app-icon name="refresh" [size]="14" [class.spinning]="loading()" />
            Run Report
          </button>
        </div>
      </header>

      <div class="tabs-bar">
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'energy'"
          (click)="setTab('energy')"
        >
          <app-icon name="zap" [size]="16" />
          Energy Consumption
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'production'"
          (click)="setTab('production')"
        >
          <app-icon name="settings" [size]="16" />
          Production Output
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'device-health'"
          (click)="setTab('device-health')"
        >
          <app-icon name="router" [size]="16" />
          Device & Logger Health
        </button>
      </div>

      <app-card heading="Telemetry & Industrial Reports" [padded]="false" expandable="true">
        @if (loading()) {
          <div class="reports-skeleton">
            <app-skeleton height="80px" />
            <app-skeleton height="48px" />
            <app-skeleton height="48px" />
          </div>
        } @else if (error()) {
          <div class="reports-state">
            <app-error-state
              heading="Failed to generate report"
              [message]="error()!"
              (retry)="loadReport()"
            />
          </div>
        } @else {
          @switch (activeTab()) {
            @case ('energy') {
              <div class="report-content">
                @if (energyData()?.data?.summary; as s) {
                  <div class="kpi-strip">
                    <div class="kpi-box">
                      <span class="kpi-box__label">Total Energy</span>
                      <span class="kpi-box__val">{{ s.total?.total ?? 0 }} {{ s.total?.unit || 'kWh' }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Assets Monitored</span>
                      <span class="kpi-box__val">{{ s.assets }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Missing Energy Tags</span>
                      <span class="kpi-box__val">{{ s.assets_without_energy_tag }}</span>
                    </div>
                  </div>
                }

                <div class="table-container table-sticky-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th class="th-sortable" (click)="toggleEnergySort('date')" tabindex="0" (keydown.enter)="toggleEnergySort('date')">
                          <span class="th-sort-content">
                            Date
                            <app-icon
                              [name]="energySortKey() === 'date' ? (energySortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="energySortKey() === 'date'"
                              [class.sort-icon-muted]="energySortKey() !== 'date'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleEnergySort('group_name')" tabindex="0" (keydown.enter)="toggleEnergySort('group_name')">
                          <span class="th-sort-content">
                            Asset / Group
                            <app-icon
                              [name]="energySortKey() === 'group_name' ? (energySortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="energySortKey() === 'group_name'"
                              [class.sort-icon-muted]="energySortKey() !== 'group_name'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleEnergySort('group_type')" tabindex="0" (keydown.enter)="toggleEnergySort('group_type')">
                          <span class="th-sort-content">
                            Type
                            <app-icon
                              [name]="energySortKey() === 'group_type' ? (energySortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="energySortKey() === 'group_type'"
                              [class.sort-icon-muted]="energySortKey() !== 'group_type'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleEnergySort('energy')" tabindex="0" (keydown.enter)="toggleEnergySort('energy')">
                          <span class="th-sort-content">
                            Energy Consumed
                            <app-icon
                              [name]="energySortKey() === 'energy' ? (energySortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="energySortKey() === 'energy'"
                              [class.sort-icon-muted]="energySortKey() !== 'energy'"
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of sortedEnergyRows(); track $index) {
                        <tr>
                          <td>{{ row.date }}</td>
                          <td>{{ row.group_name }}</td>
                          <td><span class="badge">{{ row.group_type }}</span></td>
                          <td class="cell-val">{{ row.energy }} {{ row.unit || 'kWh' }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="4" class="text-center">No energy records for the selected period.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="table-pagination">
                  <app-pagination
                    [page]="energyPage()"
                    [pageSize]="energyPageSize()"
                    [total]="energyData()?.pagination?.total ?? (energyData()?.data?.rows?.length || 0)"
                    (pageChange)="onEnergyPageChange($event)"
                    (pageSizeChange)="onEnergyPageSizeChange($event)"
                  />
                </div>
              </div>
            }

            @case ('production') {
              <div class="report-content">
                @if (productionData()?.data?.summary; as s) {
                  <div class="kpi-strip">
                    <div class="kpi-box">
                      <span class="kpi-box__label">Total Production</span>
                      <span class="kpi-box__val">{{ s.total_production ?? 0 }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Machines Monitored</span>
                      <span class="kpi-box__val">{{ s.machines }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Without Counters</span>
                      <span class="kpi-box__val">{{ s.machines_without_counter }}</span>
                    </div>
                  </div>
                }

                <div class="table-container table-sticky-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th class="th-sortable" (click)="toggleProductionSort('date')" tabindex="0" (keydown.enter)="toggleProductionSort('date')">
                          <span class="th-sort-content">
                            Date
                            <app-icon
                              [name]="productionSortKey() === 'date' ? (productionSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="productionSortKey() === 'date'"
                              [class.sort-icon-muted]="productionSortKey() !== 'date'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleProductionSort('machine_name')" tabindex="0" (keydown.enter)="toggleProductionSort('machine_name')">
                          <span class="th-sort-content">
                            Machine
                            <app-icon
                              [name]="productionSortKey() === 'machine_name' ? (productionSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="productionSortKey() === 'machine_name'"
                              [class.sort-icon-muted]="productionSortKey() !== 'machine_name'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleProductionSort('production')" tabindex="0" (keydown.enter)="toggleProductionSort('production')">
                          <span class="th-sort-content">
                            Parts Produced
                            <app-icon
                              [name]="productionSortKey() === 'production' ? (productionSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="productionSortKey() === 'production'"
                              [class.sort-icon-muted]="productionSortKey() !== 'production'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleProductionSort('runtime_seconds')" tabindex="0" (keydown.enter)="toggleProductionSort('runtime_seconds')">
                          <span class="th-sort-content">
                            Runtime (Hours)
                            <app-icon
                              [name]="productionSortKey() === 'runtime_seconds' ? (productionSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="productionSortKey() === 'runtime_seconds'"
                              [class.sort-icon-muted]="productionSortKey() !== 'runtime_seconds'"
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of sortedProductionRows(); track $index) {
                        <tr>
                          <td>{{ row.date }}</td>
                          <td>{{ row.machine_name }}</td>
                          <td class="cell-val">{{ row.production }} {{ row.unit || '' }}</td>
                          <td>{{ row.runtime_seconds ? (row.runtime_seconds / 3600 | number: '1.1-1') : '—' }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="4" class="text-center">No production records for the selected period.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="table-pagination">
                  <app-pagination
                    [page]="productionPage()"
                    [pageSize]="productionPageSize()"
                    [total]="productionData()?.pagination?.total ?? (productionData()?.data?.rows?.length || 0)"
                    (pageChange)="onProductionPageChange($event)"
                    (pageSizeChange)="onProductionPageSizeChange($event)"
                  />
                </div>
              </div>
            }

            @case ('device-health') {
              <div class="report-content">
                @if (healthData()?.data?.summary; as s) {
                  <div class="kpi-strip">
                    <div class="kpi-box">
                      <span class="kpi-box__label">Online Devices</span>
                      <span class="kpi-box__val text-green">{{ s.online }} / {{ s.devices }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Offline Devices</span>
                      <span class="kpi-box__val text-amber">{{ s.offline }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">Stale Data</span>
                      <span class="kpi-box__val text-red">{{ s.stale_data }}</span>
                    </div>
                    <div class="kpi-box">
                      <span class="kpi-box__label">DataLoggers</span>
                      <span class="kpi-box__val">{{ s.loggers.healthy }} Healthy</span>
                    </div>
                  </div>
                }

                <div class="table-container table-sticky-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th class="th-sortable" (click)="toggleHealthSort('connection_state')" tabindex="0" (keydown.enter)="toggleHealthSort('connection_state')">
                          <span class="th-sort-content">
                            Status
                            <app-icon
                              [name]="healthSortKey() === 'connection_state' ? (healthSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="healthSortKey() === 'connection_state'"
                              [class.sort-icon-muted]="healthSortKey() !== 'connection_state'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleHealthSort('name')" tabindex="0" (keydown.enter)="toggleHealthSort('name')">
                          <span class="th-sort-content">
                            Device Name / ID
                            <app-icon
                              [name]="healthSortKey() === 'name' ? (healthSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="healthSortKey() === 'name'"
                              [class.sort-icon-muted]="healthSortKey() !== 'name'"
                            />
                          </span>
                        </th>
                        <th class="th-sortable" (click)="toggleHealthSort('gateway_name')" tabindex="0" (keydown.enter)="toggleHealthSort('gateway_name')">
                          <span class="th-sort-content">
                            Gateway
                            <app-icon
                              [name]="healthSortKey() === 'gateway_name' ? (healthSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="healthSortKey() === 'gateway_name'"
                              [class.sort-icon-muted]="healthSortKey() !== 'gateway_name'"
                            />
                          </span>
                        </th>
                        <th>Protocols</th>
                        <th class="th-sortable" (click)="toggleHealthSort('data_stale')" tabindex="0" (keydown.enter)="toggleHealthSort('data_stale')">
                          <span class="th-sort-content">
                            Data Freshness
                            <app-icon
                              [name]="healthSortKey() === 'data_stale' ? (healthSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                              [size]="13"
                              [class.sort-icon-active]="healthSortKey() === 'data_stale'"
                              [class.sort-icon-muted]="healthSortKey() !== 'data_stale'"
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of sortedHealthRows(); track row.device_id) {
                        <tr>
                          <td>
                            <app-status-pill
                              dot
                              [label]="row.connection_state"
                              [tone]="row.connection_state === 'ONLINE' ? 'running' : 'warning'"
                            />
                          </td>
                          <td>
                            <strong>{{ row.name || 'Device' }}</strong>
                            <div class="cell-mono">{{ row.external_id }}</div>
                          </td>
                          <td>{{ row.gateway_name || '—' }}</td>
                          <td>{{ row.protocols.join(', ') || '—' }}</td>
                          <td>
                            <span [class.text-red]="row.data_stale">
                              {{ row.data_stale ? 'Stale Data' : 'Live' }}
                            </span>
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="5" class="text-center">No devices reporting.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="table-pagination">
                  <app-pagination
                    [page]="healthPage()"
                    [pageSize]="healthPageSize()"
                    [total]="healthData()?.pagination?.total ?? (healthData()?.data?.rows?.length || 0)"
                    (pageChange)="onHealthPageChange($event)"
                    (pageSizeChange)="onHealthPageSizeChange($event)"
                  />
                </div>
              </div>
            }
          }
        }
      </app-card>
    </div>
  `,
  styles: `
    .reports-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      width: 100%;
      box-sizing: border-box;
    }

    .reports-header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--bg-app);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-2) 0;
    }

    .reports-header__title {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .reports-header__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .tabs-bar {
      position: sticky;
      top: 56px;
      z-index: 19;
      background: var(--bg-app);
      display: flex;
      gap: var(--space-2);
      border-bottom: 1px solid var(--border-light);
      padding: var(--space-2) 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
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
      white-space: nowrap;
      flex-shrink: 0;
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

    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      padding: 16px;
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
    }

    .kpi-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-box__label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-box__val {
      font-size: 20px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--text-primary);
    }

    .text-green { color: var(--status-running); }
    .text-amber { color: var(--status-warning); }
    .text-red { color: var(--status-fault); }

    .table-container {
      overflow: auto;
      max-height: calc(100vh - 310px);
      min-height: 240px;
    }

    .table-pagination {
      border-top: 1px solid var(--border-light);
    }

    .reports-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
      text-align: left;
    }

    .reports-table th {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-card);
      box-shadow: 0 1px 0 var(--border-light);
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
    }

    .reports-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }

    .cell-val {
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .cell-mono {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: var(--text-xs);
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      color: var(--accent-cyan);
    }

    .text-center {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
    }

    .reports-skeleton {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .reports-state {
      padding: 32px 16px;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 768px) {
      .reports-page {
        padding: var(--space-3);
        gap: var(--space-3);
      }
      .reports-header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .filter-group {
        width: 100%;
        justify-content: space-between;
      }
      .kpi-strip {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 12px;
      }
    }
    @media (max-width: 480px) {
      .kpi-strip {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  private readonly reportsApi = inject(ReportsApi);

  readonly activeTab = signal<ReportTab>('energy');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly energyData = signal<ReportResponse<any, any> | null>(null);
  readonly productionData = signal<ReportResponse<any, any> | null>(null);
  readonly healthData = signal<DeviceHealthResponse | null>(null);

  readonly energyPage = signal(1);
  readonly energyPageSize = signal(25);
  readonly energySortKey = signal<string | null>(null);
  readonly energySortDir = signal<SortDirection>('asc');

  readonly productionPage = signal(1);
  readonly productionPageSize = signal(25);
  readonly productionSortKey = signal<string | null>(null);
  readonly productionSortDir = signal<SortDirection>('asc');

  readonly healthPage = signal(1);
  readonly healthPageSize = signal(25);
  readonly healthSortKey = signal<string | null>(null);
  readonly healthSortDir = signal<SortDirection>('asc');

  readonly sortedEnergyRows = computed(() => {
    const rows = this.energyData()?.data?.rows || [];
    const key = this.energySortKey();
    if (!key) return rows;
    return sortData(rows, (r: any) => r[key], this.energySortDir());
  });

  readonly sortedProductionRows = computed(() => {
    const rows = this.productionData()?.data?.rows || [];
    const key = this.productionSortKey();
    if (!key) return rows;
    return sortData(rows, (r: any) => r[key], this.productionSortDir());
  });

  readonly sortedHealthRows = computed(() => {
    const rows = this.healthData()?.data?.rows || [];
    const key = this.healthSortKey();
    if (!key) return rows;
    return sortData(rows, (r: any) => r[key], this.healthSortDir());
  });

  ngOnInit(): void {
    this.loadReport();
  }

  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);
    this.loadReport();
  }

  toggleEnergySort(key: string): void {
    toggleSort(this.energySortKey, this.energySortDir, key);
  }

  toggleProductionSort(key: string): void {
    toggleSort(this.productionSortKey, this.productionSortDir, key);
  }

  toggleHealthSort(key: string): void {
    toggleSort(this.healthSortKey, this.healthSortDir, key);
  }

  onEnergyPageChange(page: number): void {
    this.energyPage.set(page);
    this.loadReport();
  }

  onEnergyPageSizeChange(size: number): void {
    this.energyPageSize.set(size);
    this.energyPage.set(1);
    this.loadReport();
  }

  onProductionPageChange(page: number): void {
    this.productionPage.set(page);
    this.loadReport();
  }

  onProductionPageSizeChange(size: number): void {
    this.productionPageSize.set(size);
    this.productionPage.set(1);
    this.loadReport();
  }

  onHealthPageChange(page: number): void {
    this.healthPage.set(page);
    this.loadReport();
  }

  onHealthPageSizeChange(size: number): void {
    this.healthPageSize.set(size);
    this.healthPage.set(1);
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.error.set(null);

    switch (this.activeTab()) {
      case 'energy':
        this.reportsApi
          .energy({ page: this.energyPage(), page_size: this.energyPageSize() })
          .subscribe({
            next: (res) => {
              this.energyData.set(res);
              this.loading.set(false);
            },
            error: (err) => {
              this.error.set(err?.message || 'Failed to load energy report.');
              this.loading.set(false);
            },
          });
        break;

      case 'production':
        this.reportsApi
          .production({ page: this.productionPage(), page_size: this.productionPageSize() })
          .subscribe({
            next: (res) => {
              this.productionData.set(res);
              this.loading.set(false);
            },
            error: (err) => {
              this.error.set(err?.message || 'Failed to load production report.');
              this.loading.set(false);
            },
          });
        break;

      case 'device-health':
        this.reportsApi
          .deviceHealth({ page: this.healthPage(), page_size: this.healthPageSize() })
          .subscribe({
            next: (res) => {
              this.healthData.set(res);
              this.loading.set(false);
            },
            error: (err) => {
              this.error.set(err?.message || 'Failed to load device health report.');
              this.loading.set(false);
            },
          });
        break;
    }
  }
}
