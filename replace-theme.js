import fs from 'fs';
import path from 'path';

const files = [
  'src/components/AdminDashboard.jsx',
  'src/components/RevisionTab.jsx',
  'src/components/EquipmentTab.jsx',
  'src/components/TobaccoTypesTab.jsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Text color adjustments for light theme
  content = content.replace(/text-slate-200/g, 'text-slate-900');
  content = content.replace(/text-slate-300/g, 'text-slate-800');
  content = content.replace(/text-slate-100/g, 'text-slate-900');
  
  // Component style replacements
  content = content.replace(/input-dark/g, 'input-flat');
  content = content.replace(/dark-card/g, 'flat-card');
  
  // Remove glow effects and heavy shadows
  content = content.replace(/glow-[a-z]+/g, '');
  content = content.replace(/shadow-lg shadow-[a-z0-9\/]+/g, 'shadow-sm');
  content = content.replace(/shadow-xl shadow-[a-z0-9\/]+/g, 'shadow-sm');

  // Adjust glass-like semi-transparent borders for light theme
  content = content.replace(/border-surface-[0-9]+\/[0-9]+/g, 'border-slate-200');
  
  // Adjust backdrop blur
  content = content.replace(/backdrop-blur-[a-z]+/g, '');
  content = content.replace(/backdrop-blur/g, '');

  fs.writeFileSync(filePath, content);
});
console.log('Successfully replaced dark theme classes with minimalist classes.');
