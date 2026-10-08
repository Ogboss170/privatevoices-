import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@private-voices/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}

export default nextConfig
