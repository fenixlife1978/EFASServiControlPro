/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';
const isStaticExport = isAndroidBuild || isDesktopBuild;

const nextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  distDir: isStaticExport ? 'out' : '.next',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
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
