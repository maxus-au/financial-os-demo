const fs = require('fs');

let types = fs.readFileSync('dashboard/src/types.ts', 'utf8');
if (!types.includes('pending_baseline_promotion')) {
    types = types.replace('notes: string;\n}', 'notes: string;\n  pending_baseline_promotion?: { requested_by: string; reason: string; };\n}');
    fs.writeFileSync('dashboard/src/types.ts', types);
}

let app = fs.readFileSync('dashboard/src/App.tsx', 'utf8');

const handlers = `const handleApproveBaseline = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    try {
      const res = await fetch(\`/api/approve-baseline/\${id}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  const handleRejectBaseline = async (id: string) => {
    if (!sessionActor) return { success: false, error: 'Unauthorized.' };
    try {
      const res = await fetch(\`/api/reject-baseline/\${id}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: sessionActor })
      });
      if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.error };
      }
      loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  const handlePromote = async`;

if (!app.includes('handleApproveBaseline')) {
    app = app.replace('const handlePromote = async', handlers);
    app = app.replace('onPromote={handlePromote}', 'onPromote={handlePromote} onApproveBaseline={handleApproveBaseline} onRejectBaseline={handleRejectBaseline}');
    fs.writeFileSync('dashboard/src/App.tsx', app);
}

let itemGrid = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');

if (!itemGrid.includes('onApproveBaseline')) {
    itemGrid = itemGrid.replace(
        'onPromote: (id: string, reason: string) => Promise<{success: boolean, error?: string}>;',
        'onPromote: (id: string, reason: string) => Promise<{success: boolean, error?: string}>;\n  onApproveBaseline: (id: string) => Promise<{success: boolean, error?: string}>;\n  onRejectBaseline: (id: string) => Promise<{success: boolean, error?: string}>;'
    );
    itemGrid = itemGrid.replace(
        'onPromote,',
        'onPromote, onApproveBaseline, onRejectBaseline,'
    );
}

fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', itemGrid);
console.log('done');
