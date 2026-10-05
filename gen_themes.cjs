const fs = require('fs');

const themes = [
  {
    name: "neon-syndicate",
    bgDash: "#000000", bgCard: "#09090b", bgHeader: "#09090b", bgRow: "#09090b", bgRowAlt: "#18181b", bgDrifted: "#27272a",
    txtMain: "#e0e7ff", txtMuted: "#818cf8", accPri: "#06b6d4", accSec: "#164e63", border: "#312e81",
    pos: "#10b981", neg: "#d946ef"
  },
  {
    name: "terminal-green",
    bgDash: "#000000", bgCard: "#000000", bgHeader: "#000000", bgRow: "#000000", bgRowAlt: "#052e16", bgDrifted: "#022c22",
    txtMain: "#4ade80", txtMuted: "#166534", accPri: "#22c55e", accSec: "#064e3b", border: "#14532d",
    pos: "#86efac", neg: "#4ade80" // no red in pure terminal
  },
  {
    name: "nordic-frost",
    bgDash: "#e0f2fe", bgCard: "#ffffff", bgHeader: "#f0f9ff", bgRow: "#ffffff", bgRowAlt: "#f0f9ff", bgDrifted: "#e0f2fe",
    txtMain: "#0f172a", txtMuted: "#64748b", accPri: "#0ea5e9", accSec: "#bae6fd", border: "#bae6fd",
    pos: "#0284c7", neg: "#475569"
  },
  {
    name: "solar-flare",
    bgDash: "#09090b", bgCard: "#000000", bgHeader: "#000000", bgRow: "#000000", bgRowAlt: "#18181b", bgDrifted: "#27272a",
    txtMain: "#ffffff", txtMuted: "#a1a1aa", accPri: "#f97316", accSec: "#7c2d12", border: "#ea580c",
    pos: "#fb923c", neg: "#dc2626"
  },
  {
    name: "redwood-canopy",
    bgDash: "#14532d", bgCard: "#064e3b", bgHeader: "#064e3b", bgRow: "#064e3b", bgRowAlt: "#022c22", bgDrifted: "#166534",
    txtMain: "#fef3c7", txtMuted: "#d97706", accPri: "#f59e0b", accSec: "#78350f", border: "#451a03",
    pos: "#34d399", neg: "#b45309"
  },
  {
    name: "sahara-dune",
    bgDash: "#fed7aa", bgCard: "#ffedd5", bgHeader: "#ffedd5", bgRow: "#ffedd5", bgRowAlt: "#fefce8", bgDrifted: "#fde047",
    txtMain: "#431407", txtMuted: "#9a3412", accPri: "#c2410c", accSec: "#fdba74", border: "#fdba74",
    pos: "#065f46", neg: "#991b1b"
  },
  {
    name: "coral-reef",
    bgDash: "#ccfbf1", bgCard: "#f0fdfa", bgHeader: "#f0fdfa", bgRow: "#f0fdfa", bgRowAlt: "#ccfbf1", bgDrifted: "#99f6e4",
    txtMain: "#115e59", txtMuted: "#0d9488", accPri: "#14b8a6", accSec: "#a7f3d0", border: "#5eead4",
    pos: "#047857", neg: "#f43f5e"
  },
  {
    name: "midnight-ocean",
    bgDash: "#020617", bgCard: "#0f172a", bgHeader: "#0f172a", bgRow: "#0f172a", bgRowAlt: "#1e293b", bgDrifted: "#334155",
    txtMain: "#e2e8f0", txtMuted: "#94a3b8", accPri: "#38bdf8", accSec: "#0369a1", border: "#38bdf8",
    pos: "#34d399", neg: "#f43f5e"
  },
  {
    name: "autumn-harvest",
    bgDash: "#ffedd5", bgCard: "#fff7ed", bgHeader: "#fff7ed", bgRow: "#fff7ed", bgRowAlt: "#ffedd5", bgDrifted: "#fed7aa",
    txtMain: "#4a044e", txtMuted: "#9f1239", accPri: "#e11d48", accSec: "#fecdd3", border: "#fca5a5",
    pos: "#b45309", neg: "#9f1239"
  },
  {
    name: "matcha-latte",
    bgDash: "#f0fdf4", bgCard: "#f7fee7", bgHeader: "#f7fee7", bgRow: "#f7fee7", bgRowAlt: "#ecfccb", bgDrifted: "#d9f99d",
    txtMain: "#3f6212", txtMuted: "#65a30d", accPri: "#4d7c0f", accSec: "#d9f99d", border: "#bef264",
    pos: "#15803d", neg: "#9a3412"
  },
  {
    name: "swiss-typography",
    bgDash: "#ffffff", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#f4f4f5", bgDrifted: "#e4e4e7",
    txtMain: "#000000", txtMuted: "#71717a", accPri: "#000000", accSec: "#f4f4f5", border: "#000000",
    pos: "#000000", neg: "#ef4444"
  },
  {
    name: "royal-velvet",
    bgDash: "#2e1065", bgCard: "#3b0764", bgHeader: "#3b0764", bgRow: "#3b0764", bgRowAlt: "#4c1d95", bgDrifted: "#5b21b6",
    txtMain: "#fef3c7", txtMuted: "#d8b4fe", accPri: "#fbbf24", accSec: "#7c3aed", border: "#a78bfa",
    pos: "#fde047", neg: "#f87171"
  },
  {
    name: "executive-leather",
    bgDash: "#451a03", bgCard: "#78350f", bgHeader: "#78350f", bgRow: "#78350f", bgRowAlt: "#92400e", bgDrifted: "#b45309",
    txtMain: "#fef3c7", txtMuted: "#fcd34d", accPri: "#f59e0b", accSec: "#92400e", border: "#d97706",
    pos: "#fbbf24", neg: "#f87171"
  },
  {
    name: "rose-gold",
    bgDash: "#fff1f2", bgCard: "#fff5f5", bgHeader: "#fff5f5", bgRow: "#fff5f5", bgRowAlt: "#ffe4e6", bgDrifted: "#fecdd3",
    txtMain: "#4c1d95", txtMuted: "#be123c", accPri: "#e11d48", accSec: "#fecdd3", border: "#fda4af",
    pos: "#0d9488", neg: "#e11d48"
  },
  {
    name: "synthwave-1984",
    bgDash: "#1e1b4b", bgCard: "#312e81", bgHeader: "#312e81", bgRow: "#312e81", bgRowAlt: "#3730a3", bgDrifted: "#4338ca",
    txtMain: "#fdf4ff", txtMuted: "#f0abfc", accPri: "#e879f9", accSec: "#86198f", border: "#c026d3",
    pos: "#2dd4bf", neg: "#f43f5e"
  },
  {
    name: "retro-arcade",
    bgDash: "#000000", bgCard: "#000000", bgHeader: "#000000", bgRow: "#000000", bgRowAlt: "#1c1917", bgDrifted: "#292524",
    txtMain: "#ffff00", txtMuted: "#a8a29e", accPri: "#ff0000", accSec: "#1c1917", border: "#0000ff",
    pos: "#00ff00", neg: "#ff0000"
  },
  {
    name: "sepia-blueprint",
    bgDash: "#1e3a8a", bgCard: "#1d4ed8", bgHeader: "#1d4ed8", bgRow: "#1d4ed8", bgRowAlt: "#2563eb", bgDrifted: "#3b82f6",
    txtMain: "#eff6ff", txtMuted: "#bfdbfe", accPri: "#fef08a", accSec: "#2563eb", border: "#93c5fd",
    pos: "#ffffff", neg: "#fef08a"
  },
  {
    name: "lavender-haze",
    bgDash: "#f3e8ff", bgCard: "#faf5ff", bgHeader: "#faf5ff", bgRow: "#faf5ff", bgRowAlt: "#f3e8ff", bgDrifted: "#e9d5ff",
    txtMain: "#4c1d95", txtMuted: "#7e22ce", accPri: "#a855f7", accSec: "#e9d5ff", border: "#d8b4fe",
    pos: "#059669", neg: "#db2777"
  },
  {
    name: "morning-mist",
    bgDash: "#f1f5f9", bgCard: "#f8fafc", bgHeader: "#f8fafc", bgRow: "#f8fafc", bgRowAlt: "#e2e8f0", bgDrifted: "#cbd5e1",
    txtMain: "#334155", txtMuted: "#64748b", accPri: "#64748b", accSec: "#e2e8f0", border: "#94a3b8",
    pos: "#475569", neg: "#334155"
  },
  {
    name: "arctic-midnight",
    bgDash: "#082f49", bgCard: "#0369a1", bgHeader: "#0369a1", bgRow: "#0369a1", bgRowAlt: "#0284c7", bgDrifted: "#0ea5e9",
    txtMain: "#f0f9ff", txtMuted: "#bae6fd", accPri: "#38bdf8", accSec: "#0284c7", border: "#7dd3fc",
    pos: "#34d399", neg: "#f472b6"
  }
];

