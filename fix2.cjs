const fs = require('fs');
let lines = fs.readFileSync('dashboard/src/App.tsx', 'utf8').split('\n');

const replacement = `<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <select 
            value={currentTheme} 
            onChange={e => setCurrentTheme(e.target.value)}
            style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neutral)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer'}}
          >
              <option value="light">☀️ Default Theme</option>
              <option value="sunflowers">🌻 Sunflowers</option>
              <option value="elegant minimalist">✨ Elegant Minimalist</option>
              <option value="elegant monochrome">🌑 Elegant Monochrome</option>
          </select>

          <div style={{display: 'flex', gap: '1rem'}}>
              <button 
                onClick={() => setIsLocked(!isLocked)}
                style={{
                    background: isLocked ? 'var(--border-neutral)' : '#fee2e2', 
                    color: isLocked ? 'var(--text-muted)' : '#991b1b',
                    border: \`1px solid \${isLocked ? 'var(--border-neutral)' : '#f87171'}\`,
                    padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                  {isLocked ? '🔒 Engine Locked (Read-Only)' : '🔓 Edit Mode Active'}
              </button>
              <div className="session-info" style={{marginBottom: 0}}>
                  <span>Editing As: <strong>{sessionActor}</strong></span>
                  <button className="switch-btn" onClick={() => setSessionActor(null)}>Switch User</button>
              </div>
          </div>
      </div>`;

lines.splice(145, 16, replacement);
fs.writeFileSync('dashboard/src/App.tsx', lines.join('\n'));
console.log('Success');
