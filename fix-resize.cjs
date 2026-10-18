const fs = require('fs');
const file = 'src/lib/openai.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const url = isUrl \? fileOrBlob : URL\.createObjectURL\(fileOrBlob\);\n\s*const img = new Image\(\);/g,
    `const img = new Image();`
);

content = content.replace(
    /img\.src = url;/g,
    `if (isUrl) {
                img.src = fileOrBlob;
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = (e) => {
                    reject(new Error("FileReader failed to read blob"));
                };
                reader.readAsDataURL(fileOrBlob);
            }`
);

content = content.replace(/if \(!isUrl\) URL\.revokeObjectURL\(url\);/g, '');

fs.writeFileSync(file, content);
