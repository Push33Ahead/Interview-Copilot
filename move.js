const fs = require('fs');
const path = require('path');

const dirsToMove = ['chat', 'history', 'report', 'start'];
const baseDir = path.join(__dirname, 'app');
const targetDir = path.join(baseDir, '(main)');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
}

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Replace relative imports to lib
            content = content.replace(/from\s+['"]\.\.\/lib\//g, "from '@/app/lib/");
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated imports in ${fullPath}`);
        }
    }
}

for (const d of dirsToMove) {
    const sourceDir = path.join(baseDir, d);
    if (fs.existsSync(sourceDir)) {
        const destDir = path.join(targetDir, d);
        // Process files before moving or after moving
        processDirectory(sourceDir);
        fs.renameSync(sourceDir, destDir);
        console.log(`Moved ${d} to (main)/${d}`);
    }
}
