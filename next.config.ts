import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // the 3D scene starts once per mount; strict mode's double mount would build it twice in dev
  reactStrictMode: false,
  // the dev server opened from another device on the Tailscale network (100.x.x.x), so hot reload reaches it too
  allowedDevOrigins: ['100.94.51.27', '100.*.*.*'],
};

export default nextConfig;
