export type ProductColor = { name: string; hex: string };

export type StorefrontProduct = {
  id: string;
  canonicalCode: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  currency: string;
  category: string;
  emoji: string;
  desc: string;
  longDesc: string;
  features: string[];
  colors: ProductColor[];
  sizes: string[];
  badge?: string;
  status: string;
  lifecycleStatus: string;
  publicationStatus: string;
  availabilityStatus: string;
};

export type StorefrontProductsResponse = {
  source: string;
  total: number;
  products: StorefrontProduct[];
};
