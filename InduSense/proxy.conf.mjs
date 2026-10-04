// Dev-server proxy: the browser calls /api/... on the Angular origin and the dev server forwards it
// to the InduSense backend. Same-origin requests keep auth cookies first-party and need
// no CORS. Override the target with INDUSENSE_API_URL, e.g. INDUSENSE_API_URL=http://127.0.0.1:8001.
const target = process.env['INDUSENSE_API_URL'] ?? 'http://127.0.0.1:8001';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
    configure: (proxy) => {
      proxy.on('error', (_err, _req, res) => {
        if (!res.headersSent && typeof res.writeHead === 'function') {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              code: 'SERVICE_UNAVAILABLE',
              message: `Backend is unreachable at ${target}. Start the backend server using 'start-backend.bat'.`,
            }),
          );
        }
      });
    },
  },
};
