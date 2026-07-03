/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './src/app/image-loader.ts',
  },
  reactStrictMode: true,
  // Transpile workspace packages that ship raw TypeScript (JIT internal packages)
  transpilePackages: ['@meta-light/utils'],
};

export default nextConfig;