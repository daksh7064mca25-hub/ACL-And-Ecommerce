import type { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';
import {
  getCachedProductById,
  getAbsoluteUrl,
  getAbsoluteImageUrl,
  siteConfig,
} from '@/lib/seo';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getCachedProductById(id);

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The requested product could not be found or has been removed from Experto Store.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = product.title;
  const priceFormatted = `₹${Number(product.price).toFixed(2)}`;
  const stockStatus = product.quantity > 0 ? 'In Stock' : 'Out of Stock';
  const description = `Buy ${product.title} at Experto Store for ${priceFormatted}. ${stockStatus}. Hyperlocal express delivery with real-time GPS tracking and authentic warranty.`;

  const primaryImage =
    Array.isArray(product.images) && product.images.length > 0
      ? getAbsoluteImageUrl(product.images[0])
      : getAbsoluteImageUrl(siteConfig.defaultOgImage);

  const productUrl = `/products/${product._id}`;

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: productUrl,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: 'website',
      images: [
        {
          url: primaryImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [primaryImage],
      creator: siteConfig.twitterHandle,
      site: siteConfig.twitterHandle,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getCachedProductById(id);

  // Construct structured data (Schema.org JSON-LD) using verified, non-fabricated product details
  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: `Buy ${product.title} at Experto Store for ₹${Number(product.price).toFixed(2)}. Express delivery and verified quality.`,
        image:
          Array.isArray(product.images) && product.images.length > 0
            ? product.images.map((img) => getAbsoluteImageUrl(img))
            : [getAbsoluteImageUrl(siteConfig.defaultOgImage)],
        sku: product._id,
        offers: {
          '@type': 'Offer',
          url: getAbsoluteUrl(`/products/${product._id}`),
          priceCurrency: siteConfig.currency,
          price: Number(product.price).toFixed(2),
          availability:
            product.quantity > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: siteConfig.name,
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailClient productId={id} initialProduct={product} />
    </>
  );
}
