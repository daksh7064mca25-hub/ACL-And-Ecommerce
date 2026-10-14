import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/navigation/AppShell';
import Footer from '@/components/Footer';
import DeliveryLocationModal from '@/components/DeliveryLocationModal';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import PWAUpdateToast from '@/components/PWAUpdateToast';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { DeliveryLocationProvider } from '@/context/DeliveryLocationContext';
import { PWAProvider } from '@/context/PWAContext';

import { siteConfig, getSiteUrl } from '@/lib/seo';

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.legalName,
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: '/',
    siteName: siteConfig.name,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.defaultOgImage,
        width: 1200,
        height: 630,
        alt: siteConfig.ogImageAlt,
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    images: [siteConfig.defaultOgImage],
    creator: siteConfig.twitterHandle,
    site: siteConfig.twitterHandle,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body className="bg-gray-950 text-gray-100 flex flex-col min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        <PWAProvider>
          <AuthProvider>
            <SocketProvider>
              <DeliveryLocationProvider>
                <CartProvider>
                  <AppShell>
                    {children}
                  </AppShell>
                  <Footer />
                  <DeliveryLocationModal />
                  <PWAInstallPrompt />
                  <PWAUpdateToast />
                </CartProvider>
              </DeliveryLocationProvider>
            </SocketProvider>
          </AuthProvider>
        </PWAProvider>
      </body>
    </html>
  );
}

