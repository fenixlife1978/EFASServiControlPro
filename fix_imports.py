import os

files_to_fix = [
    "src/app/(admin)/dashboard/classrooms/page.tsx",
    "src/app/(admin)/dashboard/classrooms/view/page.tsx",
    "src/app/(admin)/dashboard/dispositivos/page.tsx",
    "src/app/(admin)/dashboard/enrollment/page.tsx",
    "src/app/(admin)/dashboard/seguridad/page.tsx"
]

target_import = 'import { useInstitution } from "@/app/(admin)/dashboard/institution-context";'

for filepath in files_to_fix:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        with open(filepath, 'w') as f:
            for line in lines:
                if 'from' in line and 'institution-context' in line:
                    f.write(f'{target_import}\n')
                else:
                    f.write(line)
        print(f"✅ Fixed: {filepath}")
    else:
        print(f"❌ Not found: {filepath}")
