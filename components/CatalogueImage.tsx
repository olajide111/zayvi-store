'use client';

import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  fallback: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'auto';
};

export default function CatalogueImage({ src, alt, fallback, ...props }: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return src && failedSource !== src
    ? <img src={src} alt={alt} {...props} onError={() => setFailedSource(src)} />
    : <div role="img" aria-label={fallback} style={{ minHeight: 130, display: 'grid', placeItems: 'center', padding: 20, color: '#5c6c60', textAlign: 'center' }}>Image unavailable</div>;
}
