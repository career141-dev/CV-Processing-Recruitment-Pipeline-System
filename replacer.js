const fs = require('fs');
const content = fs.readFileSync('c:/Users/user/Downloads/WORK/Recruitment/career141/src/app/dashboard/jobs/new/page.tsx', 'utf-8');
const step4_script = fs.readFileSync('replace_step4.js', 'utf-8');
const step4_code = step4_script.split('`')[1];

const startMarker = '  const renderStep4 = () => {';
const startIndex = content.indexOf(startMarker);
const endMatchStr = '<div className="flex-1 w-full bg-background';
const endIndex = content.indexOf(endMatchStr);

if (startIndex !== -1 && endIndex !== -1) {
    const prefix = content.substring(0, startIndex);
    const lastBraceIndex = content.lastIndexOf('}', endIndex);
    if (lastBraceIndex !== -1 && lastBraceIndex > startIndex) {
        const suffix = content.substring(lastBraceIndex + 1);
        fs.writeFileSync('c:/Users/user/Downloads/WORK/Recruitment/career141/src/app/dashboard/jobs/new/page.tsx', prefix + step4_code + suffix);
        console.log('Successfully replaced renderStep4');
    } else {
        console.log('Failed to find closing brace');
    }
} else {
    console.log('Failed to find bounds. start:', startIndex, 'end:', endIndex);
}
