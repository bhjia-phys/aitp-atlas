// An inquiry may point to a manifest. The host checks and reads it only on a
// researcher click. A switch of root/source unmounts the previous request/view.
function InquiryFigure({ root, figure, onOpenRef }) {
  const source = figure?.source;
  if (!source) return h('p',{className:'atlas-inquiry-figure-note'},'No comparison dataset is attached.');
  if (!root || typeof source !== 'string' || source.length > 640 || !/[^/]+\.atlas-figure\.json$/i.test(source)) return h('p',{className:'atlas-inquiry-figure-note'},'Comparison unavailable: a workspace figure manifest is required.');
  return h(InquiryFigureRequest,{key:JSON.stringify([root,source]),root,source,onOpenRef});
}

function InquiryFigureRequest({root,source,onOpenRef}) {
  const [state,setState] = useState(null), flight = useRef(null);
  useEffect(() => () => { flight.current?.abort(); flight.current = null; },[]);
  async function load() {
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    setState({loading:true});
    try {
      const query = new URLSearchParams({expectedRoot:root,source});
      const res = await fetch(`${API}/inquiry-figure?${query}`,{credentials:'same-origin',signal:controller.signal,cache:'no-store'});
      if (!res.ok) throw new Error(res.status === 409 ? 'The workspace changed. Refresh before opening the figure.' : 'The figure service could not read this comparison.');
      const result = await res.json();
      if (result?.available && result.source !== source) throw new Error('The returned figure does not match this source.');
      if (flight.current === controller) setState(result?.available || result?.limitation ? result : {limitation:'The comparison is unavailable.'});
    } catch (error) {
      if (flight.current === controller) setState({limitation:error.message || 'The comparison could not be read.'});
    } finally { if (flight.current === controller) flight.current = null; }
  }
  return h('section',{className:'atlas-inquiry-figure', 'aria-label':'Comparison figure',style:{marginBlock:'var(--s-12)',minWidth:0,overflowWrap:'anywhere'}},
    h(Button,{small:true,quiet:true,disabled:!!state?.loading,'aria-expanded':!!state?.available,onClick:state?.available ? () => setState(null) : load},
      state?.available ? 'Hide comparison figure' : state?.loading ? 'Reading comparison…' : 'Load comparison figure'),
    state?.limitation && h('p',{role:'status'},'Comparison unavailable: '+state.limitation),
    state?.available && h(InquiryFigurePlot,{table:state,root,onOpenRef}));
}

