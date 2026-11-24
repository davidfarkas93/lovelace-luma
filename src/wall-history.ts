import { historyGroups, historyNumber, historySegments, recordTime, recordValue, type HistoryWindow } from './history';

/** Bounded SVG geometry; gaps stay disconnected, extrema use the full response. */
export function wallHistory(raw:unknown,entity:string,window:HistoryWindow){
  const rows=historyGroups(raw).find(group=>group.id===entity)?.records||[];
  const segments=historySegments(rows.map(row=>({time:recordTime(row),value:historyNumber(recordValue(row))})),window);
  let min=Infinity,max=-Infinity;
  for(const segment of segments)for(const point of segment){min=Math.min(min,point.value);max=Math.max(max,point.value);}
  if(!Number.isFinite(min))return {paths:[] as string[],min:undefined,max:undefined,low:0,high:1};
  const padding=Math.max((max-min)*.12,.5),low=min-padding,high=max+padding;
  // A pathological flapping sensor cannot create unbounded DOM or path geometry.
  const visible=segments.slice().sort((a,b)=>(b.at(-1)!.time-b[0].time)-(a.at(-1)!.time-a[0].time)).slice(0,144).sort((a,b)=>a[0].time-b[0].time);
  const bucketCount=Math.max(1,Math.floor(288/Math.max(1,visible.length)));
  const paths=visible.map(segment=>{
    const samples=[segment[0]];
    for(let bucket=0;bucket<bucketCount;bucket++){
      const start=Math.floor(bucket*segment.length/bucketCount),end=Math.floor((bucket+1)*segment.length/bucketCount);
      if(start>=end)continue;
      let lower=start,upper=start;
      for(let i=start+1;i<end;i++){if(segment[i].value<segment[lower].value)lower=i;if(segment[i].value>segment[upper].value)upper=i;}
      for(const i of [...new Set([lower,upper])].sort((a,b)=>a-b))samples.push(segment[i]);
    }
    samples.push(segment.at(-1)!);
    return samples.map((p,i)=>`${i?'L':'M'}${((p.time-window.start)/(window.end-window.start)*1000).toFixed(2)},${(240-(p.value-low)/(high-low)*240).toFixed(2)}`).join(' ');
  });
  return {paths,min,max,low,high};
}
