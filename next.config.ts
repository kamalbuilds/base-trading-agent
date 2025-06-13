import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: [
      '@coinbase/agentkit',
      '@coinbase/agentkit-langchain',
      '@xmtp/browser-sdk',
      'lucide-react',
    ],
  },
  
  // Webpack configuration for better bundling
  webpack: (config) => {
    // Optimize for Node.js modules used in agents
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({
        'cpu-features': 'commonjs cpu-features',
        'node:crypto': 'commonjs node:crypto',
        'node:stream': 'commonjs node:stream',
      });
    }
    
    return config;
  },
  
  // Environment variables configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Image optimization
  images: {
    domains: ['example.com', 'api.coinbase.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Headers for security and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
