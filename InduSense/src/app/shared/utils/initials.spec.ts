import { initials } from './initials';

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Plant Admin')).toBe('PA');
    expect(initials('Jane Mary Doe')).toBe('JD');
    expect(initials('admin@indusense.com')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});
