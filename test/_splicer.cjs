const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'regression.test.mjs');
let content = fs.readFileSync(targetFile, 'utf8');

const lines = content.split('\n');
let markerIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('全部测试完成') && lines[i].includes('pass') && lines[i].includes('fail')) {
    markerIdx = i;
    break;
  }
}
if (markerIdx === -1) {
  console.error('Marker line not found');
  process.exit(1);
}

const sectionFile = path.join(__dirname, '__ss_section.mjs');
const section = fs.readFileSync(sectionFile, 'utf8');

const before = lines.slice(0, markerIdx).join('\n');
const markerAndAfter = lines.slice(markerIdx).join('\n');

content = before + section + '\n' + markerAndAfter;
fs.writeFileSync(targetFile, content, 'utf8');
console.log('Section inserted successfully at line ' + markerIdx);