// Use different strokes as well as Atlas's day/night colors. Coordinates are
// shared between curves; constant data stays flat, without an invented range.
const inquiryStrokes = [['accent',undefined],['gold','8 3'],['success-text','2 3'],['n4','8 3 2 3'],['n5','12 4'],['n7','3 2 3 5']];
function InquiryFigurePlot({table,root,onOpenRef}) {
  const {kind,columns,rows,domain,source,data,report,commonParameters,normalization} = table;
  const schematic = kind === 'schematic', name = schematic ? 'Schematic comparison' : 'Reported computed comparison';
  const title = k => table[k+'Label'] + (table[k+'Unit'] ? ` (${table[k+'Unit']})` : '');
  const [xmin,xmax] = domain.x, [ymin,ymax] = domain.y;
  const left = 64, right = 344, top = 13, bottom = 132;
  const x = v => left + (v-xmin)/(xmax-xmin)*(right-left);
  const y = v => ymin === ymax ? (top+bottom)/2 : bottom - (v-ymin)/(ymax-ymin)*(bottom-top);
  // Keep exponent text as text (rounding MAX_VALUE then parsing it can overflow).
  // If four significant digits hide a small difference, show the exact limits in
  // the axis heading rather than printing identical numbers at opposite ends.
  const tick = n => n.toPrecision(4).replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/,'$1');
  const narrow = ([a,b]) => a !== b && tick(a) === tick(b);
  const axis = k => title(k) + (narrow(domain[k]) ? ` · ${domain[k][0]} to ${domain[k][1]}` : '');
  const endTick = (k,v) => narrow(domain[k]) ? v === domain[k][0] ? 'min' : 'max' : tick(v);
  const styleFor = i => ({stroke:`var(--${inquiryStrokes[i][0]})`,strokeDasharray:inquiryStrokes[i][1],strokeWidth:2,fill:'none',vectorEffect:'non-scaling-stroke'});
  const ref = (label, pointer) => pointer && h('div',{key:label},label,': ',onOpenRef ? h('button',{type:'button',className:'atlas-link',style:{overflowWrap:'anywhere',maxWidth:'100%'},onClick:() => onOpenRef(joinPath(root,pointer))},pointer) : h('code',null,pointer));
  const legendStyle = {display:'flex',alignItems:'center',gap:'var(--s-4)',minWidth:0};
  return h('figure',{style:{margin:'var(--s-8) 0',padding:'var(--s-12)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',background:'var(--sunken)',color:'var(--text-2)',font:'var(--t-meta)',maxWidth:'40rem',boxSizing:'border-box'}},
    h('figcaption',null,h('strong',{style:{font:'var(--t-h3)',color:'var(--text-1)'}},name),
      h('div',null,schematic ? 'Illustration from supplied samples, not a computed result.' : 'The manifest labels these samples as computed and cites a report. Atlas did not replay or independently verify them.')),
    h('div',{style:{marginTop:'var(--s-12)'}},axis('y')),
    h('svg',{role:'img','aria-label':name,viewBox:'0 0 360 156',style:{display:'block',width:'100%',maxHeight:'16rem',fontFamily:'var(--font-mono)',fontSize:11}},
      h('desc',null,`${columns.slice(1).join(', ')} share ${rows.length} ${title('x')} samples from ${xmin} to ${xmax}; ${title('y')} ranges from ${ymin} to ${ymax}. Straight segments join the supplied rows.`),
      (ymin===ymax ? [ymin] : [ymin,ymax]).map(v=>h('g',{key:v},h('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:'var(--border-control)',strokeDasharray:'2 4'}),h('text',{x:left-5,y:y(v)+4,textAnchor:'end',fill:'var(--text-2)'},endTick('y',v)))),
      h('path',{d:`M${left} ${top} V${bottom} H${right}`,fill:'none',stroke:'var(--text-3)'}),
      columns.slice(1).map((label,i)=>h('polyline',{key:label,points:rows.map(r=>`${x(r[0]).toFixed(3)},${y(r[i+1]).toFixed(3)}`).join(' '),...styleFor(i)},h('title',null,label))),
      [xmin,xmax].map((v,i)=>h('text',{key:i,x:x(v),y:bottom+15,textAnchor:i ? 'end' : 'start',fill:'var(--text-2)'},endTick('x',v)))),
    h('div',{style:{textAlign:'center'}},axis('x')),
    h('ul',{'aria-label':'Series',style:{display:'flex',flexWrap:'wrap',gap:'var(--s-8) var(--s-16)',listStyle:'none',padding:0}},columns.slice(1).map((label,i)=>h('li',{key:label,style:legendStyle},h('svg',{width:26,height:8,viewBox:'0 0 26 8','aria-hidden':true},h('line',{x1:0,y1:4,x2:26,y2:4,...styleFor(i)})),label))),
    h('details',null,h('summary',null,'Source and comparison conditions'),
      h('p',null,`${rows.length} shared samples · ${title('x')}: ${xmin} to ${xmax} · ${title('y')}: ${ymin} to ${ymax}. Lines join rows without fitting or rescaling individual series.`),
      h('div',null,'Common parameters: ',commonParameters || 'Not declared (schematic).'),
      h('div',null,'Normalization: ',normalization || 'Not declared (schematic).'),ref('Manifest',source),ref('Data',data),ref('Replay / evidence report',report)));
}
