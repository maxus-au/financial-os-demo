const fs = require('fs');

let css = fs.readFileSync('dashboard/src/theme.css', 'utf8');
css += `
.table-section-inflow { background: var(--bg-table-row-alt); color: var(--positive-text); border-bottom: 2px solid var(--positive-text); }
.table-section-transfer { background: var(--bg-table-row); color: var(--text-muted); border-bottom: 2px solid var(--border-neutral); }
.table-section-outflow { background: var(--bg-table-row-alt); color: var(--negative-text); border-bottom: 2px solid var(--negative-text); }
`;
fs.writeFileSync('dashboard/src/theme.css', css);

let code = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');

code = code.replace(/<tr><td colSpan=\{7\} style=\{\{background: '#f0fdf4'.*?>Inflows \(Income\)<\/td><\/tr>/g, '<tr><td colSpan={7} className="table-section-inflow" style={{fontWeight: 700, padding: "0.75rem 1rem"}}>Inflows (Income)</td></tr>');
code = code.replace(/<tr><td colSpan=\{7\} style=\{\{background: '#f8fafc'.*?>Transfers \(Internal\)<\/td><\/tr>/g, '<tr><td colSpan={7} className="table-section-transfer" style={{fontWeight: 700, padding: "0.75rem 1rem"}}>Transfers (Internal)</td></tr>');
code = code.replace(/<tr><td colSpan=\{7\} style=\{\{background: '#fff1f2'.*?>Outflows \(Expenses\)<\/td><\/tr>/g, '<tr><td colSpan={7} className="table-section-outflow" style={{fontWeight: 700, padding: "0.75rem 1rem"}}>Outflows (Expenses)</td></tr>');

code = code.replace(/background: '#f8fafc'/g, "background: 'var(--bg-table-header)'");
code = code.replace(/background: 'white'/g, "background: 'var(--bg-card)'");
code = code.replace(/color: '#1e293b'/g, "color: 'var(--text-main)'");
code = code.replace(/color: '#0f172a'/g, "color: 'var(--text-main)'");
code = code.replace(/color: '#475569'/g, "color: 'var(--text-muted)'");
code = code.replace(/color: '#64748b'/g, "color: 'var(--text-muted)'");
code = code.replace(/color: '#334155'/g, "color: 'var(--text-muted)'");
code = code.replace(/borderBottom: '1px solid #e2e8f0'/g, "borderBottom: '1px solid var(--border-neutral)'");
code = code.replace(/borderTop: '1px solid #e2e8f0'/g, "borderTop: '1px solid var(--border-neutral)'");
code = code.replace(/border: '1px solid #e2e8f0'/g, "border: '1px solid var(--border-neutral)'");
code = code.replace(/borderColor: '#bfdbfe'/g, "borderColor: 'var(--accent-secondary)'");
code = code.replace(/color: '#059669'/g, "color: 'var(--positive-text)'");
code = code.replace(/color: '#e11d48'/g, "color: 'var(--negative-text)'");
code = code.replace(/color: '#065f46'/g, "color: 'var(--positive-text)'");
code = code.replace(/color: '#047857'/g, "color: 'var(--positive-text)'");

fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', code);
console.log('Done');
