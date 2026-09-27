import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { LocationsApi } from '../../core/api/resources/locations.api';
import { Area, AreaCreate, Plant, PlantCreate, PlantUpdate } from '../../core/models';
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

@Component({
  selector: 'app-locations-page',
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
    <div class="loc-page">
      <header class="loc-header">
        <div class="loc-header__titles">
          <h1 class="loc-header__title">Locations & Facilities</h1>
          <p class="loc-header__subtitle">Manage industrial plants, operational zones, and production facilities</p>
        </div>
        <div class="loc-header__actions">
          <button appButton variant="secondary" (click)="loadData()">
            <app-icon name="refresh" [size]="14" [class.spinning]="loading()" />
            Refresh
          </button>
          <button appButton variant="primary" (click)="openCreatePlantModal()">
            <app-icon name="plus" [size]="14" />
            New Plant
          </button>
        </div>
      </header>

      <!-- Filter & Search Toolbar -->
      <div class="loc-toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            class="search-input"
            placeholder="Search plant name, code, or address..."
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
          <label class="filter-label">Status:</label>
          <select
            class="filter-select"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <!-- Action Message / Alert -->

      @if (loading()) {
        <div class="loc-skeleton">
          <app-skeleton height="220px" />
          <app-skeleton height="220px" />
        </div>
      } @else if (error()) {
        <app-card>
          <app-error-state
            heading="Failed to load locations"
            [message]="error()!"
            (retry)="loadData()"
          />
        </app-card>
      } @else if (filteredPlants().length === 0) {
        <app-card>
          <app-empty-state
            heading="No plants match criteria"
            message="Try adjusting your search terms or create a new plant to get started."
          >
            <button appButton variant="primary" (click)="openCreatePlantModal()">
              <app-icon name="plus" [size]="14" />
              Create First Plant
            </button>
          </app-empty-state>
        </app-card>
      } @else {
        <div class="loc-grid">
          @for (plant of filteredPlants(); track plant.id) {
            <app-card class="plant-card">
              <div class="plant-card__header">
                <div class="plant-card__title-row">
                  <div class="plant-card__icon-badge">
                    <app-icon name="map-pin" [size]="20" />
                  </div>
                  <div>
                    <h2 class="plant-card__name">{{ plant.name }}</h2>
                    <span class="plant-card__code">{{ plant.code }}</span>
                  </div>
                </div>
                <div class="plant-card__badges">
                  <app-status-pill
                    [label]="plant.is_active ? 'Active' : 'Inactive'"
                    [tone]="plant.is_active ? 'running' : 'stopped'"
                  />
                </div>
              </div>

              <div class="plant-card__meta">
                <div class="plant-card__meta-item">
                  <app-icon name="clock" [size]="14" />
                  <span>Timezone: {{ plant.timezone || 'UTC' }}</span>
                </div>
                @if (plant.address) {
                  <div class="plant-card__meta-item">
                    <app-icon name="map" [size]="14" />
                    <span>{{ plant.address }}</span>
                  </div>
                }
              </div>

              <div class="plant-card__areas">
                <div class="areas-header">
                  <h3 class="areas-heading">
                    Operational Areas ({{ getPlantAreas(plant.id).length }})
                  </h3>
                  <button
                    appButton
                    variant="ghost"
                    size="sm"
                    class="btn-add-area"
                    (click)="openCreateAreaModal(plant)"
                  >
                    <app-icon name="plus" [size]="12" />
                    Add Area
                  </button>
                </div>

                @if (getPlantAreas(plant.id).length === 0) {
                  <p class="areas-empty">No operational areas configured in this plant.</p>
                } @else {
                  <div class="areas-list">
                    @for (area of getPlantAreas(plant.id); track area.id) {
                      <div class="area-chip">
                        <span class="area-chip__code">{{ area.code }}</span>
                        <span class="area-chip__name">{{ area.name }}</span>
                        <button
                          type="button"
                          class="area-delete-btn"
                          title="Deactivate area"
                          (click)="deactivateArea(area.id, area.name)"
                        >
                          <app-icon name="x" [size]="12" />
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              <footer class="plant-card__actions">
                <button
                  appButton
                  variant="ghost"
                  size="sm"
                  (click)="openEditPlantModal(plant)"
                >
                  <app-icon name="edit" [size]="14" />
                  Edit
                </button>
                <button
                  appButton
                  variant="ghost"
                  size="sm"
                  [class.text-danger]="plant.is_active"
                  (click)="togglePlantStatus(plant)"
                >
                  <app-icon name="settings" [size]="14" />
                  {{ plant.is_active ? 'Deactivate' : 'Activate' }}
                </button>
              </footer>
            </app-card>
          }
        </div>
      }

      <!-- Plant Modal (Create & Edit) -->
      <app-modal
        [open]="plantModalOpen()"
        [title]="editingPlantId() ? 'Edit Plant' : 'Create New Plant'"
        [subtitle]="editingPlantId() ? 'Update facility details' : 'Add a manufacturing or processing facility'"
        (close)="plantModalOpen.set(false)"
      >
        <form (ngSubmit)="savePlant()" class="modal-form">
          <div class="form-group">
            <label class="form-label" for="plantName">Plant Name *</label>
            <input
              id="plantName"
              type="text"
              class="form-input"
              placeholder="e.g. Pune Manufacturing Facility"
              [(ngModel)]="plantForm.name"
              name="name"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="plantCode">Plant Code *</label>
            <input
              id="plantCode"
              type="text"
              class="form-input"
              placeholder="e.g. PN-01"
              [(ngModel)]="plantForm.code"
              name="code"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="plantTimezone">Timezone</label>
            <input
              id="plantTimezone"
              type="text"
              class="form-input"
              placeholder="e.g. Asia/Kolkata or UTC"
              [(ngModel)]="plantForm.timezone"
              name="timezone"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="plantAddress">Address / Location</label>
            <textarea
              id="plantAddress"
              rows="2"
              class="form-textarea"
              placeholder="Street address, city, region..."
              [(ngModel)]="plantForm.address"
              name="address"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="plantModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !plantForm.name.trim() || !plantForm.code.trim()"
            >
              {{ saving() ? 'Saving...' : editingPlantId() ? 'Update Plant' : 'Create Plant' }}
            </button>
          </div>
        </form>
      </app-modal>

      <!-- Area Modal (Create) -->
      <app-modal
        [open]="areaModalOpen()"
        title="Add Operational Area"
        [subtitle]="selectedPlantForArea() ? 'Adding zone to ' + selectedPlantForArea()!.name : ''"
        (close)="areaModalOpen.set(false)"
      >
        <form (ngSubmit)="saveArea()" class="modal-form">
          <div class="form-group">
            <label class="form-label" for="areaName">Area Name *</label>
            <input
              id="areaName"
              type="text"
              class="form-input"
              placeholder="e.g. Assembly Line 1"
              [(ngModel)]="areaForm.name"
              name="areaName"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="areaCode">Area Code *</label>
            <input
              id="areaCode"
              type="text"
              class="form-input"
              placeholder="e.g. AS-01"
              [(ngModel)]="areaForm.code"
              name="areaCode"
              required
            />
          </div>

          <div class="modal-actions">
            <button
              appButton
              variant="secondary"
              type="button"
              (click)="areaModalOpen.set(false)"
            >
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !areaForm.name.trim() || !areaForm.code.trim()"
            >
              {{ saving() ? 'Creating...' : 'Create Area' }}
            </button>
          </div>
        </form>
      </app-modal>
    </div>
  `,
  styles: `
    .loc-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 1400px;
      margin: 0 auto;
    }

    .loc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .loc-header__title {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .loc-header__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .loc-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .loc-toolbar {
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

    .loc-skeleton {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: var(--space-4);
    }

    .loc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: var(--space-4);
    }

    .plant-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .plant-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .plant-card__title-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .plant-card__icon-badge {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--accent-cyan-soft);
      color: var(--accent-cyan);
    }

    .plant-card__name {
      font-size: var(--text-base);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .plant-card__code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--accent-cyan);
    }

    .plant-card__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--text-secondary);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-light);
    }

    .plant-card__meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .plant-card__areas {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .areas-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .areas-heading {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin: 0;
    }

    .btn-add-area {
      font-size: 11px;
      padding: 2px 8px;
    }

    .areas-empty {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .areas-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .area-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 4px 8px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
    }

    .area-chip__code {
      font-family: var(--font-mono);
      color: var(--accent-cyan);
      font-weight: 600;
    }

    .area-chip__name {
      color: var(--text-primary);
    }

    .area-delete-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      padding: 0;
      margin-left: 2px;
    }

    .area-delete-btn:hover {
      color: var(--status-fault-text);
    }

    .plant-card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding-top: var(--space-2);
      border-top: 1px solid var(--border-light);
    }

    .text-danger {
      color: var(--status-fault-text) !important;
    }

    /* Modal Form Styles */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
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
    .form-textarea {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .form-input:focus,
    .form-textarea:focus {
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
export class LocationsPageComponent implements OnInit {
  private readonly locationsApi = inject(LocationsApi);

  readonly plants = signal<Plant[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  private readonly toast = inject(ToastService);

  // Modals state
  readonly plantModalOpen = signal(false);
  readonly editingPlantId = signal<number | null>(null);
  plantForm = { name: '', code: '', timezone: 'UTC', address: '' };

  readonly areaModalOpen = signal(false);
  readonly selectedPlantForArea = signal<Plant | null>(null);
  areaForm = { name: '', code: '' };

  readonly filteredPlants = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.plants().filter((plant) => {
      const matchesSearch =
        !term ||
        plant.name.toLowerCase().includes(term) ||
        plant.code.toLowerCase().includes(term) ||
        (plant.address && plant.address.toLowerCase().includes(term));

      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && plant.is_active) ||
        (filter === 'inactive' && !plant.is_active);

      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      plants: this.locationsApi.listAllPlants().pipe(catchError((err) => { throw err; })),
      areas: this.locationsApi.listAllAreas().pipe(catchError(() => of([] as Area[]))),
    }).subscribe({
      next: ({ plants, areas }) => {
        this.plants.set(plants);
        this.areas.set(areas);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load locations from server.');
        this.loading.set(false);
      },
    });
  }

  getPlantAreas(plantId: number): Area[] {
    return this.areas().filter((a) => a.plant_id === plantId);
  }

  openCreatePlantModal(): void {
    this.editingPlantId.set(null);
    this.plantForm = { name: '', code: '', timezone: 'UTC', address: '' };
    this.plantModalOpen.set(true);
  }

  openEditPlantModal(plant: Plant): void {
    this.editingPlantId.set(plant.id);
    this.plantForm = {
      name: plant.name,
      code: plant.code,
      timezone: plant.timezone || 'UTC',
      address: plant.address || '',
    };
    this.plantModalOpen.set(true);
  }

  savePlant(): void {
    const name = this.plantForm.name.trim();
    const code = this.plantForm.code.trim();
    if (!name || !code) return;

    this.saving.set(true);
    const editingId = this.editingPlantId();

    if (editingId) {
      const payload: PlantUpdate = {
        name,
        code,
        timezone: this.plantForm.timezone.trim() || undefined,
        address: this.plantForm.address.trim() || undefined,
      };
      this.locationsApi.updatePlant(editingId, payload).subscribe({
        next: (updated) => {
          this.plants.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
          this.plantModalOpen.set(false);
          this.saving.set(false);
          this.toast.success(`Plant "${updated.name}" updated successfully.`);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'Failed to update plant.');
        },
      });
    } else {
      const payload: PlantCreate = {
        name,
        code,
        timezone: this.plantForm.timezone.trim() || 'UTC',
        address: this.plantForm.address.trim() || undefined,
      };
      this.locationsApi.createPlant(payload).subscribe({
        next: (created) => {
          this.plants.update((list) => [created, ...list]);
          this.plantModalOpen.set(false);
          this.saving.set(false);
          this.toast.success(`Plant "${created.name}" created successfully.`);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'Failed to create plant.');
        },
      });
    }
  }

  togglePlantStatus(plant: Plant): void {
    const newStatus = !plant.is_active;
    const actionLabel = newStatus ? 'activated' : 'deactivated';

    this.locationsApi.updatePlant(plant.id, { is_active: newStatus }).subscribe({
      next: (updated) => {
        this.plants.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
        this.toast.success(`Plant "${plant.name}" has been ${actionLabel}.`);
      },
      error: (err) => {
        this.toast.error(err, `Failed to change plant status.`);
      },
    });
  }

  openCreateAreaModal(plant: Plant): void {
    this.selectedPlantForArea.set(plant);
    this.areaForm = { name: '', code: '' };
    this.areaModalOpen.set(true);
  }

  saveArea(): void {
    const plant = this.selectedPlantForArea();
    if (!plant) return;

    const name = this.areaForm.name.trim();
    const code = this.areaForm.code.trim();
    if (!name || !code) return;

    this.saving.set(true);
    const payload: AreaCreate = {
      name,
      code,
      plant_id: plant.id,
    };

    this.locationsApi.createArea(payload).subscribe({
      next: (created) => {
        this.areas.update((list) => [...list, created]);
        this.areaModalOpen.set(false);
        this.saving.set(false);
        this.toast.success(`Area "${created.name}" added to ${plant.name}.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'Failed to create area.');
      },
    });
  }

  deactivateArea(areaId: number, areaName: string): void {
    if (!confirm(`Are you sure you want to deactivate area "${areaName}"?`)) return;

    this.locationsApi.deactivateArea(areaId).subscribe({
      next: () => {
        this.areas.update((list) => list.filter((a) => a.id !== areaId));
        this.toast.success(`Area "${areaName}" deactivated.`);
      },
      error: (err) => {
        this.toast.error(err, 'Failed to deactivate area.');
      },
    });
  }

}
