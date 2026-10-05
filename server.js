import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());

const DATA_FILE = path.join(__dirname, 'src', 'data', 'master.json');
const BASELINE_FILE = path.join(__dirname, 'src', 'data', 'baseline.json');
const PROPERTIES_FILE = path.join(__dirname, 'src', 'data', 'properties.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backup');

function atomicPropertiesBackup(rawData) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = Date.now();
    const backupPath = path.join(BACKUP_DIR, `properties.backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, rawData, 'utf-8');
}

// Validation rules
const ID_REGEX = /^(S|H)-\d{2}$/;
const VALID_CADENCES = ['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

function calculateAnnual(amount, cadence) {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    let weekly = 0;
    switch (cadence) {
        case 'Weekly': weekly = amount; break;
        case 'Fortnightly': weekly = amount / 2; break;
        case 'Monthly': weekly = (amount * 12) / 52; break;
        case 'Quarterly': weekly = (amount * 4) / 52; break;
        case 'Semi-Annual': weekly = (amount * 2) / 52; break;
        case 'Annual': weekly = amount / 52; break;
        default: weekly = 0;
    }
    return weekly * 52;
}

function atomicBackup(rawData) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = Date.now();
    const backupPath = path.join(BACKUP_DIR, `master.backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, rawData, 'utf-8');
}

