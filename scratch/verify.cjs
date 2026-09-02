const { execSync } = require('child_process');

try {
  console.log('Main PB Hooks syntax check:');
  execSync('node --check backend/pb_hooks/main.pb.js');
  console.log('Syntax OK!');
} catch (e) {
  console.error(e.message);
}
