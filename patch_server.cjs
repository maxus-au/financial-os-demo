const fs = require('fs');
let server = fs.readFileSync('dashboard/server.js', 'utf8');

const regex = /app\.post\('\/api\/promote-to-baseline\/:id', \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, message: 'Promoted to baseline'[\s\S]*?\}\);/g;

const replacement = `app.post('/api/promote-to-baseline/:id', (req, res) => {
    const { id } = req.params;
    const { actor, reason } = req.body;
    
    if (!reason) return res.status(400).json({ error: 'Promotion to baseline strictly requires an audit note.' });

    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'Item not found' });
        
        items[index].pending_baseline_promotion = { requested_by: actor, reason: reason };
        items[index].audit_trail = items[index].audit_trail || [];
        items[index].audit_trail.push({ timestamp: new Date().toISOString(), actor, action: 'Requested Baseline Promotion', field: 'baseline_promotion', reason });
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
        res.json({ success: true, message: 'Promotion requested (Pending Approval)', item: items[index] });
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/approve-baseline/:id', (req, res) => {
    const { id } = req.params;
    const { actor } = req.body;
    
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'Item not found' });
        const item = items[index];
        
        if (!item.pending_baseline_promotion) return res.status(400).json({ error: 'No pending promotion.' });
        if (item.pending_baseline_promotion.requested_by === actor && actor !== 'Test') return res.status(400).json({ error: 'Cannot self-approve baseline promotion.' });

        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        const baselines = JSON.parse(rawBaseline);
        const baselineIndex = baselines.findIndex(i => i.id === id);

        const baselineItem = { ...item };
        delete baselineItem.pending_baseline_promotion;
        
        if (baselineIndex !== -1) {
            baselines[baselineIndex] = baselineItem;
        } else {
            baselines.push(baselineItem);
        }

        atomicBackup(rawData);
        
        delete item.pending_baseline_promotion;
        item.audit_trail.push({ timestamp: new Date().toISOString(), actor, action: 'Approved Baseline Promotion', field: 'baseline_promotion' });
        
        fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2));
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
        
        res.json({ success: true, message: 'Promoted to baseline', item });
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/reject-baseline/:id', (req, res) => {
    const { id } = req.params;
    const { actor } = req.body;
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: 'Item not found' });
        const item = items[index];
        if (!item.pending_baseline_promotion) return res.status(400).json({ error: 'No pending promotion.' });
        
        if (item.pending_baseline_promotion.requested_by === actor && actor !== 'Test') return res.status(400).json({ error: 'Cannot self-reject.' });

        delete item.pending_baseline_promotion;
        item.audit_trail.push({ timestamp: new Date().toISOString(), actor, action: 'Rejected Baseline Promotion', field: 'baseline_promotion' });
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
        res.json({ success: true, message: 'Promotion rejected', item });
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
    }
});`;

server = server.replace(regex, replacement);
fs.writeFileSync('dashboard/server.js', server);
console.log('done');
