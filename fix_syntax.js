const fs = require('fs');
const path = require('path');

const dir = 'screens/onboarding';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  
  const pattern = /\.trim\(\)\n\s*:\s*(?:'[^']+'|"[^"]+"|[a-zA-Z0-9]+(?:\([^)]*\))?\.replace\([^)]+\))/g;
  
  if (pattern.test(content)) {
    console.log(`Fixing ${file}`);
    content = content.replace(pattern, '.trim()');
    fs.writeFileSync(filepath, content, 'utf8');
  }
}
