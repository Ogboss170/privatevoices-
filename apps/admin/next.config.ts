import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@private-voices/shared'],
  reactStrictMode: true,
}

export default nextConfig
