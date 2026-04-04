import sys

path = 'src/components/dashboard/SuperAdminView.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Asegurar que el estado lastDeviceId exista
if "const [lastDeviceId, setLastDeviceId] = useState('');" not in content:
    content = content.replace(
        "const [lastLinkedDevice, setLastLinkedDevice] = useState<any>(null);",
        "const [lastLinkedDevice, setLastLinkedDevice] = useState<any>(null);\n  const [lastDeviceId, setLastDeviceId] = useState('');"
    )

# 2. Corregir el valor del QR para que use lastDeviceId
import re
content = re.sub(
    r'value=\{JSON\.stringify\(\{ action: \'vincular\', (.*?)\s*\}\)\}',
    r"value={JSON.stringify({ action: 'vincular', deviceId: lastDeviceId, \1 })}",
    content
)

# 3. Corregir el botón de activación para que asigne el ID
boton_old = """<button disabled={!selectedConfig.aulaId} onClick={async () => { 
                              const nextId = await getNextDeviceId();
                              await setDoc(doc(db, "dispositivos", nextId), { createdAt: serverTimestamp(), vinculado: false, InstitutoId: selectedConfig.instId, aulaId: selectedConfig.aulaId, rol: selectedConfig.rol, status: 'pending_hardware' });
                              setLastLinkedDevice(null);
                              setSessionStartTime(new Date()); 
                              setIsJornadaActive(true); 
                            }}"""

boton_new = """<button disabled={!selectedConfig.aulaId} onClick={async () => { 
                              const nextId = await getNextDeviceId();
                              await setDoc(doc(db, "dispositivos", nextId), { 
                                createdAt: serverTimestamp(), 
                                vinculado: false, 
                                InstitutoId: selectedConfig.instId, 
                                aulaId: selectedConfig.aulaId, 
                                rol: selectedConfig.rol, 
                                status: 'pending_hardware' 
                              });
                              setLastDeviceId(nextId);
                              setLastLinkedDevice(null);
                              setSessionStartTime(new Date()); 
                              setIsJornadaActive(true); 
                            }}"""

content = content.replace(boton_old, boton_new)

with open(path, 'w') as f:
    f.write(content)
