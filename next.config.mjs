/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      loader: 'custom',
      loaderFile: './src/app/image-loader.js',
    },
    reactStrictMode: true,
  };
  
  export default nextConfig;