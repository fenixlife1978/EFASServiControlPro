/** @type {import('next').NextConfig} */
const nextConfig = {
  // Obligatorio para que Capacitor encuentre los archivos en la carpeta 'out'
  output: 'export',
  
  // Obligatorio porque las tablets/celulares no tienen un servidor de optimización de imágenes
  images: {
    unoptimized: true,
  },

  // Recomendado: Evita problemas de rutas relativas en archivos estáticos dentro de Android/iOS
  trailingSlash: true,

  // Opcional: Si quieres que el build ignore errores de linting para terminar más rápido
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Opcional: Si quieres que el build ignore errores de TypeScript para asegurar la creación de la carpeta 'android'
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;