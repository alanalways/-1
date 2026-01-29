const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('async function loadGlobalMarkets') || line.includes('function loadGlobalMarkets') || line.includes('loadGlobalMarkets =')) {
        console.log(`Found at line ${index + 1}: ${line.trim()}`);
    }
});
