const { execSync } = require('child_process');
try {
  const output = execSync('netstat -ano | findstr :5000 | findstr LISTENING').toString();
  const lines = output.trim().split('\n');
  if (lines.length > 0) {
    const parts = lines[0].trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    console.log(`Killing PID ${pid}`);
    execSync(`taskkill /PID ${pid} /F`);
  }
} catch (e) {
  console.log('No process found on port 5000 or error killing it.');
}
