'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {chartDateIndices,chartScale} from '@/lib/chart-scale';
import s from './daily-metric-chart.module.css';
export type DailyMetricPoint={day:string;value:number};
const date=(day:string,long=false)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:long?'long':'short',...(long?{year:'numeric' as const}:{}),timeZone:'UTC'}).format(new Date(`${day}T00:00:00Z`));
export default function DailyMetricChart({title,subtitle,points,formatValue,formatTick,caption,legend,description,controls,kind='line',tableLabel,seriesKey}:{
 title:string;subtitle:string;points:DailyMetricPoint[];formatValue:(value:number)=>string;formatTick:(value:number)=>string;
 caption:string;legend:string;description:string;controls?:ReactNode;kind?:'line'|'bars';tableLabel:string;seriesKey?:string;
}){
 const id=useId(),container=useRef<HTMLDivElement>(null),[width,setWidth]=useState(640),[selection,setSelection]=useState<{key:string;index:number}|null>(null);
 const hasPoints=points.length>0;
 useEffect(()=>{
  const element=container.current;if(!element)return;
  const measure=()=>{const next=element.getBoundingClientRect().width;if(next>0)setWidth(Math.max(240,next));};measure();
  if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[hasPoints]);
 const key=seriesKey||`${title}:${points[0]?.day}:${points.at(-1)?.day}`;
 const index=Math.max(0,Math.min(selection&&selection.key===key?selection.index:points.length-1,points.length-1)),selected=points[index];
 const choose=(index:number)=>setSelection({key,index});
 const total=points.reduce((n,p)=>n+p.value,0),scale=chartScale(points.map(p=>p.value),kind==='bars');
 const left=64,right=18,top=20,bottom=208,height=248,plotWidth=width-left-right;
 const x=(i:number)=>left+(i+.5)*plotWidth/Math.max(1,points.length);
 const y=(value:number)=>bottom-value/scale.max*(bottom-top);
 const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
 const valueLabel=kind==='bars'?'Orders':'Paid order value';
 function select(clientX:number){const rect=container.current?.getBoundingClientRect();if(!rect||rect.width<=0)return;const local=(clientX-rect.left)*width/rect.width;choose(Math.max(0,Math.min(points.length-1,Math.floor((local-left)/plotWidth*points.length))));}
 return <section className={s.card} aria-labelledby={`${id}-title`}>
  <header className={s.header}><div><h2 id={`${id}-title`} className={s.title}>{title}</h2><p className={s.subtitle}>{subtitle}</p></div>{controls}</header>
  {points.length===0?<p className={s.empty}>No recorded orders for this period and market yet.</p>:<>
   <div className={s.summary}><div><div className={s.total}>{formatValue(total)}</div><p className={s.caption}>{caption}</p></div><span className={s.legend}><i aria-hidden="true"/>{legend}</span></div>
   <div ref={container} className={s.chart}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-chart-description`} className={s.svg}
     onPointerMove={event=>{if(event.pointerType==='mouse')select(event.clientX);}} onPointerDown={event=>select(event.clientX)}>
     <desc id={`${id}-chart-description`}>Daily {valueLabel.toLowerCase()}, {formatValue(total)} in this chart. Use the day selector or figures table for exact values. Dates are UTC.</desc>
     <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#217b72" stopOpacity=".16"/><stop offset="100%" stopColor="#217b72" stopOpacity=".015"/></linearGradient></defs>
     {scale.ticks.map(tick=><g key={tick}><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} stroke={tick===0?'#dde5e8':'#edf1f3'} strokeDasharray={tick===0?undefined:'3 5'}/><text x={left-12} y={y(tick)} dy=".35em" textAnchor="end" className={s.axis}>{formatTick(tick)}</text></g>)}
     {kind==='line'?<>
      {points.length>1&&<><path d={`${path} L${x(points.length-1)},${bottom} L${x(0)},${bottom} Z`} fill={`url(#${id}-fill)`}/><path d={path} fill="none" stroke="#217b72" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/></>}
      {points.length===1&&<circle cx={x(0)} cy={y(points[0].value)} r="4" fill="#217b72"/>}
     </>:points.map((p,i)=>{const barWidth=Math.min(28,plotWidth/points.length*.55);return <rect key={p.day} x={x(i)-barWidth/2} y={y(p.value)} width={barWidth} height={bottom-y(p.value)} rx="3" fill={index===i?'#217b72':'#b8d7d1'}><title>{`${date(p.day)}: ${formatValue(p.value)}`}</title></rect>;})}
     {selected&&<g pointerEvents="none"><line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#8ea7ad" strokeDasharray="3 4"/>{kind==='line'&&<><circle cx={x(index)} cy={y(selected.value)} r="8" fill="#217b72" fillOpacity=".10"/><circle cx={x(index)} cy={y(selected.value)} r="4" fill="#217b72" stroke="white" strokeWidth="2"/></>}</g>}
     {chartDateIndices(points.length,width<500).map(i=><text key={points[i].day} x={x(i)} y="235" textAnchor={i===0?'start':i===points.length-1?'end':'middle'} className={s.axis}>{date(points[i].day)}</text>)}
    </svg>
   </div>
   {selected&&<><div className={s.readout}><time dateTime={selected.day}>{date(selected.day,true)} · UTC</time><output aria-live="polite" aria-atomic="true"><strong>{formatValue(selected.value)}</strong> {kind==='bars'?'orders':'paid order value'}</output></div>
    <div className={s.dayControl}><button type="button" disabled={index===0} aria-label="Previous chart day" onClick={()=>choose(index-1)}><ChevronLeft aria-hidden="true" size={16}/></button><input id={`${id}-day`} aria-label={kind==='bars'?'Select a day in the orders chart':'Select a day in the sales chart'} aria-valuetext={`${date(selected.day,true)}: ${formatValue(selected.value)}`} type="range" min="0" max={Math.max(0,points.length-1)} value={index} disabled={points.length<2} onChange={event=>choose(Number(event.target.value))}/><button type="button" disabled={index===points.length-1} aria-label="Next chart day" onClick={()=>choose(index+1)}><ChevronRight aria-hidden="true" size={16}/></button></div></>}
  </>}
  <details className={s.details}><summary>{tableLabel}</summary><p>{description}</p>{points.length>0&&<div className={s.table}><table><caption className="sr-only">{title} · daily figures</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">{valueLabel}</th></tr></thead><tbody>{points.map(p=><tr key={p.day}><td><time dateTime={p.day}>{date(p.day)}</time></td><td>{formatValue(p.value)}</td></tr>)}</tbody></table></div>}</details>
 </section>;
}
