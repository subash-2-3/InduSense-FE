import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ReportsApi } from '../../core/api/resources/reports.api';
import { DeviceHealthResponse, EnergyReportFilters, ReportResponse } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  ErrorStateComponent,
  IconComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';

type ReportTab = 'energy' | 'production' | 'device-health';

@Component({
  selector: 'app-reports-page',
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    IconComponent,
    StatusPillComponent,
    SkeletonComponent,
    ErrorStateComponent,
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

      <app-card [padded]="false">
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

                <div class="table-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Asset / Group</th>
                        <th>Type</th>
                        <th>Energy Consumed</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of energyData()?.data?.rows || []; track $index) {
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

                <div class="table-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Machine</th>
                        <th>Parts Produced</th>
                        <th>Runtime (Hours)</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of productionData()?.data?.rows || []; track $index) {
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

                <div class="table-container">
                  <table class="reports-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Device Name / ID</th>
                        <th>Gateway</th>
                        <th>Protocols</th>
                        <th>Data Freshness</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of healthData()?.data?.rows || []; track row.device_id) {
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
      max-width: 1400px;
      margin: 0 auto;
    }

    .reports-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
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
      overflow-x: auto;
    }

    .reports-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
      text-align: left;
    }

    .reports-table th {
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
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

  ngOnInit(): void {
    this.loadReport();
  }

  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.error.set(null);

    switch (this.activeTab()) {
      case 'energy':
        this.reportsApi.energy({ page: 1, page_size: 25 }).subscribe({
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
        this.reportsApi.production({ page: 1, page_size: 25 }).subscribe({
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
        this.reportsApi.deviceHealth({ page: 1, page_size: 25 }).subscribe({
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
