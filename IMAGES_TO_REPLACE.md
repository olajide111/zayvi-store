# Product images to replace

Every product image on the store is hot-linked straight from AliExpress's image CDN (`alicdn.com` / `aliexpress-media.com`).
These photos belong to the AliExpress sellers. They have not been licensed to ZAYVI, and they can change or disappear at any time.

**Action:** replace each one with either
1. your own photo of the product, or
2. an image the supplier has given you written permission (a licence) to use,

then host it yourself (for example in `public/products/`) and update the `image:` field for that product in `app/page.tsx`.
The images are still in place for now, because removing them would leave the store with no product photos.

36 products, all of them hot-linked:

| ID | Product | Current image URL (hot-linked) | Host |
|---|---|---|---|
| 1 | Magnetic Flip Wallet Case | https://ae01.alicdn.com/kf/S3841165a6a7044faaf244b7a8ade141cD.jpg | ae01.alicdn.com |
| 2 | Portable USB Blender Bottle | https://ae01.alicdn.com/kf/S060ad94664b44de0bf39b199b2dfc192l.jpg | ae01.alicdn.com |
| 3 | High Density COB LED Strip | https://ae01.alicdn.com/kf/Sdc2a88e0bd7445c5b9cb0ae7074b21f6N.jpg | ae01.alicdn.com |
| 4 | Adjustable Back Support Brace | https://ae01.alicdn.com/kf/S582882d977604d93b158aa0f5748d847P.jpg | ae01.alicdn.com |
| 5 | Smart Cat Water Fountain | https://ae01.alicdn.com/kf/S6c799e5956bb4f96a0e53199022c8925W.jpg | ae01.alicdn.com |
| 6 | Luxury Large Tote Bag | https://ae01.alicdn.com/kf/S2e8f9865374f4636a21ebc81e0fa9b08N.jpg | ae01.alicdn.com |
| 7 | BioloMix Stand Mixer 1200W | https://ae01.alicdn.com/kf/S88a514b7c9fb4fcb8b5502ea92d4e7eaN.jpg | ae01.alicdn.com |
| 8 | Cordless Drill Kit 45Nm | https://ae01.alicdn.com/kf/S0797fa3e8a6d41efb051222b1abc2c41L.jpg | ae01.alicdn.com |
| 9 | Smart WiFi6 HD Projector | https://ae01.alicdn.com/kf/A22fe268bafb24be5a53457e06f39b33e6.png | ae01.alicdn.com |
| 10 | NIBOSI Luxury Men Watch | https://ae01.alicdn.com/kf/S7f47122866f945ad8b9db1af8ffd133b8.jpg | ae01.alicdn.com |
| 11 | Platform Slide Sandals | https://ae01.alicdn.com/kf/Seae4e029658e42fb866840a0146081ccN.jpg | ae01.alicdn.com |
| 12 | 25W USB-C Fast Charger | https://ae01.alicdn.com/kf/S2ff051d0ac9243b8848bdbcf31ad933cL.jpg | ae01.alicdn.com |
| 13 | PDT LED Face Mask 7 Colors | https://ae01.alicdn.com/kf/S3ef6a0b87f744da38fb453cf4d48a0eaW.jpg | ae01.alicdn.com |
| 14 | Face Vacuum Blackhead Remover | https://ae01.alicdn.com/kf/S64f4f062a72b412a859ecb243068bc16C.jpg | ae01.alicdn.com |
| 15 | 24K Gold Skincare Set | https://ae01.alicdn.com/kf/S9e05198ba62d42e69d4e5b63c2e666caA.jpg | ae01.alicdn.com |
| 16 | Professional Makeup Brush Set | https://ae01.alicdn.com/kf/S322337184d9c45a1b510bbe7d2a57f2cd.jpg | ae01.alicdn.com |
| 17 | 78 Color Glitter Eyeshadow Palette | https://ae01.alicdn.com/kf/Sf767bf44e4c24996ba23459779df751bI.jpg | ae01.alicdn.com |
| 18 | 24K Gold Jelly Face Mask | https://ae01.alicdn.com/kf/S49c9dbb7c6674f38b6d05c0ac00f81f6i.jpg | ae01.alicdn.com |
| 19 | Anti-Theft Luggage Strap | https://ae01.alicdn.com/kf/S77e1729c1b254223bcffb59398505b2bY.jpg | ae01.alicdn.com |
| 20 | 360 Travel Neck Pillow | https://ae01.alicdn.com/kf/Sdd903683c01244499a50cc1e23db6342Y.jpg | ae01.alicdn.com |
| 21 | TESSAN 140W Travel Adapter | https://ae01.alicdn.com/kf/S02f14e9d85564070ac38ab3baae861cdQ.jpg | ae01.alicdn.com |
| 22 | JISULIFE Portable Neck Fan | https://ae01.alicdn.com/kf/S3784cfc3f17c4efe839d325ba78a4697K.jpg | ae01.alicdn.com |
| 23 | 4-in-1 Travel Bottle Set | https://ae01.alicdn.com/kf/Sdf2e7d75789d4451823290e8d2d03515y.jpg | ae01.alicdn.com |
| 24 | Contoured Memory Foam Pillow | https://ae01.alicdn.com/kf/S7c23bdd38c8d4a2d9b6767b2b3c88950m.jpg | ae01.alicdn.com |
| 25 | 3D Electric Fireplace Humidifier | https://ae01.alicdn.com/kf/Sc2f922a47c7e4dccb667b79f4e31f9beP.jpg | ae01.alicdn.com |
| 26 | 3D Foam Wall Sticker Panels | https://ae01.alicdn.com/kf/S16b92c7f8503481bbaddda13342776c5z.jpg | ae01.alicdn.com |
| 27 | Stretch Sofa Cover | https://ae-pic-a1.aliexpress-media.com/kf/S00f9c3475d7649449a3b172cb040d62eS.jpg | ae-pic-a1.aliexpress-media.com |
| 28 | Microfibre Bedding Set | https://ae01.alicdn.com/kf/A171e9f326432494fa10d62933f4ef90f0.jpg | ae01.alicdn.com |
| 29 | Marathon Carbon Running Shoes | https://ae01.alicdn.com/kf/Seca37513ac994225ba26995802a6eba6n.jpg | ae01.alicdn.com |
| 30 | 6 Pack Resistance Bands | https://ae01.alicdn.com/kf/S39de7922fbc64441aee4d502a58da3f6f.jpg | ae01.alicdn.com |
| 31 | Ab Wheel Roller | https://ae01.alicdn.com/kf/S93a6b11bd22147bba337615fba13761ej.jpg | ae01.alicdn.com |
| 32 | Knee Brace Compression Sleeve | https://ae01.alicdn.com/kf/S3f7687ca17be4958a1c3678060132123y.jpg | ae01.alicdn.com |
| 33 | Seamless Yoga Sports Bra | https://ae01.alicdn.com/kf/S4751968f50fe435e845f52d53ac9d2aeZ.jpg | ae01.alicdn.com |
| 34 | Men Compression Running Shirt | https://ae01.alicdn.com/kf/S8284dd7403c04090a104effd3e103f2ak.jpg | ae01.alicdn.com |
| 35 | Boxing Reflex Speed Ball | https://ae01.alicdn.com/kf/Sed41b9ee9fb94675a868a8f60030c97fM.jpg | ae01.alicdn.com |
| 36 | Non-Electric Dual Nozzle Bidet | https://ae01.alicdn.com/kf/S5641536aea66425388dd4ab329bb5c951.jpg | ae01.alicdn.com |

`get-images.mjs` in the repo root is the script that scraped these URLs from AliExpress listing pages. Don't use it to source replacement images.
