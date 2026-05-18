#!/bin/bash

# Corregir SuperAdminView.tsx
find src -name "SuperAdminView.tsx" -exec sed -i 's/onClick={() => router.push.*login.*}/onClick={() => signOut(auth)}/g' {} \;
find src -name "SuperAdminView.tsx" -exec sed -i 's/onClick={() => logout.*}/onClick={() => signOut(auth)}/g' {} \;

# Corregir DirectorView.tsx
find src -name "DirectorView.tsx" -exec sed -i 's/onClick={() => router.push.*login.*}/onClick={() => signOut(auth)}/g' {} \;
find src -name "DirectorView.tsx" -exec sed -i 's/onClick={() => logout.*}/onClick={() => signOut(auth)}/g' {} \;

# Corregir ProfesorView.tsx
find src -name "ProfesorView.tsx" -exec sed -i 's/onClick={() => router.push.*login.*}/onClick={() => signOut(auth)}/g' {} \;
find src -name "ProfesorView.tsx" -exec sed -i 's/onClick={() => logout.*}/onClick={() => signOut(auth)}/g' {} \;

# Corregir SupervisorPanelClient.tsx
find src -name "SupervisorPanelClient.tsx" -exec sed -i 's/onClick={() => router.push.*login.*}/onClick={() => signOut(auth)}/g' {} \;
find src -name "SupervisorPanelClient.tsx" -exec sed -i 's/onClick={() => logout.*}/onClick={() => signOut(auth)}/g' {} \;

echo "✅ Archivos corregidos"
