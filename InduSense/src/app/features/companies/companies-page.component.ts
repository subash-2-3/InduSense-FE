import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, concat, forkJoin, last, noop, of } from 'rxjs';

import { CompaniesApi } from '../../core/api/resources/admin.api';
import {
  Company,
  CompanyLimitUsage,
  CompanyUpdate,
  LIMITED_RESOURCES,
  LimitedResource,
  Module,
  RecordStatus,
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
import { formatDateTime } from '../../shared/utils/format';
import {
  VISIBLE_STATUSES,
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';

type StatusView = 'visible' | RecordStatus;

/** One editable company: its fields, limits (blank = unlimited) and enabled modules. */
interface CompanyForm {
  code: string;
  name: string;
  address: string;
  timezone: string;
  limits: Record<LimitedResource, string>;
  modules: Set<string>;
}

const RESOURCE_LABEL: Readonly<Record<LimitedResource, string>> = {
  plants: 'Plants',
  areas: 'Areas',
  machines: 'Machines',
  meters: 'Meters',
  gateways: 'Gateways',
  devices: 'Devices',
  users: 'Users',
};

function emptyLimits(): Record<LimitedResource, string> {
  return Object.fromEntries(LIMITED_RESOURCES.map((r) => [r, ''])) as Record<
    LimitedResource,
    string
  >;
}

/** Blank = unlimited (null); anything else must be a whole number >= 0. */
function parseLimit(value: string): number | null | undefined {
  const text = `${value ?? ''}`.trim();
  if (!text) return null;
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

/**
 * Platform administration: companies, their resource limits and enabled modules.
 * Only for `tenant:all` users (route guard + backend). Limits are enforced by the backend;
 * this page shows current use against them.
 */
@Component({
  selector: 'app-companies-page',
  imports: [
    FormsModule,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
    StatusPillComponent,
  ],
  templateUrl: './companies-page.component.html',
  styleUrl: './companies-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompaniesPageComponent implements OnInit {
  private readonly api = inject(CompaniesApi);
  private readonly toast = inject(ToastService);

  protected readonly resources = LIMITED_RESOURCES;
  protected readonly resourceLabel = RESOURCE_LABEL;
  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;
  protected readonly formatTime = formatDateTime;

  protected readonly companies = signal<Company[]>([]);
  protected readonly productModules = signal<Module[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  protected readonly statusView = signal<StatusView>('visible');

  /** null = closed, 'new' = create, otherwise the company being edited. */
  protected readonly editing = signal<Company | 'new' | null>(null);
  protected readonly usage = signal<CompanyLimitUsage[]>([]);
  protected form: CompanyForm = this.blankForm();
  private original: { limits: Record<LimitedResource, number | null>; modules: string[] } | null =
    null;

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.companies().filter(
      (c) => !term || c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term),
    );
  });

  protected readonly modalTitle = computed(() => {
    const target = this.editing();
    return target === 'new' ? 'New company' : target ? `${target.name} (${target.code})` : '';
  });

  ngOnInit(): void {
    this.load();
    this.api.listProductModules().subscribe({
      next: (modules) => this.productModules.set(modules.filter((m) => m.status === 'active')),
      error: (err) => this.toast.error(err, 'Unable to load product modules.'),
    });
  }

  protected load(): void {
    const view = this.statusView();
    this.loading.set(true);
    this.error.set(null);
    this.api.listAll({ status: view === 'visible' ? VISIBLE_STATUSES : view }).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Unable to load companies.');
        this.loading.set(false);
      },
    });
  }

  protected changeView(view: StatusView): void {
    this.statusView.set(view);
    this.load();
  }

  protected usageOf(resource: LimitedResource): CompanyLimitUsage | undefined {
    return this.usage().find((u) => u.resource === resource);
  }

  // ------------------------------------------------------------------ dialog ----

  protected openCreate(): void {
    this.form = this.blankForm();
    this.original = null;
    this.usage.set([]);
    this.editing.set('new');
  }

  protected openEdit(company: Company): void {
    this.form = { ...this.blankForm(), ...company, address: company.address ?? '' };
    this.original = null;
    this.usage.set([]);
    this.editing.set(company);
    forkJoin({
      usage: this.api.limits(company.id),
      modules: this.api.modules(company.id),
    }).subscribe({
      next: ({ usage, modules }) => {
        this.usage.set(usage);
        const limits = Object.fromEntries(usage.map((u) => [u.resource, u.limit])) as Record<
          LimitedResource,
          number | null
        >;
        this.original = { limits, modules };
        this.form.limits = Object.fromEntries(
          usage.map((u) => [u.resource, u.limit === null ? '' : String(u.limit)]),
        ) as Record<LimitedResource, string>;
        this.form.modules = new Set(modules);
      },
      error: (err) => this.toast.error(err, 'Unable to load the company’s limits and modules.'),
    });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected toggleModule(code: string, checked: boolean): void {
    if (checked) {
      this.form.modules.add(code);
    } else {
      this.form.modules.delete(code);
    }
  }

  protected invalidLimits(): LimitedResource[] {
    return this.resources.filter((r) => parseLimit(this.form.limits[r]) === undefined);
  }

  protected save(): void {
    const target = this.editing();
    const name = this.form.name.trim();
    if (!target || !name || (target === 'new' && !this.form.code.trim())) return;
    if (this.invalidLimits().length) {
      this.toast.error('Limits must be whole numbers of 0 or more (leave blank for unlimited).');
      return;
    }
    this.saving.set(true);
    const request = target === 'new' ? this.createRequest() : this.updateRequest(target);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          target === 'new' ? `Company "${name}" created.` : `Company "${name}" updated.`,
        );
        this.close();
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  private createRequest(): Observable<unknown> {
    const limits: Partial<Record<LimitedResource, number>> = {};
    for (const resource of this.resources) {
      const value = parseLimit(this.form.limits[resource]);
      if (typeof value === 'number') limits[resource] = value;
    }
    return this.api.create({
      code: this.form.code.trim().toUpperCase(),
      name: this.form.name.trim(),
      address: this.form.address.trim() || null,
      timezone: this.form.timezone.trim() || 'UTC',
      limits,
      module_codes: [...this.form.modules],
    });
  }

  /** Only what changed: company fields, limits and modules are separate endpoints. */
  private updateRequest(company: Company): Observable<unknown> {
    const steps: Observable<unknown>[] = [];
    const fields: CompanyUpdate = {};
    if (this.form.name.trim() !== company.name) fields.name = this.form.name.trim();
    if ((this.form.address.trim() || null) !== company.address)
      fields.address = this.form.address.trim() || null;
    if (this.form.timezone.trim() && this.form.timezone.trim() !== company.timezone)
      fields.timezone = this.form.timezone.trim();
    if (Object.keys(fields).length) steps.push(this.api.update(company.id, fields));

    if (this.original) {
      const changed: Partial<Record<LimitedResource, number | null>> = {};
      for (const resource of this.resources) {
        const value = parseLimit(this.form.limits[resource]) ?? null;
        if (value !== this.original.limits[resource]) changed[resource] = value;
      }
      if (Object.keys(changed).length) steps.push(this.api.setLimits(company.id, changed));
      const modules = [...this.form.modules].sort();
      if (modules.join() !== [...this.original.modules].sort().join()) {
        steps.push(this.api.setModules(company.id, modules));
      }
    }
    return steps.length ? concat(...steps).pipe(last()) : of(null);
  }

  // ----------------------------------------------------------------- status ----

  protected toggleStatus(company: Company): void {
    const status = toggledStatus(company.status);
    this.api.update(company.id, { status }).subscribe({
      next: () => {
        this.toast.success(
          `Company "${company.name}" ${status === 'active' ? 'activated' : 'deactivated'}.`,
        );
        this.load();
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  protected remove(company: Company): void {
    if (
      !confirm(`Delete company "${company.name}"? Its users can no longer sign in; data is kept.`)
    )
      return;
    this.api.delete(company.id).subscribe({
      next: () => {
        this.toast.success(`Company "${company.name}" deleted.`);
        this.load();
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  protected restore(company: Company): void {
    this.api.update(company.id, { status: 'active' }).subscribe({
      next: () => {
        this.toast.success(`Company "${company.name}" restored.`);
        this.load();
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  private blankForm(): CompanyForm {
    return {
      code: '',
      name: '',
      address: '',
      timezone: 'UTC',
      limits: emptyLimits(),
      modules: new Set<string>(),
    };
  }
}
