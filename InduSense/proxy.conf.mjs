import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveBackendPort() {
  if (process.env['PORT']) return process.env['PORT'];
  if (process.env['UVICORN_PORT']) return process.env['UVICORN_PORT'];
  try {
    const envPath = path.resolve(__dirname, '../../InduSense-BE/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^PORT\s*=\s*(\d+)/m);
      if (match) return match[1];
    }
  } catch {
    // Ignore and fallback
  }
  return '8000';
}

const port = resolveBackendPort();
const target = process.env['INDUSENSE_API_URL'] ?? `http://127.0.0.1:${port}`;

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
