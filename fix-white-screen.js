import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/AdminDashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /ownerNetProfit: locationShifts\.reduce\(/g,
  `ownerNetProfit: closedShifts.reduce(`
);

content = content.replace(
  /const ownerProfit = empShifts\.reduce\(/g,
  `const ownerProfit = filteredShifts.reduce(`
);

content = content.replace(
  /const hookahProfit = dayShifts\.reduce\(/g,
  `const hookahProfit = filteredShifts.reduce(`
);

content = content.replace(
  /const replacementProfit = dayShifts\.reduce\(/g,
  `const replacementProfit = filteredShifts.reduce(`
);

content = content.replace(
  /const globalOwnerProfit = allClosedShifts\.reduce\(/g,
  `const globalOwnerProfit = closedSystemShifts.reduce(`
);

fs.writeFileSync(file, content);
console.log('Fixed undefined arrays!');
