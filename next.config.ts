import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // the 3D scene starts once per mount; strict mode's double mount would build it twice in dev
  reactStrictMode: false,
};

export default nextConfig;
