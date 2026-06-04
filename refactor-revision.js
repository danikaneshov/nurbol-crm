import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/RevisionTab.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Update signature and remove useMemo for allTobaccoSorts
const sigOld = /const RevisionTab = \(\{ locationId, locations, tobaccoTemplates = \[\], tobaccoTypes = \[\], allShifts, invStandards \}\) => \{\n  \/\/ Нормализуем: используем tobaccoTypes если есть, иначе фолбэк на tobaccoTemplates\n  const allTobaccoSorts = useMemo\(\(\) => \{\n    if \(tobaccoTypes && tobaccoTypes\.length > 0\) \{\n      return tobaccoTypes\.map\(t => \(\{\n        id: t\.id,\n        name: t\.name,\n        totalGrams: Number\(t\.totalGrams\) \|\| 0,\n        totalCost: Number\(t\.totalCost\) \|\| 0,\n        pricePerGram: t\.pricePerGram \|\| \(\(t\.totalGrams && t\.totalCost\) \? Number\(t\.totalCost\) \/ Number\(t\.totalGrams\) : 0\),\n      \}\)\);\n    \}\n    return tobaccoTemplates\.map\(t => \(\{\n      id: t\.id,\n      name: t\.name,\n      totalGrams: Number\(t\.amount\) \|\| 0,\n      totalCost: Number\(t\.price\) \|\| 0,\n      pricePerGram: \(t\.amount && t\.price\) \? Number\(t\.price\) \/ Number\(t\.amount\) : 0,\n    \}\)\);\n  \}, \[tobaccoTypes, tobaccoTemplates\]\);\n/;
const sigNew = `const RevisionTab = ({ locationId, locations, allTobaccoSorts = [], allShifts, invStandards }) => {\n`;
content = content.replace(sigOld, sigNew);

// 2. Update Expected calculation
const expectedOld = `    const locMovements = invMovements.filter(m => 
      (!m.locationId || m.locationId === selectedLocForRevision) && 
      m.item === 'tobacco' && 
      m.type === 'in'
    );
    const totalTobaccoIn = locMovements.reduce((a, m) => a + (m.amount || 0), 0);

    // Распределяем по сортам
    const tobaccoInByType = {};
    allTobaccoSorts.forEach(tt => {
      const typeMovements = locMovements.filter(m => 
        m.tobaccoTypeId === tt.id || 
        m.tobaccoTypeName === tt.name || 
        m.templateId === tt.id || 
        m.templateName === tt.name
      );
      tobaccoInByType[tt.id] = typeMovements.reduce((a, m) => a + (m.amount || 0), 0);
    });

    // Расход пропорционален доле каждого сорта
    const result = {};
    allTobaccoSorts.forEach(tt => {
      const share = totalTobaccoIn > 0 ? (tobaccoInByType[tt.id] || 0) / totalTobaccoIn : 0;
      const usedForType = totalTobaccoUsed * share;
      result[tt.id] = {
        incoming: tobaccoInByType[tt.id] || 0,
        used: Math.round(usedForType),
        expected: Math.max(0, (tobaccoInByType[tt.id] || 0) - usedForType),
      };
    });`;

const expectedNew = `    const locMovements = invMovements.filter(m => 
      (!m.locationId || m.locationId === selectedLocForRevision) && 
      m.item === 'tobacco'
    );
    
    const totalTobaccoIn = locMovements.filter(m => m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0);

    // Распределяем по сортам
    const tobaccoInByType = {};
    const tobaccoCorrectionByType = {};
    
    allTobaccoSorts.forEach(tt => {
      const typeMovements = locMovements.filter(m => m.templateId === tt.id);
      tobaccoInByType[tt.id] = typeMovements.filter(m => m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0);
      tobaccoCorrectionByType[tt.id] = typeMovements.filter(m => m.type === 'correction').reduce((a, m) => a + (m.amount || 0), 0);
    });

    // Расход пропорционален доле каждого сорта от общего прихода
    const result = {};
    allTobaccoSorts.forEach(tt => {
      const share = totalTobaccoIn > 0 ? (tobaccoInByType[tt.id] || 0) / totalTobaccoIn : 0;
      const usedForType = totalTobaccoUsed * share;
      const expected = (tobaccoInByType[tt.id] || 0) + (tobaccoCorrectionByType[tt.id] || 0) - usedForType;
      result[tt.id] = {
        incoming: tobaccoInByType[tt.id] || 0,
        correction: tobaccoCorrectionByType[tt.id] || 0,
        used: Math.round(usedForType),
        expected: Math.max(0, Math.round(expected)),
      };
    });`;
content = content.replace(expectedOld, expectedNew);

// 3. Update Save logic
const saveOld = `      await addDoc(collection(db, 'revisions'), {
        locationId: selectedLocForRevision,
        locationName: locName,
        dateStr: revisionDate,
        soldHookahs,
        items: revisionItems,
        totalShortage,
        totalShortageGrams,
        createdAt: serverTimestamp()
      });`;

const saveNew = `      await addDoc(collection(db, 'revisions'), {
        locationId: selectedLocForRevision,
        locationName: locName,
        dateStr: revisionDate,
        soldHookahs,
        items: revisionItems,
        totalShortage,
        totalShortageGrams,
        createdAt: serverTimestamp()
      });
      
      // Авто-корректировка склада на основе разницы
      for (const tt of allTobaccoSorts) {
        const data = expectedByTobaccoType[tt.id] || { expected: 0 };
        const actualGrams = Number(actuals[tt.id] || 0);
        const diff = actualGrams - data.expected;
        
        if (diff !== 0) {
          await addDoc(collection(db, 'inventory_movements'), {
            type: 'correction',
            item: 'tobacco',
            amount: diff,
            templateId: tt.id,
            templateName: tt.name,
            locationId: selectedLocForRevision,
            note: \`Корректировка ревизии \${revisionDate}\`,
            dateStr: revisionDate,
            createdAt: serverTimestamp()
          });
        }
      }`;
content = content.replace(saveOld, saveNew);

fs.writeFileSync(file, content);
console.log('RevisionTab.jsx logic rewritten successfully!');
