import sys

file_path = 'components/dashboard/SuperAdminView.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Asegurar que setDoc y doc estén en las importaciones
if 'setDoc, doc' not in content:
    content = content.replace('addDoc,', 'addDoc, setDoc, doc,')

# 2. Reemplazar la lógica de creación de la institución
# Buscamos el bloque que usa addDoc para instituciones
old_creation = 'await addDoc(collection(db, "institutions"), {'
new_creation = 'await setDoc(doc(db, "institutions", newInst.InstitutoId), {'

if old_creation in content:
    content = content.replace(old_creation, new_creation)
    with open(file_path, 'w') as f:
        f.write(content)
    print("✅ SuperAdminView actualizado: Ahora usa IDs manuales.")
else:
    # Intento alternativo si el estado se llama distinto a newInst
    print("⚠️ No se encontró 'newInst', intentando con 'formData'...")
    content = content.replace('await addDoc(collection(db, "institutions"), {', 'await setDoc(doc(db, "institutions", formData.InstitutoId), {')
    with open(file_path, 'w') as f:
        f.write(content)
