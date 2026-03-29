import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter, Fragment_Mono } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

const fragmentMono = Fragment_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-fragment-mono',
});

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.className} ${fragmentMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider theme={{ defaultTheme: 'light' }}>{children}</RootProvider>
      </body>
    </html>
  );
}
