/** @type {import('next').NextConfig} */
const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';

const nextConfig = {
  // 1. Condicional de salida: 'export' para Capacitor, 'undefined' para Vercel
  output: isAndroidBuild ? 'export' : undefined,
  
  // 2. Directorio de salida: 'out' es lo que busca Capacitor por defecto
  distDir: isAndroidBuild ? 'out' : '.next',
  
  // 3. Configuración de imágenes: Obligatorio 'unoptimized' para builds estáticos
  images: {
    unoptimized: true,
  },

  // 4. Compatibilidad de rutas: Añade la barra final (ej: /login/) para evitar problemas en Android
  trailingSlash: true,

  // 5. Blindaje: Ignoramos errores de compilación solo si estamos en build de Android
  // Esto evita que las rutas de API (que usan firebase-admin) bloqueen el export estático
  typescript: {
    ignoreBuildErrors: isAndroidBuild,
  },
  eslint: {
    ignoreDuringBuilds: isAndroidBuild,
  },
};

export default nextConfig;