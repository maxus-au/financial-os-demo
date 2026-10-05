const fs = require('fs');

let app = fs.readFileSync('dashboard/src/App.tsx', 'utf8');

const insertion = `
  const handleApproveBaseline = async (id: string) => {
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
`;

if (!app.includes('handleRejectBaseline = async')) {
    app = app.replace('const handlePromote = async (id: string, reason: string) => {', insertion + '\n  const handlePromote = async (id: string, reason: string) => {');
    fs.writeFileSync('dashboard/src/App.tsx', app);
    console.log('injected functions');
} else {
    console.log('already injected');
}
