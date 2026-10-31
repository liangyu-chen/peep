import type { Metadata, Viewport } from 'next';

// the description is what search results and link previews (LINE, Facebook…) show under the title
const DESCRIPTION = [
  '你有需要喝咖啡，尿尿，打發無聊的時間時，也許你就會找到這裡',
  '週五六營業時間15：00-22：00',
  '其餘時段至15:00-21:00',
  '店休時間不固定',
  '店休會發在每日限動上沒發店休通知就是有開',
].join('\n');

// the picture link previews show: the two hands, white on black as on the loading screen, with the name (public/og.png)
const SHARE_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: '窺視咖啡' };

export const metadata: Metadata = {
  metadataBase: new URL('https://peep-hazel.vercel.app'),
  title: '窺視咖啡',
  description: DESCRIPTION,
  openGraph: { title: '窺視咖啡', description: DESCRIPTION, images: [SHARE_IMAGE], type: 'website' },
  twitter: { card: 'summary_large_image', title: '窺視咖啡', description: DESCRIPTION, images: [SHARE_IMAGE.url] },
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
