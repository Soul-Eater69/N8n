/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stagerush/shared'],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4100/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
