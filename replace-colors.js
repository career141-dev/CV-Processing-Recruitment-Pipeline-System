const fs = require('fs');
const path = require('path');

const colorMap = {
  // Backgrounds & Surfaces
  'bg-white': 'bg-surface',
  'bg-[#FFFFFF]': 'bg-surface',
  'bg-[#FAFAFA]': 'bg-surface-container-lowest',
  'bg-[#FAFAF5]': 'bg-background',
  'bg-[#F5F5F0]': 'bg-background',
  'bg-[#F4F4EF]': 'bg-surface-container-low',
  'bg-[#E8E8E3]': 'bg-surface-container-high',
  'bg-[#E3E3DE]': 'bg-surface-variant',
  'bg-[#E0E0E0]': 'bg-border',
  'bg-[#F2F5EC]': 'bg-surface-container-high',
  'bg-[#F2F5EC4D]': 'bg-surface-container-high/30',
  'bg-[#1B5E20]': 'bg-primary-container',
  'bg-[#006763]': 'bg-accent-teal',

  // Text
  'text-white': 'text-on-primary',
  'text-[#FFFFFF]': 'text-on-primary',
  'text-[#212121]': 'text-text-primary',
  'text-[#1A1C19]': 'text-on-background',
  'text-[#616161]': 'text-text-secondary',
  'text-[#9E9E9E]': 'text-text-disabled',
  'text-[#1B5E20]': 'text-primary-container',
  'text-[#006763]': 'text-accent-teal',

  // Borders
  'border-white': 'border-surface',
  'border-[#FFFFFF]': 'border-surface',
  'border-[#E0E0E0]': 'border-border',
  'border-b-[#E0E0E0]': 'border-b-border',
  'border-t-[#E0E0E0]': 'border-t-border',
  'border-l-[#E0E0E0]': 'border-l-border',
  'border-r-[#E0E0E0]': 'border-r-border',
  'border-[#1B5E20]': 'border-primary-container',
  
  // Specific Badge colors that might need dark mode adjustments
  // For now we'll just leave badge colors with hexes if they are transparent bg like bg-[#1B5E2026], or map them
  'bg-[#1B5E2026]': 'bg-primary-container/15',
  'bg-[#EAB30826]': 'bg-yellow-500/15',
  'bg-[#3B82F626]': 'bg-blue-500/15',
  'bg-[#A855F726]': 'bg-purple-500/15',
  'bg-[#ECEFE6]': 'bg-surface-container',
  'bg-[#FFD9E2]': 'bg-tertiary-fixed',
  'text-[#6B1D3D]': 'text-tertiary',
  'bg-[#ACF4A4]': 'bg-primary-fixed',
  'text-[#002C06]': 'text-on-primary-fixed',
};

// Also replace simple hexes where they are used dynamically
const hexMap = {
  "'#E0E0E0'": "'var(--border)'",
  "'#F2F5EC'": "'var(--surface-container-high)'",
  "'#1B5E20'": "'var(--primary-container)'",
  "'#616161'": "'var(--text-secondary)'",
  "'#9E9E9E'": "'var(--text-disabled)'",
  "'#212121'": "'var(--text-primary)'",
  "'#FFFFFF'": "'var(--surface)'",
  "'#FAFAF5'": "'var(--background)'",
  "'#F5F5F0'": "'var(--background)'",
  "'#F4F4EF'": "'var(--surface-container-low)'",
  "'#006763'": "'var(--accent-teal)'",
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceColors(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // Replace class utility strings
  for (const [hex, util] of Object.entries(colorMap)) {
    // Escape brackets for regex
    const escapedHex = hex.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    const regex = new RegExp(escapedHex, 'g');
    content = content.replace(regex, util);
  }

  // Replace dynamic strings
  for (const [hex, util] of Object.entries(hexMap)) {
    const regex = new RegExp(hex, 'g');
    content = content.replace(regex, util);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Updated', filePath);
  }
}

walkDir('src/components', replaceColors);
walkDir('src/app', replaceColors);
