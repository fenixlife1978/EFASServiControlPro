/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';

const nextConfig = {
  output: isAndroidBuild ? 'export' : 'standalone',
  distDir: isAndroidBuild ? 'out' : '.next',
  images: {
    unoptimized: isAndroidBuild,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
