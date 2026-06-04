import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/AdminDashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

const funcCode = `            const handleSaveStandards = async () => {
              setIsSavingInv(true);
              try { await setDoc(doc(db, 'settings', 'inventory_standards'), invStandards); alert('Стандарты сохранены!'); }
              catch (err) { alert('Ошибка: ' + err.message); }
              finally { setIsSavingInv(false); }
            };`;

// Remove from inventory IIFE
content = content.replace(funcCode, '');

const saveSettingsCode = `  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'profits'), ownerProfits);
      alert('Настройки прибыли успешно сохранены!');
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
    finally { setIsSavingSettings(false); }
  };`;

const newFuncCode = `\n  const handleSaveStandards = async () => {
    setIsSavingInv(true);
    try { await setDoc(doc(db, 'settings', 'inventory_standards'), invStandards); alert('Стандарты сохранены!'); }
    catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsSavingInv(false); }
  };`;

// Inject next to handleSaveSettings
content = content.replace(saveSettingsCode, saveSettingsCode + newFuncCode);

fs.writeFileSync(file, content);
console.log('Fixed handleSaveStandards scope!');
