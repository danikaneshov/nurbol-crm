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

  // Replace accent colors
  content = content.replace(/accent-cyan/g, 'blue-600');
  content = content.replace(/accent-purple/g, 'indigo-600');
  content = content.replace(/surface-300\/15/g, 'slate-100');
  content = content.replace(/surface-300\/20/g, 'slate-100');
  content = content.replace(/surface-200\/80/g, 'white');
  content = content.replace(/surface-200\/60/g, 'white');
  content = content.replace(/surface-[0-9]+/g, 'white');

  fs.writeFileSync(filePath, content);
});
console.log('Successfully replaced accent colors.');
