const fs = require('fs');
let code = fs.readFileSync('src/components/ItemGrid.tsx', 'utf8');
code = code.replace(/import\s*["']\.\/ItemGrid\.css["'];?\r?\n/g, '');
fs.writeFileSync('src/components/ItemGrid.tsx', code);
