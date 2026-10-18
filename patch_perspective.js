const fs = require('fs');
let content = fs.readFileSync('src/lib/perspective.js', 'utf8');

content = content.replace(/const MAX_SRC_DIM = 2048;/g, 'const MAX_SRC_DIM = 800;');
content = content.replace(/const MAX_DIM = 1200;/g, 'const MAX_DIM = 800;');

const newValidation = `
        // Validation: Check if source is empty/black (iOS Canvas Crash)
        let isAllZero = true;
        for (let i = 3; i < srcData.length; i += 4) {
            if (srcData[i] > 0) {
                isAllZero = false;
                break;
            }
        }
        if (isAllZero) throw new Error("iOS memory limit exceeded. The canvas is empty.");
`;

content = content.replace(/\/\/ Validation: Check if source is empty\/black[\s\S]*?if \(srcData\.length === 0\) throw new Error\("Source image data is empty"\);/m, newValidation);

fs.writeFileSync('src/lib/perspective.js', content);
