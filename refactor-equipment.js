import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/EquipmentTab.jsx');
let content = fs.readFileSync(file, 'utf8');

// Remove CATEGORIES constant
content = content.replace(/const CATEGORIES = \[\n(?:.*\n)*?\];\n/g, '');

// Update initial state
content = content.replace(
  /const \[form, setForm\] = useState\(\{ locationId: '', name: '', serialNumber: '', category: 'hookah', quantity: 1 \}\);/g,
  `const [form, setForm] = useState({ locationId: '', name: '', serialNumber: '', quantity: 1 });`
);

// Update addDoc to not include category
content = content.replace(
  /category: form\.category,/g,
  ``
);

// Update reset form
content = content.replace(
  /setForm\(\{ \.\.\.form, name: '', serialNumber: '', category: 'hookah', quantity: 1 \}\);/g,
  `setForm({ ...form, name: '', serialNumber: '', quantity: 1 });`
);

// Remove category from form JSX
const categoryFormRegex = /<div>\s*<label className="block text-\[10px\] font-bold text-slate-500 uppercase mb-1">Категория<\/label>\s*<select value=\{form\.category\} onChange=\{e => setForm\(\{ \.\.\.form, category: e\.target\.value \}\)\} className="input-flat">\s*\{CATEGORIES\.map\(c => <option key=\{c\.id\} value=\{c\.id\}>\{c\.icon\} \{c\.label\}<\/option>\)\}\s*<\/select>\s*<\/div>/g;
content = content.replace(categoryFormRegex, '');

// Remove category grid col class (if it was grid-cols-2 and we removed one, we should maybe make it a single column or change how quantity looks. Let's just remove the <div> wrapping the grid)
content = content.replace(/<div className="grid grid-cols-2 gap-3">\s*(<div>\s*<label className="block text-\[10px\] font-bold text-slate-500 uppercase mb-1">Кол-во<\/label>\s*<input type="number" min="1" value=\{form\.quantity\} onChange=\{e => setForm\(\{ \.\.\.form, quantity: e\.target\.value \}\)\} className="input-flat" \/>\s*<\/div>)\s*<\/div>/g, '$1');

// Remove grouping logic
const groupingRegex = /  const grouped = CATEGORIES\.map\(cat => \(\{\n    \.\.\.cat,\n    items: filteredEquipment\.filter\(e => e\.category === cat\.id\)\n  \}\)\)\.filter\(g => g\.items\.length > 0\);\n/g;
content = content.replace(groupingRegex, '');

// Update render logic
const renderOld = /          \{grouped\.map\(group => \(\n            <div key=\{group\.id\}>\n              <h3 className="text-\[10px\] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">\n                <span>\{group\.icon\}<\/span> \{group\.label\}\n              <\/h3>\n              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">\n                \{group\.items\.map\(item => \{/g;
const renderNew = `          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredEquipment.map(item => {`;
content = content.replace(renderOld, renderNew);

const renderOldEnd = /                \}\)\}\n              <\/div>\n            <\/div>\n          \)\)\}/g;
const renderNewEnd = `            })}
          </div>`;
content = content.replace(renderOldEnd, renderNewEnd);

fs.writeFileSync(file, content);
console.log('EquipmentTab.jsx updated: categories removed!');
