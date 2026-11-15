const items = [
  { title: "Thoughtful curation", sub: "A focused product point of view" },
  { title: "Market-aware retail", sub: "Local details matter" },
  { title: "Clear product information", sub: "No invented claims" },
];

export default function TrustBar() {
  return (
    <section className="z-principles" aria-label="Our approach">
      {items.map((item, index) => (
        <div className="z-principle" key={item.title}>
          <span className="z-principle-index">0{index + 1}</span>
          <div><h2>{item.title}</h2><p>{item.sub}</p></div>
        </div>
      ))}
    </section>
  );
}
