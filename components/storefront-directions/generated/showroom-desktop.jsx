"use client";
// Ported from the supplied design-source board. Review changes against that source.
import React from "react";
import {DCLogic,css as baseCss} from "../zdx-runtime";

const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255); };
const shade = (h, f) => { const n = parseInt(h.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return '#' + ((1 << 24) + (c(n >> 16 & 255) << 16) + (c(n >> 8 & 255) << 8) + c(n & 255)).toString(16).slice(1); };
const tones = (h) => lum(h) < 90 ? [shade(h, 1.7), shade(h, 2.2)] : [shade(h, 0.84), shade(h, 0.7)];
const G = [
  { id: 'coat', name: 'Wool Overcoat', tag: 'OUTERWEAR', room: 'Outerwear', gb: 285, ng: 460000, colours: [['Camel', '#B98B5A'], ['Charcoal', '#3B3B3E']], d1: 'M36 68 L100 58 L164 68 L190 214 L160 220 L150 120 L150 262 L50 262 L50 120 L40 220 L10 214 Z', d2: 'M84 60 L100 160 L116 60 L100 56 Z', d3: 'M98 150 H102 V262 H98 Z M60 192 H86 V206 H60 Z M114 192 H140 V206 H114 Z', desc: 'A relaxed single-breasted overcoat in a brushed wool blend. Notch lapel, two flap pockets, half-lined.', fabric: 'Wool blend · half-lined · dry clean only' },
  { id: 'dress', name: 'Poplin Shirt Dress', tag: 'DRESSES', room: 'Dresses', gb: 98, ng: 165000, colours: [['Indigo', '#2F4A7D'], ['Sage', '#8FA58A']], d1: 'M40 68 L100 60 L160 68 L176 120 L150 128 L146 150 L168 268 L32 268 L54 150 L50 128 L24 120 Z', d2: 'M86 60 L100 82 L114 60 L124 66 L100 96 L76 66 Z', d3: 'M98 96 H102 V268 H98 Z M52 150 H148 V158 H52 Z', desc: 'A crisp cotton poplin shirt dress with a self-tie belt, covered placket and short sleeves.', fabric: 'Cotton poplin · machine wash 30°' },
  { id: 'trousers', name: 'Pleated Trousers', tag: 'TROUSERS', room: 'Trousers', gb: 84, ng: 142000, colours: [['Ink', '#2A2D3A'], ['Stone', '#BDB5A6']], d1: 'M56 70 H144 L158 266 H108 L100 140 L92 266 H42 Z', d2: 'M56 70 H144 V80 H56 Z', d3: 'M84 80 L82 122 H86 L88 80 Z M116 80 L114 122 H118 L120 80 Z', desc: 'High-waisted trousers with a single pleat and a straight leg. Falls to the ankle.', fabric: 'Twill blend · machine wash 30°' },
  { id: 'bomber', name: 'Cropped Bomber', tag: 'OUTERWEAR', room: 'Outerwear', gb: 120, ng: 205000, colours: [['Olive', '#6B7048'], ['Black', '#202020']], d1: 'M40 68 L100 60 L160 68 L184 190 L158 196 L152 116 L152 196 H48 L48 116 L42 196 L16 190 Z', d2: 'M48 184 H152 V198 H48 Z M16 184 L42 190 L40 200 L14 196 Z M184 184 L158 190 L160 200 L186 196 Z', d3: 'M98 62 H102 V196 H98 Z M84 60 L100 56 L116 60 L116 70 L84 70 Z', desc: 'A cropped bomber with ribbed cuffs and hem, a full zip and a clean stand collar.', fabric: 'Cotton-nylon shell · wipe or hand wash' },
  { id: 'polo', name: 'Ribbed Knit Polo', tag: 'KNITWEAR', room: 'Knitwear', gb: 64, ng: 108000, colours: [['Cream', '#EDE4D3'], ['Rust', '#B25A32']], d1: 'M44 68 L100 60 L156 68 L176 112 L152 124 L150 236 L50 236 L48 124 L24 112 Z', d2: 'M84 60 L100 78 L116 60 L128 66 L100 92 L72 66 Z', d3: 'M50 224 H150 V238 H50 Z M98 90 H102 V130 H98 Z', desc: 'A fine-rib knit polo with a soft collar and a three-button placket. Sits at the hip.', fabric: 'Cotton-viscose knit · hand wash cool' },
  { id: 'skirt', name: 'Wrap Skirt', tag: 'DRESSES', room: 'Dresses', gb: 72, ng: 122000, colours: [['Terracotta', '#B8553A'], ['Ochre', '#D0A03C']], d1: 'M60 70 H140 L172 258 H28 Z', d2: 'M60 70 H140 V82 H60 Z', d3: 'M100 82 L150 258 H128 L92 82 Z', desc: 'A midi wrap skirt that ties at the waist. Soft drape in a matte crepe.', fabric: 'Crepe · machine wash 30°' }
];
const ROOMS = ['All', 'Outerwear', 'Dresses', 'Trousers', 'Knitwear'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export default class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { screen: null, focus: 0, market: 'GB', room: 'All', size: 'M', colour: 0, bag: [{ i: 0, size: 'M', colour: 0, qty: 1 }, { i: 2, size: 'M', colour: 0, qty: 1 }, { i: 4, size: 'S', colour: 0, qty: 1 }] };
  }
  renderVals() {
    const s = this.state;
    const screen = s.screen || this.props.screen || 'home';
    const m = s.market;
    const money = (g, q) => m === 'NG' ? '₦' + ((g.ng * q)).toLocaleString('en-US') : '£' + (g.gb * q);
    const set = (o) => () => this.setState(o);
    const n = G.length;
    const fillOf = (g, ci) => { const f1 = g.colours[ci][1]; const t = tones(f1); return [f1, t[0], t[1]]; };

    const garments = G.map((g, i) => {
      const d = i - s.focus;
      const col = i % 3, row = Math.floor(i / 3);
      const ci = (screen === 'product' && i === s.focus) ? s.colour : 0;
      const f = fillOf(g, ci);
      let x = 90 + d * 290, y = 176, sc = 0.9, op = 0, lab = 0;
      if (screen === 'home' || screen === 'bag') {
        const a = Math.abs(d);
        sc = a === 0 ? 1.45 : 0.9;
        op = a === 0 ? 1 : a === 1 ? 0.9 : a === 2 ? 0.4 : 0;
        if (screen === 'bag') op = op * 0.5;
      } else if (screen === 'collection') {
        x = 90 + (col - 1) * 300; y = 176 + row * 300; sc = 0.72;
        op = (s.room === 'All' || g.room === s.room) ? 1 : 0.12; lab = 1;
      } else if (screen === 'product') {
        if (i === s.focus) { x = -110; y = 120; sc = 1.7; op = 1; }
      }
      const pe = op < 0.2 && screen !== 'collection' ? 'none' : 'auto';
      const pick = () => {
        if (screen === 'collection') this.setState({ focus: i, screen: 'product', size: 'M', colour: 0 });
        else if (screen === 'home') { if (i === s.focus) this.setState({ screen: 'product', size: 'M', colour: 0 }); else this.setState({ focus: i }); }
        else if (screen === 'bag') this.setState({ focus: i, screen: 'home' });
      };
      return {
        d1: g.d1, d2: g.d2, d3: g.d3, f1: f[0], f2: f[1], f3: f[2],
        name: g.name, price: money(g, 1), aria: g.name + ', ' + money(g, 1),
        style: 'position:absolute;left:50%;top:' + y + 'px;width:240px;margin-left:-120px;transform:translateX(' + x + 'px) scale(' + sc + ');transform-origin:50% 0;opacity:' + op + ';pointer-events:' + pe + ';transition:transform .8s cubic-bezier(.22,.8,.2,1),opacity .6s ease,top .8s cubic-bezier(.22,.8,.2,1)',
        labelStyle: 'position:absolute;left:-20px;right:-20px;top:356px;text-align:center;line-height:1.3;pointer-events:none;transition:opacity .5s;opacity:' + lab + ';font-size:' + (15 / 0.72).toFixed(1) + 'px',
        pick
      };
    });

    const cur = G[s.focus];
    const colours = cur.colours.map((c, ci) => ({
      aria: c[0],
      style: 'width:34px;height:34px;border-radius:50%;background:' + c[1] + ';border:' + (s.colour === ci ? '3px solid #1B1A18' : '1.5px solid rgba(0,0,0,.25)') + ';padding:0',
      pick: set({ colour: ci })
    }));
    const sizes = SIZES.map((z) => ({
      label: z,
      style: 'min-width:46px;padding:11px 0;border-radius:10px;font-size:14px;font-weight:600;border:1.5px solid #1B1A18;background:' + (s.size === z ? '#1B1A18' : 'transparent') + ';color:' + (s.size === z ? '#fff' : '#1B1A18'),
      pick: set({ size: z })
    }));

    const bagItems = s.bag.map((b, k) => {
      const g = G[b.i]; const f = fillOf(g, b.colour);
      return {
        d1: g.d1, d2: g.d2, d3: g.d3, f1: f[0], f2: f[1], f3: f[2],
        name: g.name, meta: b.size + ' · ' + g.colours[b.colour][0], qty: b.qty, line: money(g, b.qty),
        inc: () => this.setState({ bag: s.bag.map((x, j) => j === k ? { ...x, qty: x.qty + 1 } : x) }),
        dec: () => this.setState({ bag: s.bag.map((x, j) => j === k ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0) })
      };
    });
    const count = s.bag.reduce((a, b) => a + b.qty, 0);
    const total = s.bag.reduce((a, b) => a + (m === 'NG' ? G[b.i].ng : G[b.i].gb) * b.qty, 0);
    const subtotal = m === 'NG' ? '₦' + total.toLocaleString('en-US') : '£' + total;

    const rooms = ROOMS.map((r, k) => ({
      no: '0' + (k + 1), name: r,
      style: 'background:none;border:0;padding:4px 0;text-align:left;font-size:15px;font-weight:' + (s.room === r && screen === 'collection' ? 800 : 600) + ';opacity:' + (s.room === r && screen === 'collection' ? 1 : 0.7),
      pick: set({ room: r, screen: 'collection' })
    }));
    const pill = (on) => 'border:0;padding:8px 14px;font-size:13px;font-weight:600;background:' + (on ? '#1B1A18' : 'transparent') + ';color:' + (on ? '#fff' : '#1B1A18');

    return {
      garments, colours, sizes, bagItems, rooms, cur: { tag: cur.tag, name: cur.name, price: money(cur, 1), desc: cur.desc, fabric: cur.fabric },
      curColour: cur.colours[s.colour][0], size: s.size, count, subtotal,
      isHome: screen === 'home', isCollection: screen === 'collection', isProduct: screen === 'product', isBag: screen === 'bag',
      rail1: 1, rail2: screen === 'collection' ? 1 : 0,
      roomTitle: s.room === 'All' ? 'ALL PIECES' : s.room.toUpperCase(),
      counter: String(s.focus + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'),
      gbStyle: pill(m === 'GB'), ngStyle: pill(m === 'NG'),
      setGB: set({ market: 'GB' }), setNG: set({ market: 'NG' }),
      goHome: set({ screen: 'home' }), goCollection: set({ screen: 'collection', room: 'All' }), goBag: set({ screen: 'bag' }),
      prev: set({ focus: (s.focus + n - 1) % n }), next: set({ focus: (s.focus + 1) % n }),
      addToBag: () => {
        const idx = s.bag.findIndex((b) => b.i === s.focus && b.size === s.size && b.colour === s.colour);
        const bag = idx >= 0 ? s.bag.map((b, j) => j === idx ? { ...b, qty: b.qty + 1 } : b) : s.bag.concat([{ i: s.focus, size: s.size, colour: s.colour, qty: 1 }]);
        this.setState({ bag, screen: 'bag' });
      }
    };
  }

 render(){const css=value=>baseCss(value,this.context);const v=this.renderVals();return <div className="zdx-root"><style>{"\n\n@keyframes kosiIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\n.kosi-btn{cursor:pointer;font-family:inherit;color:inherit}\n.kosi-btn:focus-visible{outline:2px solid #B8330F;outline-offset:3px}\n\n.zdx-root button,.zdx-root input{min-height:44px!important;box-sizing:border-box}.zdx-root button{min-width:44px!important}.zdx-root :focus-visible{outline:3px solid currentColor!important;outline-offset:3px!important}@media(prefers-reduced-motion:reduce){.zdx-root *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}"}</style>{"\n"}{"\n"}<div style={css("position:relative;width:100%;height:900px;overflow:hidden;background:#E4E0D8;color:#1B1A18;font-family:'Bricolage Grotesque',system-ui,sans-serif")}>{"\n\n  "}<div style={css("position:absolute;left:0;right:0;bottom:0;height:190px;background:linear-gradient(#D8D3C9,#C5BFB3)")}></div>{"\n  "}<div style={css("position:absolute;left:0;right:0;bottom:190px;height:1px;background:rgba(0,0,0,.14)")}></div>{"\n\n  "}<div style={css("position:absolute;left:0;right:0;top:0;height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;z-index:40")}>{"\n    "}<button className={"kosi-btn"} onClick={v.goHome} style={css("background:none;border:0;padding:0;font-size:24px;font-weight:800;letter-spacing:.28em")} type="button">{this.context?.brand||"KOSI"}</button>{"\n    "}<div style={css("display:flex;align-items:center;gap:14px")}>{"\n      "}<div style={css("display:flex;border:1.5px solid #1B1A18;border-radius:999px;overflow:hidden")}>{"\n        "}<button className={"kosi-btn"} onClick={v.setGB} style={css(v.gbStyle)} type="button">{"UK £"}</button>{"\n        "}<button className={"kosi-btn"} onClick={v.setNG} style={css(v.ngStyle)} type="button">{"NG ₦"}</button>{"\n      "}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.goCollection} style={css("background:none;border:0;padding:8px 6px;font-size:15px;font-weight:600")} type="button">{"All pieces"}</button>{"\n      "}<button className={"kosi-btn"} onClick={v.goBag} style={css("background:#1B1A18;color:#fff;border:0;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:600")} type="button">{["Bag · ",v.count]}</button>{"\n    "}</div>{"\n  "}</div>{"\n\n  "}<nav aria-label={"Rooms"} style={css("position:absolute;left:40px;top:150px;z-index:40;display:flex;flex-direction:column;gap:10px")}>{"\n    "}{(v.rooms||[]).map((r,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n      "}<button className={"kosi-btn"} onClick={r.pick} style={css(r.style)} type="button"><span style={css("font-size:11px;letter-spacing:.1em;margin-right:8px")}>{r.no}</span>{r.name}</button>{"\n    "}</React.Fragment>)}{"\n  "}</nav>{"\n\n  "}<div style={css(["position:absolute;left:0;right:0;top:171px;height:6px;background:linear-gradient(#9A9890,#6D6B65 55%,#9A9890);opacity:",v.rail1,";transition:opacity .5s"])}></div>{"\n  "}<div style={css(["position:absolute;left:0;right:0;top:471px;height:6px;background:linear-gradient(#9A9890,#6D6B65 55%,#9A9890);opacity:",v.rail2,";transition:opacity .5s"])}></div>{"\n\n  "}{(v.garments||[]).map((g,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n    "}<div style={css(g.style)}>{"\n      "}<button className={"kosi-btn"} onClick={g.pick} aria-label={g.aria} style={css("display:block;position:relative;width:100%;padding:0;border:0;background:none")} type="button">{"\n        "}<svg viewBox={"0 0 200 280"} width={"240"} height={"336"} style={css("display:block;overflow:visible")} aria-hidden={"true"}>{"\n          "}<path d={"M100 24 V16 C100 4 114 4 114 14 M100 24 L24 66 M100 24 L176 66 M24 66 H176"} fill={"none"} stroke={"#6B6A66"} strokeWidth={"2.2"} strokeLinecap={"round"}></path>{"\n          "}<path d={g.d1} fill={g.f1}></path>{"\n          "}<path d={g.d2} fill={g.f2}></path>{"\n          "}<path d={g.d3} fill={g.f3}></path>{"\n        "}</svg>{"\n        "}<div style={css("position:absolute;left:12%;right:12%;bottom:-34px;height:16px;border-radius:50%;background:rgba(0,0,0,.24);filter:blur(9px)")}></div>{"\n      "}</button>{"\n      "}<div style={css(g.labelStyle)}><span style={css("display:block;font-weight:800")}>{g.name}</span><span style={css("display:block;opacity:.75")}>{g.price}</span></div>{"\n    "}</div>{"\n  "}</React.Fragment>)}{"\n\n  "}{v.isHome&&<React.Fragment>{"\n    "}<div style={css("position:absolute;left:130px;bottom:54px;z-index:30;animation:kosiIn .6s both")}>{"\n      "}<div style={css("font-size:13px;font-weight:600;letter-spacing:.16em;margin-bottom:8px")}>{"SPRING RAIL 01"}</div>{"\n      "}<div style={css("font-size:56px;line-height:1;font-weight:800;letter-spacing:-.02em")}>{"Six pieces."}<br />{"One rail."}</div>{"\n    "}</div>{"\n    "}<div style={css("position:absolute;left:810px;margin-left:-110px;bottom:60px;z-index:30;display:flex;align-items:center;gap:18px")}>{"\n      "}<button className={"kosi-btn"} onClick={v.prev} aria-label={"Previous garment"} style={css("width:46px;height:46px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:20px")} type="button">{"←"}</button>{"\n      "}<div style={css("width:110px;text-align:center;font-size:15px;font-weight:600")}>{v.counter}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.next} aria-label={"Next garment"} style={css("width:46px;height:46px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:20px")} type="button">{"→"}</button>{"\n    "}</div>{"\n    "}<div style={css("position:absolute;right:40px;bottom:68px;z-index:30;font-size:14px;max-width:230px;line-height:1.4;text-align:right")}>{"Tap the centre garment to bring it forward."}</div>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isCollection&&<React.Fragment>{"\n    "}<div style={css("position:absolute;left:180px;top:96px;z-index:30;font-size:13px;font-weight:600;letter-spacing:.16em;animation:kosiIn .5s both")}>{v.roomTitle}</div>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isProduct&&<React.Fragment>{"\n    "}<button className={"kosi-btn"} onClick={v.goHome} style={css("position:absolute;left:180px;top:96px;z-index:40;background:none;border:0;padding:0;font-size:15px;font-weight:600")} type="button">{"← Back to the rail"}</button>{"\n    "}<aside aria-label={"Product"} style={css("position:absolute;right:40px;top:110px;width:380px;box-sizing:border-box;background:rgba(255,255,255,.86);border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:28px;z-index:40;animation:kosiIn .6s .25s both;display:flex;flex-direction:column;gap:16px")}>{"\n      "}<div style={css("font-size:12px;font-weight:600;letter-spacing:.14em")}>{v.cur.tag}</div>{"\n      "}<h1 style={css("margin:0;font-size:34px;line-height:1.05;font-weight:800")}>{v.cur.name}</h1>{"\n      "}<div style={css("font-size:24px;font-weight:600")}>{v.cur.price}</div>{"\n      "}<p style={css("margin:0;font-size:15px;line-height:1.5;color:#3A3834")}>{v.cur.desc}</p>{"\n      "}<div >{"\n        "}<div style={css("font-size:12px;font-weight:600;letter-spacing:.1em;margin-bottom:8px")}>{["COLOUR · ",v.curColour]}</div>{"\n        "}<div style={css("display:flex;gap:10px")}>{"\n          "}{(v.colours||[]).map((c,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n            "}<button className={"kosi-btn"} onClick={c.pick} aria-label={c.aria} style={css(c.style)} type="button"></button>{"\n          "}</React.Fragment>)}{"\n        "}</div>{"\n      "}</div>{"\n      "}<div >{"\n        "}<div style={css("font-size:12px;font-weight:600;letter-spacing:.1em;margin-bottom:8px")}>{["SIZE · ",v.size]}</div>{"\n        "}<div style={css("display:flex;gap:8px")}>{"\n          "}{(v.sizes||[]).map((z,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n            "}<button className={"kosi-btn"} onClick={z.pick} style={css(z.style)} type="button">{z.label}</button>{"\n          "}</React.Fragment>)}{"\n        "}</div>{"\n      "}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.addToBag} style={css("background:#B8330F;color:#fff;border:0;border-radius:12px;padding:16px;font-size:17px;font-weight:800")} type="button">{"Add to bag"}</button>{"\n      "}<div style={css("font-size:13px;line-height:1.5;color:#4A4843;border-top:1px solid rgba(0,0,0,.1);padding-top:12px")}>{v.cur.fabric}<br />{"Delivery and returns are shown at checkout for your market."}</div>{"\n    "}</aside>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isBag&&<React.Fragment>{"\n    "}<div style={css("position:absolute;inset:0;background:rgba(228,224,216,.35);z-index:35")}></div>{"\n    "}<aside aria-label={"Bag"} style={css("position:absolute;right:40px;top:110px;width:380px;box-sizing:border-box;background:#fff;border-radius:18px;padding:26px;z-index:40;animation:kosiIn .5s both;display:flex;flex-direction:column;gap:14px;box-shadow:0 18px 50px rgba(0,0,0,.18)")}>{"\n      "}<div style={css("display:flex;justify-content:space-between;align-items:baseline")}>{"\n        "}<div style={css("font-size:26px;font-weight:800")}>{["Bag · ",v.count]}</div>{"\n        "}<button className={"kosi-btn"} onClick={v.goHome} style={css("background:none;border:0;padding:0;font-size:14px;font-weight:600;text-decoration:underline")} type="button">{"Keep browsing"}</button>{"\n      "}</div>{"\n      "}{(v.bagItems||[]).map((b,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n        "}<div style={css("display:flex;gap:14px;align-items:center;border-top:1px solid rgba(0,0,0,.1);padding-top:14px")}>{"\n          "}<div style={css("width:62px;height:76px;background:#EEEBE5;border-radius:10px;display:flex;align-items:center;justify-content:center")}>{"\n            "}<svg viewBox={"0 0 200 280"} width={"44"} height={"62"} aria-hidden={"true"}><path d={b.d1} fill={b.f1}></path><path d={b.d2} fill={b.f2}></path><path d={b.d3} fill={b.f3}></path></svg>{"\n          "}</div>{"\n          "}<div style={css("flex-grow:1")}>{"\n            "}<div style={css("font-size:15px;font-weight:800")}>{b.name}</div>{"\n            "}<div style={css("font-size:13px;color:#4A4843")}>{b.meta}</div>{"\n            "}<div style={css("display:flex;align-items:center;gap:10px;margin-top:6px")}>{"\n              "}<button className={"kosi-btn"} onClick={b.dec} aria-label={"Remove one"} style={css("width:28px;height:28px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:16px;line-height:1")} type="button">{"−"}</button>{"\n              "}<span style={css("font-size:14px;font-weight:600;width:14px;text-align:center")}>{b.qty}</span>{"\n              "}<button className={"kosi-btn"} onClick={b.inc} aria-label={"Add one"} style={css("width:28px;height:28px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:16px;line-height:1")} type="button">{"+"}</button>{"\n            "}</div>{"\n          "}</div>{"\n          "}<div style={css("font-size:15px;font-weight:800")}>{b.line}</div>{"\n        "}</div>{"\n      "}</React.Fragment>)}{"\n      "}<div style={css("display:flex;justify-content:space-between;border-top:1px solid rgba(0,0,0,.1);padding-top:14px;font-size:18px;font-weight:800")}><span >{"Subtotal"}</span><span >{v.subtotal}</span></div>{"\n      "}<div style={css("font-size:13px;color:#4A4843")}>{"Delivery is calculated at checkout for your market."}</div>{"\n      "}<button className={"kosi-btn"} style={css("background:#1B1A18;color:#fff;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:800")} type="button">{"Pay with PayPal"}</button>{"\n      "}<button className={"kosi-btn"} style={css("background:#B8330F;color:#fff;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:800")} type="button">{"Checkout"}</button>{"\n    "}</aside>{"\n  "}</React.Fragment>}{"\n"}</div>{"\n"}</div>;}
}
