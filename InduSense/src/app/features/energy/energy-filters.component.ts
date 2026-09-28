import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { CompaniesApi } from '../../core/api/resources/admin.api';
import { LocationsApi } from '../../core/api/resources/locations.api';
import { MetersApi } from '../../core/api/resources/plant-assets.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { Area, Company, EnergyFilters, Meter, Plant } from '../../core/models';
import { RANGE_OPTIONS, RangePreset, customRangeError, toLocalInput } from './energy-range';

export interface EnergyFilterState {
  scope: EnergyFilters;
  preset: RangePreset;
  custom: { from?: string; to?: string };
}

/**
 * Scope and time filters of the energy pages. Lists come from the existing plants/areas/meters
 * endpoints (already limited to the caller's company and plants); the company picker only appears
 * for platform administrators.
 */
@Component({
  selector: 'app-energy-filters',
  imports: [FormsModule],
  template: `
    <div class="filters" role="group" aria-label="Energy filters">
      @if (platformAdmin()) {
        <label class="field">
          <span class="field__label">Company</span>
          <select
            class="field__control"
            [ngModel]="companyId()"
            (ngModelChange)="setCompany($event)"
          >
            <option [ngValue]="null">All companies</option>
            @for (c of companies(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
      }
      <label class="field">
        <span class="field__label">Plant</span>
        <select class="field__control" [ngModel]="plantId()" (ngModelChange)="setPlant($event)">
          <option [ngValue]="null">All plants</option>
          @for (p of visiblePlants(); track p.id) {
            <option [ngValue]="p.id">{{ p.name }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span class="field__label">Area</span>
        <select
          class="field__control"
          [ngModel]="areaId()"
          (ngModelChange)="setArea($event)"
          [disabled]="!plantId()"
        >
          <option [ngValue]="null">All areas</option>
          @for (a of areas(); track a.id) {
            <option [ngValue]="a.id">{{ a.name }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span class="field__label">Meter</span>
        <select class="field__control" [ngModel]="meterId()" (ngModelChange)="setMeter($event)">
          <option [ngValue]="null">All meters</option>
          @for (m of visibleMeters(); track m.id) {
            <option [ngValue]="m.id">{{ m.name }}</option>
          }
        </select>
      </label>
      @if (showRange()) {
        <div class="field">
          <span class="field__label" id="energy-range-label">Period</span>
          <div class="segmented" role="radiogroup" aria-labelledby="energy-range-label">
            @for (o of rangeOptions; track o.value) {
              <button
                type="button"
                role="radio"
                class="segmented__item"
                [class.segmented__item--active]="preset() === o.value"
                [attr.aria-checked]="preset() === o.value"
                (click)="setPreset(o.value)"
              >
                {{ o.label }}
              </button>
            }
          </div>
        </div>
        @if (preset() === 'custom') {
          <label class="field">
            <span class="field__label">From</span>
            <input
              class="field__control"
              type="datetime-local"
              [ngModel]="customFrom()"
              (ngModelChange)="customFrom.set($event)"
            />
          </label>
          <label class="field">
            <span class="field__label">To</span>
            <input
              class="field__control"
              type="datetime-local"
              [ngModel]="customTo()"
              (ngModelChange)="customTo.set($event)"
            />
          </label>
          <div class="field field--action">
            <button type="button" class="apply" [disabled]="!!customError()" (click)="emit()">
              Apply
            </button>
          </div>
          @if (customError(); as message) {
            <p class="filters__error" role="alert">{{ message }}</p>
          }
        }
      }
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-3);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 150px;
    }
    .field--action {
      min-width: 0;
    }
    .field__label {
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .field__control {
      height: 34px;
      padding: 0 10px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--fs-sm);
      color-scheme: inherit;
    }
    .field__control:focus-visible,
    .segmented__item:focus-visible,
    .apply:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
    .field__control:disabled {
      opacity: 0.5;
    }
    .segmented {
      display: inline-flex;
      flex-wrap: wrap;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .segmented__item {
      height: 32px;
      padding: 0 12px;
      border: 0;
      border-right: 1px solid var(--border-light);
      background: var(--bg-topbar);
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      cursor: pointer;
    }
    .segmented__item:last-child {
      border-right: 0;
    }
    .segmented__item--active {
      background: var(--accent-cyan-soft);
      color: var(--accent-cyan);
      font-weight: var(--fw-semibold);
    }
    .apply {
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--accent-cyan);
      border-radius: var(--radius-sm);
      background: var(--accent-cyan-soft);
      color: var(--accent-cyan);
      font-weight: var(--fw-semibold);
      cursor: pointer;
    }
    .apply:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .filters__error {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--status-fault-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnergyFiltersComponent implements OnInit {
  /** Initial period. */
  readonly initialPreset = input<RangePreset>('today');
  readonly showRange = input(true);
  readonly changed = output<EnergyFilterState>();

  private readonly locations = inject(LocationsApi);
  private readonly metersApi = inject(MetersApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rangeOptions = RANGE_OPTIONS;
  protected readonly platformAdmin = computed(
    () => this.auth.hasPermission(Permission.TenantAll) && this.auth.user()?.company_id == null,
  );

  protected readonly companies = signal<Company[]>([]);
  protected readonly plants = signal<Plant[]>([]);
  protected readonly areas = signal<Area[]>([]);
  protected readonly meters = signal<Meter[]>([]);

  protected readonly companyId = signal<number | null>(null);
  protected readonly plantId = signal<number | null>(null);
  protected readonly areaId = signal<number | null>(null);
  protected readonly meterId = signal<number | null>(null);
  protected readonly preset = signal<RangePreset>('today');
  protected readonly customFrom = signal(toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)));
  protected readonly customTo = signal(toLocalInput(new Date()));
  protected readonly customError = computed(() =>
    customRangeError({ from: this.customFrom(), to: this.customTo() }),
  );

  protected readonly visiblePlants = computed(() => {
    const company = this.companyId();
    return company ? this.plants().filter((p) => p.company_id === company) : this.plants();
  });
  protected readonly visibleMeters = computed(() => {
    const [company, plant, area] = [this.companyId(), this.plantId(), this.areaId()];
    return this.meters().filter(
      (m) =>
        (!company || m.company_id === company) &&
        (!plant || m.plant_id === plant) &&
        (!area || m.area_id === area),
    );
  });

  ngOnInit(): void {
    this.preset.set(this.initialPreset());
    const keep = <T>(target: (items: T[]) => void) => ({
      next: target,
      error: () => target([]), // a list the user may not read just stays empty
    });
    if (this.platformAdmin()) {
      this.companiesApi
        .listAll()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(keep((c) => this.companies.set(c)));
    }
    this.locations
      .listAllPlants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(keep((p) => this.plants.set(p)));
    this.metersApi
      .listAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(keep((m) => this.meters.set(m)));
    this.emit();
  }

  protected setCompany(id: number | null): void {
    this.companyId.set(id);
    this.plantId.set(null);
    this.areaId.set(null);
    this.meterId.set(null);
    this.areas.set([]);
    this.emit();
  }

  protected setPlant(id: number | null): void {
    this.plantId.set(id);
    this.areaId.set(null);
    this.meterId.set(null);
    this.areas.set([]);
    (id ? this.locations.listAllAreas({ plant_id: id }) : of([] as Area[]))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (a) => this.areas.set(a), error: () => this.areas.set([]) });
    this.emit();
  }

  protected setArea(id: number | null): void {
    this.areaId.set(id);
    this.meterId.set(null);
    this.emit();
  }

  protected setMeter(id: number | null): void {
    this.meterId.set(id);
    this.emit();
  }

  protected setPreset(preset: RangePreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') {
      this.emit();
    }
  }

  protected emit(): void {
    const scope: EnergyFilters = {};
    if (this.companyId()) scope.company_id = this.companyId()!;
    if (this.plantId()) scope.plant_id = this.plantId()!;
    if (this.areaId()) scope.area_id = this.areaId()!;
    if (this.meterId()) scope.meter_id = this.meterId()!;
    this.changed.emit({
      scope,
      preset: this.preset(),
      custom: { from: this.customFrom(), to: this.customTo() },
    });
  }
}
