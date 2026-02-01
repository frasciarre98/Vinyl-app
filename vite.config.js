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
            await runCommand('git add .');
            // We use || true to ignore "nothing to commit" errors
            await runCommand('git commit -m "🚀 Auto-publish collection" || true');
            console.log('DONE');

            process.stdout.write('  ☁️  Pushing to GitHub... ');
            await runCommand('git push');
            console.log('DONE');

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
    host: true,
  }
})
