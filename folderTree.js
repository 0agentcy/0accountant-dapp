const fs = require('fs');
const path = require('path');

function printTree(dir, prefix = '', ignore = ['node_modules', '.git']) {
    const files = fs.readdirSync(dir).filter(file => !ignore.includes(file));
    files.forEach((file, index) => {
        const isLast = index === files.length - 1;
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        console.log(`${prefix}${isLast ? '└── ' : '├── '}${file}`);
        if (stats.isDirectory()) {
            printTree(filePath, prefix + (isLast ? '    ' : '│   '), ignore);
        }
    });
}

// Replace '.' with your target directory
printTree('.');