let cssBlock = '';
let optionsBlock = `<option value="light">☀️ Base (Neutral Polished)</option>\n<option value="sunflowers">🌻 Sunflowers</option>\n<option value="elegant minimalist">✨ Elegant Minimalist</option>\n<option value="elegant monochrome">🌑 Elegant Monochrome</option>\n`;

themes.forEach(t => {
  cssBlock += `\n/* ${t.name} */\n[data-theme="${t.name}"] {\n`;
  cssBlock += `  --bg-dashboard: ${t.bgDash};\n`;
  cssBlock += `  --bg-card: ${t.bgCard};\n`;
  cssBlock += `  --bg-table-header: ${t.bgHeader};\n`;
  cssBlock += `  --bg-table-row: ${t.bgRow};\n`;
  cssBlock += `  --bg-table-row-alt: ${t.bgRowAlt};\n`;
  cssBlock += `  --bg-table-row-drifted: ${t.bgDrifted};\n`;
  cssBlock += `  --text-main: ${t.txtMain};\n`;
  cssBlock += `  --text-muted: ${t.txtMuted};\n`;
  cssBlock += `  --accent-primary: ${t.accPri};\n`;
  cssBlock += `  --accent-secondary: ${t.accSec};\n`;
  cssBlock += `  --border-neutral: ${t.border};\n`;
  cssBlock += `  --positive-text: ${t.pos};\n`;
  cssBlock += `  --negative-text: ${t.neg};\n`;
  cssBlock += `}\n`;
  
  const titleCase = t.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  optionsBlock += `<option value="${t.name}">🎨 ${titleCase}</option>\n`;
});

let themeCss = fs.readFileSync('dashboard/src/theme.css', 'utf8');
fs.writeFileSync('dashboard/src/theme.css', themeCss + cssBlock);

let tsx = fs.readFileSync('dashboard/src/App.tsx', 'utf8');
const startTag = '<select \n            value={currentTheme} \n            onChange={e => setCurrentTheme(e.target.value)}\n            style={{padding: \'6px 12px\', borderRadius: \'8px\', border: \'1px solid var(--border-neutral)\', background: \'var(--bg-card)\', color: \'var(--text-main)\', fontWeight: 600, cursor: \'pointer\'}}\n          >';
// Regex replace options
const replacement = `<select \n            value={currentTheme} \n            onChange={e => setCurrentTheme(e.target.value)}\n            style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neutral)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer'}}\n          >\n${optionsBlock}          </select>`;
tsx = tsx.replace(/<select[\s\S]*?<\/select>/, replacement);

fs.writeFileSync('dashboard/src/App.tsx', tsx);
console.log('generated');
