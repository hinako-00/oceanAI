/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dockerイメージを小さくするため、実行に必要なファイルだけを .next/standalone に出力する。
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
