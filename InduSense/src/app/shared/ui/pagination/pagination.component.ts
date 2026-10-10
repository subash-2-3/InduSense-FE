import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',
  imports: [FormsModule, ButtonComponent, IconComponent],
  template: `
    <div class="pagination">
      <div class="pagination__info">
        @if (total() > 0) {
          <span>Showing <strong>{{ startItem() }}</strong>–<strong>{{ endItem() }}</strong> of <strong>{{ total() }}</strong></span>
        } @else {
          <span>0 items</span>
        }
      </div>

      <div class="pagination__controls">
        @if (pageSizeOptions().length > 1) {
          <div class="pagination__size">
            <label for="page-size-select" class="pagination__size-label">Rows per page:</label>
            <select
              id="page-size-select"
              class="pagination__size-select"
              [ngModel]="pageSize()"
              (ngModelChange)="onSizeChange($event)"
            >
              @for (opt of pageSizeOptions(); track opt) {
                <option [value]="opt">{{ opt }}</option>
              }
            </select>
          </div>
        }

        <div class="pagination__pager">
          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="page() <= 1"
            title="First page"
            aria-label="First page"
            (click)="goToPage(1)"
          >
            <app-icon name="chevron-left" [size]="14" />
            <app-icon name="chevron-left" [size]="14" class="stacked-icon" />
          </button>

          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="page() <= 1"
            title="Previous page"
            aria-label="Previous page"
            (click)="goToPage(page() - 1)"
          >
            <app-icon name="chevron-left" [size]="14" />
            <span>Prev</span>
          </button>

          <span class="pagination__page-indicator">
            Page <strong>{{ page() }}</strong> of <strong>{{ totalPages() }}</strong>
          </span>

          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="page() >= totalPages()"
            title="Next page"
            aria-label="Next page"
            (click)="goToPage(page() + 1)"
          >
            <span>Next</span>
            <app-icon name="chevron-right" [size]="14" />
          </button>

          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="page() >= totalPages()"
            title="Last page"
            aria-label="Last page"
            (click)="goToPage(totalPages())"
          >
            <app-icon name="chevron-right" [size]="14" />
            <app-icon name="chevron-right" [size]="14" class="stacked-icon" />
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .pagination__info {
      white-space: nowrap;
      color: var(--text-secondary);
      strong {
        color: var(--text-primary);
      }
    }

    .pagination__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
    }

    .pagination__size {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      white-space: nowrap;
    }

    .pagination__size-label {
      color: var(--text-muted);
      font-size: var(--text-xs);
    }

    .pagination__size-select {
      height: 28px;
      padding: 2px 8px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-xs);
      cursor: pointer;
      &:focus-visible {
        outline: 2px solid var(--accent-cyan);
      }
    }

    .pagination__pager {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .pagination__page-indicator {
      padding: 0 var(--space-2);
      white-space: nowrap;
      strong {
        color: var(--text-primary);
      }
    }

    .stacked-icon {
      margin-left: -8px;
    }

    @media (max-width: 640px) {
      .pagination {
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
      }
      .pagination__controls {
        flex-direction: column;
        gap: var(--space-2);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly total = input(0);
  readonly pageSizeOptions = input<readonly number[]>([10, 20, 50, 100]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))),
  );

  protected readonly startItem = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });

  protected readonly endItem = computed(() =>
    Math.min(this.total(), this.page() * this.pageSize()),
  );

  protected goToPage(p: number): void {
    const validPage = Math.max(1, Math.min(this.totalPages(), p));
    if (validPage !== this.page()) {
      this.pageChange.emit(validPage);
    }
  }

  protected onSizeChange(size: number | string): void {
    const nextSize = Number(size);
    if (!isNaN(nextSize) && nextSize > 0) {
      this.pageSizeChange.emit(nextSize);
    }
  }
}
