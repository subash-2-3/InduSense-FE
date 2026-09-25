import { contrastRatio, escapeHtml, percentLabel, readableInk, sum } from './chart-base';

describe('chart-base', () => {
  it('escapes HTML in data-derived tooltip text', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
  });

  it('sums finite values only', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([1, Number.NaN, 2])).toBe(3);
    expect(sum([])).toBe(0);
  });

  it('formats shares as whole percents, with <1% for tiny non-zero shares', () => {
    expect(percentLabel(1, 1)).toBe('100%');
    expect(percentLabel(1, 3)).toBe('33%');
    expect(percentLabel(1, 500)).toBe('<1%');
    expect(percentLabel(0, 5)).toBe('0%');
    expect(percentLabel(3, 0)).toBe('0%');
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('picks the ink with >= 4.5:1 on every categorical slice color', () => {
    const light = '#f8fafc';
    const dark = '#0b0f19';
    for (const fill of [
      '#3987e5',
      '#d95926',
      '#199e70',
      '#c98500',
      '#d55181',
      '#008300',
      '#9085e9',
      '#e66767',
    ]) {
      expect(contrastRatio(readableInk(fill, light, dark), fill)).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableInk('#008300', light, dark)).toBe(light);
    expect(readableInk('#c98500', light, dark)).toBe(dark);
  });
});
