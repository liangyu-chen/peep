import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '窺視珈琲 3D',
  description: '台北窺視珈琲的 3D 小店：熟客、老闆小鬍子，還有一台一直在打 NBA 2K 的電視。',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#141218' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&family=Noto+Sans+TC:wght@400;500;700;900&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
