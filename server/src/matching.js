const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
export function scorePair(lost,found){
 let score=0, reasons=[];
 if(String(lost.category).toLowerCase()===String(found.category).toLowerCase()){score+=35;reasons.push('same category');}
 const a=new Set(norm(lost.item_name+' '+lost.description)), b=new Set(norm(found.item_name+' '+found.description));
 const common=[...a].filter(x=>b.has(x)&&x.length>2); const union=new Set([...a,...b]).size;
 const text=union?common.length/union:0; score+=Math.round(text*35); if(text>.1)reasons.push('similar item details');
 const d1=new Date(lost.item_date),d2=new Date(found.item_date); const days=Math.abs((d1-d2)/86400000);
 if(days<=2){score+=20;reasons.push('close dates');}else if(days<=7){score+=12;reasons.push('dates within a week');}else if(days<=30){score+=5;}
 const locA=norm(lost.location),locB=norm(found.location); if(locA.some(x=>locB.includes(x))){score+=10;reasons.push('overlapping location');}
 return {score:Math.min(100,score),reason:reasons.join(', ')||'some attributes are similar'};
}
