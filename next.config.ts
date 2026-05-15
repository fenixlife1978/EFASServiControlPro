/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isStaticExport = isAndroidBuild || process.env.IS_DESKTOP_BUILD === 'true';

const nextConfig = {
  output: isStaticExport ? 'export' : undefined,
  distDir: isStaticExport ? 'out' : '.next',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: isStaticExport,
  },
  eslint: {
    ignoreDuringBuilds: isStaticExport,
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
