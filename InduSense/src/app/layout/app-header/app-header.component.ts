import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { initials } from '../../shared/utils/initials';
import { ButtonComponent, DropdownMenuComponent, IconComponent, MenuItem } from '../../shared/ui';

/** Top bar: brand, current section, company, search, settings and the user menu. */
@Component({
  selector: 'app-header',
  imports: [ButtonComponent, DropdownMenuComponent, IconComponent, RouterLink],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  /** Title of the current section, e.g. "Dashboard". */
  readonly section = input('');
  /** Whether the mobile navigation drawer is open (drives the menu button's aria-expanded). */
  readonly navOpen = input(false, { transform: booleanAttribute });
  readonly navToggle = output<void>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly user = this.auth.displayUser;
  protected readonly avatarText = computed(() => initials(this.user()?.name ?? ''));
  protected readonly searchOpen = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly userMenu: MenuItem[] = [
    { id: 'profile', label: 'My profile', icon: 'user', disabled: true, hint: 'Soon' },
    { id: 'logout', label: 'Log out', icon: 'log-out', danger: true, separatorBefore: true },
  ];

  protected toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (this.searchOpen()) {
      afterNextRender(() => this.searchInput()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }

  protected onUserMenu(id: string): void {
    if (id === 'logout') {
      this.auth.logout().subscribe(() => void this.router.navigate(['/login']));
    }
  }
}
