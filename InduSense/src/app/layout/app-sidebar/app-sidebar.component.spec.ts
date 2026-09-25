import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { AppSidebarComponent } from './app-sidebar.component';

@Component({ imports: [AppSidebarComponent], template: '<app-sidebar />' })
class ShellComponent {}

describe('AppSidebarComponent', () => {
  async function renderAt(url: string, permissions?: string[]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: ShellComponent }]),
        provideFakeAuth(fakeUser(permissions ? { permissions } : {})),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  it('renders the 9 navigation items with Quick Start pinned last', async () => {
    const el = await renderAt('/dashboard');
    const labels = Array.from(el.querySelectorAll('.nav-item__label')).map((l) => l.textContent);
    expect(labels).toEqual([
      'Dashboard',
      'Devices',
      'Assets',
      'Locations',
      'Maps',
      'Reports',
      'Alarms',
      'More',
      'Quick Start',
    ]);
    expect(el.querySelector('.sidebar__pinned .nav-item__label')?.textContent).toBe('Quick Start');
  });

  it('shows chevrons on sections with sub-pages', async () => {
    const el = await renderAt('/dashboard');
    const withChevron = Array.from(el.querySelectorAll('.nav-item'))
      .filter((a) => a.querySelector('.nav-item__chevron'))
      .map((a) => a.querySelector('.nav-item__label')?.textContent);
    expect(withChevron).toEqual(['Devices', 'Reports', 'Alarms']);
  });

  it('marks the active section with aria-current', async () => {
    const el = await renderAt('/reports');
    const active = el.querySelectorAll('a[aria-current="page"]');
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain('Reports');
    expect(active[0].classList).toContain('nav-item--active');
  });

  it('hides sections the user has no permission for', async () => {
    const el = await renderAt('/dashboard', ['devices:view']);
    const labels = Array.from(el.querySelectorAll('.nav-item__label')).map((l) => l.textContent);
    expect(labels).toEqual(['Dashboard', 'Devices', 'Alarms', 'More', 'Quick Start']);
  });
});
