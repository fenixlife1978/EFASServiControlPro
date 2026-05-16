/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';
const isStaticExport = isAndroidBuild || isDesktopBuild;

const nextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  // Mantenemos distDir tal como lo tienes para no romper tus scripts de empaquetado
  distDir: isStaticExport ? 'out' : '.next',
  images: {
    unoptimized: true,
  },
  // CORRECCIÓN: Solo activamos trailingSlash para Android. 
  // En Desktop (Electron) DEBE ser false para que genere los archivos .html planos en la raíz de out.
  trailingSlash: isAndroidBuild ? true : false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignorar rutas de API durante el export estático
  skipTrailingSlashRedirect: true,
};

export default nextConfig;