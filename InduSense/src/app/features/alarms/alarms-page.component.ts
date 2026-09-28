import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AlarmsApi } from '../../core/api/resources/alarms.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { AlarmTag } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ActiveAlarmsComponent } from './active-alarms.component';
import { AlarmHistoryComponent } from './alarm-history.component';
import { AlarmSetupComponent } from './alarm-setup.component';

type Tab = 'active' | 'history' | 'setup';

/** Alarms from the machines' PLC alarm words: active now, history, and bit names (setup). */
@Component({
  selector: 'app-alarms-page',
  imports: [FormsModule, ActiveAlarmsComponent, AlarmHistoryComponent, AlarmSetupComponent],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1 class="title">Alarms</h1>
          <p class="subtitle">
            Alarms reported by the machines' PLCs (one alarm per bit of the alarm word)
          </p>
        </div>
        @if (tab() !== 'setup' && machines().length > 1) {
          <label class="fl">
            <span>Machine</span>
            <select class="control" [ngModel]="machineId()" (ngModelChange)="machineId.set($event)">
              <option [ngValue]="null">All machines</option>
              @for (m of machines(); track m.id) {
                <option [ngValue]="m.id">{{ m.name }}</option>
              }
            </select>
          </label>
        }
      </header>

      <div class="tabs" role="tablist" aria-label="Alarms">
        @for (t of tabs(); track t.value) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === t.value"
            [attr.aria-selected]="tab() === t.value"
            (click)="tab.set(t.value)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('active') {
          <app-active-alarms [machineId]="machineId()" />
        }
        @case ('history') {
          <app-alarm-history [machineId]="machineId()" />
        }
        @case ('setup') {
          <app-alarm-setup [tags]="tags()" [canManage]="canManage()" (saved)="loadTags()" />
        }
      }
    </div>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 1440px;
      margin: 0 auto;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .title {
      margin: 0;
      font-size: var(--fs-xl);
      font-weight: var(--fw-bold);
      color: var(--text-primary);
    }
    .subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .fl {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .control {
      height: 34px;
      min-width: 200px;
      padding: 0 10px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-topbar);
      color: var(--text-primary);
      font-size: var(--fs-sm);
      text-transform: none;
      letter-spacing: normal;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      border-bottom: 1px solid var(--border-light);
    }
    .tab {
      padding: var(--space-2) var(--space-4);
      border: 0;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      font-weight: var(--fw-medium);
      cursor: pointer;
    }
    .tab--active {
      border-bottom-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .tab:focus-visible,
    .control:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlarmsPageComponent implements OnInit {
  private readonly api = inject(AlarmsApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly canManage = computed(() => this.auth.hasPermission(Permission.AlarmsManage));
  protected readonly tab = signal<Tab>('active');
  protected readonly tabs = computed(() => [
    { value: 'active' as const, label: 'Active alarms' },
    { value: 'history' as const, label: 'History' },
    { value: 'setup' as const, label: this.canManage() ? 'Setup' : 'Alarm names' },
  ]);
  protected readonly tags = signal<AlarmTag[]>([]);
  protected readonly machineId = signal<number | null>(null);
  protected readonly machines = computed(() => {
    const seen = new Map<number, string>();
    for (const t of this.tags()) seen.set(t.machine_id, t.machine_name);
    return [...seen].map(([id, name]) => ({ id, name }));
  });

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.api.tags().subscribe({
      next: (tags) => this.tags.set(tags),
      error: (e) => this.toast.error(e, 'Unable to load the alarm words.'),
    });
  }
}
