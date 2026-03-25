import os

def resolve_conflict(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        out = []
        state = 'normal'
        for line in lines:
            if line.startswith('<<<<<<<'):
                state = 'head'
            elif line.startswith('======='):
                state = 'master'
            elif line.startswith('>>>>>>>'):
                state = 'normal'
            else:
                if state == 'normal' or state == 'master':
                    out.append(line)
                    
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(out)
        print(f"Resolved {file_path}")
    except Exception as e:
        print(f"Failed {file_path}: {e}")

for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.py', '.css')):
            fp = os.path.join(root, file)
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    content = f.read()
                if '<<<<<<<' in content:
                    resolve_conflict(fp)
            except Exception as e:
                pass
