import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { SearchableSelectComponent, SelectOption } from './searchable-select.component';

@Component({
  imports: [SearchableSelectComponent, FormsModule],
  template: `
    <app-searchable-select
      [options]="opts"
      [searchable]="true"
      ariaLabel="Device"
      [(ngModel)]="val"
    />
  `,
})
class HostComponent {
  opts: SelectOption[] = [
    { value: 1, label: 'Alpha' },
    { value: 2, label: 'Beta' },
    { value: 3, label: 'Gamma' },
  ];
  val: number | null = null;
}

async function setup(val: number | null = null) {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.val = val;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const el = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('SearchableSelectComponent', () => {
  it('shows the placeholder when nothing is selected', async () => {
    const fixture = await setup(null);
    expect(el(fixture).querySelector('.ss__value')?.textContent?.trim()).toBe('Select an option...');
    expect(el(fixture).querySelector('.ss__panel')).toBeNull();
  });

  it('reflects an externally set value as the selected label with a check', async () => {
    const fixture = await setup(2);
    expect(el(fixture).querySelector('.ss__value')?.textContent?.trim()).toBe('Beta');
    el(fixture).querySelector<HTMLButtonElement>('.ss__trigger')!.click();
    fixture.detectChanges();
    const selected = el(fixture).querySelector('.ss__option--selected');
    expect(selected?.textContent).toContain('Beta');
    expect(selected?.querySelector('.ss__check')).not.toBeNull();
  });

  it('opens, filters by the search query, and selects — preserving the numeric value', async () => {
    const fixture = await setup(null);
    el(fixture).querySelector<HTMLButtonElement>('.ss__trigger')!.click();
    fixture.detectChanges();

    const search = el(fixture).querySelector<HTMLInputElement>('.ss__search-input')!;
    search.value = 'bet';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = el(fixture).querySelectorAll('.ss__option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Beta');

    (options[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.val).toBe(2);
    expect(typeof fixture.componentInstance.val).toBe('number');
    expect(el(fixture).querySelector('.ss__panel')).toBeNull();
  });

  it('closes on a pointer-down outside the component', async () => {
    const fixture = await setup(null);
    el(fixture).querySelector<HTMLButtonElement>('.ss__trigger')!.click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('.ss__panel')).not.toBeNull();

    await tick();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(el(fixture).querySelector('.ss__panel')).toBeNull();
  });

  it('shows the empty label when nothing matches', async () => {
    const fixture = await setup(null);
    el(fixture).querySelector<HTMLButtonElement>('.ss__trigger')!.click();
    fixture.detectChanges();
    const search = el(fixture).querySelector<HTMLInputElement>('.ss__search-input')!;
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el(fixture).querySelector('.ss__empty')?.textContent?.trim()).toBe('No matches');
  });
});
