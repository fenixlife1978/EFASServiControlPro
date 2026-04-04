// scripts/build-android.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Rutas originales - ARCHIVOS a eliminar temporalmente
const apiFiles = [
  'src/app/api/nextdns/denylist/route.ts',
  'src/app/api/nextdns/allowlist/route.ts',
  'src/app/api/nextdns/logs/route.ts',
  'src/app/(admin)/dashboard/supervisor/[institutoId]/page.tsx'
];

// Carpetas a eliminar temporalmente
const apiFolders = [
  'src/app/api/cron'
];

// Directorio de respaldo fuera de src
const BACKUP_DIR = path.join(__dirname, '../.backup-api');

console.log('📦 Preparando build para Android...');

// Limpiar respaldo anterior si existe
if (fs.existsSync(BACKUP_DIR)) {
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 1. Respaldar y eliminar archivos de API
apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    // Crear la estructura de directorios para el backup
    const backupPath = path.join(BACKUP_DIR, file.replace(/^src\//, ''));
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    console.log(`📁 Respaldando: ${file}`);
    fs.copyFileSync(file, backupPath);
    fs.unlinkSync(file);
    console.log(`✅ Eliminado: ${file}`);
  }
});

// 2. Respaldar y eliminar carpetas de API
apiFolders.forEach(folder => {
  if (fs.existsSync(folder)) {
    const backupPath = path.join(BACKUP_DIR, folder.replace(/^src\//, ''));
    console.log(`📁 Respaldando carpeta: ${folder}`);
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
    fs.cpSync(folder, backupPath, { recursive: true });
    fs.rmSync(folder, { recursive: true, force: true });
    console.log(`✅ Carpeta eliminada: ${folder}`);
  }
});

try {
  // 3. Ejecutar build de Next.js
  console.log('🔨 Ejecutando Next.js build...');
  execSync('IS_ANDROID_BUILD=true next build', { 
    stdio: 'inherit',
    env: { ...process.env, IS_ANDROID_BUILD: 'true' }
  });
  
  // 4. Eliminar carpeta out/api si existe
  if (fs.existsSync('out/api')) {
    console.log('🗑️ Eliminando out/api...');
    fs.rmSync('out/api', { recursive: true, force: true });
  }
  
  // 5. Copiar a Capacitor
  console.log('📱 Copiando a Capacitor...');
  execSync('npx cap copy android', { stdio: 'inherit' });
  
  console.log('✅ Build Android completado exitosamente');
} catch (error) {
  console.error('❌ Error durante el build:', error.message);
} finally {
  // 6. Restaurar archivos y carpetas
  console.log('🔄 Restaurando archivos...');
  
  apiFiles.forEach(file => {
    const backupPath = path.join(BACKUP_DIR, file.replace(/^src\//, ''));
    if (fs.existsSync(backupPath)) {
      const destDir = path.dirname(file);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(backupPath, file);
      console.log(`✅ Restaurado: ${file}`);
    }
  });
  
  apiFolders.forEach(folder => {
    const backupPath = path.join(BACKUP_DIR, folder.replace(/^src\//, ''));
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
      }
      fs.cpSync(backupPath, folder, { recursive: true });
      console.log(`✅ Restaurado: ${folder}`);
    }
  });
  
  // Limpiar directorio de respaldo
  if (fs.existsSync(BACKUP_DIR)) {
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
}