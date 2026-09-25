import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { FakeAuthService, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { AppHeaderComponent } from './app-header.component';

describe('AppHeaderComponent', () => {
  async function setup(user = fakeUser()) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), provideFakeAuth(user)],
    });
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.componentRef.setInput('section', 'Dashboard');
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => (document.body.innerHTML = ''));

  it('shows the section, company and the signed-in user', async () => {
    const { el } = await setup();
    expect(el.querySelector('.topbar__section')?.textContent).toBe('Dashboard');
    expect(el.querySelector('.company__name')?.textContent).toBe('InduSense Corp');
    expect(el.querySelector('.company__code')?.textContent).toBe('INDU');
    expect(el.querySelector('.avatar')?.textContent).toBe('PA');
  });

  it('emits navToggle and reflects navOpen on the menu button', async () => {
    const { fixture, el } = await setup();
    let toggles = 0;
    fixture.componentInstance.navToggle.subscribe(() => toggles++);
    const button = el.querySelector<HTMLButtonElement>('.topbar__nav-toggle')!;
    button.click();
    expect(toggles).toBe(1);
    fixture.componentRef.setInput('navOpen', true);
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Close navigation');
  });

  it('opens and closes the search box', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="Search"]')!.click();
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(input).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('input[type="search"]')).toBeNull();
  });

  it('shows the user card and logs out through AuthService', async () => {
    const { fixture, el } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>('app-dropdown-menu button')!.click();
    await fixture.whenStable();
    const meta = Array.from(el.querySelectorAll('.user-card__meta')).map((m) => m.textContent);
    expect(el.querySelector('.user-card__name')?.textContent).toBe('Plant Admin');
    expect(meta).toEqual(['plant.admin@indusense.com', 'Company admin · INDU']);

    const logout = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(
      (b) => b.textContent?.includes('Log out'),
    )!;
    logout.click();
    await fixture.whenStable();

    expect(TestBed.inject(FakeAuthService).logoutCalls).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(el.querySelector('a[href="/login"]')?.textContent?.trim()).toBe('Sign in');
  });
});
