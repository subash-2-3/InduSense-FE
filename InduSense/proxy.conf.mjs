// Dev-server proxy: the browser calls /api/... on the Angular origin and the dev server forwards it
// to the InduSense backend. Same-origin requests keep auth cookies first-party (Phase 7) and need
// no CORS. Override the target with INDUSENSE_API_URL, e.g. INDUSENSE_API_URL=http://127.0.0.1:8001.
const target = process.env['INDUSENSE_API_URL'] ?? 'http://localhost:8000';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
};
