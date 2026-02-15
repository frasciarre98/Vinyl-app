import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'publish-api',
      configureServer(server) {
        server.middlewares.use('/api/publish', async (req, res) => {
          console.log('🚀 PUB: Starting Magic Publish...');

          const runCommand = (cmd) => new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
              if (error) {
                console.error(`❌ CMD [${cmd}] FAILED:`, stderr);
                reject(stderr || stdout || error.message);
              } else {
                resolve(stdout);
              }
            });
          });

          try {
            // 1. Export Static
            process.stdout.write('  📦 Exporting data... ');
            await runCommand('npm run export:static');
            console.log('DONE');

            // 2. Git Automation
            process.stdout.write('  💾 Committing changes... ');
            await runCommand('git config http.postBuffer 524288000'); // Increase buffer for large pushes
            await runCommand('git add .');
            await runCommand('git commit -m "🚀 Auto-publish collection" || true');
            console.log('DONE');

            process.stdout.write('  ☁️  Pushing to GitHub... ');
            try {
              await runCommand('git push');
              console.log('DONE');
            } catch (pushErr) {
              if (pushErr.includes('400') || pushErr.includes('postBuffer')) {
                console.error('⚠️  Push failed due to size. Retrying with larger buffer...');
                await runCommand('git config http.postBuffer 1048576000');
                await runCommand('git push');
                console.log('DONE (after retry)');
              } else {
                throw pushErr;
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Published successfully!' }));
          } catch (err) {
            console.error('🔥 PUB FAILED:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0', // Explicitly bind to all interfaces
    strictPort: true, // Fail if port 5173 is busy
    cors: true, // Allow CORS
    allowedHosts: 'all' // Allow any host header (New Vite 5.x requirement for some networks)
  }
})
