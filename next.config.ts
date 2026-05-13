/** @type {import('next').NextConfig} */

// Detecta si es build para Android o para exportación estática (Electron)
const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
// Puedes usar también una variable IS_ELECTRON_BUILD si lo prefieres, pero para ahora con export es suficiente:

const isStaticExport = isAndroidBuild || process.env.IS_DESKTOP_BUILD === 'true';

// Next.js Config
const nextConfig = {
  // Para Android o Escritorio (Electron): export estático
  output: isStaticExport ? 'export' : undefined,
  
  // Directorio de salida
  distDir: isStaticExport ? 'out' : '.next',
  
  // Imágenes sin optimización para exportación estática
  images: {
    unoptimized: true,
  },

  // Compatibilidad de rutas (barra al final)
  trailingSlash: true,

  // Blindaje: Ignora errores solo en build externos
  typescript: {
    ignoreBuildErrors: isStaticExport,
  },
  eslint: {
    ignoreDuringBuilds: isStaticExport,
  },
};

export default nextConfig;