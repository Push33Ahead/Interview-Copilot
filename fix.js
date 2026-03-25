const fs = require('fs');
const path = require('path');

function resolveConflict(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const out = [];
        let state = 'normal';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('<<<<<<<')) {
                state = 'head';
            } else if (line.startsWith('=======')) {
                state = 'master';
            } else if (line.startsWith('>>>>>>>')) {
                state = 'normal';
            } else {
                if (state === 'normal' || state === 'master') {
                    out.push(line);
                }
            }
        }
        
        fs.writeFileSync(filePath, out.join('\n'), 'utf8');
        console.log(`Resolved ${filePath}`);
    } catch (e) {
        console.log(`Failed ${filePath}: ${e}`);
    }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (path.basename(file) !== 'node_modules' && path.basename(file) !== '.git' && path.basename(file) !== '.next') {
              walk(file);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.py') || file.endsWith('.css') || file.endsWith('.bak')) {
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('<<<<<<<')) {
                        resolveConflict(file);
                    }
                } catch(e) {}
            }
        }
    });
}

walk('app');
