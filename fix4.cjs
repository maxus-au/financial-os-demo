const fs = require('fs');

let css = fs.readFileSync('dashboard/src/theme.css', 'utf8');
css = css.replace('--bg-table-row-alt: #f1f5f9;', '--bg-table-row-alt: #f1f5f9;\n  --bg-table-row-drifted: #fefce8;');
css = css.replace('--bg-table-row-alt: #fdf8e6;', '--bg-table-row-alt: #fdf8e6;\n  --bg-table-row-drifted: #fdf0ba;');
css = css.replace('--bg-table-row-alt: #f4f4f5;', '--bg-table-row-alt: #f4f4f5;\n  --bg-table-row-drifted: #f5f5f0;');
css = css.replace('--bg-table-row-alt: #27272a;', '--bg-table-row-alt: #27272a;\n  --bg-table-row-drifted: #18181b;');
fs.writeFileSync('dashboard/src/theme.css', css);

let tsx = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');
tsx = tsx.replace(/background: isDrifted \? '#fefce8' : 'transparent'/g, "background: isDrifted ? 'var(--bg-table-row-drifted)' : 'transparent'");
fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', tsx);
console.log('done');
