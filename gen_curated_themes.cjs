const fs = require('fs');

const themes = [
  // Original 4
  {
    name: "sunflowers", icon: "🌻",
    bgDash: "#fdfaf2", bgCard: "#ffffff", bgHeader: "#fdfaf2", bgRow: "#ffffff", bgRowAlt: "#fdf8e6", bgDrifted: "#fdf0ba",
    txtMain: "#2b2005", txtMuted: "#705e38", accPri: "#e6a100", accSec: "#fdf8e6", border: "#e6dfc8", pos: "#536239", neg: "#b33939"
  },
  {
    name: "elegant-minimalist", icon: "✨",
    bgDash: "#fcfcfc", bgCard: "#ffffff", bgHeader: "#fafafa", bgRow: "#ffffff", bgRowAlt: "#f4f4f5", bgDrifted: "#f5f5f0",
    txtMain: "#27272a", txtMuted: "#a1a1aa", accPri: "#52525b", accSec: "#f4f4f5", border: "#e4e4e7", pos: "#4d7c5f", neg: "#9f4949"
  },
  {
    name: "elegant-monochrome", icon: "🌑",
    bgDash: "#121212", bgCard: "#1e1e1e", bgHeader: "#121212", bgRow: "#1e1e1e", bgRowAlt: "#27272a", bgDrifted: "#18181b",
    txtMain: "#ffffff", txtMuted: "#a1a1aa", accPri: "#ffffff", accSec: "#333333", border: "#333333", pos: "#ffffff", neg: "#a1a1aa"
  },
  
  // Kept from previous list
  {
    name: "rose-gold", icon: "🌸",
    bgDash: "#fff1f2", bgCard: "#fff5f5", bgHeader: "#fff5f5", bgRow: "#fff5f5", bgRowAlt: "#ffe4e6", bgDrifted: "#fecdd3",
    txtMain: "#4c1d95", txtMuted: "#be123c", accPri: "#e11d48", accSec: "#fecdd3", border: "#fda4af", pos: "#0d9488", neg: "#e11d48"
  },
  {
    name: "morning-mist", icon: "🌫️",
    bgDash: "#f1f5f9", bgCard: "#f8fafc", bgHeader: "#f8fafc", bgRow: "#f8fafc", bgRowAlt: "#e2e8f0", bgDrifted: "#cbd5e1",
    txtMain: "#334155", txtMuted: "#64748b", accPri: "#64748b", accSec: "#e2e8f0", border: "#94a3b8", pos: "#475569", neg: "#334155"
  },
  {
    name: "swiss-typography", icon: "📐",
    bgDash: "#ffffff", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#f4f4f5", bgDrifted: "#e4e4e7",
    txtMain: "#000000", txtMuted: "#71717a", accPri: "#000000", accSec: "#f4f4f5", border: "#000000", pos: "#000000", neg: "#ef4444"
  },
  {
    name: "nordic-frost", icon: "❄️",
    bgDash: "#e0f2fe", bgCard: "#ffffff", bgHeader: "#f0f9ff", bgRow: "#ffffff", bgRowAlt: "#f0f9ff", bgDrifted: "#e0f2fe",
    txtMain: "#0f172a", txtMuted: "#64748b", accPri: "#0ea5e9", accSec: "#bae6fd", border: "#bae6fd", pos: "#0284c7", neg: "#475569"
  },

  // 10 New Elegant/Soft Themes
  {
    name: "cashmere-taupe", icon: "🧶",
    bgDash: "#f5f5f4", bgCard: "#fafaf9", bgHeader: "#fafaf9", bgRow: "#fafaf9", bgRowAlt: "#f5f5f4", bgDrifted: "#e7e5e4",
    txtMain: "#44403c", txtMuted: "#78716c", accPri: "#78716c", accSec: "#e7e5e4", border: "#d6d3d1", pos: "#3f6212", neg: "#9f1239"
  },
  {
    name: "porcelain-blue", icon: "🏺",
    bgDash: "#f8fafc", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#f0f9ff", bgDrifted: "#e0f2fe",
    txtMain: "#0c4a6e", txtMuted: "#0284c7", accPri: "#0284c7", accSec: "#e0f2fe", border: "#bae6fd", pos: "#059669", neg: "#e11d48"
  },
  {
    name: "soft-sage", icon: "🌿",
    bgDash: "#f0fdf4", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#f0fdf4", bgDrifted: "#dcfce7",
    txtMain: "#14532d", txtMuted: "#166534", accPri: "#15803d", accSec: "#dcfce7", border: "#bbf7d0", pos: "#15803d", neg: "#991b1b"
  },
  {
    name: "desert-sand", icon: "🏜️",
    bgDash: "#fff7ed", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#ffedd5", bgDrifted: "#fed7aa",
    txtMain: "#431407", txtMuted: "#9a3412", accPri: "#c2410c", accSec: "#ffedd5", border: "#fed7aa", pos: "#065f46", neg: "#9f1239"
  },
  {
    name: "lavender-silk", icon: "🪻",
    bgDash: "#faf5ff", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#faf5ff", bgDrifted: "#f3e8ff",
    txtMain: "#3b0764", txtMuted: "#6b21a8", accPri: "#7e22ce", accSec: "#f3e8ff", border: "#e9d5ff", pos: "#047857", neg: "#be123c"
  },
  {
    name: "graphite-matte", icon: "✏️",
    bgDash: "#18181b", bgCard: "#27272a", bgHeader: "#27272a", bgRow: "#27272a", bgRowAlt: "#3f3f46", bgDrifted: "#18181b",
    txtMain: "#f4f4f5", txtMuted: "#a1a1aa", accPri: "#d4d4d8", accSec: "#3f3f46", border: "#52525b", pos: "#4ade80", neg: "#f87171"
  },
  {
    name: "oxford-navy", icon: "👔",
    bgDash: "#0f172a", bgCard: "#1e293b", bgHeader: "#1e293b", bgRow: "#1e293b", bgRowAlt: "#334155", bgDrifted: "#0f172a",
    txtMain: "#f8fafc", txtMuted: "#94a3b8", accPri: "#e2e8f0", accSec: "#334155", border: "#475569", pos: "#34d399", neg: "#fb7185"
  },
  {
    name: "olive-grove", icon: "🫒",
    bgDash: "#f4f5f0", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#e9ecef", bgDrifted: "#dee2e6",
    txtMain: "#2b3022", txtMuted: "#4b5320", accPri: "#4b5320", accSec: "#e9ecef", border: "#ced4da", pos: "#2b3022", neg: "#8c2f39"
  },
  {
    name: "parchment-ink", icon: "📜",
    bgDash: "#fefae0", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#faedcd", bgDrifted: "#e9edc9",
    txtMain: "#283618", txtMuted: "#606c38", accPri: "#606c38", accSec: "#faedcd", border: "#d4a373", pos: "#283618", neg: "#bc4749"
  },
  {
    name: "cloud-grey", icon: "☁️",
    bgDash: "#f8f9fa", bgCard: "#ffffff", bgHeader: "#ffffff", bgRow: "#ffffff", bgRowAlt: "#e9ecef", bgDrifted: "#dee2e6",
    txtMain: "#212529", txtMuted: "#6c757d", accPri: "#495057", accSec: "#e9ecef", border: "#ced4da", pos: "#2b8a3e", neg: "#c92a2a"
  }
];

