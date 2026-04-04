// scripts/build-android-fixed.js
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

// Directorio de respaldo
const BACKUP_DIR = path.join(__dirname, '../.backup-api');

console.log('📦 Preparando build para Android...');

// Limpiar respaldo anterior
if (fs.existsSync(BACKUP_DIR)) {
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Respaldar y eliminar archivos
apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const backupPath = path.join(BACKUP_DIR, path.basename(file));
    console.log(`📁 Respaldando: ${file}`);
    fs.copyFileSync(file, backupPath);
    fs.unlinkSync(file);
    console.log(`✅ Eliminado: ${file}`);
  }
});

try {
  // Limpiar .next previo para evitar conflictos
  if (fs.existsSync('.next')) {
    console.log('🗑️ Limpiando .next previo...');
    fs.rmSync('.next', { recursive: true, force: true });
  }
  
  // Ejecutar build de Next.js
  console.log('🔨 Ejecutando Next.js build...');
  execSync('IS_ANDROID_BUILD=true next build', { 
    stdio: 'inherit',
    env: { ...process.env, IS_ANDROID_BUILD: 'true' }
  });
  
  console.log('✅ Build completado exitosamente');
  
  // Verificar si Capacitor está configurado
  if (fs.existsSync('capacitor.config.json')) {
    console.log('📱 Copiando a Capacitor...');
    try {
      execSync('npx cap copy android', { stdio: 'inherit' });
    } catch (capError) {
      console.log('⚠️ Capacitor no está configurado, saltando...');
    }
  } else {
    console.log('⚠️ Capacitor no configurado, los archivos están en .next/');
  }
  
} catch (error) {
  console.error('❌ Error durante el build:', error.message);
  process.exit(1);
} finally {
  // Restaurar archivos
  console.log('🔄 Restaurando archivos...');
  apiFiles.forEach(file => {
    const backupPath = path.join(BACKUP_DIR, path.basename(file));
    if (fs.existsSync(backupPath)) {
      const destDir = path.dirname(file);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(backupPath, file);
      console.log(`✅ Restaurado: ${file}`);
    }
  });
  
  if (fs.existsSync(BACKUP_DIR)) {
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
}
