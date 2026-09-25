import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { provideFakeAuth } from '../../core/auth/testing';
import { MainLayoutComponent } from './main-layout.component';

@Component({ template: '<p class="page">page</p>' })
class PageComponent {}

describe('MainLayoutComponent', () => {
  async function setup(url = '/dashboard') {
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(),
        provideRouter([
          {
            path: '',
            component: MainLayoutComponent,
            children: [
              { path: 'dashboard', component: PageComponent, data: { section: 'Dashboard' } },
              { path: 'devices', component: PageComponent, data: { section: 'Devices' } },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    const el = harness.fixture.nativeElement as HTMLElement;
    return { harness, el };
  }

  it('renders header, sidebar, skip link and the routed page', async () => {
    const { el } = await setup();
    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('app-sidebar#app-sidebar')).not.toBeNull();
    expect(el.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(el.querySelector('main#main-content .page')).not.toBeNull();
  });

  it('shows the section from route data and follows navigation', async () => {
    const { harness, el } = await setup();
    expect(el.querySelector('.topbar__section')?.textContent).toBe('Dashboard');
    await harness.navigateByUrl('/devices');
    await harness.fixture.whenStable();
    expect(el.querySelector('.topbar__section')?.textContent).toBe('Devices');
  });

  it('opens the drawer from the header and closes it on Escape, backdrop or navigation', async () => {
    const { harness, el } = await setup();
    const toggle = el.querySelector<HTMLButtonElement>('.topbar__nav-toggle')!;
    const sidebar = el.querySelector('app-sidebar')!;
    const open = async () => {
      toggle.click();
      await harness.fixture.whenStable();
      expect(sidebar.classList).toContain('layout__sidebar--open');
    };
    const expectClosed = () => {
      expect(sidebar.classList).not.toContain('layout__sidebar--open');
      expect(el.querySelector('.layout__backdrop')).toBeNull();
    };

    await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await harness.fixture.whenStable();
    expectClosed();

    await open();
    el.querySelector<HTMLElement>('.layout__backdrop')!.click();
    await harness.fixture.whenStable();
    expectClosed();

    await open();
    await harness.navigateByUrl('/devices');
    await harness.fixture.whenStable();
    expectClosed();
  });
});
