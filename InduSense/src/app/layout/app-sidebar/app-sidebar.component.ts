import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ActiveAlarmCountService } from '../../features/alarms/active-alarm-count.service';
import { IconComponent } from '../../shared/ui';
import { Permission } from '../../core/auth/permissions';
import { NavItem, PINNED_NAV, PRIMARY_NAV } from '../navigation';

/** 68px icon rail. On small screens MainLayoutComponent turns it into an off-canvas drawer. */
@Component({
  selector: 'app-sidebar',
  imports: [IconComponent, NgTemplateOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly alarms = inject(ActiveAlarmCountService);

  /** Sections the signed-in user may open. */
  protected readonly items = computed<readonly NavItem[]>(() => {
    this.auth.permissions(); // re-evaluate when the user changes
    return PRIMARY_NAV.filter(
      (item) => !item.permission || this.auth.hasPermission(item.permission),
    );
  });
  protected readonly pinned = PINNED_NAV;

  constructor() {
    if (this.auth.hasPermission(Permission.AlarmsView)) {
      this.alarms.start();
    }
  }

  protected badge(item: NavItem): number | null {
    if (item.badge !== 'alarms') {
      return null;
    }
    const count = this.alarms.count();
    return count ? count : null;
  }
}
