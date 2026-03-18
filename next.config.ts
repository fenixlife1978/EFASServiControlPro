/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
