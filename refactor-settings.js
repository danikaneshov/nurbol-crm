import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/AdminDashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add Margin State
content = content.replace(
  /const \[newLocName, setNewLocName\] = useState\(''\);\n  const \[newLocAddress, setNewLocAddress\] = useState\(''\);/g,
  `const [newLocName, setNewLocName] = useState('');\n  const [newLocAddress, setNewLocAddress] = useState('');\n  const [newLocMargin, setNewLocMargin] = useState(50);`
);

// 2. Add margin to addDoc inside handleAddLocation
content = content.replace(
  /name: newLocName,\n        address: newLocAddress,/g,
  `name: newLocName,\n        address: newLocAddress,\n        margin: newLocMargin,`
);
content = content.replace(
  /setNewLocName\(''\); setNewLocAddress\(''\);/g,
  `setNewLocName(''); setNewLocAddress(''); setNewLocMargin(50);`
);

// 3. Move Standards Pill
content = content.replace(
  /: subTab === 'standards' \? 'Стандарты' : 'Склад',/g,
  `: 'Склад',`
);
content = content.replace(
  /<button onClick=\{\(\) => setSubTab\('standards'\)\} className=\{`pill-tab \$\{subTab === 'standards' \? 'pill-tab-active' : 'pill-tab-inactive'\}`\}>Стандарты<\/button>\n/g,
  ''
);

// Add Standards to Settings Pills
content = content.replace(
  /<button onClick=\{\(\) => setSubTab\('margins'\)\} className=\{`pill-tab \$\{subTab === 'margins' \? 'pill-tab-active' : 'pill-tab-inactive'\}`\}>Маржинальность<\/button>/g,
  `<button onClick={() => setSubTab('standards')} className={\`pill-tab \${subTab === 'standards' ? 'pill-tab-active' : 'pill-tab-inactive'}\`}>Стандарты</button>\n                <button onClick={() => setSubTab('margins')} className={\`pill-tab \${subTab === 'margins' ? 'pill-tab-active' : 'pill-tab-inactive'}\`}>Маржинальность</button>`
);

// 4. Move Standards UI block
const standardsBlock = `              {subTab === 'standards' && (
                <div className="max-w-xl space-y-4">
                  <h1 className="text-xl font-bold text-slate-900">Стандарты расхода</h1>
                  <div className="stat-card p-6">
                    <p className="text-slate-500 mb-4 text-xs">Укажи сколько ресурсов уходит на 1 чашу.</p>
                    <div className="space-y-4">
                      <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">🔥 Углей на 1 чашу (шт)</label><input type="number" min="1" value={invStandards.coalPerBowl} onChange={e => setInvStandards({...invStandards, coalPerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">🍃 Табака на 1 чашу (г)</label><input type="number" min="1" value={invStandards.tobaccoPerBowl} onChange={e => setInvStandards({...invStandards, tobaccoPerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">💠 Мундштуков на 1 чашу (шт)</label><input type="number" min="0" value={invStandards.mouthpiecePerBowl} onChange={e => setInvStandards({...invStandards, mouthpiecePerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <button onClick={handleSaveStandards} disabled={isSavingInv} className="w-full p-3 bg-primary text-white rounded-xl font-bold shadow-sm disabled:opacity-40 text-sm">{isSavingInv ? 'Сохранение...' : 'Сохранить стандарты'}</button>
                    </div>
                  </div>
                </div>
              )}`;

// Remove from Inventory
content = content.replace(standardsBlock, '');

// Append to Settings (after locations subTab)
const locationsSubTabRegex = /\{subTab === 'margins' && \([\s\S]*?\)\}/;
content = content.replace(locationsSubTabRegex, match => `${standardsBlock}\n\n              ${match}`);


// 5. Add Margin input to Location Creation
const locCreationRegex = /<div><label className="block text-\[9px\] font-bold text-slate-500 uppercase mb-0\.5">Адрес<\/label><input type="text" value=\{newLocAddress\} onChange=\{e=>setNewLocAddress\(e\.target\.value\)\} placeholder="Напр\. ул\. Абая, 12" className="input-flat" \/><\/div>/;
content = content.replace(locCreationRegex, match => `${match}\n                  <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Маржа (%)</label><input type="number" min="0" max="100" value={newLocMargin} onChange={e=>setNewLocMargin(Number(e.target.value))} placeholder="%" className="input-flat" required /></div>`);

// 6. Update Location display and edit form
content = content.replace(
  /setEditLocForm\(\{ name: loc\.name \|\| '', address: loc\.address \|\| '' \}\);/g,
  `setEditLocForm({ name: loc.name || '', address: loc.address || '', margin: loc.margin || 50 });`
);

const editLocRegex = /<div><label className="block text-\[9px\] font-bold text-slate-500 uppercase mb-0\.5">Адрес<\/label><input type="text" value=\{editLocForm\.address\} onChange=\{e=>setEditLocForm\(\{\.\.\.editLocForm, address: e\.target\.value\}\)\} className="input-flat text-sm p-2\.5" \/><\/div>/g;
content = content.replace(editLocRegex, match => `${match}\n                          <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Маржа (%)</label><input type="number" min="0" max="100" value={editLocForm.margin} onChange={e=>setEditLocForm({...editLocForm, margin: Number(e.target.value)})} className="input-flat text-sm p-2.5" /></div>`);

content = content.replace(
  /<p className="text-xs font-medium text-slate-500 mt-0\.5">\{loc\.address \|\| 'Адрес не указан'\}<\/p>/g,
  `<p className="text-xs font-medium text-slate-500 mt-0.5">{loc.address || 'Адрес не указан'} • {loc.margin || 50}% маржа</p>`
);

fs.writeFileSync(file, content);
console.log('AdminDashboard.jsx settings restructured successfully!');
