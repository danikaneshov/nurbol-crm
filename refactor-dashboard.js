import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/AdminDashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove TobaccoTypesTab import
content = content.replace(/import TobaccoTypesTab from '\.\/TobaccoTypesTab';\n/g, '');

// 2. Remove tobaccoTypes state
content = content.replace(/  \/\/ Tobacco types\n  const \[tobaccoTypes, setTobaccoTypes\] = useState\(\[\]\);\n/g, '');

// 3. Remove listener
const listenerRegex = /    \/\/ Tobacco types\n    const unsubTobacco = onSnapshot\(query\(collection\(db, 'tobacco_types'\), orderBy\('name', 'asc'\)\), \(snap\) => \{\n      setTobaccoTypes\(snap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\)\);\n    \}\);\n/;
content = content.replace(listenerRegex, '');

content = content.replace(/unsubSales\(\); unsubEmp\(\); unsubSettings\(\); unsubLoc\(\); unsubTobacco\(\);/g, 'unsubSales(); unsubEmp(); unsubSettings(); unsubLoc();');

// 4. SubTab cleanup
content = content.replace(/ : subTab === 'tobacco' \? 'Сорта табака'/g, '');
content = content.replace(/<button onClick=\{\(\) => setSubTab\('tobacco'\)\} className=\{`pill-tab \$\{subTab === 'tobacco' \? 'pill-tab-active' : 'pill-tab-inactive'\}`\}>Сорта табака<\/button>\n/g, '');

// 5. Update Stock calculation
const stockOld = `            const coalStock = coalIn - autoCoalUsed - coalWriteoff;
            const tobaccoStock = tobaccoIn - autoTobaccoUsed - tobaccoWriteoff;`;

const stockNew = `            const coalStock = coalIn - autoCoalUsed - coalWriteoff;
            const tobaccoCorrection = locMovements.filter(m => m.item === 'tobacco' && m.type === 'correction').reduce((a, m) => a + (m.amount || 0), 0);
            const tobaccoStock = tobaccoIn + tobaccoCorrection - autoTobaccoUsed - tobaccoWriteoff;`;
content = content.replace(stockOld, stockNew);

// 6. Update RevisionTab props
const revisionOld = /<RevisionTab[\s\S]*?tobaccoTypes=\{tobaccoTypes\}[\s\S]*?\/>/;
const revisionNew = `<RevisionTab 
              locations={locations} 
              allShifts={allShifts}
              locationId={selectedLocationId}
              allTobaccoSorts={invTemplates.filter(t => t.item === 'tobacco').map(t => ({ id: t.id, name: t.name, pricePerGram: (t.price && t.amount) ? (Number(t.price)/Number(t.amount)) : 0 }))}
            />`;
content = content.replace(revisionOld, revisionNew);

// 7. Remove TobaccoTypesTab usage
content = content.replace(/              \{subTab === 'tobacco' && \([\s\S]*?<TobaccoTypesTab tobaccoTypes=\{tobaccoTypes\} \/>\n              \)\}\n/g, '');

fs.writeFileSync(file, content);
console.log('AdminDashboard.jsx restructured successfully!');
