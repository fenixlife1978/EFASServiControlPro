import sys

path = 'src/components/dashboard/SuperAdminView.tsx'
with open(path, 'r') as f:
    content = f.read()

# Buscamos la consulta del listener para simplificarla
# Queremos que escuche el documento exacto que se acaba de activar (lastDeviceId)
old_query = """const q = query(
        collection(db, "dispositivos"),
        where("InstitutoId", "==", selectedConfig.instId),
        where("aulaId", "==", selectedConfig.aulaId),
        where("vinculado", "==", true),
        where("createdAt", ">=", sessionStartTime)
      );"""

new_query = """const q = query(
        collection(db, "dispositivos"),
        where("InstitutoId", "==", selectedConfig.instId),
        where("vinculado", "==", true)
      );"""

# También vamos a mejorar la lógica de detección para que use el ID secuencial
logic_old = "const deviceData = doc.data();"
logic_new = """const deviceData = doc.data();
          if (doc.id === lastDeviceId) {"""

content = content.replace(old_query, new_query)

with open(path, 'w') as f:
    f.write(content)
