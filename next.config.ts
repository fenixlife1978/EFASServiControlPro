/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';

// Definimos el output según el tipo de build:
// - Android: export (estático)
// - Desktop: standalone (servidor embebido para que funcionen las APIs)
// - Otros (desarrollo, Vercel): undefined (modo por defecto)
const outputType = isAndroidBuild ? 'export' : (isDesktopBuild ? 'standalone' : undefined);

const nextConfig = {
  output: outputType,
  // distDir: para Android usa 'out', para Desktop usa '.next' (standalone), para otros '.next'
  distDir: (isAndroidBuild ? 'out' : (isDesktopBuild ? '.next' : '.next')),
  images: {
    unoptimized: true,
  },
  // trailingSlash solo para Android (necesario para rutas relativas en APK)
  trailingSlash: isAndroidBuild ? true : false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Solo necesario para export estático, pero no afecta a standalone
  skipTrailingSlashRedirect: true,
};

export default nextConfig;