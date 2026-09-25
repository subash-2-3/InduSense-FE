import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { FullscreenService } from './fullscreen.service';

describe('FullscreenService', () => {
  function withFullscreen(fullscreenElement: Element | null) {
    const doc = TestBed.inject(DOCUMENT);
    const request = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(doc, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(doc, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(doc, 'exitFullscreen', { configurable: true, value: exit });
    doc.documentElement.requestFullscreen = request;
    return { doc, request, exit };
  }

  afterEach(() => {
    const doc = TestBed.inject(DOCUMENT);
    for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
      delete (doc as unknown as Record<string, unknown>)[key];
    }
  });

  it('enters fullscreen on the root element when not fullscreen', async () => {
    const { request, exit } = withFullscreen(null);
    const service = TestBed.inject(FullscreenService);
    expect(service.supported).toBe(true);
    await service.toggle();
    expect(request).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits fullscreen and tracks fullscreenchange events', async () => {
    const { doc, exit } = withFullscreen(document.body);
    const service = TestBed.inject(FullscreenService);
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(service.isFullscreen()).toBe(true);
    await service.toggle();
    expect(exit).toHaveBeenCalledOnce();
  });

  it('is inert when the Fullscreen API is unavailable', async () => {
    const doc = TestBed.inject(DOCUMENT);
    Object.defineProperty(doc, 'fullscreenEnabled', { configurable: true, value: false });
    const service = TestBed.inject(FullscreenService);
    expect(service.supported).toBe(false);
    await expect(service.toggle()).resolves.toBeUndefined();
  });
});