let cssBlock = `/* Base Theme (Default Light) */
:root {
  --bg-dashboard: #f8fafc;
  --bg-card: #ffffff;
  --bg-table-header: #f8fafc;
  --bg-table-row: #ffffff;
  --bg-table-row-alt: #f1f5f9;
  --bg-table-row-drifted: #fefce8;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --accent-primary: #3b82f6;
  --accent-secondary: #eff6ff;
  --border-neutral: #e2e8f0;
  
  --positive-text: #059669;
  --negative-text: #e11d48;
}

.table-section-inflow { background: var(--bg-table-row-alt); color: var(--positive-text); border-bottom: 2px solid var(--positive-text); }
.table-section-transfer { background: var(--bg-table-row); color: var(--text-muted); border-bottom: 2px solid var(--border-neutral); }
.table-section-outflow { background: var(--bg-table-row-alt); color: var(--negative-text); border-bottom: 2px solid var(--negative-text); }
`;

let optionsBlock = `<option value="light">☀️ Base (Neutral Polished)</option>\n`;

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
  
  cssBlock += `  --background: ${t.bgDash};\n`;
  cssBlock += `  --foreground: ${t.txtMain};\n`;
  cssBlock += `  --card: ${t.bgCard};\n`;
  cssBlock += `  --card-foreground: ${t.txtMain};\n`;
  cssBlock += `  --popover: ${t.bgCard};\n`;
  cssBlock += `  --popover-foreground: ${t.txtMain};\n`;
  cssBlock += `  --primary: ${t.accPri};\n`;
  cssBlock += `  --primary-foreground: ${t.bgDash};\n`;
  cssBlock += `  --secondary: ${t.accSec};\n`;
  cssBlock += `  --secondary-foreground: ${t.txtMain};\n`;
  cssBlock += `  --muted: ${t.bgRowAlt};\n`;
  cssBlock += `  --muted-foreground: ${t.txtMuted};\n`;
  cssBlock += `  --accent: ${t.bgRowAlt};\n`;
  cssBlock += `  --accent-foreground: ${t.txtMain};\n`;
  cssBlock += `  --destructive: ${t.neg};\n`;
  cssBlock += `  --destructive-foreground: #ffffff;\n`;
  cssBlock += `  --border: ${t.border};\n`;
  cssBlock += `  --input: ${t.border};\n`;
  cssBlock += `  --ring: ${t.accPri};\n`;

  cssBlock += `}\n`;
  
  const titleCase = t.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  optionsBlock += `<option value="${t.name}">${t.icon} ${titleCase}</option>\n`;
});

fs.writeFileSync('dashboard/src/theme.css', cssBlock);

let tsx = fs.readFileSync('dashboard/src/App.tsx', 'utf8');
const replacement = `<select \n            value={currentTheme} \n            onChange={e => setCurrentTheme(e.target.value)}\n            style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neutral)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer'}}\n          >\n${optionsBlock}          </select>`;
tsx = tsx.replace(/<select[\s\S]*?<\/select>/, replacement);

fs.writeFileSync('dashboard/src/App.tsx', tsx);
console.log('generated curated themes');
