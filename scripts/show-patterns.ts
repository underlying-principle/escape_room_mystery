import fs from 'node:fs';
const levels = JSON.parse(fs.readFileSync('src/data/levels.json', 'utf8'));
const w3 = levels.find((l: any) => l.id === 'w3-l9');
console.log('--- w3-l9 ---');
console.log(JSON.stringify({ rules: w3.reactionRules, slots: w3.slots, wc: w3.wildcardCount, intended: w3.intendedMoveCount }, null, 1));
const w2l8 = levels.find((l: any) => l.id === 'w2-l8');
console.log('--- w2-l8 ---');
console.log(JSON.stringify({ slots: w2l8.slots, wc: w2l8.wildcardCount, name: w2l8.name }, null, 1));
