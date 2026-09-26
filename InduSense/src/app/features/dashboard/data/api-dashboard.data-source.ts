import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { DevicesApi } from '../../../core/api/resources/devices.api';
import { LocationsApi } from '../../../core/api/resources/locations.api';
import { GatewaysApi, MachinesApi } from '../../../core/api/resources/plant-assets.api';
import { TagsApi } from '../../../core/api/resources/tags.api';
import { TelemetryApi } from '../../../core/api/resources/telemetry.api';
import { APP_CONFIG } from '../../../core/config/app-config';
import { Device, Tag } from '../../../core/models';
import {
  CategorySliceVm,
  FleetPageVm,
  GaugeVm,
  KpiVm,
  StackedBarVm,
  StatusSliceVm,
} from '../models/dashboard.vm';
import {
  aggregateDeviceCount,
  aggregateDeviceTypeCount,
  aggregateDevicesByConnection,
  aggregateDevicesBySource,
  aggregateDevicesByType,
  aggregateFleet,
  aggregateGauge,
} from './aggregate';
import type {
  DashboardDataSource,
  DashboardQuery,
  DashboardSnapshot,
} from './dashboard-data-source';
import { DevScenarioService } from './dev-scenario.service';
import { MockDashboardDataSource } from './mock-dashboard.data-source';
import { WidgetResult, failed, ok } from './widget-result';

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Can't reach the server. Check your connection and try again.";
}

interface DeviceWidgets {
  deviceCount: WidgetResult<KpiVm>;
  deviceTypeCount: WidgetResult<KpiVm>;
  devicesByType: WidgetResult<CategorySliceVm[]>;
  devicesByConnection: WidgetResult<StatusSliceVm[]>;
  devicesBySource: WidgetResult<StackedBarVm>;
}

/**
 * Production dashboard data source (Phase 8): fetches live data from InduSense-BE via API services,
 * transforms models to view models with aggregate helpers, and handles per-widget error states.
 * In development, honors selected non-normal dev scenarios by delegating to MockDashboardDataSource.
 */
@Injectable({ providedIn: 'root' })
export class ApiDashboardDataSource implements DashboardDataSource {
  private readonly devicesApi = inject(DevicesApi);
  private readonly machinesApi = inject(MachinesApi);
  private readonly gatewaysApi = inject(GatewaysApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly tagsApi = inject(TagsApi);
  private readonly telemetryApi = inject(TelemetryApi);
  private readonly config = inject(APP_CONFIG);
  private readonly devScenario = inject(DevScenarioService);
  private readonly mockSource = inject(MockDashboardDataSource);

  private cachedTag: { label: string; tag: Tag | null } | null = null;

  load(query: DashboardQuery): Observable<DashboardSnapshot> {
    if (!this.config.production && this.devScenario.current() !== 'normal') {
      return this.mockSource.load(query);
    }

    const devices$ = this.devicesApi.listAll().pipe(shareReplay({ bufferSize: 1, refCount: false }));

    const deviceWidgets$: Observable<DeviceWidgets> = devices$.pipe(
      map((devices) => ({
        deviceCount: ok(aggregateDeviceCount(devices)),
        deviceTypeCount: ok(aggregateDeviceTypeCount(devices)),
        devicesByType: ok(aggregateDevicesByType(devices)),
        devicesByConnection: ok(aggregateDevicesByConnection(devices)),
        devicesBySource: ok(aggregateDevicesBySource(devices)),
      })),
      catchError((err) => {
        const message = toErrorMessage(err);
        return of({
          deviceCount: failed<KpiVm>(message),
          deviceTypeCount: failed<KpiVm>(message),
          devicesByType: failed<CategorySliceVm[]>(message),
          devicesByConnection: failed<StatusSliceVm[]>(message),
          devicesBySource: failed<StackedBarVm>(message),
        });
      }),
    );

    const fleet$: Observable<WidgetResult<FleetPageVm>> = forkJoin({
      machinesPage: this.machinesApi.list({
        page: query.fleetPage,
        page_size: query.fleetPageSize,
      }),
      devices: devices$.pipe(catchError(() => of([] as Device[]))),
      gateways: this.getCachedGateways(),
      plants: this.getCachedPlants(),
      areas: this.getCachedAreas(),
    }).pipe(
      map(({ machinesPage, devices, gateways, plants, areas }) =>
        ok(aggregateFleet(machinesPage, devices, gateways, plants, areas)),
      ),
      catchError((err) => of(failed<FleetPageVm>(toErrorMessage(err)))),
    );

    const gauge$: Observable<WidgetResult<GaugeVm>> = this.resolveGaugeTag().pipe(
      switchMap((tag) => {
        if (!tag) {
          return of(ok(aggregateGauge(null, null, this.config.gauge)));
        }
        return this.telemetryApi.latest({ tagIds: [tag.id] }).pipe(
          map((latestList) => ok(aggregateGauge(tag, latestList[0] ?? null, this.config.gauge))),
          catchError((err) => of(failed<GaugeVm>(toErrorMessage(err)))),
        );
      }),
      catchError((err) => of(failed<GaugeVm>(toErrorMessage(err)))),
    );

    return forkJoin({
      deviceWidgets: deviceWidgets$,
      fleet: fleet$,
      gauge: gauge$,
    }).pipe(
      map(({ deviceWidgets, fleet, gauge }) => ({
        deviceCount: deviceWidgets.deviceCount,
        deviceTypeCount: deviceWidgets.deviceTypeCount,
        devicesByType: deviceWidgets.devicesByType,
        devicesByConnection: deviceWidgets.devicesByConnection,
        devicesBySource: deviceWidgets.devicesBySource,
        fleet,
        gauge,
      })),
    );
  }

  loadFleetPage(page: number, pageSize: number): Observable<FleetPageVm> {
    if (!this.config.production && this.devScenario.current() !== 'normal') {
      return this.mockSource.loadFleetPage(page, pageSize);
    }

    return forkJoin({
      machinesPage: this.machinesApi.list({ page, page_size: pageSize }),
      devices: this.devicesApi.listAll().pipe(catchError(() => of([] as Device[]))),
      gateways: this.gatewaysApi.listAll().pipe(catchError(() => of([]))),
      plants: this.locationsApi.listAllPlants().pipe(catchError(() => of([]))),
      areas: this.locationsApi.listAllAreas().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ machinesPage, devices, gateways, plants, areas }) =>
        aggregateFleet(machinesPage, devices, gateways, plants, areas),
      ),
    );
  }

  private cachedGateways$: Observable<any[]> | null = null;
  private cachedPlants$: Observable<any[]> | null = null;
  private cachedAreas$: Observable<any[]> | null = null;

  private getCachedGateways(): Observable<any[]> {
    if (!this.cachedGateways$) {
      this.cachedGateways$ = this.gatewaysApi.listAll().pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.cachedGateways$;
  }

  private getCachedPlants(): Observable<any[]> {
    if (!this.cachedPlants$) {
      this.cachedPlants$ = this.locationsApi.listAllPlants().pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.cachedPlants$;
  }

  private getCachedAreas(): Observable<any[]> {
    if (!this.cachedAreas$) {
      this.cachedAreas$ = this.locationsApi.listAllAreas().pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.cachedAreas$;
  }

  private resolveGaugeTag(): Observable<Tag | null> {
    const label = this.config.gauge.label;
    if (this.cachedTag && this.cachedTag.label === label) {
      return of(this.cachedTag.tag);
    }
    return this.tagsApi.findByName(label).pipe(
      map((tag) => {
        this.cachedTag = { label, tag };
        return tag;
      }),
    );
  }
}
