import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AppHeaderComponent } from '../app-header/app-header.component';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

/**
 * Application shell: top bar, sidebar rail and the routed page.
 * Below 768px the sidebar becomes an off-canvas drawer opened from the header.
 */
@Component({
  selector: 'app-main-layout',
  imports: [AppHeaderComponent, AppSidebarComponent, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  host: { '(document:keydown.escape)': 'closeNav()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  private readonly router = inject(Router);

  protected readonly navOpen = signal(false);

  /** `data.section` of the deepest active route, shown in the header. */
  protected readonly section = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentSection()),
    ),
    { initialValue: '' },
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeNav());
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  private currentSection(): string {
    // Read the router's state snapshot: during the first navigation, child ActivatedRoutes
    // exist before their snapshots are assigned.
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const section: unknown = route.data['section'];
    return typeof section === 'string' ? section : '';
  }
}
