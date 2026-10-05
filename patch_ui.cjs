const fs = require('fs');

let itemGrid = fs.readFileSync('dashboard/src/components/ItemGrid.tsx', 'utf8');

const targetRow = `<tr key={item.id} style={{background: isDrifted ? 'var(--bg-table-row-drifted)' : 'transparent'}}>`;
const replacementRow = `<tr key={item.id} style={{background: item.pending_baseline_promotion ? 'var(--bg-table-row-alt)' : isDrifted ? 'var(--bg-table-row-drifted)' : 'transparent', borderLeft: item.pending_baseline_promotion ? '4px solid var(--accent-primary)' : 'none'}}>`;
itemGrid = itemGrid.replace(targetRow, replacementRow);

const targetTitle = `<strong style={{color: 'var(--text-main)'}}>{item.description}</strong>`;
const replacementTitle = `<strong style={{color: 'var(--text-main)'}}>{item.description}</strong>
                            {item.pending_baseline_promotion && (
                                <div style={{display: 'inline-block', marginLeft: '12px', background: 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600}}>
                                    Pending Approval ({item.pending_baseline_promotion.requested_by})
                                </div>
                            )}`;
itemGrid = itemGrid.replace(targetTitle, replacementTitle);

const targetAction = `<button className="action-btn" onClick={() => { setPromoteId(promoteId === item.id ? null : item.id); setConfirmRevertId(null); setHistoryId(null); }} title="Promote to baseline" style={{fontSize: '0.75rem', padding: '4px 8px'}}>↑ Promote</button>`;
const replacementAction = `{item.pending_baseline_promotion ? (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                {sessionActor !== item.pending_baseline_promotion.requested_by && sessionActor !== 'Test' ? (
                                    <>
                                        <button onClick={() => onApproveBaseline(item.id)} style={{background: 'var(--positive-text)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'}}>Approve</button>
                                        <button onClick={() => onRejectBaseline(item.id)} style={{background: 'var(--negative-text)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'}}>Reject</button>
                                    </>
                                ) : (
                                    <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600}}>Awaiting Approval</span>
                                )}
                            </div>
                        ) : (
                            <button className="action-btn" onClick={() => { setPromoteId(promoteId === item.id ? null : item.id); setConfirmRevertId(null); setHistoryId(null); }} title="Promote to baseline" style={{fontSize: '0.75rem', padding: '4px 8px'}}>↑ Promote</button>
                        )}`;
itemGrid = itemGrid.replace(targetAction, replacementAction);

fs.writeFileSync('dashboard/src/components/ItemGrid.tsx', itemGrid);
console.log('done');
