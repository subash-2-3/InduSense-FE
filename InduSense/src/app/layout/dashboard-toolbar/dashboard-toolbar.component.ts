import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FullscreenService } from '../../core/browser/fullscreen.service';
import { ButtonComponent, DropdownMenuComponent, IconComponent, MenuItem } from '../../shared/ui';
import { formatRelativeTime } from '../../shared/utils/format';
import { injectNow } from '../../shared/utils/now';

export interface DashboardOption {
  id: string;
  name: string;
  path?: string;
}

export const DEFAULT_DASHBOARDS: readonly DashboardOption[] = [
  { id: 'device-summary', name: 'Device Summary Dashboard', path: '/dashboard' },
  { id: 'energy', name: 'Energy Monitoring SCADA', path: '/energy' },
  { id: 'oee', name: 'OEE & Machine Fleet', path: '/energy' },
  { id: 'alarms', name: 'Alarms Intelligence', path: '/alarms' },
  { id: 'reports', name: 'Reports & Analytics', path: '/reports' },
];

/**
 * Dashboard bar: dashboard switcher, refresh with "updated … ago", help, fullscreen, actions
 * and Add Dashboard.
 */
@Component({
  selector: 'app-dashboard-toolbar',
  imports: [ButtonComponent, DropdownMenuComponent, IconComponent, RouterLink],
  templateUrl: './dashboard-toolbar.component.html',
  styleUrl: './dashboard-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardToolbarComponent {
  readonly dashboards = input<readonly DashboardOption[]>(DEFAULT_DASHBOARDS);
  readonly activeId = input.required<string>();
  readonly refreshing = input(false, { transform: booleanAttribute });
  readonly lastUpdated = input<Date | number | string | null>(null);

  readonly refresh = output<void>();
  readonly dashboardChange = output<string>();

  protected readonly fullscreen = inject(FullscreenService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly now = injectNow(1000);

  protected readonly activeName = computed(
    () => this.dashboards().find((d) => d.id === this.activeId())?.name ?? 'Dashboard',
  );

  protected readonly switcherItems = computed<MenuItem[]>(() =>
    this.dashboards().map((d) => ({
      id: d.id,
      label: d.name,
      checked: d.id === this.activeId(),
    })),
  );

  protected readonly updatedText = computed(() => {
    const updated = this.lastUpdated();
    return updated === null
      ? 'Not updated yet'
      : `Updated ${formatRelativeTime(updated, this.now())}`;
  });

  protected readonly actionItems: MenuItem[] = [
    { id: 'export-pdf', label: 'Export PDF', icon: 'download' },
    { id: 'edit-layout', label: 'Edit Layout', icon: 'edit', disabled: true, hint: 'Soon' },
  ];

  protected onDashboardSelect(id: string): void {
    if (id !== this.activeId()) {
      this.dashboardChange.emit(id);
      const target = this.dashboards().find((d) => d.id === id);
      if (target?.path) {
        if (id === 'oee') {
          void this.router.navigate([target.path], { queryParams: { view: 'oee' } });
        } else {
          void this.router.navigate([target.path]);
        }
      }
    }
  }

  protected onRefresh(): void {
    if (!this.refreshing()) {
      this.refresh.emit();
    }
  }

  protected onAction(id: string): void {
    if (id === 'export-pdf') {
      this.document.defaultView?.print();
    }
  }
}
