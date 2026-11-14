-- Zayvi migration 0004: Preview tenant, application grants and initial catalogue
-- Seeds only the Zayvi Preview tenant/store and grants zayvi_app the minimum
-- catalogue permissions needed by the Preview API. Idempotent by stable slugs/codes.

BEGIN;

INSERT INTO tenants (name, slug, legal_name, status, default_market_code)
VALUES ('Zayvi Store', 'zayvi', 'Zayvi Store', 'active', 'GB')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  status = 'active',
  default_market_code = 'GB',
  updated_at = now();

INSERT INTO stores (
  tenant_id, name, slug, status, brand_name, default_locale, default_market_code
)
SELECT
  t.id, 'Zayvi Store', 'main', 'active', 'ZAYVI', 'en-GB', 'GB'
FROM tenants t
WHERE t.slug = 'zayvi'
ON CONFLICT (tenant_id, slug) DO UPDATE
SET
  name = EXCLUDED.name,
  status = 'active',
  brand_name = 'ZAYVI',
  default_locale = 'en-GB',
  default_market_code = 'GB',
  updated_at = now();

UPDATE commerce_markets
SET enabled = true, updated_at = now()
WHERE code IN ('GB', 'NG');

DO $$
DECLARE
  v_tenant_id uuid;
  v_store_id uuid;
  item jsonb;
  v_product_id uuid;
  v_tenant_product_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'zayvi';

  SELECT id INTO v_store_id
  FROM stores
  WHERE tenant_id = v_tenant_id
    AND slug = 'main';

  FOR item IN
    SELECT value
    FROM jsonb_array_elements(
      '[
        {"code":"ZAYVI-001","slug":"aerobottle-travel-bottle","name":"AeroBottle Travel Bottle","category":"Travel","price":34.00,"image":"https://d1a4ubvkp2b6va.cloudfront.net/products/31d53b39-59c2-4e7a-8763-0510105befa7.png","emoji":"🧴","desc":"Insulated steel bottle. 24h cold, 12h hot. Leak-proof.","longDesc":"The bottle that stays on your desk and in your bag. Double-wall vacuum insulation, soft-touch finish, wide mouth for ice. 750ml. Built for daily use and travel.","badge":"Best Seller","features":["24h cold / 12h hot","Leak-proof","750ml","Soft-touch finish","Cup-holder friendly"],"colors":[{"name":"Forest Green","hex":"#1a5a2a"},{"name":"Matte Black","hex":"#1a1a1a"},{"name":"Sand","hex":"#d4b896"}],"sizes":[]},
        {"code":"ZAYVI-002","slug":"softpack-cubes-set","name":"SoftPack Cubes Set","category":"Travel","price":28.00,"image":"https://d1a4ubvkp2b6va.cloudfront.net/products/71042d3a-a7e5-4f9e-b4c5-5374673b1e86.png","emoji":"🧳","desc":"4 packing cubes. Mesh tops, light, compress well.","longDesc":"Organise your suitcase without bulk. Four nested sizes, mesh so you can see inside, soft fabric that packs down. Weekend or long-haul ready.","badge":"Best Seller","features":["4 sizes","Mesh visibility","Lightweight","Compression friendly","Washable"],"colors":[{"name":"Sage","hex":"#8a9a7a"},{"name":"Black","hex":"#1a1a1a"}],"sizes":[]},
        {"code":"ZAYVI-003","slug":"travel-neck-pillow","name":"Travel Neck Pillow","category":"Travel","price":32.00,"image":"https://slimages.macysassets.com/is/image/MCY/products/2/optimized/36600612_fpx.tif?$filterlrg$&wid=600","emoji":"✈️","desc":"360° memory foam. Washable cover. Packs small.","longDesc":"Proper neck support for flights and long journeys. Soft memory foam, removable cover, compresses into a pouch. Better than cheap U-shaped pillows.","badge":"Best Seller","features":["360° support","Memory foam","Washable cover","Packs small","Adjustable"],"colors":[{"name":"Charcoal","hex":"#3a3a3a"},{"name":"Navy","hex":"#1a1a3e"}],"sizes":[]},
        {"code":"ZAYVI-004","slug":"travel-adapter-140w","name":"Travel Adapter 140W","category":"Travel","price":36.00,"image":"https://m.media-amazon.com/images/I/51SWn4xhvzL.jpg","emoji":"🔌","desc":"Universal adapter. 140W GaN. 3× USB-C + USB-A.","longDesc":"One adapter for 150+ countries. Charge laptop and phone together. Foldable plugs, safety shutters. Built for real travel.","badge":"Best Seller","features":["140W GaN","150+ countries","3× USB-C + 1× USB-A","Foldable plugs","Safety shutters"],"colors":[{"name":"White","hex":"#f5f5f5"},{"name":"Black","hex":"#1a1a1a"}],"sizes":[]},
        {"code":"ZAYVI-005","slug":"essential-daypack","name":"Essential Daypack","category":"Carry","price":78.00,"image":"https://www.evo.com/cdn/shop/files/product-image-1304854.jpg?v=1781110162","emoji":"🎒","desc":"Everyday backpack. Laptop sleeve, water-resistant, clean shape.","longDesc":"Built for daily use without looking like a tech bag. Padded 15 inch sleeve, organisation pockets, water-resistant canvas. Works with workwear or weekends.","badge":"Best Seller","features":["15 inch laptop sleeve","Water-resistant","Internal organisation","Hidden back pocket","Clean silhouette"],"colors":[{"name":"Forest","hex":"#1a5a2a"},{"name":"Black","hex":"#1a1a1a"},{"name":"Navy","hex":"#1a1a3e"}],"sizes":[]},
        {"code":"ZAYVI-006","slug":"everyday-tote","name":"Everyday Tote","category":"Carry","price":52.00,"image":"https://thumbs.dreamstime.com/b/folded-white-tote-bag-product-photography-folded-white-cotton-tote-bag-flat-handles-soft-creases-isolated-white-376221648.jpg","emoji":"👜","desc":"Structured canvas tote. Leather handles. Daily-ready.","longDesc":"The tote that replaces three bags. Structured base, soft leather handles, internal zip pocket. Enough for laptop, bottle and daily kit.","features":["Structured base","Leather handles","Internal zip pocket","Laptop friendly","Minimal design"],"colors":[{"name":"Sand","hex":"#d4b896"},{"name":"Black","hex":"#1a1a1a"},{"name":"Olive","hex":"#4a5a3a"}],"sizes":[]},
        {"code":"ZAYVI-007","slug":"contour-memory-pillow","name":"Contour Memory Pillow","category":"Recovery","price":39.00,"image":"https://dusk.com/cdn/shop/files/memory-foam-standard-pillow-white-715068-cutout.jpg?v=1788275639","emoji":"😴","desc":"Ergonomic memory foam. Cooling cover. Side & back sleepers.","longDesc":"Supports the natural curve of your neck. Contoured foam, removable cooling cover. For side and back sleepers. Inner liner included.","features":["Contoured shape","Cooling cover","Washable","Side & back sleeper","Inner liner"],"colors":[{"name":"White","hex":"#f5f5f5"}],"sizes":[]},
        {"code":"ZAYVI-008","slug":"echo-foam-roller","name":"Echo Foam Roller","category":"Recovery","price":29.00,"image":"https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80","emoji":"🧘","desc":"High-density foam roller. Textured. Built to last.","longDesc":"Recovery that lasts. Firm high-density foam with subtle texture. Use before or after training. 45cm.","features":["High-density foam","Textured surface","45cm","Durable core","Easy to clean"],"colors":[{"name":"Forest Green","hex":"#1a5a2a"},{"name":"Black","hex":"#1a1a1a"}],"sizes":[]},
        {"code":"ZAYVI-009","slug":"resistance-bands-set","name":"Resistance Bands Set","category":"Recovery","price":24.00,"image":"https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&q=80","emoji":"💪","desc":"5 bands + handles, door anchor, carry bag.","longDesc":"Portable strength set. Five levels, foam handles, door anchor, carry bag. Home, travel or add-on to bodyweight work.","features":["5 resistance levels","Foam handles","Door anchor","Carry bag","Portable"],"colors":[{"name":"Multi","hex":"#1a5a2a"}],"sizes":[]},
        {"code":"ZAYVI-010","slug":"led-face-mask","name":"LED Face Mask","category":"Daily","price":59.00,"image":"https://www.celluma.com/cdn/shop/files/Celluma-FACE-acne-red-light-therapy-2000x2000px_1024x1024.jpg?v=1737505626","emoji":"💡","desc":"7-colour LED mask. USB-C. Soft fit.","longDesc":"At-home LED mask with seven modes. Soft silicone, adjustable straps, one-button control. USB-C rechargeable. Cosmetic use only.","features":["7 colour modes","USB-C rechargeable","Soft silicone","Adjustable straps","Cosmetic use only"],"colors":[{"name":"White","hex":"#f5f5f5"}],"sizes":[]},
        {"code":"ZAYVI-011","slug":"lumina-face-cream","name":"Lumina Face Cream","category":"Daily","price":42.00,"image":"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80","emoji":"✨","desc":"Daily moisturiser. Niacinamide + HA. Non-greasy.","longDesc":"Simple, effective daily cream. Niacinamide and hyaluronic acid. Absorbs fast, no stickiness. 50ml.","features":["Niacinamide + HA","Non-greasy","50ml","Clean formula","Daily use"],"colors":[{"name":"Original","hex":"#f5f0e8"}],"sizes":[]},
        {"code":"ZAYVI-012","slug":"makeup-brush-set","name":"Makeup Brush Set","category":"Daily","price":29.00,"image":"https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=80","emoji":"💄","desc":"12-piece synthetic set. Travel roll included.","longDesc":"Full face set in a roll-up case. Soft synthetic bristles for foundation, powder, contour, blush and eyes. Travel-friendly.","features":["12 brushes","Soft synthetic","Travel roll","Full face","Easy to clean"],"colors":[{"name":"Rose Gold","hex":"#b8860c"},{"name":"Black","hex":"#1a1a1a"}],"sizes":[]}
      ]'::jsonb
    )
  LOOP
    INSERT INTO catalogue_products (
      canonical_code,
      slug,
      name,
      brand_name,
      product_type,
      lifecycle_status,
      attributes
    )
    VALUES (
      item->>'code',
      item->>'slug',
      item->>'name',
      'ZAYVI',
      item->>'category',
      'active',
      jsonb_build_object(
        'category', item->>'category',
        'image', item->>'image',
        'emoji', item->>'emoji',
        'desc', item->>'desc',
        'longDesc', item->>'longDesc',
        'badge', item->'badge',
        'features', COALESCE(item->'features', '[]'::jsonb),
        'colors', COALESCE(item->'colors', '[]'::jsonb),
        'sizes', COALESCE(item->'sizes', '[]'::jsonb)
      )
    )
    ON CONFLICT (slug) DO UPDATE
    SET
      canonical_code = EXCLUDED.canonical_code,
      name = EXCLUDED.name,
      brand_name = EXCLUDED.brand_name,
      product_type = EXCLUDED.product_type,
      lifecycle_status = 'active',
      attributes = EXCLUDED.attributes,
      updated_at = now()
    RETURNING id INTO v_product_id;

    INSERT INTO tenant_catalogue_products (
      tenant_id,
      store_id,
      product_id,
      merchant_sku,
      status,
      listing_overrides
    )
    VALUES (
      v_tenant_id,
      v_store_id,
      v_product_id,
      item->>'code',
      'active',
      '{}'::jsonb
    )
    ON CONFLICT (tenant_id, product_id) DO UPDATE
    SET
      store_id = EXCLUDED.store_id,
      merchant_sku = EXCLUDED.merchant_sku,
      status = 'active',
      updated_at = now()
    RETURNING id INTO v_tenant_product_id;

    INSERT INTO tenant_product_markets (
      tenant_id,
      tenant_catalogue_product_id,
      market_code,
      availability_status,
      compliance_status,
      publication_status,
      requires_human_approval,
      customer_price,
      currency_code,
      price_observed_at
    )
    VALUES (
      v_tenant_id,
      v_tenant_product_id,
      'GB',
      'available',
      'pending',
      'pending_review',
      true,
      (item->>'price')::numeric,
      'GBP',
      now()
    )
    ON CONFLICT (tenant_id, tenant_catalogue_product_id, market_code) DO UPDATE
    SET
      availability_status = EXCLUDED.availability_status,
      customer_price = EXCLUDED.customer_price,
      currency_code = EXCLUDED.currency_code,
      price_observed_at = now(),
      updated_at = now();
  END LOOP;
END
$$;

-- The application role has IAM login but deliberately does not own the schema.
-- Grant only the catalogue/store access used by the Preview API.
GRANT SELECT ON tenants, stores, commerce_markets, catalogue_products,
  catalogue_product_variants, catalogue_product_media,
  tenant_catalogue_products, tenant_product_markets
TO zayvi_app;

GRANT INSERT, UPDATE ON catalogue_products, catalogue_product_variants,
  catalogue_product_media, tenant_catalogue_products, tenant_product_markets
TO zayvi_app;

COMMIT;
