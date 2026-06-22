const fs = require('fs');
const text = fs.readFileSync('src/app/globals.css', 'utf-8');
const lines = text.split('\n');

const lightColors = [];
const darkColors = [];
const themeVars = [];

let inTheme = false;

for (let line of lines) {
  if (line.includes('@theme {')) {
    inTheme = true;
    continue;
  }
  if (inTheme && line.trim() === '}') {
    inTheme = false;
    continue;
  }
  if (inTheme && line.includes('--color-')) {
    const match = line.match(/--color-([^:]+):\s*([^;]+);/);
    if (match) {
      const name = match[1];
      const val = match[2];
      lightColors.push('  --' + name + ': ' + val + ';');
      
      // Auto-generate some basic dark colors
      let darkVal = val;
      const lowerVal = val.toLowerCase();
      if (lowerVal === '#ffffff') darkVal = '#1E1E1E';
      else if (lowerVal === '#fafaf5') darkVal = '#121212';
      else if (lowerVal === '#f4f4ef') darkVal = '#181818';
      else if (lowerVal === '#e3e3de' || lowerVal === '#e8e8e3') darkVal = '#2C2C2C';
      else if (lowerVal === '#e0e0e0') darkVal = '#333333';
      else if (lowerVal === '#212121' || lowerVal === '#1a1c19') darkVal = '#E0E0E0';
      else if (lowerVal === '#616161') darkVal = '#A0A0A0';
      else if (lowerVal === '#9e9e9e') darkVal = '#757575';
      else if (lowerVal === '#1b5e20') darkVal = '#2E7D32'; 
      else if (lowerVal === '#006763') darkVal = '#00897B'; 
      else if (lowerVal === '#eeeee9') darkVal = '#242424'; 
      else if (lowerVal === '#dadad5') darkVal = '#3A3A3A'; 
      else if (lowerVal === '#f2f5ec4d') darkVal = '#2e332c4d';
      else if (lowerVal === '#f2f5ec') darkVal = '#2e332c';
      
      darkColors.push('  --' + name + ': ' + darkVal + ';');
      themeVars.push('  --color-' + name + ': var(--' + name + ');');
    }
  }
}

const out = [];
out.push('@import "tailwindcss";\n');
out.push(':root {');
out.push(lightColors.join('\n'));
out.push('}\n');
out.push('.dark {');
out.push(darkColors.join('\n'));
out.push('}\n');
out.push('@theme {');
out.push(themeVars.join('\n'));
out.push(`
  --spacing-stack-sm: 8px;
  --spacing-stack-md: 16px;
  --spacing-navbar-height: 56px;
  --spacing-gutter: 24px;
  --spacing-card-padding: 20px;
  --spacing-base: 24px;
  --spacing-sidebar-width: 240px;

  --radius-DEFAULT: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  --font-label-caps: var(--font-inter), sans-serif;
  --font-card-header: var(--font-inter), sans-serif;
  --font-page-title: var(--font-inter), sans-serif;
  --font-nav-item: var(--font-inter), sans-serif;
  --font-body: var(--font-inter), sans-serif;
  --font-helper-text: var(--font-inter), sans-serif;
}

@utility text-label-caps {
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.05em;
  font-weight: 600;
}

@utility text-card-header {
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

@utility text-page-title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}

@utility text-nav-item {
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
}

@utility text-body {
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
}

@utility text-helper-text {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
}

html, body {
  height: 100%;
}

body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
}`);

fs.writeFileSync('src/app/globals.css', out.join('\n'));
console.log('Done');
