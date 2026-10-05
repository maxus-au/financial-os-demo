const fs = require('fs');

let app = fs.readFileSync('dashboard/src/App.tsx', 'utf8');
const selectStart = app.indexOf('<select');
const selectEnd = app.indexOf('</select>') + 9;
const newSelect = `<select 
              value={currentTheme} 
              onChange={e => setCurrentTheme(e.target.value)}
              style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neutral)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer'}}
            >
  <option value="light">☀️ Base (Neutral Polished)</option>
  <option value="sunflowers">🌻 Sunflowers</option>
  <option value="elegant-minimalist">✨ Elegant Minimalist</option>
  <option value="elegant-monochrome">🌑 Elegant Monochrome</option>
  <option value="morning-mist">🌫️ Morning Mist</option>
  <option value="nordic-frost">❄️ Nordic Frost</option>
</select>`;

app = app.substring(0, selectStart) + newSelect + app.substring(selectEnd);
fs.writeFileSync('dashboard/src/App.tsx', app);

let grid = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');
grid = grid.replace(/↑ Promote/g, '⇧ Update Baseline');
grid = grid.replace(/Promote to baseline/g, 'Update Master Baseline');
grid = grid.replace(/Promoting to Baseline/g, 'Updating Master Baseline');
grid = grid.replace(/This will permanently overwrite the historical baseline for this item./g, 'This will permanently update the master baseline with these new figures.');
grid = grid.replace(/Confirm Promotion/g, 'Confirm Update');
fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', grid);
console.log('done');
