import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './src/app/image-loader.ts',
  },
  reactStrictMode: true,
  // Transpile workspace packages that ship raw TypeScript (JIT internal packages)
  transpilePackages: ['@meta-light/utils'],
  // Workers have no filesystem at runtime, so markdown is bundled as a string instead of read with fs.
  turbopack: {
    rules: {
      '*.md': { type: 'text' },
    },
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();