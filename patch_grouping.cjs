const fs = require('fs');

let code = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');

// 1. Add state for expanded groups
if (!code.includes('const [expandedGroups')) {
    code = code.replace(
        'const [errorMsg, setErrorMsg] = useState<string | null>(null);',
        'const [errorMsg, setErrorMsg] = useState<string | null>(null);\n    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});'
    );
}

// 2. Inject renderCategoryGroup and renderSection before the return block
const injection = `
    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    const renderCategoryGroup = (groupTitle: string, groupItems: FinancialItem[]) => {
        if (groupItems.length === 0) return null;
        const isExpanded = expandedGroups[groupTitle];
        const { emoji } = getCategoryStyle(groupTitle);
        const title = groupTitle.toLowerCase() === 'pet' ? 'Lola (Pet)' : groupTitle;

        const tWk = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).weekly, 0);
        const tFn = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).fortnightly, 0);
        const tMo = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).monthly, 0);
        const tYr = groupItems.reduce((acc, i) => acc + calculateMetrics(i.native_amount, i.cadence).annual, 0);

        return (
            <React.Fragment key={groupTitle}>
                <tr onClick={() => toggleGroup(groupTitle)} style={{cursor: 'pointer', background: 'var(--bg-table-row)', borderBottom: '1px solid var(--border-neutral)'}}>
                    <td style={{padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <span style={{color: 'var(--text-muted)', fontSize: '0.8rem', width: '16px', display: 'inline-block'}}>{isExpanded ? '▼' : '▶'}</span>
                        <span style={{fontSize: '1.2rem'}}>{emoji}</span> 
                        <span>{title}</span>
                        <span style={{marginLeft: '8px', background: 'var(--bg-table-row-alt)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', border: '1px solid var(--border-neutral)'}}>{groupItems.length} item{groupItems.length !== 1 && 's'}</span>
                    </td>
                    <td style={{color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'right', paddingRight: '1.5rem'}}>Subtotal</td>
                    <td className="derived" style={{background: 'var(--bg-table-row-alt)', fontWeight: 600}}>{formatCurrency(tWk)}</td>
                    <td className="derived" style={{background: 'var(--bg-table-row-alt)', fontWeight: 600}}>{formatCurrency(tFn)}</td>
                    <td className="derived" style={{background: 'var(--bg-table-row-alt)', fontWeight: 600}}>{formatCurrency(tMo)}</td>
                    <td className="derived" style={{background: 'var(--bg-table-row-alt)', fontWeight: 600}}>{formatCurrency(tYr)}</td>
                    <td style={{background: 'var(--bg-table-row-alt)'}} />
                </tr>
                {isExpanded && groupItems.map(renderRow)}
            </React.Fragment>
        );
    };

    const renderSection = (items: FinancialItem[], sectionTitle: string, sectionClass: string) => {
        if (items.length === 0) return null;
        const cats = [...new Set(items.map(i => i.category))];
        return (
            <React.Fragment key={sectionTitle}>
                <tr><td colSpan={7} className={sectionClass} style={{fontWeight: 700, padding: "0.75rem 1rem"}}>{sectionTitle}</td></tr>
                {cats.map(cat => renderCategoryGroup(cat, items.filter(i => i.category === cat)))}
            </React.Fragment>
        );
    };
`;

if (!code.includes('const renderCategoryGroup')) {
    code = code.replace('return (', injection + '\n    return (');
}

// 3. Replace the old render block with the new renderSection calls
const oldRenderBlockRegex = /\{inflows\.length > 0 && \([\s\S]*?\{outflows\.map\(renderRow\)\}\s*<\/>\s*\)\}/;
const newRenderBlock = `{renderSection(inflows, "Inflows (Income)", "table-section-inflow")}
                  {renderSection(transfers, "Transfers (Internal)", "table-section-transfer")}
                  {renderSection(outflows, "Outflows (Expenses)", "table-section-outflow")}`;

code = code.replace(oldRenderBlockRegex, newRenderBlock);

// 4. Also add React import if missing
if (!code.includes("import React")) {
    code = code.replace("import { useState", "import React, { useState");
}

fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', code);
console.log('done');
