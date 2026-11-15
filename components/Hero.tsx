"use client";

type Props = { onShopAll: () => void; onBestSellers: () => void };

export default function Hero({ onShopAll, onBestSellers }: Props) {
  return (
    <section className="z-hero">
      <div className="z-hero-copy">
        <p className="z-eyebrow">A considered approach to everyday essentials</p>
        <h1>Make room for<br /><em>better choices.</em></h1>
        <p className="z-hero-intro">Explore a thoughtfully curated direction for travel, everyday carry and daily living. Useful things, selected with intention.</p>
        <div className="z-hero-actions">
          <button className="z-button z-button-dark" onClick={onBestSellers}>Explore the collection</button>
          <button className="z-button z-button-light" onClick={onShopAll}>Browse categories</button>
        </div>
        <p className="z-preview-note">Store preview · Product range and market availability are being verified.</p>
      </div>
      <div className="z-hero-art" role="img" aria-label="Open road winding through a dramatic landscape">
        <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1400&q=85" alt="" fetchPriority="high" />
        <div className="z-hero-art-caption"><span>THE ZAYVI EDIT</span><span>01 / EVERYDAY EXPLORATION</span></div>
      </div>
    </section>
  );
}
