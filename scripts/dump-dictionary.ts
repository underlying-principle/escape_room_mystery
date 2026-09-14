import fs from 'node:fs';
const g = JSON.parse(fs.readFileSync('public/data/wordGraphCache.json', 'utf8')).graph;
const w3 = Object.keys(g).filter((w) => w.length === 3);
const w4 = Object.keys(g).filter((w) => w.length === 4);
console.log('3-letter (' + w3.length + '):');
console.log(w3.join(' '));
console.log();
console.log('4-letter (' + w4.length + '):');
console.log(w4.join(' '));
