/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';

// Android -> export estático
// Desktop -> standalone (servidor embebido)
// Otros (desarrollo, Vercel) -> modo por defecto
const outputType = isAndroidBuild ? 'export' : (isDesktopBuild ? 'standalone' : undefined);

const nextConfig = {
  output: outputType,
  distDir: isAndroidBuild ? 'out' : (isDesktopBuild ? '.next' : '.next'),
  images: {
    unoptimized: true,
  },
  trailingSlash: isAndroidBuild ? true : false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;