app.get('/api/data', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const baseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        res.json({ items: JSON.parse(data), baselines: JSON.parse(baseline) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.put('/api/item/:id', (req, res) => {
    const { id } = req.params;
    const { actor, edit_reason, ...updatedItem } = req.body;

    if (!updatedItem.id || !ID_REGEX.test(updatedItem.id)) return res.status(400).json({ error: 'Invalid ID format' });
    if (!VALID_CADENCES.includes(updatedItem.cadence)) return res.status(400).json({ error: 'Invalid cadence' });
    if (typeof updatedItem.native_amount !== 'number' || isNaN(updatedItem.native_amount)) return res.status(400).json({ error: 'Native amount must be a number' });

    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'Item not found' });

        const originalItem = items[index];
        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        const baselines = JSON.parse(rawBaseline);
        const baselineItem = baselines.find(i => i.id === id) || originalItem;

        // Anomaly Check (Normalized Annual)
        const baselineAnnual = calculateAnnual(baselineItem.native_amount, baselineItem.cadence);
        const newAnnual = calculateAnnual(updatedItem.native_amount, updatedItem.cadence);
        const annualDelta = Math.abs(newAnnual - baselineAnnual);
        
        let percentChange = 0;
        if (baselineAnnual === 0) {
            percentChange = annualDelta > 0 ? 100 : 0;
        } else {
            percentChange = (annualDelta / baselineAnnual) * 100;
        }

        const isAnomaly = percentChange >= 15 && annualDelta >= 120;

        if (isAnomaly && (!edit_reason || edit_reason.trim() === '')) {
            return res.status(400).json({ 
                error: `Anomaly detected (${percentChange.toFixed(1)}% variance, $${annualDelta.toFixed(2)}/yr delta). An audit note is strictly required.` 
            });
        }

        // Batch changes into a single atomic audit entry
        const changes = [];
        const checkField = (field, label) => {
            if (originalItem[field] !== updatedItem[field]) {
                changes.push({
                    field: field,
                    label: label || field,
                    from: originalItem[field] === undefined ? 'None' : originalItem[field],
                    to: updatedItem[field] === undefined ? 'None' : updatedItem[field]
                });
            }
        };

        checkField('category', 'Category');
        checkField('verification_status', 'Status');
        checkField('account_route', 'Route');
        checkField('description', 'Description');
        checkField('notes', 'Notes');
        checkField('source_authority', 'Source Authority');
        checkField('direction', 'Direction');
        checkField('due_month', 'Due Month');
        checkField('due_day', 'Due Day');
        checkField('deduction_day', 'Deduction Day');

        const amountChanged = Number(originalItem.native_amount) !== Number(updatedItem.native_amount) || originalItem.cadence !== updatedItem.cadence;
        if (amountChanged) {
            changes.push({
                field: 'amount/cadence',
                label: 'Amount & Cadence',
                from_amount: originalItem.native_amount,
                from_cadence: originalItem.cadence,
                to_amount: updatedItem.native_amount,
                to_cadence: updatedItem.cadence
            });
        }

        let auditTrail = [...(originalItem.audit_trail || [])];

        if (changes.length > 0) {
            let summaryReason = edit_reason;
            if (!summaryReason || summaryReason.startsWith('Inline update:')) {
                if (changes.length === 1) {
                    if (amountChanged) {
                        summaryReason = `Changed amount: $${originalItem.native_amount} (${originalItem.cadence}) ➔ $${updatedItem.native_amount} (${updatedItem.cadence})`;
                    } else {
                        summaryReason = `Changed ${changes[0].label}: "${changes[0].from}" ➔ "${changes[0].to}"`;
                    }
                } else {
                    summaryReason = `Updated ${changes.length} fields (${changes.map(c => c.label).join(', ')})`;
                }
            }

            auditTrail.push({
                timestamp: new Date().toISOString(),
                actor: actor || 'System',
                field: changes.length === 1 ? changes[0].field : 'batch_update',
                changes: changes,
                from_amount: amountChanged ? originalItem.native_amount : undefined,
                to_amount: amountChanged ? updatedItem.native_amount : undefined,
                from: changes.length === 1 && !amountChanged ? changes[0].from : undefined,
                to: changes.length === 1 && !amountChanged ? changes[0].to : undefined,
                reason: summaryReason
            });
        } else if (edit_reason && !edit_reason.startsWith('Inline update')) {
            auditTrail.push({
                timestamp: new Date().toISOString(),
                actor: actor || 'System',
                field: 'general_audit',
                reason: edit_reason
            });
        }

        // Enforce 15-revision storage cap per item
        if (auditTrail.length > 15) {
            auditTrail = auditTrail.slice(auditTrail.length - 15);
        }

        items[index] = { ...originalItem, ...updatedItem, audit_trail: auditTrail };

        atomicBackup(rawData);
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        res.json({ success: true, items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

app.post('/api/promote-to-baseline/:id', (req, res) => {
    const { id } = req.params;
    const { actor, reason } = req.body;
    
    if (!reason) return res.status(400).json({ error: 'Promotion to baseline strictly requires an audit note.' });

    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const item = items.find(i => i.id === id);
        
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        const baselines = JSON.parse(rawBaseline);
        const baselineIndex = baselines.findIndex(i => i.id === id);

        if (baselineIndex !== -1) {
            baselines[baselineIndex] = { ...item };
        } else {
            baselines.push({ ...item });
        }

        atomicBackup(rawData);
        
        const index = items.findIndex(i => i.id === id);
        const auditTrail = items[index].audit_trail || [];
        auditTrail.push({
            timestamp: new Date().toISOString(),
            actor: actor || 'System',
            field: 'baseline_promotion',
            reason: reason
        });
        items[index].audit_trail = auditTrail;

        fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2), 'utf-8');
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        res.json({ success: true, items, baselines });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to promote' });
    }
});

app.post('/api/revert/:id', (req, res) => {
    const { id } = req.params;
    const { actor } = req.body;

    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'Item not found' });

        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        const baselines = JSON.parse(rawBaseline);
        const baselineItem = baselines.find(i => i.id === id);

        if (!baselineItem) return res.status(404).json({ error: 'Baseline not found' });

        atomicBackup(rawData);

        const currentItem = items[index];
        const diffs = [];

        const checkRevertField = (field, label) => {
            if (currentItem[field] !== baselineItem[field]) {
                diffs.push({
                    field: field,
                    label: label || field,
                    from: currentItem[field] === undefined ? 'None' : currentItem[field],
                    to: baselineItem[field] === undefined ? 'None' : baselineItem[field]
                });
            }
        };

        checkRevertField('category', 'Category');
        checkRevertField('verification_status', 'Status');
        checkRevertField('account_route', 'Route');
        checkRevertField('description', 'Description');
        checkRevertField('notes', 'Notes');
        checkRevertField('source_authority', 'Source Authority');
        checkRevertField('direction', 'Direction');

        const amountDiff = Number(currentItem.native_amount) !== Number(baselineItem.native_amount) || currentItem.cadence !== baselineItem.cadence;
        if (amountDiff) {
            diffs.push({
                field: 'native_amount',
                label: 'Amount & Cadence',
                from: `$${currentItem.native_amount} (${currentItem.cadence})`,
                to: `$${baselineItem.native_amount} (${baselineItem.cadence})`,
                from_amount: currentItem.native_amount,
                to_amount: baselineItem.native_amount
            });
        }

        if (diffs.length === 0) {
            return res.json({ success: true, items, message: 'Already aligned with baseline' });
        }

        let auditTrail = [...(currentItem.audit_trail || [])];

        let revertReason = '';
        if (diffs.length === 1) {
            revertReason = `Reverted ${diffs[0].label} to baseline: ${diffs[0].from} ➔ ${diffs[0].to}`;
        } else {
            revertReason = `Reverted ${diffs.length} fields to baseline: ${diffs.map(d => `${d.label} (${d.from} ➔ ${d.to})`).join(', ')}`;
        }

        auditTrail.push({
            timestamp: new Date().toISOString(),
            actor: actor || 'System',
            action: 'revert',
            field: 'revert_to_baseline',
            changes: diffs,
            reverted_to: {
                native_amount: baselineItem.native_amount,
                cadence: baselineItem.cadence,
                verification_status: baselineItem.verification_status,
                account_route: baselineItem.account_route,
                category: baselineItem.category
            },
            from_amount: amountDiff ? currentItem.native_amount : undefined,
            to_amount: amountDiff ? baselineItem.native_amount : undefined,
            reason: revertReason
        });

        // Enforce 15-revision storage cap per item
        if (auditTrail.length > 15) {
            auditTrail = auditTrail.slice(auditTrail.length - 15);
        }

        items[index] = { ...baselineItem, audit_trail: auditTrail };
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        res.json({ success: true, items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to revert' });
    }
});

// Delete a single audit log entry
app.delete('/api/item/:id/audit/:logIndex', (req, res) => {
    const { id, logIndex } = req.params;
    const idx = parseInt(logIndex, 10);
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const item = items.find(i => i.id === id);

        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (!item.audit_trail || isNaN(idx) || idx < 0 || idx >= item.audit_trail.length) {
            return res.status(400).json({ error: 'Invalid audit log index' });
        }

        atomicBackup(rawData);
        item.audit_trail.splice(idx, 1);
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        res.json({ success: true, items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete audit log entry' });
    }
});

// Clear all audit logs for an item (test cleanup)
app.delete('/api/item/:id/audit', (req, res) => {
    const { id } = req.params;
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        const item = items.find(i => i.id === id);

        if (!item) return res.status(404).json({ error: 'Item not found' });

        atomicBackup(rawData);
        item.audit_trail = [];
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        res.json({ success: true, items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to clear audit trail' });
    }
});

app.post('/api/item', (req, res) => {
    const { actor, ...newItem } = req.body;
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const items = JSON.parse(rawData);
        
        // Generate new ID based on owner
        const prefix = newItem.owner === 'Stephen' ? 'S' : 'H';
        const existingIds = items.filter(i => i.id.startsWith(prefix)).map(i => parseInt(i.id.split('-')[1])).filter(n => !isNaN(n));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newIdNumber = (maxId + 1).toString().padStart(2, '0');
        newItem.id = `${prefix}-${newIdNumber}`;
        newItem.audit_trail = [{
            timestamp: new Date().toISOString(),
            actor: actor || 'System',
            field: 'creation',
            reason: 'Item created'
        }];

        atomicBackup(rawData);
        items.push(newItem);
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        // Add to baselines so it doesn't instantly show as drifted from nowhere
        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        const baselines = JSON.parse(rawBaseline);
        baselines.push(newItem);
        fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2), 'utf-8');

        res.json({ success: true, items, baselines });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

app.delete('/api/item/:id', (req, res) => {
    const { id } = req.params;
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        let items = JSON.parse(rawData);
        const index = items.findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: 'Item not found' });
        atomicBackup(rawData);
        items.splice(index, 1);
        fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');

        // Also clean up from baseline.json so no orphaned baselines remain
        const rawBaseline = fs.readFileSync(BASELINE_FILE, 'utf-8');
        let baselines = JSON.parse(rawBaseline);
        const bIndex = baselines.findIndex(b => b.id === id);
        if (bIndex !== -1) {
            baselines.splice(bIndex, 1);
            fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2), 'utf-8');
        }

        res.json({ success: true, items, baselines });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// ==========================================
// PROSPECTIVE PROPERTY TRIAGE VAULT ENDPOINTS
// ==========================================

app.get('/api/properties', (req, res) => {
    try {
        if (!fs.existsSync(PROPERTIES_FILE)) {
            fs.writeFileSync(PROPERTIES_FILE, '[]', 'utf-8');
        }
        const data = fs.readFileSync(PROPERTIES_FILE, 'utf-8');
        res.json({ properties: JSON.parse(data) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read properties' });
    }
});

app.post('/api/properties', (req, res) => {
    try {
        if (!fs.existsSync(PROPERTIES_FILE)) {
            fs.writeFileSync(PROPERTIES_FILE, '[]', 'utf-8');
        }
        const rawData = fs.readFileSync(PROPERTIES_FILE, 'utf-8');
        let properties = JSON.parse(rawData);
        const newProperty = req.body;

        if (!newProperty.address || typeof newProperty.address !== 'string' || !newProperty.address.trim()) {
            return res.status(400).json({ error: 'Property address or headline is required' });
        }
        if (typeof newProperty.guide_price !== 'number' || isNaN(newProperty.guide_price) || newProperty.guide_price <= 0) {
            return res.status(400).json({ error: 'Guide price must be a positive number' });
        }

        const existingIds = properties
            .filter(p => p.id && p.id.startsWith('PROP-'))
            .map(p => parseInt(p.id.split('-')[1]))
            .filter(n => !isNaN(n));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newIdNumber = (maxId + 1).toString().padStart(2, '0');
        newProperty.id = `PROP-${newIdNumber}`;
        newProperty.created_at = new Date().toISOString();
        newProperty.updated_at = new Date().toISOString();
        newProperty.status = newProperty.status || 'Watching';
        newProperty.rating_stephen = typeof newProperty.rating_stephen === 'number' ? newProperty.rating_stephen : 0;
        newProperty.rating_shae = typeof newProperty.rating_shae === 'number' ? newProperty.rating_shae : 0;

        atomicPropertiesBackup(rawData);
        properties.unshift(newProperty); // Newest first
        fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2), 'utf-8');

        res.json({ success: true, properties, property: newProperty });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create property entry' });
    }
});

app.put('/api/properties/:id', (req, res) => {
    const { id } = req.params;
    try {
        if (!fs.existsSync(PROPERTIES_FILE)) {
            return res.status(404).json({ error: 'Properties file not found' });
        }
        const rawData = fs.readFileSync(PROPERTIES_FILE, 'utf-8');
        let properties = JSON.parse(rawData);
        const index = properties.findIndex(p => p.id === id);
        if (index === -1) return res.status(404).json({ error: 'Property not found' });

        const updated = {
            ...properties[index],
            ...req.body,
            id, // preserve immutable ID
            updated_at: new Date().toISOString()
        };

        atomicPropertiesBackup(rawData);
        properties[index] = updated;
        fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2), 'utf-8');

        res.json({ success: true, properties, property: updated });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update property' });
    }
});

app.delete('/api/properties/:id', (req, res) => {
    const { id } = req.params;
    try {
        if (!fs.existsSync(PROPERTIES_FILE)) {
            return res.status(404).json({ error: 'Properties file not found' });
        }
        const rawData = fs.readFileSync(PROPERTIES_FILE, 'utf-8');
        let properties = JSON.parse(rawData);
        const index = properties.findIndex(p => p.id === id);
        if (index === -1) return res.status(404).json({ error: 'Property not found' });

        atomicPropertiesBackup(rawData);
        properties.splice(index, 1);
        fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2), 'utf-8');

        res.json({ success: true, properties });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete property' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend CRUD server running on port ${PORT}`);
});
