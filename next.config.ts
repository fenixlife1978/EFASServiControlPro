/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';

// Usamos export para Android y también para Desktop (modo estático)
const isStaticExport = isAndroidBuild || isDesktopBuild;

const nextConfig = {
  output: isStaticExport ? 'export' : undefined,
  distDir: isStaticExport ? 'out' : '.next',
  images: {
    unoptimized: true,
  },
  trailingSlash: isAndroidBuild ? true : false,  // false para escritorio (rutas planas)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;