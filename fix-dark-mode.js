const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/dashboard/ingestion-monitor/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  ['bg-blue-500/10', 'bg-blue-500/10 dark:bg-blue-500/20'],
  ['bg-red-500/10', 'bg-red-500/10 dark:bg-red-500/20'],
  ['bg-amber-500/10', 'bg-amber-500/10 dark:bg-amber-500/20'],
  ['text-blue-600 bg-blue-50 hover:bg-blue-100', 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'],
  ['text-blue-500 bg-blue-50 hover:bg-blue-100', 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'],
  ['text-blue-600', 'text-blue-600 dark:text-blue-400'],
  ['text-blue-500', 'text-blue-500 dark:text-blue-400'],
  ['text-orange-500', 'text-orange-500 dark:text-orange-400'],
  ['text-green-600', 'text-green-600 dark:text-green-400'],
  ['text-emerald-600', 'text-emerald-600 dark:text-emerald-400'],
  ['text-blue-700', 'text-blue-700 dark:text-blue-400'],
  ['text-green-700', 'text-green-700 dark:text-green-400'],
  ['text-amber-500', 'text-amber-500 dark:text-amber-400'],
  ['bg-green-50/50 border border-green-100', 'bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30'],
  ['bg-red-100 text-red-600', 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'],
  ['bg-amber-100 text-amber-700', 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'],
  ['bg-red-50/50 border border-red-100', 'bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30'],
  ['bg-amber-50/50 border border-amber-100', 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30'],
  ['text-red-900', 'text-red-900 dark:text-red-400'],
  ['text-amber-900', 'text-amber-900 dark:text-amber-400'],
  ['border-b border-red-100', 'border-b border-red-100 dark:border-red-900/30'],
  ['border-b border-amber-100', 'border-b border-amber-100 dark:border-amber-900/30'],
  ['border border-red-100', 'border border-red-100 dark:border-red-900/30'],
  ['border border-amber-100', 'border border-amber-100 dark:border-amber-900/30'],
  ['text-red-600', 'text-red-600 dark:text-red-400'],
  ['text-amber-700', 'text-amber-700 dark:text-amber-400']
];

// Perform replacements, ensuring we don't accidentally double-replace
// by checking if the dark: variant is already present
for (const [search, replace] of replacements) {
  // Simple check: if replace string contains "dark:", only replace if not already there
  const [baseClass] = replace.split(' dark:');
  
  // A bit naive, but we will just replace the exact search string
  // if it's not immediately followed by " dark:"
  const regex = new RegExp(search.replace(/\//g, '\\/') + '(?![\\w\\s]*dark:)', 'g');
  content = content.replace(regex, replace);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed dark mode classes in page.tsx');
