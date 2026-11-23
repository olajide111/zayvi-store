"use client";
// Ported from the supplied design-source board. Review changes against that source.
import ThemeIcon from "../../themes/ThemeIcon";
import React from "react";
import {DCLogic,css as baseCss} from "../zdx-runtime";

const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255); };
const shade = (h, f) => { const n = parseInt(h.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return '#' + ((1 << 24) + (c(n >> 16 & 255) << 16) + (c(n >> 8 & 255) << 8) + c(n & 255)).toString(16).slice(1); };
const tones = (h) => lum(h) < 90 ? [shade(h, 1.7), shade(h, 2.2)] : [shade(h, 0.84), shade(h, 0.7)];
const G = [
  { id: 'coat', name: 'Wool Overcoat', tag: 'Outerwear', room: 'Outerwear', gb: 285, ng: 460000, colours: [['Camel', '#B98B5A'], ['Charcoal', '#3B3B3E']], d1: 'M36 68 L100 58 L164 68 L190 214 L160 220 L150 120 L150 262 L50 262 L50 120 L40 220 L10 214 Z', d2: 'M84 60 L100 160 L116 60 L100 56 Z', d3: 'M98 150 H102 V262 H98 Z M60 192 H86 V206 H60 Z M114 192 H140 V206 H114 Z', desc: 'A relaxed single-breasted overcoat in a brushed wool blend. Notch lapel, two flap pockets, half-lined.', fabric: 'wool blend, half-lined' },
  { id: 'dress', name: 'Poplin Shirt Dress', tag: 'Dresses', room: 'Dresses', gb: 98, ng: 165000, colours: [['Indigo', '#2F4A7D'], ['Sage', '#8FA58A']], d1: 'M40 68 L100 60 L160 68 L176 120 L150 128 L146 150 L168 268 L32 268 L54 150 L50 128 L24 120 Z', d2: 'M86 60 L100 82 L114 60 L124 66 L100 96 L76 66 Z', d3: 'M98 96 H102 V268 H98 Z M52 150 H148 V158 H52 Z', desc: 'A crisp cotton poplin shirt dress with a self-tie belt, covered placket and short sleeves.', fabric: 'cotton poplin' },
  { id: 'trousers', name: 'Pleated Trousers', tag: 'Trousers', room: 'Trousers', gb: 84, ng: 142000, colours: [['Ink', '#2A2D3A'], ['Stone', '#BDB5A6']], d1: 'M56 70 H144 L158 266 H108 L100 140 L92 266 H42 Z', d2: 'M56 70 H144 V80 H56 Z', d3: 'M84 80 L82 122 H86 L88 80 Z M116 80 L114 122 H118 L120 80 Z', desc: 'High-waisted trousers with a single pleat and a straight leg. Falls to the ankle.', fabric: 'twill blend' },
  { id: 'bomber', name: 'Cropped Bomber', tag: 'Outerwear', room: 'Outerwear', gb: 120, ng: 205000, colours: [['Olive', '#6B7048'], ['Black', '#202020']], d1: 'M40 68 L100 60 L160 68 L184 190 L158 196 L152 116 L152 196 H48 L48 116 L42 196 L16 190 Z', d2: 'M48 184 H152 V198 H48 Z M16 184 L42 190 L40 200 L14 196 Z M184 184 L158 190 L160 200 L186 196 Z', d3: 'M98 62 H102 V196 H98 Z M84 60 L100 56 L116 60 L116 70 L84 70 Z', desc: 'A cropped bomber with ribbed cuffs and hem, a full zip and a clean stand collar.', fabric: 'cotton-nylon shell' },
  { id: 'polo', name: 'Ribbed Knit Polo', tag: 'Knitwear', room: 'Knitwear', gb: 64, ng: 108000, colours: [['Cream', '#EDE4D3'], ['Rust', '#B25A32']], d1: 'M44 68 L100 60 L156 68 L176 112 L152 124 L150 236 L50 236 L48 124 L24 112 Z', d2: 'M84 60 L100 78 L116 60 L128 66 L100 92 L72 66 Z', d3: 'M50 224 H150 V238 H50 Z M98 90 H102 V130 H98 Z', desc: 'A fine-rib knit polo with a soft collar and a three-button placket. Sits at the hip.', fabric: 'cotton-viscose knit' },
  { id: 'skirt', name: 'Wrap Skirt', tag: 'Dresses', room: 'Dresses', gb: 72, ng: 122000, colours: [['Terracotta', '#B8553A'], ['Ochre', '#D0A03C']], d1: 'M60 70 H140 L172 258 H28 Z', d2: 'M60 70 H140 V82 H60 Z', d3: 'M100 82 L150 258 H128 L92 82 Z', desc: 'A midi wrap skirt that ties at the waist. Soft drape in a matte crepe.', fabric: 'matte crepe' }
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
    const money = (g, q) => m === 'NG' ? '₦' + (g.ng * q).toLocaleString('en-US') : '£' + (g.gb * q);
    const set = (o) => () => this.setState(o);
    const n = G.length;
    const fillOf = (g, ci) => { const f1 = g.colours[ci][1]; const t = tones(f1); return [f1, t[0], t[1]]; };

    const garments = G.map((g, i) => {
      const d = i - s.focus;
      const col = i % 2, row = Math.floor(i / 2);
      const ci = (screen === 'product' && i === s.focus) ? s.colour : 0;
      const f = fillOf(g, ci);
      let x = d * 190, y = 128, sc = 0.62, op = 0, lab = 0;
      if (screen === 'home' || screen === 'bag') {
        const a = Math.abs(d);
        sc = a === 0 ? 1.1 : 0.62;
        op = a === 0 ? 1 : a === 1 ? 0.85 : 0;
        if (screen === 'bag') op = op * 0.5;
      } else if (screen === 'collection') {
        x = col === 0 ? -95 : 95; y = 140 + row * 226; sc = 0.5;
        op = (s.room === 'All' || g.room === s.room) ? 1 : 0.12; lab = 1;
      } else if (screen === 'product') {
        if (i === s.focus) { x = 0; y = 100; sc = 0.9; op = 1; }
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
        labelStyle: 'position:absolute;left:-30px;right:-30px;top:352px;text-align:center;line-height:1.25;pointer-events:none;transition:opacity .5s;opacity:' + lab + ';font-size:' + (13 / 0.5).toFixed(1) + 'px',
        pick
      };
    });

    const cur = G[s.focus];
    const colours = cur.colours.map((c, ci) => ({
      aria: c[0],
      style: 'width:36px;height:36px;border-radius:50%;background:' + c[1] + ';border:' + (s.colour === ci ? '3px solid #1B1A18' : '1.5px solid rgba(0,0,0,.25)') + ';padding:0',
      pick: set({ colour: ci })
    }));
    const sizes = SIZES.map((z) => ({
      label: z,
      style: 'flex:1;min-height:44px;border-radius:10px;font-size:14px;font-weight:600;border:1.5px solid #1B1A18;background:' + (s.size === z ? '#1B1A18' : 'transparent') + ';color:' + (s.size === z ? '#fff' : '#1B1A18'),
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
    const rooms = ROOMS.map((r) => ({
      name: r,
      style: 'flex-shrink:0;min-height:40px;padding:0 14px;border-radius:999px;font-size:14px;font-weight:600;border:1.5px solid #1B1A18;background:' + (s.room === r && screen === 'collection' ? '#1B1A18' : 'transparent') + ';color:' + (s.room === r && screen === 'collection' ? '#fff' : '#1B1A18'),
      pick: set({ room: r, screen: 'collection' })
    }));
    const pill = (on) => 'border:0;padding:9px 12px;font-size:13px;font-weight:600;min-height:40px;background:' + (on ? '#1B1A18' : 'transparent') + ';color:' + (on ? '#fff' : '#1B1A18');
    const bar = (top, op) => ({ style: 'position:absolute;left:0;right:0;top:' + top + 'px;height:5px;background:linear-gradient(#9A9890,#6D6B65 55%,#9A9890);opacity:' + op + ';transition:opacity .5s' });

    return {
      garments, colours, sizes, bagItems, rooms,
      rails: [bar(125, screen === 'product' ? 0 : 1), bar(351, screen === 'collection' ? 1 : 0), bar(577, screen === 'collection' ? 1 : 0)],
      cur: { tag: cur.tag, name: cur.name, price: money(cur, 1), desc: cur.desc, fabric: cur.fabric },
      curColour: cur.colours[s.colour][0], size: s.size, count, subtotal,
      showChips: screen === 'home' || screen === 'collection',
      isHome: screen === 'home', isCollection: screen === 'collection', isProduct: screen === 'product', isBag: screen === 'bag',
      roomTitle: s.room === 'All' ? 'ALL PIECES' : s.room.toUpperCase(),
      counter: String(s.focus + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'),
      gbStyle: pill(m === 'GB'), ngStyle: pill(m === 'NG'),
      setGB: set({ market: 'GB' }), setNG: set({ market: 'NG' }),
      goHome: set({ screen: 'home' }), goBag: set({ screen: 'bag' }),
      goProduct: set({ screen: 'product', size: 'M', colour: 0 }),
      prev: set({ focus: (s.focus + n - 1) % n }), next: set({ focus: (s.focus + 1) % n }),
      quickAdd: () => {
        const idx = s.bag.findIndex((b) => b.i === s.focus && b.size === 'M' && b.colour === 0);
        const bag = idx >= 0 ? s.bag.map((b, j) => j === idx ? { ...b, qty: b.qty + 1 } : b) : s.bag.concat([{ i: s.focus, size: 'M', colour: 0, qty: 1 }]);
        this.setState({ bag, screen: 'bag' });
      },
      addToBag: () => {
        const idx = s.bag.findIndex((b) => b.i === s.focus && b.size === s.size && b.colour === s.colour);
        const bag = idx >= 0 ? s.bag.map((b, j) => j === idx ? { ...b, qty: b.qty + 1 } : b) : s.bag.concat([{ i: s.focus, size: s.size, colour: s.colour, qty: 1 }]);
        this.setState({ bag, screen: 'bag' });
      }
    };
  }

 render(){const css=value=>baseCss(value,this.context);const v=this.renderVals();return <div className="zdx-root"><style>{"\n\n@keyframes kosiUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}\n.kosi-btn{cursor:pointer;font-family:inherit;color:inherit}\n.kosi-btn:focus-visible{outline:2px solid #B8330F;outline-offset:2px}\n\n.zdx-root button,.zdx-root input{min-height:44px!important;box-sizing:border-box}.zdx-root button{min-width:44px!important}.zdx-root :focus-visible{outline:3px solid currentColor!important;outline-offset:3px!important}@media(prefers-reduced-motion:reduce){.zdx-root *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}"}</style>{"\n"}{"\n"}<div style={css("position:relative;width:390px;height:844px;overflow:hidden;background:#E4E0D8;color:#1B1A18;font-family:'Bricolage Grotesque',system-ui,sans-serif")}>{"\n\n  "}<div style={css("position:absolute;left:0;right:0;bottom:0;height:250px;background:linear-gradient(#D8D3C9,#C5BFB3)")}></div>{"\n\n  "}<div style={css("position:absolute;left:0;right:0;top:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;z-index:40")}>{"\n    "}<button className={"kosi-btn"} onClick={v.goHome} style={css("background:none;border:0;padding:0;font-size:20px;font-weight:800;letter-spacing:.26em")} type="button">{this.context?.brand||"KOSI"}</button>{"\n    "}<div style={css("display:flex;align-items:center;gap:10px")}>{"\n      "}<div style={css("display:flex;border:1.5px solid #1B1A18;border-radius:999px;overflow:hidden")}>{"\n        "}<button className={"kosi-btn"} onClick={v.setGB} style={css(v.gbStyle)} type="button">{"£"}</button>{"\n        "}<button className={"kosi-btn"} onClick={v.setNG} style={css(v.ngStyle)} type="button">{"₦"}</button>{"\n      "}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.goBag} style={css("background:#1B1A18;color:#fff;border:0;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:600;min-height:40px")} type="button">{["Bag · ",v.count]}</button>{"\n    "}</div>{"\n  "}</div>{"\n\n  "}{v.showChips&&<React.Fragment>{"\n    "}<nav aria-label={"Rooms"} style={css("position:absolute;left:0;right:0;top:58px;height:48px;z-index:40;display:flex;gap:8px;padding:0 18px;overflow-x:auto;align-items:center")}>{"\n      "}{(v.rooms||[]).map((r,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n        "}<button className={"kosi-btn"} onClick={r.pick} style={css(r.style)} type="button">{r.name}</button>{"\n      "}</React.Fragment>)}{"\n    "}</nav>{"\n  "}</React.Fragment>}{"\n  "}{v.isProduct&&<React.Fragment>{"\n    "}<button className={"kosi-btn"} onClick={v.goHome} style={css("position:absolute;left:18px;top:62px;z-index:40;background:none;border:0;padding:8px 0;font-size:15px;font-weight:600;min-height:44px")} type="button">{<> <ThemeIcon name="left"/>{" Back to the rail"} </>}</button>{"\n  "}</React.Fragment>}{"\n\n  "}{(v.rails||[]).map((rl,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n    "}<div style={css(rl.style)}></div>{"\n  "}</React.Fragment>)}{"\n\n  "}{(v.garments||[]).map((g,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n    "}<div style={css(g.style)}>{"\n      "}<button className={"kosi-btn"} onClick={g.pick} aria-label={g.aria} style={css("display:block;position:relative;width:100%;padding:0;border:0;background:none")} type="button">{"\n        "}<svg viewBox={"0 0 200 280"} width={"240"} height={"336"} style={css("display:block;overflow:visible")} aria-hidden={"true"}>{"\n          "}<path d={"M100 24 V16 C100 4 114 4 114 14 M100 24 L24 66 M100 24 L176 66 M24 66 H176"} fill={"none"} stroke={"#6B6A66"} strokeWidth={"2.4"} strokeLinecap={"round"}></path>{"\n          "}<path d={g.d1} fill={g.f1}></path>{"\n          "}<path d={g.d2} fill={g.f2}></path>{"\n          "}<path d={g.d3} fill={g.f3}></path>{"\n        "}</svg>{"\n        "}<div style={css("position:absolute;left:12%;right:12%;bottom:-30px;height:16px;border-radius:50%;background:rgba(0,0,0,.24);filter:blur(9px)")}></div>{"\n      "}</button>{"\n      "}<div style={css(g.labelStyle)}><span style={css("display:block;font-weight:800")}>{g.name}</span><span style={css("display:block;opacity:.75")}>{g.price}</span></div>{"\n    "}</div>{"\n  "}</React.Fragment>)}{"\n\n  "}{v.isHome&&<React.Fragment>{"\n    "}<div style={css("position:absolute;left:18px;right:18px;top:522px;z-index:30;display:flex;align-items:center;justify-content:space-between")}>{"\n      "}<button className={"kosi-btn"} onClick={v.prev} aria-label={"Previous garment"} style={css("width:44px;height:44px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:18px")} type="button">{<> <ThemeIcon name="left"/> </>}</button>{"\n      "}<div style={css("font-size:14px;font-weight:600")}>{v.counter}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.next} aria-label={"Next garment"} style={css("width:44px;height:44px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:18px")} type="button">{<> <ThemeIcon name="right"/> </>}</button>{"\n    "}</div>{"\n    "}<div style={css("position:absolute;left:12px;right:12px;bottom:14px;height:188px;box-sizing:border-box;background:#fff;border-radius:18px;padding:18px 20px;z-index:30;display:flex;flex-direction:column;gap:10px;animation:kosiUp .5s both")}>{"\n      "}<div style={css("display:flex;justify-content:space-between;align-items:baseline;gap:8px")}>{"\n        "}<div style={css("font-size:22px;font-weight:800;line-height:1.1")}>{v.cur.name}</div>{"\n        "}<div style={css("font-size:19px;font-weight:600")}>{v.cur.price}</div>{"\n      "}</div>{"\n      "}<div style={css("font-size:13px;color:#4A4843;line-height:1.4")}>{[v.cur.tag," · ",v.cur.fabric]}</div>{"\n      "}<div style={css("display:flex;gap:10px;margin-top:auto")}>{"\n        "}<button className={"kosi-btn"} onClick={v.goProduct} style={css("flex:1;min-height:48px;background:none;border:1.5px solid #1B1A18;border-radius:12px;font-size:15px;font-weight:800")} type="button">{"Details"}</button>{"\n        "}<button className={"kosi-btn"} onClick={v.quickAdd} style={css("flex:1;min-height:48px;background:#B8330F;color:#fff;border:0;border-radius:12px;font-size:15px;font-weight:800")} type="button">{"Add to bag"}</button>{"\n      "}</div>{"\n    "}</div>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isCollection&&<React.Fragment>{"\n    "}<div style={css("position:absolute;left:18px;top:108px;z-index:30;font-size:12px;font-weight:600;letter-spacing:.14em")}>{v.roomTitle}</div>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isProduct&&<React.Fragment>{"\n    "}<aside aria-label={"Product"} style={css("position:absolute;left:0;right:0;bottom:0;height:430px;box-sizing:border-box;background:#fff;border-radius:22px 22px 0 0;padding:22px 22px 20px;z-index:40;display:flex;flex-direction:column;gap:12px;animation:kosiUp .55s both")}>{"\n      "}<div style={css("display:flex;justify-content:space-between;align-items:baseline;gap:8px")}>{"\n        "}<h1 style={css("margin:0;font-size:27px;line-height:1.05;font-weight:800")}>{v.cur.name}</h1>{"\n        "}<div style={css("font-size:21px;font-weight:600")}>{v.cur.price}</div>{"\n      "}</div>{"\n      "}<p style={css("margin:0;font-size:14px;line-height:1.45;color:#3A3834")}>{v.cur.desc}</p>{"\n      "}<div style={css("display:flex;align-items:center;gap:10px")}>{"\n        "}<div style={css("font-size:12px;font-weight:600;letter-spacing:.1em;width:96px")}>{["COLOUR · ",v.curColour]}</div>{"\n        "}{(v.colours||[]).map((c,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n          "}<button className={"kosi-btn"} onClick={c.pick} aria-label={c.aria} style={css(c.style)} type="button"></button>{"\n        "}</React.Fragment>)}{"\n      "}</div>{"\n      "}<div >{"\n        "}<div style={css("font-size:12px;font-weight:600;letter-spacing:.1em;margin-bottom:8px")}>{["SIZE · ",v.size]}</div>{"\n        "}<div style={css("display:flex;gap:8px")}>{"\n          "}{(v.sizes||[]).map((z,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n            "}<button className={"kosi-btn"} onClick={z.pick} style={css(z.style)} type="button">{z.label}</button>{"\n          "}</React.Fragment>)}{"\n        "}</div>{"\n      "}</div>{"\n      "}<button className={"kosi-btn"} onClick={v.addToBag} style={css("margin-top:auto;min-height:54px;background:#B8330F;color:#fff;border:0;border-radius:14px;font-size:17px;font-weight:800")} type="button">{["Add to bag · ",v.cur.price]}</button>{"\n      "}<div style={css("font-size:12px;color:#4A4843;text-align:center")}>{"Delivery and returns are shown at checkout for your market."}</div>{"\n    "}</aside>{"\n  "}</React.Fragment>}{"\n\n  "}{v.isBag&&<React.Fragment>{"\n    "}<div style={css("position:absolute;inset:0;background:rgba(228,224,216,.4);z-index:35")}></div>{"\n    "}<aside aria-label={"Bag"} style={css("position:absolute;left:0;right:0;bottom:0;height:590px;box-sizing:border-box;background:#fff;border-radius:22px 22px 0 0;padding:22px;z-index:40;display:flex;flex-direction:column;gap:12px;animation:kosiUp .5s both;box-shadow:0 -10px 40px rgba(0,0,0,.15)")}>{"\n      "}<div style={css("display:flex;justify-content:space-between;align-items:baseline")}>{"\n        "}<div style={css("font-size:24px;font-weight:800")}>{["Bag · ",v.count]}</div>{"\n        "}<button className={"kosi-btn"} onClick={v.goHome} style={css("background:none;border:0;padding:8px 0;font-size:14px;font-weight:600;text-decoration:underline;min-height:44px")} type="button">{"Keep browsing"}</button>{"\n      "}</div>{"\n      "}{(v.bagItems||[]).map((b,zdxIndex)=><React.Fragment key={zdxIndex}>{"\n        "}<div style={css("display:flex;gap:12px;align-items:center;border-top:1px solid rgba(0,0,0,.1);padding-top:12px")}>{"\n          "}<div style={css("width:58px;height:70px;background:#EEEBE5;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0")}>{"\n            "}<svg viewBox={"0 0 200 280"} width={"40"} height={"56"} aria-hidden={"true"}><path d={b.d1} fill={b.f1}></path><path d={b.d2} fill={b.f2}></path><path d={b.d3} fill={b.f3}></path></svg>{"\n          "}</div>{"\n          "}<div style={css("flex-grow:1")}>{"\n            "}<div style={css("font-size:15px;font-weight:800")}>{b.name}</div>{"\n            "}<div style={css("font-size:12px;color:#4A4843")}>{b.meta}</div>{"\n            "}<div style={css("display:flex;align-items:center;gap:8px;margin-top:4px")}>{"\n              "}<button className={"kosi-btn"} onClick={b.dec} aria-label={"Remove one"} style={css("width:36px;height:36px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:16px;line-height:1")} type="button">{<> <ThemeIcon name="minus"/> </>}</button>{"\n              "}<span style={css("font-size:14px;font-weight:600;width:16px;text-align:center")}>{b.qty}</span>{"\n              "}<button className={"kosi-btn"} onClick={b.inc} aria-label={"Add one"} style={css("width:36px;height:36px;border-radius:50%;border:1.5px solid #1B1A18;background:none;font-size:16px;line-height:1")} type="button">{<> <ThemeIcon name="plus"/> </>}</button>{"\n            "}</div>{"\n          "}</div>{"\n          "}<div style={css("font-size:15px;font-weight:800")}>{b.line}</div>{"\n        "}</div>{"\n      "}</React.Fragment>)}{"\n      "}<div style={css("display:flex;justify-content:space-between;border-top:1px solid rgba(0,0,0,.1);padding-top:12px;font-size:18px;font-weight:800;margin-top:auto")}><span >{"Subtotal"}</span><span >{v.subtotal}</span></div>{"\n      "}<div style={css("font-size:12px;color:#4A4843")}>{"Delivery is calculated at checkout for your market."}</div>{"\n      "}<button className={"kosi-btn"} style={css("min-height:50px;background:#1B1A18;color:#fff;border:0;border-radius:12px;font-size:16px;font-weight:800")} type="button">{"Pay with PayPal"}</button>{"\n      "}<button className={"kosi-btn"} style={css("min-height:50px;background:#B8330F;color:#fff;border:0;border-radius:12px;font-size:16px;font-weight:800")} type="button">{"Checkout"}</button>{"\n    "}</aside>{"\n  "}</React.Fragment>}{"\n"}</div>{"\n"}</div>;}
}
