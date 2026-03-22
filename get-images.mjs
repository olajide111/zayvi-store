const products = [
  ["Magnetic Flip Wallet Case", "https://a.aliexpress.com/_EJFg6cy"],
  ["Portable USB Blender", "https://a.aliexpress.com/_EuPwa3w"],
  ["COB LED Strip", "https://a.aliexpress.com/_EvOu1TQ"],
  ["Posture Corrector", "https://a.aliexpress.com/_EvbKQKu"],
  ["Cat Water Fountain", "https://a.aliexpress.com/_EJZ6rGC"],
  ["Luxury Tote Bag", "https://a.aliexpress.com/_EzVfaEg"],
  ["Stand Mixer", "https://a.aliexpress.com/_EuHU2vq"],
  ["Cordless Drill", "https://a.aliexpress.com/_Ey689ss"],
  ["WiFi Projector", "https://a.aliexpress.com/_EGoNtFq"],
  ["NIBOSI Watch", "https://a.aliexpress.com/_EH5QuTS"],
  ["Platform Sandals", "https://a.aliexpress.com/_EQcaPbq"],
  ["Samsung Charger", "https://a.aliexpress.com/_EGEg0vA"],
  ["LED Face Mask", "https://a.aliexpress.com/_EJCx7Q4"],
  ["Blackhead Remover", "https://a.aliexpress.com/_ExY9Cmg"],
  ["Skincare Set", "https://a.aliexpress.com/_EHlGdTA"],
  ["Makeup Brushes", "https://a.aliexpress.com/_Ez7d2mu"],
  ["Eyeshadow Palette", "https://a.aliexpress.com/_EznI1Zw"],
  ["Gold Jelly Mask", "https://a.aliexpress.com/_Ex8sSC4"],
  ["Luggage Strap", "https://a.aliexpress.com/_Ex9ZGJa"],
  ["Neck Pillow", "https://a.aliexpress.com/_Ew2l232"],
  ["Travel Adapter", "https://a.aliexpress.com/_EJVGwkk"],
  ["Neck Fan", "https://a.aliexpress.com/_EzwXv9K"],
  ["Travel Bottles", "https://a.aliexpress.com/_EIS71wG"],
  ["Cervical Pillow", "https://a.aliexpress.com/_Evj9mzW"],
  ["Bidet", "https://a.aliexpress.com/_Ey39KPK"],
  ["Bedding Set", "https://a.aliexpress.com/_EJ7oRH6"],
  ["3D Fireplace", "https://a.aliexpress.com/_Ew0KKuc"],
  ["Storage Tube", "https://a.aliexpress.com/_EJwO6Xa"],
  ["Wall Sticker", "https://a.aliexpress.com/_EzFohAG"],
  ["Ceiling Lamp", "https://a.aliexpress.com/_Ezud4lQ"],
  ["Running Shoes", "https://a.aliexpress.com/_EQMHVd6"],
  ["Squat Rack", "https://a.aliexpress.com/_EGjJQba"],
  ["Yoga Sports Bra", "https://a.aliexpress.com/_Eyi5ms8"],
  ["Ab Wheel", "https://a.aliexpress.com/_EIsCDFQ"],
  ["Resistance Bands", "https://a.aliexpress.com/_Eyn6vik"],
  ["Yoga Mat", "https://a.aliexpress.com/_EQVnNCg"],
  ["Knee Brace", "https://a.aliexpress.com/_EusVZDa"],
  ["Compression Shirt", "https://a.aliexpress.com/_EuVLkfS"],
  ["Boxing Ball", "https://a.aliexpress.com/_EHGDibi"],
];

for (const [name, url] of products) {
  try {
    const r = await fetch(url, {redirect:"follow", headers:{"User-Agent":"Mozilla/5.0"}});
    const h = await r.text();
    const m = h.match(/https:\/\/ae\d+\.alicdn\.com\/kf\/[^\s"'<>]+\.(jpg|webp|jpeg|png)/i);
    console.log(name + " = " + (m ? m[0] : "NOT_FOUND"));
  } catch(e) {
    console.log(name + " = ERROR");
  }
}
