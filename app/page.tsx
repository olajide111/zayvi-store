"use client";

import { useState, useEffect, useRef } from "react";

const STORE_NAME = "ZAYVI";
const STORE_COLOR = "#16a34a";

const PRODUCTS = [
  {
    id: 1, name: "Magnetic Flip Wallet Case", price: 24.99, compare: 39.99,
    category: "Accessories", badge: "Best Seller", rating: 4.8, reviewCount: 3241,
    sold: 3241, stock: 89, emoji: "💳",
    desc: "Magnetic charging flip wallet case. Holds 3 cards. Compatible with Samsung Galaxy A and S series.",
    longDesc: "Premium leather flip wallet case with built-in magnetic charging support. Fits Samsung Galaxy A06, A16, A55, A35, A25, A15, S25, S24, S23, S22 Ultra and Plus models. Slim profile with 3 card slots and full phone protection.",
    features: ["Magnetic Charging Compatible", "3 Card Slots", "Premium Leather", "Full Body Protection", "Multi-Model Fit"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Brown", hex: "#8B4513" }, { name: "Navy", hex: "#1a1a3e" }],
    sizes: [],
    reviews: [
      { name: "Marcus T.", rating: 5, text: "Perfect fit for my S24. Cards slide in smoothly and magnetic charging still works.", date: "Mar 2025" },
      { name: "Aisha B.", rating: 5, text: "Looks so premium. Everyone asks where I got it.", date: "Feb 2025" },
    ],
  },
  {
    id: 2, name: "Portable USB Blender Bottle", price: 34.99, compare: 54.99,
    category: "Fitness", badge: "Trending", rating: 4.7, reviewCount: 5892,
    sold: 5892, stock: 134, emoji: "🥤",
    desc: "400ml USB rechargeable blender. 6 colours. Makes smoothies, shakes and juices anywhere.",
    longDesc: "Blend protein shakes, smoothies and fruit juices anywhere in seconds. 400ml BPA-free capacity with powerful USB rechargeable motor. 6 stainless steel blades blend ice and frozen fruit with ease. Perfect for gym, office, travel and outdoor use.",
    features: ["USB Rechargeable", "400ml BPA-Free", "6 Stainless Blades", "Portable Travel Size", "Easy Clean Design"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Pink", hex: "#e8a0b0" }, { name: "Blue", hex: "#1a3a6e" }, { name: "Green", hex: "#1a5a2a" }, { name: "White", hex: "#f5f5f5" }, { name: "Purple", hex: "#4a1a7e" }],
    sizes: [],
    reviews: [
      { name: "James O.", rating: 5, text: "Takes it to the gym every day. Charges fast and blends everything perfectly.", date: "Mar 2025" },
      { name: "Fatima K.", rating: 5, text: "Made my morning smoothie routine so much easier.", date: "Mar 2025" },
    ],
  },
  {
    id: 3, name: "High Density COB LED Strip", price: 19.99, compare: 32.99,
    category: "Home", badge: "Viral", rating: 4.9, reviewCount: 8104,
    sold: 8104, stock: 210, emoji: "💡",
    desc: "Ultra high density 336-528 LED strip. Warm to cool white. Dimmable. 12V and 24V.",
    longDesc: "Professional grade FCOB COB LED strip with ultra high density 336 to 528 LEDs per metre. RA90 colour rendering for true natural light. Fully dimmable with smooth continuous light. Available in warm white, natural white and cool white. Works on 12V and 24V systems.",
    features: ["336-528 LEDs Per Metre", "RA90 Colour Rendering", "Fully Dimmable", "12V and 24V", "No Hotspots"],
    colors: [{ name: "Warm White", hex: "#FFD580" }, { name: "Natural White", hex: "#F5F0E0" }, { name: "Cool White", hex: "#E8F4FF" }],
    sizes: ["1 Metre", "2 Metres", "5 Metres"],
    reviews: [
      { name: "Daniel W.", rating: 5, text: "Installed under my kitchen cabinets. The light quality is incredible.", date: "Mar 2025" },
      { name: "Sophie R.", rating: 5, text: "Transformed my bedroom. So much better than cheap LED strips.", date: "Feb 2025" },
    ],
  },
  {
    id: 4, name: "Adjustable Posture Corrector", price: 29.99, compare: 49.99,
    category: "Health", badge: "Top Rated", rating: 4.8, reviewCount: 4320,
    sold: 4320, stock: 76, emoji: "🦴",
    desc: "VBOSi adjustable back support brace. For men and women. Relieves back and shoulder pain.",
    longDesc: "Professionally designed adjustable posture corrector for men and women. Targets upper back, shoulder and spine alignment. Breathable lightweight material comfortable under clothing. Fully adjustable straps fit all body sizes. Wear 20-30 minutes per day to retrain posture muscles.",
    features: ["Unisex Design", "Fully Adjustable", "Breathable Material", "Wear Under Clothing", "Physio Recommended"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Nude", hex: "#c8a882" }],
    sizes: ["S/M", "L/XL", "XXL"],
    reviews: [
      { name: "Chris N.", rating: 5, text: "Been wearing this for 3 weeks. My back pain has reduced massively.", date: "Mar 2025" },
      { name: "Priya M.", rating: 5, text: "Works under my work clothes perfectly.", date: "Feb 2025" },
    ],
  },
  {
    id: 5, name: "Smart Cat Water Fountain", price: 44.99, compare: 69.99,
    category: "Pets", badge: "New Drop", rating: 4.9, reviewCount: 2876,
    sold: 2876, stock: 43, emoji: "🐱",
    desc: "ROJECO wireless automatic pet fountain. 2600mAh battery. Infrared sensor. For cats and dogs.",
    longDesc: "Keep your pets hydrated with the ROJECO smart wireless fountain. 2600mAh rechargeable battery runs for weeks without being plugged in. Intelligent infrared sensor detects your pet and activates water flow automatically. Triple filtration system removes hair, debris and impurities.",
    features: ["2600mAh Battery", "Infrared Sensor", "Triple Filtration", "Ultra Quiet Pump", "Wireless Cordless"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Pink", hex: "#f0d0d8" }],
    sizes: [],
    reviews: [
      { name: "Lisa T.", rating: 5, text: "My cat refused to drink from a bowl. This fountain changed everything.", date: "Mar 2025" },
      { name: "Ben A.", rating: 5, text: "Battery lasts about 3 weeks. My dog loves it.", date: "Mar 2025" },
    ],
  },
  {
    id: 6, name: "Luxury Large Tote Bag", price: 49.99, compare: 79.99,
    category: "Accessories", badge: "Trending", rating: 4.8, reviewCount: 2341,
    sold: 2341, stock: 67, emoji: "👜",
    desc: "2025 large capacity luxury tote. Mommy bag, shoulder bag and commuter bag in one.",
    longDesc: "The ultimate everyday bag for the modern woman. Massive main compartment fits a laptop, water bottle, baby essentials and everything in between. Premium light luxury materials with gold-tone hardware. Multiple inner pockets keep everything organised.",
    features: ["Large Capacity", "Premium Hardware", "Multiple Pockets", "Shoulder and Tote Carry", "Versatile Daily Use"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Brown", hex: "#8B4513" }, { name: "Beige", hex: "#d4b896" }],
    sizes: [],
    reviews: [
      { name: "Amara D.", rating: 5, text: "Fits absolutely everything. I use it as my work bag and gym bag.", date: "Mar 2025" },
      { name: "Rachel P.", rating: 5, text: "Got so many compliments. Looks way more expensive than it is.", date: "Feb 2025" },
    ],
  },
  {
    id: 7, name: "BioloMix Stand Mixer 1200W", price: 89.99, compare: 139.99,
    category: "Home", badge: "Best Seller", rating: 4.9, reviewCount: 4102,
    sold: 4102, stock: 38, emoji: "🍰",
    desc: "1200W professional stand mixer. 6L bowl. 6 speeds. Quiet DC motor. Cream, whisk and dough attachments.",
    longDesc: "Professional grade 1200W stand mixer with whisper-quiet DC motor. 6 litre stainless steel bowl handles large batches. Comes with cream beater, egg whisk and dough hook. 6 speed settings plus pulse function.",
    features: ["1200W Quiet DC Motor", "6 Litre Bowl", "6 Speed Settings", "3 Attachments Included", "Professional Grade"],
    colors: [{ name: "Silver", hex: "#8a8a8a" }, { name: "Black", hex: "#1a1a1a" }, { name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Hannah W.", rating: 5, text: "Replaced my KitchenAid with this. Just as good at a fraction of the price.", date: "Mar 2025" },
      { name: "Tunde B.", rating: 5, text: "The quiet motor is unreal. Kneads bread dough perfectly.", date: "Mar 2025" },
    ],
  },
  {
    id: 8, name: "Cordless Drill Kit 45Nm", price: 54.99, compare: 84.99,
    category: "Home", badge: "New Drop", rating: 4.7, reviewCount: 1893,
    sold: 1893, stock: 55, emoji: "🔧",
    desc: "45Nm cordless drill and screwdriver kit. LED work light. Perfect for home and garden DIY.",
    longDesc: "Complete cordless drill and screwdriver combination kit. 45Nm torque handles wood, metal and masonry. Built-in LED work light illuminates dark spaces. Includes full drill bit and screwdriver bit set. Rechargeable battery with long runtime.",
    features: ["45Nm Torque", "LED Work Light", "Cordless Freedom", "Full Bit Set Included", "Long Battery Life"],
    colors: [{ name: "Yellow", hex: "#f5c518" }, { name: "Black", hex: "#1a1a1a" }],
    sizes: [],
    reviews: [
      { name: "Steve M.", rating: 5, text: "Built an entire shed with this. Never lost power and the torque is impressive.", date: "Mar 2025" },
      { name: "Kevin A.", rating: 4, text: "Great value kit. Does everything a beginner needs.", date: "Feb 2025" },
    ],
  },
  {
    id: 9, name: "Smart WiFi6 HD Projector", price: 119.99, compare: 189.99,
    category: "Home", badge: "Hot", rating: 4.8, reviewCount: 3204,
    sold: 3204, stock: 29, emoji: "🎬",
    desc: "WiFi6 smart projector. Wireless phone sync. HD home cinema. iOS and Android. Perfect for camping and parties.",
    longDesc: "Turn any wall into a cinema with this Smart WiFi6 HD projector. Wirelessly sync your iPhone or Android in seconds. Crisp HD image up to 120 inches. Built-in speaker delivers room-filling sound. Perfect for movie nights, outdoor camping, birthday parties and sports events.",
    features: ["WiFi6 Technology", "Wireless Phone Sync", "Up to 120 Inch Screen", "iOS and Android", "Built-in Speaker"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Black", hex: "#1a1a1a" }],
    sizes: [],
    reviews: [
      { name: "Jay F.", rating: 5, text: "Set this up in my garden for a movie night. 40 people came and the picture was perfect.", date: "Mar 2025" },
      { name: "Chloe R.", rating: 5, text: "Used it camping last weekend. Everyone was blown away.", date: "Feb 2025" },
    ],
  },
  {
    id: 10, name: "NIBOSI Luxury Men Watch", price: 39.99, compare: 64.99,
    category: "Accessories", badge: "Top Rated", rating: 4.8, reviewCount: 6721,
    sold: 6721, stock: 94, emoji: "⌚",
    desc: "NIBOSI luxury waterproof digital quartz watch. Luminous dial. Silicone strap. Date display.",
    longDesc: "NIBOSI top brand luxury watch combining digital and quartz movement. Waterproof construction survives splashes and rain. Super luminous dial readable in complete darkness. Automatic date display. Suits business, casual and sport occasions.",
    features: ["Waterproof Design", "Luminous Dial", "Digital and Quartz", "Date Display", "Silicone Strap"],
    colors: [{ name: "All Black", hex: "#1a1a1a" }, { name: "Silver", hex: "#8a8a8a" }, { name: "Rose Gold", hex: "#b8860c" }, { name: "Blue", hex: "#1a3a6e" }],
    sizes: [],
    reviews: [
      { name: "Michael O.", rating: 5, text: "Wore this to a wedding and got asked where I bought it three times.", date: "Mar 2025" },
      { name: "Sam T.", rating: 5, text: "Build quality is far above the price.", date: "Feb 2025" },
    ],
  },
  {
    id: 11, name: "Platform Slide Sandals", price: 27.99, compare: 44.99,
    category: "Accessories", badge: "Viral", rating: 4.7, reviewCount: 5430,
    sold: 5430, stock: 112, emoji: "👡",
    desc: "2025 fashion platform sandals. Thick sole. Solid colour. Perfect for beach, party and everyday wear.",
    longDesc: "Elevate any outfit with these 2025 fashion platform slide sandals. Chunky thick sole adds height and comfort. Smooth solid colour upper suits casual outfits, beach days, pool parties and summer events. Lightweight and easy to slip on.",
    features: ["Platform Thick Sole", "Slip On Design", "Lightweight Comfort", "Beach and Party Ready", "2025 Fashion Style"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "White", hex: "#f5f5f5" }, { name: "Beige", hex: "#d4b896" }, { name: "Pink", hex: "#e8a0b0" }],
    sizes: ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8"],
    reviews: [
      { name: "Zara K.", rating: 5, text: "Wore these on holiday in Spain. So comfortable for walking all day.", date: "Mar 2025" },
      { name: "Bola A.", rating: 5, text: "Perfect for summer. The platform gives just enough height.", date: "Feb 2025" },
    ],
  },
  {
    id: 12, name: "Samsung 25W Super Fast Charger", price: 19.99, compare: 32.99,
    category: "Accessories", badge: "Best Seller", rating: 4.9, reviewCount: 9841,
    sold: 9841, stock: 200, emoji: "⚡",
    desc: "Samsung 25W super fast charger. USB Type-C. Compatible with Galaxy S24, S23, S22, A54, A34, Z Flip and Fold.",
    longDesc: "Official compatible 25W super fast charger for Samsung Galaxy devices. USB Type-C charges from 0 to 50% in just 30 minutes. Compatible with Galaxy S24, S23, S22, S21, S20, A54, A34, Z Flip, Z Fold and all USB-C Samsung devices. Intelligent chip prevents overcharging.",
    features: ["25W Super Fast Charge", "USB Type-C", "0 to 50% in 30 Minutes", "Overcharge Protection", "Wide Samsung Compatibility"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Emeka J.", rating: 5, text: "Charges my S24 Ultra insanely fast.", date: "Mar 2025" },
      { name: "Nina S.", rating: 5, text: "Bought 3 — one for home, work and my bag.", date: "Mar 2025" },
    ],
  },
  {
    id: 13, name: "PDT LED Face Mask 7 Colors", price: 49.99, compare: 89.99,
    category: "Beauty", badge: "Best Seller", rating: 4.8, reviewCount: 6234,
    sold: 6234, stock: 54, emoji: "✨",
    desc: "287 LED photon light therapy face mask. 7 colors. Skin rejuvenation, anti-aging and acne treatment.",
    longDesc: "Professional grade 287 LED PDT photon light therapy mask used in top salons worldwide. 7 color modes target different skin concerns. Red for anti-aging, blue for acne, green for pigmentation. 20 minute daily sessions deliver visible results within 2 weeks.",
    features: ["287 LEDs", "7 Color Modes", "Anti-Aging and Acne", "Salon Grade", "Rechargeable"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Jade M.", rating: 5, text: "Used this every night for 3 weeks. My skin has never looked better.", date: "Mar 2025" },
      { name: "Tolu A.", rating: 5, text: "Saved me a fortune on salon treatments.", date: "Feb 2025" },
    ],
  },
  {
    id: 14, name: "Face Vacuum Blackhead Remover", price: 29.99, compare: 49.99,
    category: "Beauty", badge: "Trending", rating: 4.7, reviewCount: 8901,
    sold: 8901, stock: 143, emoji: "💆",
    desc: "Electric face vacuum blackhead remover. Dead skin cleansing. 4 suction heads. USB rechargeable.",
    longDesc: "Professional electric facial vacuum that removes blackheads, dead skin and impurities deep from pores. 4 interchangeable suction heads target different areas. 3 suction levels from gentle to deep cleanse. Visible results after first use.",
    features: ["4 Suction Heads", "3 Suction Levels", "USB Rechargeable", "Deep Pore Cleanse", "Visible First Use"],
    colors: [{ name: "Pink", hex: "#e8a0b0" }, { name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Kezia B.", rating: 5, text: "Cleared my blackheads completely in one session.", date: "Mar 2025" },
      { name: "Sade O.", rating: 4, text: "Works really well on my nose.", date: "Feb 2025" },
    ],
  },
  {
    id: 15, name: "24K Gold Hydrating Skincare Set", price: 39.99, compare: 64.99,
    category: "Beauty", badge: "New Drop", rating: 4.8, reviewCount: 3102,
    sold: 3102, stock: 87, emoji: "🌹",
    desc: "QUIYUM 5 piece deep hydration kit. 24K gold and rose petal. Wrinkle smoothing and skin tightening.",
    longDesc: "Luxurious 5 piece skincare gift set infused with 24K gold and rose petal extract. Complete deep hydration system includes cleanser, serum, day cream, night cream and eye cream. Targets wrinkles, dryness and loss of firmness. Comes in premium gift box.",
    features: ["24K Gold Infused", "5 Piece Complete Set", "Deep Hydration", "Anti-Wrinkle Formula", "Perfect Gift Set"],
    colors: [{ name: "Gold", hex: "#b8960c" }],
    sizes: [],
    reviews: [
      { name: "Blessing N.", rating: 5, text: "Bought this as a gift for my mum. Beautiful packaging.", date: "Mar 2025" },
      { name: "Funmi A.", rating: 5, text: "My skin feels incredible after 2 weeks.", date: "Feb 2025" },
    ],
  },
  {
    id: 16, name: "Professional Makeup Brush Set", price: 24.99, compare: 39.99,
    category: "Beauty", badge: "Top Rated", rating: 4.9, reviewCount: 11230,
    sold: 11230, stock: 200, emoji: "💄",
    desc: "Professional soft fluffy makeup brush set. Foundation, powder, eyeshadow, kabuki and blending brushes.",
    longDesc: "Complete professional makeup brush collection with ultra-soft synthetic bristles. Includes foundation, powder, contour, blush, eyeshadow, blending and kabuki brushes. Cruelty-free and hypoallergenic. Comes with storage roll bag.",
    features: ["Ultra-Soft Bristles", "Full Face Set", "Cruelty-Free", "Hypoallergenic", "Storage Bag Included"],
    colors: [{ name: "Rose Gold", hex: "#b8860c" }, { name: "Black", hex: "#1a1a1a" }, { name: "Purple", hex: "#4a1a7e" }],
    sizes: [],
    reviews: [
      { name: "Chisom P.", rating: 5, text: "Best brushes I have ever owned. So soft and blend perfectly.", date: "Mar 2025" },
      { name: "Lauren T.", rating: 5, text: "My old brushes feel like sandpaper compared to these.", date: "Feb 2025" },
    ],
  },
  {
    id: 17, name: "78 Color Glitter Eyeshadow Palette", price: 22.99, compare: 36.99,
    category: "Beauty", badge: "Viral", rating: 4.8, reviewCount: 9876,
    sold: 9876, stock: 167, emoji: "🎨",
    desc: "78 color glitter and matte eyeshadow palette. Waterproof, long lasting pressed powder.",
    longDesc: "78 stunning shades combining matte, shimmer and glitter finishes. Waterproof formula lasts all day without creasing. Highly pigmented pressed powder blends effortlessly. Compact mirror included. Suitable for all skin tones.",
    features: ["78 Shades", "Matte and Glitter Mix", "Waterproof Formula", "Highly Pigmented", "Mirror Included"],
    colors: [{ name: "Multi", hex: "#e8a0b0" }],
    sizes: [],
    reviews: [
      { name: "Yemi S.", rating: 5, text: "The pigmentation is insane. One swipe and the colour is full.", date: "Mar 2025" },
      { name: "Abby W.", rating: 5, text: "Wore the gold shimmer shade to a wedding. Got compliments all night.", date: "Mar 2025" },
    ],
  },
  {
    id: 18, name: "24K Gold Jelly Face Mask", price: 19.99, compare: 32.99,
    category: "Beauty", badge: "Hot", rating: 4.7, reviewCount: 4521,
    sold: 4521, stock: 198, emoji: "🌟",
    desc: "350g hydrating 24K gold soft jelly mask powder. Rose petal crystal formula. Salon spa quality.",
    longDesc: "Professional salon quality 24K gold crystal jelly mask powder. Mix with water to create a luxurious gel mask that peels off cleanly. Rose petal extract brightens and hydrates. 350g tub gives approximately 20 full face treatments.",
    features: ["24K Gold Formula", "Rose Petal Extract", "20 Treatments Per Tub", "Peel Off Design", "All Skin Types"],
    colors: [{ name: "Gold", hex: "#b8960c" }],
    sizes: [],
    reviews: [
      { name: "Ngozi K.", rating: 5, text: "My skin glows after every use. The peel off is so satisfying.", date: "Mar 2025" },
      { name: "Maria L.", rating: 5, text: "Used this at a girls night. Everyone wanted to buy one.", date: "Feb 2025" },
    ],
  },
  {
    id: 19, name: "Anti-Theft Luggage Strap", price: 12.99, compare: 19.99,
    category: "Travel", badge: "", rating: 4.8, reviewCount: 7432,
    sold: 7432, stock: 300, emoji: "🧳",
    desc: "Anti-theft cross strap luggage buckle. Adjustable bundling belt. Keeps suitcases secure during travel.",
    longDesc: "Keep your luggage safe with this adjustable anti-theft cross strap. Durable buckle system locks around your suitcase preventing accidental opening. Fits all suitcase sizes. Bright colours make your luggage easy to spot on the baggage carousel.",
    features: ["Anti-Theft Design", "Fits All Suitcase Sizes", "Adjustable Length", "Durable Buckle", "Easy Identification"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Red", hex: "#8B0000" }, { name: "Blue", hex: "#1a3a6e" }],
    sizes: [],
    reviews: [
      { name: "Dele F.", rating: 5, text: "My suitcase arrived perfectly intact. Peace of mind for every trip.", date: "Mar 2025" },
      { name: "Sarah H.", rating: 4, text: "Very sturdy buckle. Easy to fit and adjust.", date: "Feb 2025" },
    ],
  },
  {
    id: 20, name: "360 Travel Neck Pillow", price: 22.99, compare: 34.99,
    category: "Travel", badge: "Best Seller", rating: 4.8, reviewCount: 5621,
    sold: 5621, stock: 89, emoji: "✈️",
    desc: "COQ 360 degree neck support travel pillow. For flights, office naps and car journeys.",
    longDesc: "The ultimate travel companion for long haul flights and road trips. 360 degree neck support prevents neck strain and head dropping during sleep. Memory foam core adapts to your neck shape. Compact and compressible. Removable washable cover.",
    features: ["360 Degree Support", "Memory Foam Core", "Washable Cover", "Compact and Portable", "Flight and Office"],
    colors: [{ name: "Grey", hex: "#8a8a8a" }, { name: "Navy", hex: "#1a1a3e" }, { name: "Black", hex: "#1a1a1a" }],
    sizes: [],
    reviews: [
      { name: "Kemi A.", rating: 5, text: "Flew 12 hours and slept the whole way. This pillow is life changing.", date: "Mar 2025" },
      { name: "Paul R.", rating: 5, text: "Use it at my desk too. Neck pain completely gone.", date: "Feb 2025" },
    ],
  },
  {
    id: 21, name: "TESSAN 140W Travel Adapter", price: 34.99, compare: 54.99,
    category: "Travel", badge: "Trending", rating: 4.9, reviewCount: 4320,
    sold: 4320, stock: 112, emoji: "🔌",
    desc: "TESSAN 140W GaN international travel adapter. EU, UK, USA and Australia. 3 USB-C and 1 USB-A.",
    longDesc: "The ultimate all-in-one international travel adapter. Works in over 150 countries. 140W GaN technology supports super fast charging. 3 USB-C ports and 1 USB-A charge up to 4 devices simultaneously. Universal AC outlet works with laptops. Compact foldable plug design.",
    features: ["Works in 150+ Countries", "140W GaN Fast Charging", "3 USB-C Ports", "4 Devices Simultaneously", "Compact Foldable"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Black", hex: "#1a1a1a" }],
    sizes: [],
    reviews: [
      { name: "Temi O.", rating: 5, text: "Charged my MacBook, iPhone and iPad simultaneously. Perfect.", date: "Mar 2025" },
      { name: "James W.", rating: 5, text: "Works perfectly in every country I have visited.", date: "Feb 2025" },
    ],
  },
  {
    id: 22, name: "JISULIFE Portable Neck Fan", price: 29.99, compare: 44.99,
    category: "Travel", badge: "Viral", rating: 4.8, reviewCount: 12340,
    sold: 12340, stock: 156, emoji: "💨",
    desc: "JISULIFE 4500mAh wearable neck fan. 100 wind speeds. LED display. Ultra lightweight.",
    longDesc: "Stay cool anywhere with the JISULIFE hands-free wearable neck fan. Massive 4500mAh battery delivers up to 8 hours of continuous use. 100 precise wind speed settings. LED display shows battery level and speed. Perfect for outdoor events, commuting, festivals and hot offices.",
    features: ["4500mAh Battery", "100 Wind Speeds", "LED Display", "8 Hour Runtime", "Hands-Free Design"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Black", hex: "#1a1a1a" }, { name: "Pink", hex: "#e8a0b0" }],
    sizes: [],
    reviews: [
      { name: "Ife B.", rating: 5, text: "Wore this at an outdoor festival all day. Never got hot once.", date: "Mar 2025" },
      { name: "Grace P.", rating: 5, text: "Perfect for my hot office. The 100 speeds mean I can get it exactly right.", date: "Mar 2025" },
    ],
  },
  {
    id: 23, name: "4-in-1 Travel Bottle Set", price: 15.99, compare: 24.99,
    category: "Travel", badge: "", rating: 4.7, reviewCount: 6780,
    sold: 6780, stock: 243, emoji: "🧴",
    desc: "4-in-1 leak proof travel dispenser set. For perfume, shampoo, conditioner and lotion. TSA approved.",
    longDesc: "Never suffer leaking toiletries again. 4 leak-proof travel bottles in TSA approved sizes. Fill with your favourite products. Airtight caps and secure seals prevent leakage. Transparent bottles show fill levels at a glance. Reusable and eco-friendly.",
    features: ["4 Bottles Included", "100% Leak Proof", "TSA Approved Size", "Transparent Design", "Reusable and Eco"],
    colors: [{ name: "Clear", hex: "#e8f4e8" }, { name: "Pink", hex: "#e8a0b0" }],
    sizes: [],
    reviews: [
      { name: "Ada C.", rating: 5, text: "Travelled with my favourite products without any leaks. Game changer.", date: "Mar 2025" },
      { name: "Tom B.", rating: 4, text: "Very secure lids. Survived a 10 hour flight with no issues.", date: "Feb 2025" },
    ],
  },
  {
    id: 24, name: "Ergonomic Cervical Pillow", price: 34.99, compare: 54.99,
    category: "Health", badge: "Top Rated", rating: 4.8, reviewCount: 5430,
    sold: 5430, stock: 76, emoji: "😴",
    desc: "Ergonomic cervical traction pillow. Supports all sleeping positions. Anti-snoring and body relaxation.",
    longDesc: "Wake up pain free with this ergonomically designed cervical traction pillow. Dual height contour supports both back and side sleeping positions. Memory foam core adapts to your exact neck shape. Promotes natural spinal alignment reducing neck pain and snoring.",
    features: ["Cervical Traction Design", "All Sleep Positions", "Memory Foam Core", "Anti-Snoring", "Cooling Cover"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Bola T.", rating: 5, text: "Woke up without neck pain for the first time in years.", date: "Mar 2025" },
      { name: "Karen S.", rating: 5, text: "My husband stopped snoring within a week of using this.", date: "Feb 2025" },
    ],
  },
  {
    id: 25, name: "3D Electric Fireplace Humidifier", price: 59.99, compare: 94.99,
    category: "Home", badge: "Viral", rating: 4.9, reviewCount: 7832,
    sold: 7832, stock: 48, emoji: "🔥",
    desc: "3D water vapor atomized electric fireplace. Realistic steam flame effect. Room humidifier and decoration.",
    longDesc: "Create cosy fireplace ambience without any heat or fire risk. 3D water vapor technology creates stunningly realistic flickering flame effect. Doubles as a room humidifier. Colourful LED lighting with multiple flame colour options. Safe around children and pets.",
    features: ["Realistic 3D Flame Effect", "Built-In Humidifier", "Colourful LED Lighting", "Safe No Heat Flame", "Remote Control"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Nora K.", rating: 5, text: "Looks absolutely stunning in my living room. The flame is incredibly realistic.", date: "Mar 2025" },
      { name: "David A.", rating: 5, text: "The humidifier function is brilliant too.", date: "Feb 2025" },
    ],
  },
  {
    id: 26, name: "3D Foam Wall Sticker Panels", price: 17.99, compare: 28.99,
    category: "Home", badge: "Trending", rating: 4.7, reviewCount: 9123,
    sold: 9123, stock: 312, emoji: "🏠",
    desc: "Self-adhesive 3D foam wall panels. Peel and stick. Suitable for living room, bedroom and ceiling.",
    longDesc: "Transform any wall in minutes with self-adhesive 3D foam wall panels. Simply peel and stick — no tools needed. Waterproof and easy to wipe clean. Can be cut to size. Removable without damaging walls. Perfect for renters.",
    features: ["Peel and Stick", "No Tools Needed", "Waterproof", "Renter Friendly", "Cut to Size"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Grey", hex: "#8a8a8a" }, { name: "Beige", hex: "#d4b896" }],
    sizes: [],
    reviews: [
      { name: "Ola F.", rating: 5, text: "Transformed my bedroom wall in 30 minutes. Looks like professional work.", date: "Mar 2025" },
      { name: "Lisa M.", rating: 4, text: "Easy to apply and looks great. Perfect for a rental.", date: "Feb 2025" },
    ],
  },
  {
    id: 27, name: "Stretch Sofa Cover", price: 27.99, compare: 44.99,
    category: "Home", badge: "", rating: 4.7, reviewCount: 8234,
    sold: 8234, stock: 189, emoji: "🛋️",
    desc: "Jacquard stretch recliner sofa cover. Non-slip elastic slipcover. Protects sofas and armchairs.",
    longDesc: "Give your sofa a fresh new look without replacing it. Premium jacquard fabric with built-in stretch fits most sofa shapes. Non-slip bottom stays perfectly in place. Machine washable. Protects against pet hair, spills and scratches.",
    features: ["Universal Stretch Fit", "Non-Slip Bottom", "Machine Washable", "Pet and Spill Protection", "Jacquard Fabric"],
    colors: [{ name: "Grey", hex: "#8a8a8a" }, { name: "Beige", hex: "#d4b896" }, { name: "Dark Brown", hex: "#3a2010" }, { name: "Navy", hex: "#1a1a3e" }],
    sizes: ["Armchair", "2 Seater", "3 Seater", "L-Shape"],
    reviews: [
      { name: "Abby N.", rating: 5, text: "My sofa looks brand new. The non-slip backing is excellent.", date: "Mar 2025" },
      { name: "Cath P.", rating: 4, text: "Great quality fabric. Fits my 3 seater perfectly.", date: "Feb 2025" },
    ],
  },
  {
    id: 28, name: "Microfibre Bedding Set", price: 34.99, compare: 54.99,
    category: "Home", badge: "Best Seller", rating: 4.9, reviewCount: 14320,
    sold: 14320, stock: 234, emoji: "🛏️",
    desc: "4 piece soft brushed microfibre bedding set with fitted sheet. UK Single, Double, King and Super King.",
    longDesc: "Hotel quality 4 piece bedding set at a fraction of the price. Duvet cover, 2 pillowcases and fitted sheet in ultra-soft brushed microfibre. Gets softer with every wash. Breathable fabric regulates temperature year round. Machine washable and quick drying.",
    features: ["4 Piece Set", "Ultra-Soft Microfibre", "Gets Softer with Washing", "All UK Sizes", "Easy Care"],
    colors: [{ name: "White", hex: "#f5f5f5" }, { name: "Grey", hex: "#8a8a8a" }, { name: "Navy", hex: "#1a1a3e" }, { name: "Blush Pink", hex: "#e8c0c8" }],
    sizes: ["Single", "Double", "King", "Super King"],
    reviews: [
      { name: "Yinka B.", rating: 5, text: "Feels like sleeping in a 5 star hotel. Bought 3 sets for every bed.", date: "Mar 2025" },
      { name: "Emma T.", rating: 5, text: "Washes beautifully and does not crease badly.", date: "Feb 2025" },
    ],
  },
  {
    id: 29, name: "Marathon Carbon Running Shoes", price: 64.99, compare: 99.99,
    category: "Fitness", badge: "New Drop", rating: 4.8, reviewCount: 3241,
    sold: 3241, stock: 67, emoji: "👟",
    desc: "Carbon board marathon running shoes. Breathable lightweight. Non-slip. For men and women.",
    longDesc: "Professional grade marathon running shoes with carbon fibre board for maximum energy return. Ultra-lightweight breathable upper keeps feet cool. Non-slip rubber outsole grips all surfaces. Cushioned midsole protects knees and joints. Suitable for road running, treadmill and race day.",
    features: ["Carbon Board Sole", "Ultra-Lightweight", "Breathable Upper", "Non-Slip Outsole", "Joint Protecting Cushion"],
    colors: [{ name: "Black White", hex: "#1a1a1a" }, { name: "Blue White", hex: "#1a3a6e" }, { name: "Pink White", hex: "#e8a0b0" }],
    sizes: ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    reviews: [
      { name: "Emeka R.", rating: 5, text: "Ran my first half marathon in these. The carbon plate is genuinely noticeable.", date: "Mar 2025" },
      { name: "Claire B.", rating: 5, text: "Lightest shoes I have ever owned. My pace improved immediately.", date: "Feb 2025" },
    ],
  },
  {
    id: 30, name: "6 Pack Resistance Bands", price: 18.99, compare: 29.99,
    category: "Fitness", badge: "Best Seller", rating: 4.9, reviewCount: 18920,
    sold: 18920, stock: 400, emoji: "💪",
    desc: "6 piece crossfit resistance band set. 6 resistance levels. Home gym, yoga and strength training.",
    longDesc: "Complete resistance band set for full body workouts anywhere. 6 bands with progressively increasing resistance. Made from 100% natural latex. Perfect for squats, glute workouts, arm exercises, yoga and pilates. Comes with carry bag and exercise guide.",
    features: ["6 Resistance Levels", "Natural Latex", "Full Body Workout", "Carry Bag Included", "Exercise Guide"],
    colors: [{ name: "Multi", hex: "#f5c518" }],
    sizes: [],
    reviews: [
      { name: "Jade W.", rating: 5, text: "Use these every morning. Quality far better than cheap ones that snap.", date: "Mar 2025" },
      { name: "Femi A.", rating: 5, text: "Travelled with these and worked out in my hotel room every day.", date: "Feb 2025" },
    ],
  },
  {
    id: 31, name: "Ab Wheel Roller", price: 22.99, compare: 34.99,
    category: "Fitness", badge: "Trending", rating: 4.8, reviewCount: 7654,
    sold: 7654, stock: 143, emoji: "🏋️",
    desc: "6 elbow design ab wheel with automatic rebound. Anti-slip. Core and abdominal workout equipment.",
    longDesc: "Build a stronger core with the 6 elbow ab wheel roller. Automatic rebound mechanism assists beginners. Wide anti-slip wheel provides stability. Ergonomic foam handles reduce wrist strain. Targets abs, obliques, back and shoulders in one movement.",
    features: ["Automatic Rebound", "6 Elbow Stability", "Anti-Slip Wheel", "Foam Handles", "Full Core Workout"],
    colors: [{ name: "Black Red", hex: "#8B0000" }, { name: "Black Blue", hex: "#1a3a6e" }],
    sizes: [],
    reviews: [
      { name: "Tunde K.", rating: 5, text: "Visible abs after 6 weeks of daily use.", date: "Mar 2025" },
      { name: "Steve A.", rating: 4, text: "Solid build quality. Much better than cheap rollers.", date: "Feb 2025" },
    ],
  },
  {
    id: 32, name: "Knee Brace Compression Sleeve", price: 16.99, compare: 26.99,
    category: "Health", badge: "", rating: 4.8, reviewCount: 12450,
    sold: 12450, stock: 300, emoji: "🦵",
    desc: "Knee brace support compression sleeve. For gym, running and sports. Joint pain relief.",
    longDesc: "Medically designed knee compression sleeve for pain relief and injury support. Graduated compression reduces swelling and improves circulation. Non-slip silicone strips keep it in position during any activity. Breathable fabric prevents overheating. Suitable for arthritis, runner knee, sports injuries and recovery.",
    features: ["Graduated Compression", "Non-Slip Silicone", "Breathable Fabric", "Pain Relief", "All Activity Use"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Grey", hex: "#8a8a8a" }],
    sizes: ["S", "M", "L", "XL"],
    reviews: [
      { name: "Mike O.", rating: 5, text: "Wore this during a 10K run. Knee pain completely managed.", date: "Mar 2025" },
      { name: "Pat S.", rating: 5, text: "Most comfortable knee support I have tried.", date: "Feb 2025" },
    ],
  },
  {
    id: 33, name: "Seamless Yoga Sports Bra", price: 21.99, compare: 34.99,
    category: "Fitness", badge: "Hot", rating: 4.8, reviewCount: 9870,
    sold: 9870, stock: 178, emoji: "🧘",
    desc: "HISTELLO seamless sports bra vest. Quick-dry. High elastic. For yoga, running and gym.",
    longDesc: "High performance seamless sports bra and vest in one. Ultra-stretch fabric moves with your body. Quick-dry technology wicks moisture. Removable padding for adjustable support. Flatlock seams prevent chafing. Suitable for yoga, pilates, running and gym.",
    features: ["Seamless Construction", "Quick-Dry Fabric", "Removable Padding", "High Stretch", "No Chafe Seams"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Grey", hex: "#8a8a8a" }, { name: "Pink", hex: "#e8a0b0" }, { name: "Green", hex: "#1a5a2a" }],
    sizes: ["XS", "S", "M", "L", "XL"],
    reviews: [
      { name: "Olu B.", rating: 5, text: "Most comfortable sports bra I own. Stays in place through intense workouts.", date: "Mar 2025" },
      { name: "Nadia P.", rating: 5, text: "Wear this to yoga every day.", date: "Feb 2025" },
    ],
  },
  {
    id: 34, name: "Men Compression Running Shirt", price: 24.99, compare: 39.99,
    category: "Fitness", badge: "", rating: 4.7, reviewCount: 6543,
    sold: 6543, stock: 134, emoji: "🏃",
    desc: "Men long sleeve compression t-shirt. Quick-dry. Gym, jogging and athletic training top.",
    longDesc: "High performance long sleeve compression shirt for men. Graduated compression improves blood flow and reduces muscle fatigue. Quick-dry fabric pulls sweat away instantly. Four-way stretch moves with every exercise. Suitable for running, gym, cycling and all athletic training.",
    features: ["Graduated Compression", "Quick-Dry Fabric", "Four-Way Stretch", "Anti-Odour", "No Irritation Stitching"],
    colors: [{ name: "Black", hex: "#1a1a1a" }, { name: "Navy", hex: "#1a1a3e" }, { name: "Grey", hex: "#8a8a8a" }, { name: "Red", hex: "#8B0000" }],
    sizes: ["S", "M", "L", "XL", "XXL"],
    reviews: [
      { name: "Biodun A.", rating: 5, text: "Wear this for every gym session. The compression makes a difference.", date: "Mar 2025" },
      { name: "Ryan C.", rating: 4, text: "Great fit and very breathable. Washed 20 times and still looks new.", date: "Feb 2025" },
    ],
  },
  {
    id: 35, name: "Boxing Reflex Speed Ball", price: 14.99, compare: 22.99,
    category: "Fitness", badge: "Viral", rating: 4.7, reviewCount: 15230,
    sold: 15230, stock: 267, emoji: "🥊",
    desc: "Head-mounted boxing reflex speed ball. Improves reaction time, speed and coordination.",
    longDesc: "Train your reflexes, speed and hand-eye coordination anywhere. Adjustable elastic band fits all head sizes. The unpredictable bounce pattern dramatically improves reaction time. Perfect for boxing training, MMA, stress relief and general fitness. No gym needed.",
    features: ["Improves Reaction Time", "Adjustable Head Strap", "Unpredictable Bounce", "Use Anywhere", "Stress Relief"],
    colors: [{ name: "Black Red", hex: "#8B0000" }, { name: "Black Blue", hex: "#1a3a6e" }],
    sizes: [],
    reviews: [
      { name: "Dele M.", rating: 5, text: "My boxing coach is amazed at how much my speed improved.", date: "Mar 2025" },
      { name: "Josh T.", rating: 5, text: "Kids love it too. Great for hand eye coordination.", date: "Feb 2025" },
    ],
  },
  {
    id: 36, name: "Non-Electric Dual Nozzle Bidet", price: 29.99, compare: 49.99,
    category: "Home", badge: "Top Rated", rating: 4.8, reviewCount: 11230,
    sold: 11230, stock: 98, emoji: "🚿",
    desc: "SAMODRA non-electric self-cleaning bidet. Dual nozzle frontal and rear wash. Easy toilet attachment.",
    longDesc: "Upgrade your bathroom hygiene instantly. No electricity required — connects directly to your existing water supply. Dual nozzle system provides both frontal and rear wash. Self-cleaning nozzles retract when not in use. Adjustable water pressure. Fits most standard toilet seats in minutes.",
    features: ["No Electricity Needed", "Dual Nozzle System", "Self-Cleaning Nozzles", "Adjustable Pressure", "Easy 10 Min Install"],
    colors: [{ name: "White", hex: "#f5f5f5" }],
    sizes: [],
    reviews: [
      { name: "Chidi F.", rating: 5, text: "Installed in 10 minutes. Can never go back to not having one.", date: "Mar 2025" },
      { name: "Anne B.", rating: 5, text: "The self-cleaning feature is brilliant. So hygienic.", date: "Feb 2025" },
    ],
  },
];

const CATS = ["All","Travel","Outdoors","Pets","Fitness","Home","Beauty","Health","Accessories"];

const BADGE_MAP: Record<string, [string, string]> = {
  "Best Seller":["#fff8e1","#b45309"],
  "Trending":   ["#e0f2fe","#0369a1"],
  "Top Rated":  ["#f0fdf4","#15803d"],
  "New Drop":   ["#fdf4ff","#7e22ce"],
  "Viral":      ["#fff1f2","#be123c"],
  "Hot":        ["#fff7ed","#c2410c"],
};

const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2025\n\nWe collect your name, email and shipping address to fulfil your order. We use Stripe for payments and never store your card details.\n\nWe may send marketing emails if you opt in. You can unsubscribe at any time. We do not sell your data to third parties.\n\nFor questions: hello@vyvostore.shop",
  },
  returns: {
    title: "Returns Policy",
    body: "We offer a 30-day return window on all products.\n\nHow to return:\n1. Email hello@vyvostore.shop within 30 days of delivery\n2. Include your order number and reason for return\n3. We will send return instructions\n4. Refund processed within 5 business days\n\nItems must be unused and in original packaging.",
  },
  shipping: {
    title: "Shipping Information",
    body: "We ship worldwide. All orders include a tracking number sent by email.\n\nDelivery Times:\n• United Kingdom: 7-14 days\n• United States: 8-14 days\n• Europe: 10-16 days\n• Australia / Canada: 10-18 days\n• Rest of World: 12-21 days\n\nFree shipping on orders over $75.\nStandard shipping: $6.99",
  },
  contact: {
    title: "Contact Us",
    body: "We are here to help.\n\nEmail: hello@vyvostore.shop\nResponse time: within 24 hours on business days\n\nFor order tracking include your order number in the subject line.\n\nBusiness hours: Monday to Friday, 9am to 6pm GMT",
  },
  faqs: {
    title: "Frequently Asked Questions",
    body: "How long does delivery take?\nMost orders arrive in 7-14 days.\n\nCan I track my order?\nYes. You will receive a tracking link by email once dispatched.\n\nWhat if my item arrives damaged?\nEmail us with a photo and we will send a replacement or full refund immediately.\n\nHow do I return an item?\nSee our Returns Policy. We offer 30-day returns on all items.\n\nDo you offer free shipping?\nYes — free worldwide shipping on all orders over $75.\n\nWhich payment methods do you accept?\nVisa, Mastercard, Apple Pay, Google Pay and all major cards via Stripe.",
  },
  about: {
    title: "About Us",
    body: "ZAYVI is an AI-powered ecommerce store that discovers trending products from around the world and delivers them to your door.\n\nOur machine learning system scans thousands of products daily, scoring each one on demand, margin, competition and trend velocity. Only the best make it to our store.\n\nWe offer free worldwide shipping on orders over $75 and a 30-day returns guarantee on everything.\n\nThank you for shopping with us.",
  },
};

function Stars({ n, sz = 13 }: { n: number; sz?: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: sz, letterSpacing: -1 }}>
      {"★".repeat(Math.floor(n))}{"☆".repeat(5 - Math.floor(n))}
    </span>
  );
}

function BadgePill({ label }: { label: string }) {
  if (!label) return null;
  const [bg, fg] = BADGE_MAP[label] || ["#f0f0f0","#555"];
  return (
    <span style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700,
      padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ColorDot({ color, active, onClick }: {
  color: { name: string; hex: string }; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={color.name}
      style={{ width: 22, height: 22, borderRadius: "50%", background: color.hex,
        border: "none", cursor: "pointer", flexShrink: 0,
        outline: active ? "2px solid #111" : "2px solid transparent",
        outlineOffset: 2, transition: "outline .15s" }} />
  );
}

function PageModal({ pageKey, onClose }: { pageKey: string; onClose: () => void }) {
  const p = PAGES[pageKey];
  if (!p) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)", zIndex: 1400, backdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1401,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, width: "100%",
          maxWidth: 580, maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,.3)" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>{p.title}</div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%",
              border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
              fontSize: 16, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#777" }}>✕</button>
          </div>
          <div style={{ padding: 24 }}>
            {p.body.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "#555", lineHeight: 1.9,
                marginBottom: 16, whiteSpace: "pre-line" }}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface CartItem {
  id: number; name: string; emoji: string;
  price: number; qty: number; selectedColor?: string;
}

function CartDrawer({ cart, open, onClose, onQty, onRemove }: {
  cart: CartItem[]; open: boolean; onClose: () => void;
  onQty: (id: number, color: string | undefined, d: number) => void;
  onRemove: (id: number, color: string | undefined) => void;
}) {
  const sub  = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const cnt  = cart.reduce((a, i) => a + i.qty, 0);
  const left = Math.max(0, 75 - sub);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.45)", zIndex: 1100,
        opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none",
        transition: "opacity .3s" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "#fff", zIndex: 1101, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .35s cubic-bezier(.4,0,.2,1)",
        boxShadow: "-8px 0 40px rgba(0,0,0,.14)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Your Cart</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {cnt} item{cnt !== 1 ? "s" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%",
            border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
            fontSize: 16, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#777" }}>✕</button>
        </div>
        <div style={{ padding: "12px 24px", background: "#fafafa",
          borderBottom: "1px solid #f0f0f0" }}>
          {left > 0
            ? <div style={{ fontSize: 12, color: "#555" }}>
                Add <b style={{ color: "#111" }}>${left.toFixed(2)}</b> more for{" "}
                <b style={{ color: "#111" }}>FREE shipping</b>
              </div>
            : <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                You unlocked FREE shipping!
              </div>
          }
          <div style={{ height: 4, background: "#e5e5e5", borderRadius: 2, marginTop: 8 }}>
            <div style={{ width: `${Math.min(100, (sub / 75) * 100)}%`, height: "100%",
              background: "#16a34a", borderRadius: 2, transition: "width .4s" }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {cart.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 14, color: "#aaa" }}>Your cart is empty</div>
              </div>
            : cart.map(item => (
              <div key={`${item.id}-${item.selectedColor}`}
                style={{ display: "flex", gap: 14, paddingBottom: 16, marginBottom: 16,
                  borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ width: 68, height: 68, background: "#f9f9f9", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, flexShrink: 0 }}>{item.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </div>
                  {item.selectedColor && (
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                      {item.selectedColor}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginTop: 8 }}>
                    <div style={{ display: "flex", border: "1px solid #e5e5e5",
                      borderRadius: 6, overflow: "hidden" }}>
                      <button onClick={() => onQty(item.id, item.selectedColor, -1)}
                        style={{ width: 28, height: 28, background: "none", border: "none",
                          cursor: "pointer", fontSize: 16, color: "#888" }}>−</button>
                      <span style={{ width: 28, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 13, fontWeight: 600,
                        color: "#111" }}>{item.qty}</span>
                      <button onClick={() => onQty(item.id, item.selectedColor, 1)}
                        style={{ width: 28, height: 28, background: "none", border: "none",
                          cursor: "pointer", fontSize: 16, color: "#888" }}>+</button>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>
                        ${(item.price * item.qty).toFixed(2)}
                      </div>
                      <button onClick={() => onRemove(item.id, item.selectedColor)}
                        style={{ fontSize: 10, color: "#ccc", background: "none",
                          border: "none", cursor: "pointer", marginTop: 2 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        {cart.length > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#888" }}>Subtotal</span>
              <span style={{ fontSize: 13, color: "#555" }}>${sub.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#888" }}>Shipping</span>
              <span style={{ fontSize: 13, color: sub >= 75 ? "#16a34a" : "#555" }}>
                {sub >= 75 ? "FREE" : "$6.99"}
              </span>
            </div>
            <button
              onClick={async () => {
                const res = await fetch('/api/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: cart }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              style={{ width: "100%", background: "#111", color: "#fff",
                border: "none", borderRadius: 10, padding: "14px", cursor: "pointer",
                fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              Checkout · ${(sub + (sub >= 75 ? 0 : 6.99)).toFixed(2)}
            </button>
            <div style={{ textAlign: "center", fontSize: 11, color: "#bbb" }}>
              Stripe · Apple Pay · Google Pay
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function QuickView({ product, open, onClose, onAdd }: {
  product: typeof PRODUCTS[0] | null; open: boolean;
  onClose: () => void;
  onAdd: (p: typeof PRODUCTS[0], qty: number, color: string | undefined) => void;
}) {
  const [qty,   setQty]   = useState(1);
  const [col,   setCol]   = useState(0);
  const [sz,    setSz]    = useState(0);
  const [tab,   setTab]   = useState("desc");
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (open) { setQty(1); setCol(0); setTab("desc"); setAdded(false); }
  }, [open]);
  if (!product) return null;
  const save = (((product.compare - product.price) / product.compare) * 100).toFixed(0);
  const handleAdd = () => {
    onAdd(product, qty, product.colors[col]?.name);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)", zIndex: 1200,
        opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none",
        transition: "opacity .3s" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1201,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, pointerEvents: open ? "all" : "none" }}>
        <div style={{ background: "#fff", borderRadius: 20, width: "100%",
          maxWidth: 860, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,.25)",
          transform: open ? "scale(1)" : "scale(.96)",
          opacity: open ? 1 : 0, transition: "all .3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ background: "#f9f9f9", borderRadius: "20px 0 0 20px",
              padding: 32, display: "flex", flexDirection: "column",
              gap: 16, minHeight: 500 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 110 }}>{product.emoji}</div>
              {product.stock < 30 && (
                <div style={{ textAlign: "center", fontSize: 11, color: "#dc2626",
                  background: "#fef2f2", padding: "6px 12px", borderRadius: 6 }}>
                  Only {product.stock} left
                </div>
              )}
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column",
              gap: 14, position: "relative" }}>
              <button onClick={onClose} style={{ position: "absolute", top: 16,
                right: 16, width: 32, height: 32, borderRadius: "50%",
                border: "1px solid #eee", background: "#fafafa", cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#999" }}>✕</button>
              {product.badge && <div><BadgePill label={product.badge} /></div>}
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111",
                lineHeight: 1.2, margin: 0 }}>{product.name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Stars n={product.rating} sz={14} />
                <span style={{ fontSize: 12, color: "#888" }}>
                  {product.rating} ({product.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>${product.price}</span>
                <span style={{ fontSize: 15, color: "#ccc", textDecoration: "line-through" }}>${product.compare}</span>
                <span style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a",
                  padding: "3px 8px", borderRadius: 5, fontWeight: 700 }}>Save {save}%</span>
              </div>
              {product.colors.length > 1 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                    letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Colour — <span style={{ color: "#111", textTransform: "none",
                      fontWeight: 600 }}>{product.colors[col].name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {product.colors.map((c, i) => (
                      <ColorDot key={i} color={c} active={col === i} onClick={() => setCol(i)} />
                    ))}
                  </div>
                </div>
              )}
              {product.sizes.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                    letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Size</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {product.sizes.map((s, i) => (
                      <button key={i} onClick={() => setSz(i)}
                        style={{ padding: "6px 14px",
                          border: `1px solid ${sz === i ? "#111" : "#e5e5e5"}`,
                          borderRadius: 6, background: sz === i ? "#111" : "#fff",
                          color: sz === i ? "#fff" : "#555",
                          fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888",
                  letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Qty</div>
                <div style={{ display: "inline-flex", alignItems: "center",
                  border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 38, height: 38, background: "#fafafa",
                      border: "none", cursor: "pointer", fontSize: 18, color: "#555" }}>−</button>
                  <span style={{ width: 42, textAlign: "center",
                    fontSize: 15, fontWeight: 700, color: "#111" }}>{qty}</span>
                  <button onClick={() => setQty(q => q + 1)}
                    style={{ width: 38, height: 38, background: "#fafafa",
                      border: "none", cursor: "pointer", fontSize: 18, color: "#555" }}>+</button>
                </div>
              </div>
              <button onClick={handleAdd}
                style={{ background: added ? "#16a34a" : "#111", color: "#fff",
                  border: "none", borderRadius: 10, padding: "14px",
                  cursor: "pointer", fontSize: 14, fontWeight: 800,
                  transition: "background .3s" }}>
                {added ? "Added!" : `Add to Cart — $${(product.price * qty).toFixed(2)}`}
              </button>
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center" }}>
                Free shipping · 30-day returns · Secure checkout
              </div>
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
                <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", marginBottom: 12 }}>
                  {[["desc","Description"],["feat","Features"],["rev","Reviews"]].map(([k,l]) => (
                    <button key={k} onClick={() => setTab(k)}
                      style={{ padding: "7px 14px", border: "none", background: "none",
                        cursor: "pointer", fontSize: 12,
                        fontWeight: tab === k ? 700 : 400,
                        color: tab === k ? "#111" : "#aaa",
                        borderBottom: `2px solid ${tab === k ? "#111" : "transparent"}`,
                        marginBottom: -1 }}>
                      {l}{k === "rev" ? ` (${product.reviews.length})` : ""}
                    </button>
                  ))}
                </div>
                {tab === "desc" && <p style={{ fontSize: 13, color: "#666", lineHeight: 1.8, margin: 0 }}>{product.longDesc}</p>}
                {tab === "feat" && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {product.features.map((f, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, fontSize: 13,
                        color: "#555", padding: "4px 0", alignItems: "center" }}>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                )}
                {tab === "rev" && product.reviews.map((r, i) => (
                  <div key={i} style={{ marginBottom: 12, paddingBottom: 12,
                    borderBottom: i < product.reviews.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%",
                          background: "#f0f0f0", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#888" }}>
                          {r.name[0]}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{r.name}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#ccc" }}>{r.date}</span>
                    </div>
                    <Stars n={r.rating} sz={11} />
                    <p style={{ fontSize: 12, color: "#666", marginTop: 4, lineHeight: 1.6 }}>{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ product, onView, onAdd }: {
  product: typeof PRODUCTS[0];
  onView: (p: typeof PRODUCTS[0]) => void;
  onAdd: (p: typeof PRODUCTS[0], qty: number, color: string | undefined) => void;
}) {
  const [hov,  setHov]  = useState(false);
  const [col,  setCol]  = useState(0);
  const [wish, setWish] = useState(false);
  const save = (((product.compare - product.price) / product.compare) * 100).toFixed(0);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer",
        boxShadow: hov ? "0 16px 48px rgba(0,0,0,.13)" : "0 2px 8px rgba(0,0,0,.05)",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        transition: "all .2s ease" }}>
      <div onClick={() => onView(product)}
        style={{ background: "#f9f9f9", height: 210, display: "flex",
          alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ fontSize: 84, transform: hov ? "scale(1.08)" : "scale(1)",
          transition: "transform .3s" }}>{product.emoji}</div>
        {product.badge && (
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <BadgePill label={product.badge} />
          </div>
        )}
        <div style={{ position: "absolute", top: 12, right: 12,
          background: "#fff", color: "#16a34a", fontSize: 10, fontWeight: 700,
          padding: "3px 8px", borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
          -{save}%
        </div>
        <button onClick={e => { e.stopPropagation(); setWish(w => !w); }}
          style={{ position: "absolute", bottom: 12, right: 12, width: 32, height: 32,
            borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
            transform: hov ? "scale(1)" : "scale(0)", transition: "transform .2s",
            color: wish ? "#dc2626" : "#ccc" }}>
          {wish ? "♥" : "♡"}
        </button>
        {product.stock < 30 && (
          <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10,
            color: "#dc2626", background: "#fff", padding: "3px 8px", borderRadius: 5,
            fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
            Only {product.stock} left
          </div>
        )}
        {hov && (
          <div style={{ position: "absolute", inset: 0, display: "flex",
            alignItems: "flex-end", justifyContent: "center", paddingBottom: 14 }}>
            <button onClick={e => { e.stopPropagation(); onView(product); }}
              style={{ background: "rgba(255,255,255,.95)", border: "none",
                borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.12)", color: "#111" }}>
              Quick View
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: "16px 16px 20px" }}>
        <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 1,
          textTransform: "uppercase", marginBottom: 4 }}>{product.category}</div>
        <div onClick={() => onView(product)}
          style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 6, lineHeight: 1.3 }}>
          {product.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Stars n={product.rating} />
          <span style={{ fontSize: 11, color: "#aaa" }}>({product.reviewCount.toLocaleString()})</span>
        </div>
        {product.colors.length > 1 && (
          <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
            {product.colors.map((c, i) => (
              <ColorDot key={i} color={c} active={col === i} onClick={() => setCol(i)} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>${product.price}</span>
            <span style={{ fontSize: 12, color: "#ccc", textDecoration: "line-through", marginLeft: 6 }}>
              ${product.compare}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onAdd(product, 1, product.colors[col]?.name); }}
            onMouseEnter={e => (e.currentTarget.style.background = "#333")}
            onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700,
              transition: "background .15s" }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [cart,    setCart]    = useState<CartItem[]>([]);
  const [cartOpen,setCartOpen]= useState(false);
  const [qv,      setQv]      = useState<typeof PRODUCTS[0] | null>(null);
  const [cat,     setCat]     = useState("All");
  const [sort,    setSort]    = useState("featured");
  const [search,  setSearch]  = useState("");
  const [searchOn,setSearchOn]= useState(false);
  const [megaOn,  setMegaOn]  = useState(false);
  const [email,   setEmail]   = useState("");
  const [subDone, setSubDone] = useState(false);
  const [scrolled,setScrolled]= useState(false);
  const [toast,   setToast]   = useState<string | null>(null);
  const [page,    setPage]    = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (searchOn) setTimeout(() => searchRef.current?.focus(), 80);
  }, [searchOn]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth" });

  const addToCart = (product: typeof PRODUCTS[0], qty = 1, color?: string) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id && i.selectedColor === color);
      if (ex) return prev.map(i =>
        i.id === product.id && i.selectedColor === color ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id: product.id, name: product.name, emoji: product.emoji,
        price: product.price, qty, selectedColor: color }];
    });
    showToast(`✓ ${product.name} added to cart`);
    setCartOpen(true);
  };

  const removeFromCart = (id: number, color: string | undefined) =>
    setCart(p => p.filter(i => !(i.id === id && i.selectedColor === color)));

  const updateQty = (id: number, color: string | undefined, delta: number) =>
    setCart(p => p.map(i =>
      i.id === id && i.selectedColor === color
        ? { ...i, qty: Math.max(1, i.qty + delta) } : i));

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  const filtered = PRODUCTS
    .filter(p => cat === "All" || p.category === cat)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "price-asc"  ? a.price - b.price :
      sort === "price-desc" ? b.price - a.price :
      sort === "top-rated"  ? b.rating - a.rating :
      sort === "best"       ? b.sold - a.sold : 0);

  const marquee = "✦ Free worldwide shipping over $75   ✦ 30-day hassle-free returns   ✦ New arrivals every week   ✦ 15,000+ happy customers   ✦ Stripe · Apple Pay · Google Pay   ";

  const footerCols = [
    { title: "Shop", items: [
      { label: "All Products", fn: () => { setCat("All"); setSort("featured"); scrollToGrid(); } },
      { label: "Best Sellers", fn: () => { setSort("best"); setCat("All"); scrollToGrid(); } },
      { label: "New Arrivals", fn: () => { setSort("featured"); setCat("All"); scrollToGrid(); } },
      { label: "Sale",         fn: () => { setSort("price-asc"); setCat("All"); scrollToGrid(); } },
      { label: "Gift Cards",   fn: () => {} },
    ]},
    { title: "Help", items: [
      { label: "Track Order",  fn: () => setPage("contact") },
      { label: "Returns",      fn: () => setPage("returns") },
      { label: "Shipping",     fn: () => setPage("shipping") },
      { label: "Contact",      fn: () => setPage("contact") },
      { label: "FAQs",         fn: () => setPage("faqs") },
    ]},
    { title: "Company", items: [
      { label: "About",        fn: () => setPage("about") },
      { label: "Careers",      fn: () => {} },
      { label: "Press",        fn: () => {} },
      { label: "Affiliate",    fn: () => {} },
      { label: "Privacy",      fn: () => setPage("privacy") },
    ]},
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f6",
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <style>{`
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes toastUp{from{opacity:0;transform:translateY(12px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#f8f8f6}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%",
          background: "#111", color: "#fff", padding: "11px 22px", borderRadius: 40,
          fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
          boxShadow: "0 8px 28px rgba(0,0,0,.2)", animation: "toastUp .3s ease",
          transform: "translateX(-50%)" }}>
          {toast}
        </div>
      )}

      <div style={{ background: "#111", color: "#fff", height: 34,
        overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", animation: "marquee 24s linear infinite", whiteSpace: "nowrap" }}>
          {[marquee, marquee].map((t, i) => (
            <span key={i} style={{ fontSize: 11, letterSpacing: 0.6, padding: "0 32px", opacity: 0.85 }}>{t}</span>
          ))}
        </div>
      </div>

      <nav style={{ position: "sticky", top: 0, zIndex: 900, background: "#fff",
        borderBottom: "1px solid #efefef",
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,.07)" : "none",
        transition: "box-shadow .2s" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px",
          height: 62, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 20 }}>
          <div onClick={() => { setCat("All"); setSort("featured"); setSearch(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ fontSize: 24, fontWeight: 900, color: "#111", letterSpacing: -0.5, cursor: "pointer", flexShrink: 0 }}>
            {STORE_NAME}<span style={{ color: STORE_COLOR }}>.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "center" }}
            onMouseLeave={() => setMegaOn(false)}>
            <div style={{ position: "relative" }} onMouseEnter={() => setMegaOn(true)}>
              <button onClick={() => { setCat("All"); scrollToGrid(); setMegaOn(false); }}
                style={{ padding: "8px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#444",
                  borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                Shop All <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {megaOn && (
                <div style={{ position: "absolute", top: "100%", left: "50%",
                  transform: "translateX(-50%)", background: "#fff", borderRadius: 16,
                  boxShadow: "0 20px 60px rgba(0,0,0,.14)", border: "1px solid #f0f0f0",
                  padding: 24, display: "grid", gridTemplateColumns: "180px 180px",
                  gap: 24, zIndex: 200, marginTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa",
                      letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Categories</div>
                    {CATS.filter(c => c !== "All").map(c => (
                      <button key={c} onClick={() => { setCat(c); setMegaOn(false); scrollToGrid(); }}
                        style={{ display: "block", width: "100%", textAlign: "left",
                          padding: "5px 0", background: "none", border: "none",
                          cursor: "pointer", fontSize: 13, color: "#555", fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#555")}>{c}</button>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa",
                      letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Collections</div>
                    {[
                      { label: "Best Sellers", fn: () => { setSort("best"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                      { label: "New Arrivals", fn: () => { setSort("featured"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                      { label: "Under $25",    fn: () => { setSort("price-asc"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                      { label: "Top Rated",    fn: () => { setSort("top-rated"); setCat("All"); setMegaOn(false); scrollToGrid(); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.fn}
                        style={{ display: "block", width: "100%", textAlign: "left",
                          padding: "5px 0", background: "none", border: "none",
                          cursor: "pointer", fontSize: 13, color: "#555", fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#555")}>{item.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {[
              { label: "Best Sellers", fn: () => { setSort("best"); setCat("All"); scrollToGrid(); } },
              { label: "New Arrivals", fn: () => { setSort("featured"); setCat("All"); scrollToGrid(); } },
            ].map(item => (
              <button key={item.label} onClick={item.fn}
                style={{ padding: "8px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#444", borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111")}
                onMouseLeave={e => (e.currentTarget.style.color = "#444")}>{item.label}</button>
            ))}
            <button onClick={() => { setSort("price-asc"); setCat("All"); scrollToGrid(); }}
              style={{ padding: "8px 14px", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626", borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#b91c1c")}
              onMouseLeave={e => (e.currentTarget.style.color = "#dc2626")}>Sale</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setSearchOn(true)}
              style={{ width: 36, height: 36, borderRadius: 8, border: "none",
                background: "none", cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>🔍</button>
            <button onClick={() => setCartOpen(true)}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
              style={{ display: "flex", alignItems: "center", gap: 8,
                background: "#111", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                transition: "background .15s" }}>
              🛒 Cart
              {cartCount > 0 && (
                <span style={{ background: STORE_COLOR, borderRadius: 20,
                  padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {searchOn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.97)",
          zIndex: 1300, display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: 80 }}>
          <button onClick={() => { setSearchOn(false); setSearch(""); }}
            style={{ position: "absolute", top: 20, right: 24, width: 38, height: 38,
              borderRadius: "50%", border: "1px solid #eee", background: "#fff",
              cursor: "pointer", fontSize: 17, color: "#888" }}>✕</button>
          <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 20 }}>Search</div>
          <div style={{ position: "relative", width: "100%", maxWidth: 560, padding: "0 20px" }}>
            <input ref={searchRef} value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setSearchOn(false); scrollToGrid(); } }}
              placeholder="What are you looking for?"
              style={{ width: "100%", border: "none", borderBottom: "2px solid #111",
                padding: "14px 14px 14px 46px", fontSize: 22, fontWeight: 600,
                outline: "none", background: "transparent", color: "#111" }} />
            <span style={{ position: "absolute", left: 34, top: "50%",
              transform: "translateY(-50%)", fontSize: 18, color: "#ccc" }}>🔍</span>
          </div>
          {search && (
            <div style={{ marginTop: 28, display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10, maxWidth: 640, width: "100%", padding: "0 20px" }}>
              {PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 4).map(p => (
                <div key={p.id} onClick={() => { setSearchOn(false); setQv(p); }}
                  style={{ background: "#fff", borderRadius: 12, padding: 12, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,.07)", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 22 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>${p.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section style={{ background: "#fff", padding: "72px 28px 56px",
        overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: -100, right: -60, width: 440, height: 440,
          background: `radial-gradient(circle, ${STORE_COLOR}12 0%, transparent 70%)`,
          borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 20, padding: "6px 14px", marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%",
                background: STORE_COLOR, display: "inline-block" }} />
              <span style={{ fontSize: 11, color: STORE_COLOR, fontWeight: 700, letterSpacing: 0.8 }}>
                NEW ARRIVALS WEEKLY
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(34px, 4vw, 56px)", fontWeight: 900, color: "#111",
              lineHeight: 1.08, letterSpacing: -1, marginBottom: 18 }}>
              Products the<br />
              <span style={{ color: STORE_COLOR }}>world is buying</span><br />right now.
            </h1>
            <p style={{ fontSize: 16, color: "#777", lineHeight: 1.8, marginBottom: 28, maxWidth: 400 }}>
              AI-powered discovery. Trending items. Worldwide delivery. 30-day guarantee.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={scrollToGrid}
                style={{ background: "#111", color: "#fff", border: "none",
                  borderRadius: 10, padding: "13px 26px", cursor: "pointer",
                  fontSize: 14, fontWeight: 800 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#333")}
                onMouseLeave={e => (e.currentTarget.style.background = "#111")}>
                Shop Now →
              </button>
              <button onClick={() => { setSort("best"); scrollToGrid(); }}
                style={{ background: "transparent", color: "#111", border: "1px solid #ddd",
                  borderRadius: 10, padding: "13px 26px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#999")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#ddd")}>
                Best Sellers
              </button>
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 32, flexWrap: "wrap" }}>
              {[["15,000+","Happy Customers"],["4.8★","Avg Rating"],["50+","Countries"]].map(([v,l]) => (
                <div key={l}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PRODUCTS.slice(0, 4).map(p => (
              <div key={p.id} onClick={() => setQv(p)}
                style={{ background: "#f9f9f9", borderRadius: 16, padding: 18,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, transition: "transform .2s, box-shadow .2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(0,0,0,.09)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
                <div style={{ fontSize: 46 }}>{p.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111", textAlign: "center", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111" }}>${p.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0", padding: "20px 28px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 8, overflowX: "auto" }}>
          {CATS.map(c => (
            <button key={c} onClick={() => { setCat(c); scrollToGrid(); }}
              style={{ padding: "9px 20px", borderRadius: 40, flexShrink: 0,
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .15s",
                border: "1px solid", borderColor: cat === c ? "#111" : "#e5e5e5",
                background: cat === c ? "#111" : "#fff", color: cat === c ? "#fff" : "#666" }}>
              {c}
            </button>
          ))}
        </div>
      </section>

      <section ref={gridRef} id="grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#111", letterSpacing: -0.5 }}>
              {cat === "All" ? "All Products" : cat}
            </h2>
            <div style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 14px",
              fontSize: 13, color: "#555", outline: "none", background: "#fff", cursor: "pointer" }}>
            <option value="featured">Featured</option>
            <option value="best">Best Selling</option>
            <option value="top-rated">Top Rated</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, color: "#aaa", fontWeight: 700 }}>No products found</div>
              <button onClick={() => { setSearch(""); setCat("All"); }}
                style={{ marginTop: 16, background: "#111", color: "#fff", border: "none",
                  borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                  fontSize: 13, fontWeight: 700 }}>Clear filters</button>
            </div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {filtered.map(p => <Card key={p.id} product={p} onView={setQv} onAdd={addToCart} />)}
            </div>
        }
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0",
        borderBottom: "1px solid #f0f0f0", padding: "40px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28 }}>
          {[["🔒","Secure Payments","Stripe, Apple Pay and Google Pay."],
            ["🚚","Free Worldwide Shipping","On all orders over $75."],
            ["↩️","30-Day Returns","Full refund, zero questions."],
            ["⭐","4.8 Star Average","15,000+ verified reviews."]
          ].map(([icon,title,desc]) => (
            <div key={title as string} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "#111", padding: "64px 28px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: STORE_COLOR, letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 14 }}>STAY IN THE LOOP</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff",
            marginBottom: 10, letterSpacing: -0.5 }}>Get early access to new drops</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.7 }}>
            Join 12,000+ subscribers. Exclusive discounts, new products first.
          </p>
          {subDone
            ? <div style={{ background: "#052e16", border: "1px solid #16a34a55",
                borderRadius: 10, padding: 18, color: "#16a34a", fontSize: 14, fontWeight: 700 }}>
                You are in! Welcome to {STORE_NAME}.
              </div>
            : <div style={{ display: "flex", gap: 8 }}>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && email.includes("@")) setSubDone(true); }}
                  placeholder="your@email.com"
                  style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333",
                    borderRadius: 8, padding: "12px 16px", color: "#fff", fontSize: 13, outline: "none" }} />
                <button onClick={() => { if (email.includes("@")) setSubDone(true); }}
                  style={{ background: STORE_COLOR, color: "#fff", border: "none", borderRadius: 8,
                    padding: "12px 22px", cursor: "pointer", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>
                  Subscribe
                </button>
              </div>
          }
        </div>
      </section>

      <footer style={{ background: "#0a0a0a", padding: "56px 28px 28px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 44, marginBottom: 44 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5, marginBottom: 14 }}>
                {STORE_NAME}<span style={{ color: STORE_COLOR }}>.</span>
              </div>
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.8, maxWidth: 240 }}>
                AI-powered ecommerce. Trending products delivered worldwide. No subscriptions, ever.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                {["TikTok","Instagram","Twitter"].map(s => (
                  <button key={s} style={{ background: "#1a1a1a", border: "1px solid #222",
                    borderRadius: 6, padding: "5px 12px", color: "#666", cursor: "pointer", fontSize: 11 }}>{s}</button>
                ))}
              </div>
            </div>
            {footerCols.map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#555",
                  letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>{col.title}</div>
                {col.items.map(item => (
                  <div key={item.label} onClick={item.fn}
                    style={{ fontSize: 13, color: "#444", marginBottom: 10, cursor: "pointer" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.color = "#fff")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.color = "#444")}>
                    {item.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 22,
            display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#333" }}>2025 {STORE_NAME}. Zero subscriptions.</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["Visa","Mastercard","Apple Pay","Google Pay","Stripe"].map(p => (
                <span key={p} style={{ fontSize: 10, color: "#444", background: "#111",
                  border: "1px solid #222", padding: "4px 10px", borderRadius: 4 }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {page && <PageModal pageKey={page} onClose={() => setPage(null)} />}
      <CartDrawer cart={cart} open={cartOpen}
        onClose={() => setCartOpen(false)} onQty={updateQty} onRemove={removeFromCart} />
      <QuickView product={qv} open={!!qv}
        onClose={() => setQv(null)} onAdd={addToCart} />
    </div>
  );
}