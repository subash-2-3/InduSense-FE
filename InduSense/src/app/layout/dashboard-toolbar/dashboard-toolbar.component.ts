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
import { RouterLink } from '@angular/router';

import { FullscreenService } from '../../core/browser/fullscreen.service';
import { ButtonComponent, DropdownMenuComponent, IconComponent, MenuItem } from '../../shared/ui';
import { formatRelativeTime } from '../../shared/utils/format';
import { injectNow } from '../../shared/utils/now';

export interface DashboardOption {
  id: string;
  name: string;
}

/**
 * Dashboard bar: dashboard switcher, refresh with "updated … ago", help, fullscreen, actions
 * and Add Dashboard. Presentational: refresh state comes from the page that hosts it.
 */
@Component({
  selector: 'app-dashboard-toolbar',
  imports: [ButtonComponent, DropdownMenuComponent, IconComponent, RouterLink],
  templateUrl: './dashboard-toolbar.component.html',
  styleUrl: './dashboard-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardToolbarComponent {
  readonly dashboards = input.required<readonly DashboardOption[]>();
  readonly activeId = input.required<string>();
  readonly refreshing = input(false, { transform: booleanAttribute });
  readonly lastUpdated = input<Date | number | null>(null);

  readonly refresh = output<void>();
  readonly dashboardChange = output<string>();

  protected readonly fullscreen = inject(FullscreenService);
  private readonly document = inject(DOCUMENT);
  private readonly now = injectNow(1000);

  protected readonly activeName = computed(
    () => this.dashboards().find((d) => d.id === this.activeId())?.name ?? 'Dashboard',
  );

  protected readonly switcherItems = computed<MenuItem[]>(() =>
    this.dashboards().map((d) => ({ id: d.id, label: d.name, checked: d.id === this.activeId() })),
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
