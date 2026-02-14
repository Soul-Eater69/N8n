/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@flowforge/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        source: '/webhooks/:path*',
        destination: 'http://localhost:4000/webhooks/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
