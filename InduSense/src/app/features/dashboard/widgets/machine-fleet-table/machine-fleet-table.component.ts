import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import {
  ButtonComponent,
  IconComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../../../shared/ui';
import { formatDateTime } from '../../../../shared/utils/format';
import { statusLabel, statusTone } from '../../../../shared/utils/status-colors';
import { FleetPageVm } from '../../models/dashboard.vm';
import {
  WidgetCardComponent,
  WidgetContentDirective,
  WidgetSkeletonDirective,
} from '../widget-card/widget-card.component';
import {
  ALL_FLEET_COLUMNS,
  CONNECTION_LABEL,
  FLEET_COLUMNS,
  FleetColumnKey,
  FleetSort,
  connectionTone,
  isSortable,
  nextSort,
  sortRows,
  totalPages,
} from './fleet-table';

/**
 * Machine fleet table (W6 "OEE"): status pills, update times, connection, location, gateway.
 * Server-side paging (emits `pageChange`); Name and Status sort the current page.
 */
@Component({
  selector: 'app-machine-fleet-table',
  imports: [
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    StatusPillComponent,
    WidgetCardComponent,
    WidgetContentDirective,
    WidgetSkeletonDirective,
  ],
  templateUrl: './machine-fleet-table.component.html',
  styleUrl: './machine-fleet-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineFleetTableComponent {
  readonly heading = input.required<string>();
  readonly fleet = input<FleetPageVm | null>(null);
  /** Visible columns, in display order. */
  readonly columns = input<readonly FleetColumnKey[]>(ALL_FLEET_COLUMNS);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);

  readonly pageChange = output<number>();
  readonly retry = output<void>();

  protected readonly sort = signal<FleetSort | null>(null);

  protected readonly visibleColumns = computed(() => {
    const wanted = this.columns();
    return wanted
      .map((key) => FLEET_COLUMNS.find((c) => c.key === key))
      .filter((c) => c !== undefined);
  });
  protected readonly rows = computed(() => sortRows(this.fleet()?.rows ?? [], this.sort()));
  protected readonly hasData = computed(() => (this.fleet()?.rows.length ?? 0) > 0);
  protected readonly page = computed(() => this.fleet()?.page ?? 1);
  protected readonly pageCount = computed(() =>
    totalPages(this.fleet()?.total ?? 0, this.fleet()?.pageSize ?? 1),
  );
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly statusLabel = statusLabel;
  protected readonly statusTone = statusTone;
  protected readonly connectionLabel = CONNECTION_LABEL;
  protected readonly connectionTone = connectionTone;
  protected readonly formatDateTime = formatDateTime;

  protected toggleSort(column: FleetColumnKey): void {
    if (isSortable(column)) {
      this.sort.update((current) => nextSort(current, column));
    }
  }

  protected ariaSort(column: FleetColumnKey): 'ascending' | 'descending' | 'none' | null {
    const sortable = FLEET_COLUMNS.find((c) => c.key === column)?.sortable;
    if (!sortable) {
      return null;
    }
    const sort = this.sort();
    if (sort?.column !== column) {
      return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected goTo(page: number): void {
    if (page >= 1 && page <= this.pageCount() && page !== this.page() && !this.loading()) {
      this.pageChange.emit(page);
    }
  }
}
