const fs = require('fs');
let lines = fs.readFileSync('test/regression.test.mjs', 'utf8').split('\n');

const orphanIdx = lines.findIndex((l, i) =>
  i > 1400 && i < 1420 &&
  l.trim() === "console.log('\\n' + '='.repeat(80));" &&
  lines[i + 1] && lines[i + 1].includes('SnapshotSource')
);
if (orphanIdx !== -1) {
  lines.splice(orphanIdx, 1);
  console.log('Removed orphan separator at line ' + (orphanIdx + 1));
}

const summaryIdx = lines.findIndex((l, i) =>
  i > 1800 && l.includes('\u5168\u90e8\u6d4b\u8bd5\u5b8c\u6210')
);
if (summaryIdx !== -1) {
  const prevLine = lines[summaryIdx - 1] || '';
  if (!prevLine.includes('.repeat(80)')) {
    lines.splice(summaryIdx, 0, "console.log('\\n' + '='.repeat(80));");
    console.log('Added separator before summary');
  }
}

fs.writeFileSync('test/regression.test.mjs', lines.join('\n'), 'utf8');
console.log('done');
