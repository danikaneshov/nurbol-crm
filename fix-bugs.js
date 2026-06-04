import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/AdminDashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

// ============================================
// 1. FIX DEBUG SHIFT 
// ============================================

// State
content = content.replace(
  /const \[debugShift, setDebugShift\] = useState\(\{\n    dateStr: '',\n    employeeId: '',\n    partnerId: '',\n    hookahs: 0,\n    replacements: 0\n  \}\);/g,
  `const [debugShift, setDebugShift] = useState({\n    dateStr: '',\n    locationId: '',\n    employeeId: '',\n    partnerId: '',\n    hookahs: 0,\n    replacements: 0\n  });`
);

// Validation
content = content.replace(
  /if \(!debugShift\.employeeId \|\| !debugShift\.dateStr\) return alert\('Выберите мастера и дату'\);/g,
  `if (!debugShift.employeeId || !debugShift.dateStr || !debugShift.locationId) return alert('Выберите заведение, мастера и дату');`
);

// AddDoc injections
content = content.replace(
  /await addDoc\(collection\(db, 'sales'\), \{/g,
  `await addDoc(collection(db, 'sales'), {\n          locationId: debugShift.locationId, locationName: locations.find(l => l.id === debugShift.locationId)?.name || 'Неизвестно',`
);

// Reset form
content = content.replace(
  /setDebugShift\(\{ \.\.\.debugShift, hookahs: 0, replacements: 0, partnerId: '' \}\);/g,
  `setDebugShift({ ...debugShift, hookahs: 0, replacements: 0, partnerId: '', locationId: '' });`
);

// Form JSX
content = content.replace(
  /<div><label className="block text-\[10px\] font-bold text-slate-500 uppercase mb-1">Мастер<\/label>/g,
  `<div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Заведение</label><select value={debugShift.locationId || ''} onChange={e=>setDebugShift({...debugShift, locationId: e.target.value})} className="input-flat" required><option value="">Выберите точку</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>\n                  <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Мастер</label>`
);


// ============================================
// 2. FIX LOCATION MARGINS
// ============================================

// Update State
content = content.replace(
  /const \[newLocMargin, setNewLocMargin\] = useState\(50\);/g,
  `const [newLocProfitHookah, setNewLocProfitHookah] = useState('');\n  const [newLocProfitReplacement, setNewLocProfitReplacement] = useState('');`
);

// Update AddLocation logic
content = content.replace(
  /margin: newLocMargin,/g,
  `profitHookah: Number(newLocProfitHookah) || ownerProfits.hookah,\n        profitReplacement: Number(newLocProfitReplacement) || ownerProfits.replacement,`
);
content = content.replace(
  /setNewLocMargin\(50\);/g,
  `setNewLocProfitHookah(''); setNewLocProfitReplacement('');`
);

// Location Add Form
content = content.replace(
  /<div><label className="block text-\[9px\] font-bold text-slate-500 uppercase mb-0\.5">Маржа \(\%\)<\/label><input type="number" min="0" max="100" value=\{newLocMargin\} onChange=\{e=>setNewLocMargin\(Number\(e\.target\.value\)\)\} placeholder="%" className="input-flat" required \/><\/div>/g,
  `<div className="grid grid-cols-2 gap-2"><div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Прибыль: Кальян</label><input type="number" min="0" value={newLocProfitHookah} onChange={e=>setNewLocProfitHookah(e.target.value)} placeholder="В тенге" className="input-flat" /></div><div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Прибыль: Замена</label><input type="number" min="0" value={newLocProfitReplacement} onChange={e=>setNewLocProfitReplacement(e.target.value)} placeholder="В тенге" className="input-flat" /></div></div>`
);

// Location Edit Form State
content = content.replace(
  /setEditLocForm\(\{ name: loc\.name \|\| '', address: loc\.address \|\| '', margin: loc\.margin \|\| 50 \}\);/g,
  `setEditLocForm({ name: loc.name || '', address: loc.address || '', profitHookah: loc.profitHookah || '', profitReplacement: loc.profitReplacement || '' });`
);

// Location Edit Form JSX
content = content.replace(
  /<div><label className="block text-\[9px\] font-bold text-slate-500 uppercase mb-0\.5">Маржа \(\%\)<\/label><input type="number" min="0" max="100" value=\{editLocForm\.margin\} onChange=\{e=>setEditLocForm\(\{\.\.\.editLocForm, margin: Number\(e\.target\.value\)\}\)\} className="input-flat text-sm p-2\.5" \/><\/div>/g,
  `<div className="grid grid-cols-2 gap-2"><div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Прибыль: Кальян (₸)</label><input type="number" min="0" value={editLocForm.profitHookah} onChange={e=>setEditLocForm({...editLocForm, profitHookah: Number(e.target.value)})} className="input-flat text-sm p-2.5" /></div><div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Прибыль: Замена (₸)</label><input type="number" min="0" value={editLocForm.profitReplacement} onChange={e=>setEditLocForm({...editLocForm, profitReplacement: Number(e.target.value)})} className="input-flat text-sm p-2.5" /></div></div>`
);

// Display
content = content.replace(
  /\{loc\.address \|\| 'Адрес не указан'\} • \{loc\.margin \|\| 50\}% маржа/g,
  `{loc.address || 'Адрес не указан'} • К: {loc.profitHookah || ownerProfits.hookah}₸ / З: {loc.profitReplacement || ownerProfits.replacement}₸`
);

// ============================================
// 3. APPLY MARGIN TO CALCULATIONS
// ============================================

// monthlyStats
content = content.replace(
  /ownerNetProfit: \(hookahs \* ownerProfits\.hookah\) \+ \(replacements \* ownerProfits\.replacement\)/g,
  `ownerNetProfit: locationShifts.reduce((acc, s) => {
        const loc = locations.find(l => l.id === s.locationId) || {};
        const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
        const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
        return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
      }, 0)`
);

// activeEmployees
content = content.replace(
  /const ownerProfit = \(hookahs \* ownerProfits\.hookah\) \+ \(replacements \* ownerProfits\.replacement\);/g,
  `const ownerProfit = empShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
      const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
      return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
    }, 0);`
);

// dailyData
content = content.replace(
  /const hookahProfit = hookahs \* ownerProfits\.hookah;\n    const replacementProfit = replacements \* ownerProfits\.replacement;/g,
  `const hookahProfit = dayShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
      return acc + ((s.items?.cocktail1 || 0) * ph);
    }, 0);
    const replacementProfit = dayShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
      return acc + ((s.items?.cocktail2 || 0) * pr);
    }, 0);`
);

// globalOwnerProfit
content = content.replace(
  /const globalOwnerProfit = \(globalHookahs \* ownerProfits\.hookah\) \+ \(globalReplacements \* ownerProfits\.replacement\);/g,
  `const globalOwnerProfit = allClosedShifts.reduce((acc, s) => {
    const loc = locations.find(l => l.id === s.locationId) || {};
    const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
    const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
    return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
  }, 0);`
);

// globalOwnerProfit UI
content = content.replace(
  /<p className="text-slate-500 text-xs mt-1">\{monthlyStats\.hookahs\} шт × \{formatMoney\(ownerProfits\.hookah\)\} ₸<\/p>/g,
  `<p className="text-slate-500 text-xs mt-1">{monthlyStats.hookahs} шт (Индивидуально)</p>`
);
content = content.replace(
  /<p className="text-slate-500 text-xs mt-1">\{monthlyStats\.replacements\} шт × \{formatMoney\(ownerProfits\.replacement\)\} ₸<\/p>/g,
  `<p className="text-slate-500 text-xs mt-1">{monthlyStats.replacements} шт (Индивидуально)</p>`
);


fs.writeFileSync(file, content);
console.log('AdminDashboard.jsx updated successfully!');
