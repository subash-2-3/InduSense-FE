import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * The login screen is prerendered at build time. Authenticated screens (dashboard, charts,
 * browser-only APIs) render on the client.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
