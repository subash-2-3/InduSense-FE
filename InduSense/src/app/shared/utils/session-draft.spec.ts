import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { clearDraft, persistedSignal, readDraft, sanitizeDraft, writeDraft } from './session-draft';

describe('session-draft', () => {
  beforeEach(() => sessionStorage.clear());

  describe('sanitizeDraft', () => {
    it('strips sensitive keys at any depth', () => {
      const cleaned = sanitizeDraft({
        username: 'agent',
        password: 'secret',
        nested: { api_key: 'k', token: 't', name: 'ok' },
        list: [{ otp: '1234', keep: 'yes' }],
      });
      expect(cleaned).toEqual({
        username: 'agent',
        nested: { name: 'ok' },
        list: [{ keep: 'yes' }],
      });
    });

    it('passes primitives through untouched', () => {
      expect(sanitizeDraft(42)).toBe(42);
      expect(sanitizeDraft('hi')).toBe('hi');
      expect(sanitizeDraft(null)).toBeNull();
    });
  });

  describe('read/write/clear', () => {
    it('round-trips a draft object (minus sensitive fields)', () => {
      writeDraft('k.form', { full_name: 'Gokul', password: 'x' });
      expect(readDraft('k.form')).toEqual({ full_name: 'Gokul' });
    });

    it('returns null when nothing is stored', () => {
      expect(readDraft('k.missing')).toBeNull();
    });

    it('clears a stored draft', () => {
      writeDraft('k.form', { a: 1 });
      clearDraft('k.form');
      expect(readDraft('k.form')).toBeNull();
    });

    it('removes the key when writing null', () => {
      writeDraft('k.flag', { a: 1 });
      writeDraft('k.flag', null);
      expect(sessionStorage.getItem('k.flag')).toBeNull();
    });
  });

  describe('persistedSignal', () => {
    it('seeds from an existing stored value', () => {
      sessionStorage.setItem('k.open', JSON.stringify(true));
      const state = TestBed.runInInjectionContext(() => persistedSignal('k.open', false));
      expect(state()).toBe(true);
    });

    it('falls back to the initial value when nothing is stored', () => {
      const state = TestBed.runInInjectionContext(() => persistedSignal('k.open', false));
      expect(state()).toBe(false);
    });

    it('writes changes back to sessionStorage', () => {
      const state = TestBed.runInInjectionContext(() => persistedSignal('k.open', false));
      state.set(true);
      TestBed.inject(ApplicationRef).tick();
      expect(sessionStorage.getItem('k.open')).toBe(JSON.stringify(true));
    });
  });
});
