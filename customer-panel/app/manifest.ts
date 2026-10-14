import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Experto Visuals Store',
    short_name: 'Experto Store',
    description: 'Experto Visuals Store - Browse products, shop online and track orders.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#030712',
    theme_color: '#4f46e5',
    categories: ['shopping', 'ecommerce', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Browse Products',
        short_name: 'Products',
        description: 'Explore the full product collection',
        url: '/products',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My Orders & Tracking',
        short_name: 'Orders',
        description: 'View order history and track active deliveries',
        url: '/orders',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Nearby Stores',
        short_name: 'Nearby',
        description: 'Find local stores and express delivery zones',
        url: '/nearby',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
