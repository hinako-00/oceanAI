/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone出力はDocker/systemd運用向け（DEPLOY.md参照）。
  // Netlifyは自前のアダプタ（@netlify/plugin-nextjs）がビルド成果物を扱うため、
  // Netlify上のビルドでは standalone を使わない（NETLIFY はNetlifyがビルド時に自動設定する）。
  output: process.env.NETLIFY ? undefined : 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
