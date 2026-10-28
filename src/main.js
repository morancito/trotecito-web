import "./styles.css";
import { Viewer, topY, RM } from "./shoe3d.js";

/* Catálogo: se edita en public/data/modelos.json, no acá. */
const res = await fetch(import.meta.env.BASE_URL + "data/modelos.json", { cache: "no-cache" });
const CAT = await res.json();
const DATA = CAT.modelos.map(d => {
  d.tiendas.sort((a, b) => a.precio - b.precio);
  d.min = d.tiendas[0]?.precio ?? null;
  d.full = !!(d.peso && d.drop && d.corredor && d.tiendas.length);
  return d;
});

const PISADA={"Neutra":"Neutra · Supinadora","Estabilidad":"Pronadora"};
const USOS=["Iniciación","Rodaje diario","Rodaje largo","Ritmo","Competencia"];
const BRANDS=[...new Set(DATA.map(d=>d.m))];
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>"$"+Math.round(n).toLocaleString("es-AR");
const pend='<span class="pend">pendiente</span>';
const pad=n=>String(n).padStart(3,"0");
const hasPlate=d=>!!d.pl&&/carbono|nylon|varilla/i.test(d.pl);

/* ---------- Hero ---------- */
const hero=Viewer($("#heroStage"),{H:38,F:28,dims:true,view:.55});

/* ---------- Laboratorio ---------- */
const VIEWS={lado:0,"3/4":.55,atrás:Math.PI/2};
const lab=Viewer($("#labStage"),{H:38,F:28,auto:false,view:.35});
$("#labViews").innerHTML=Object.keys(VIEWS).map(k=>`<button data-v="${k}" aria-pressed="false">${k[0].toUpperCase()+k.slice(1)}</button>`).join("");
function setView(k){lab.view(VIEWS[k],false);document.querySelectorAll("#labViews button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===k));}
$("#labViews").onclick=e=>{const b=e.target.closest("button");if(b)setView(b.dataset.v);};
const LANES=[
 {k:"drop",t:"Drop",view:"lado",render(){const F=26;return `<h3>Drop</h3>
   <p>Es la diferencia de altura entre el talón y la punta. Si el talón mide 36 mm y el antepié 26 mm, el drop es 10 mm.</p>
   <div class="big" id="dropv">10 mm</div>
   <div class="ctrl"><label for="dropr">Mové el drop</label><input type="range" id="dropr" min="0" max="12" step="1" value="10"></div>
   <div class="scale" id="dropscale"><div data-r="0-4"><b>0 a 4 mm</b><span>Más natural. Cargan más el gemelo y el Aquiles: conviene pasar de a poco.</span></div>
   <div data-r="5-8"><b>5 a 8 mm</b><span>Intermedio. Es el rango más común en zapatillas actuales.</span></div>
   <div data-r="9-12"><b>9 a 12 mm</b><span>Clásico. Le resulta cómodo a quien apoya primero el talón.</span></div></div>
   <p class="note" style="margin-top:12px">Ningún drop es mejor que otro. Lo que más importa es no cambiar de golpe al que venís usando.</p>`;},
  mount(){const r=$("#dropr"),u=()=>{const d=+r.value;$("#dropv").textContent=d+" mm";lab.set({H:26+d,F:26,plate:false,leg:false,tilt:0,hl:null,dims:true});
   document.querySelectorAll("#dropscale div").forEach(x=>{const[a,b]=x.dataset.r.split("-").map(Number);x.classList.toggle("on",d>=a&&d<=b);});};r.oninput=u;u();}},
 {k:"stack",t:"Amortiguación",view:"3/4",render(){return `<h3>Amortiguación</h3>
   <p>Es cuánta espuma hay entre tu pie y el piso, medida en el talón (en la ficha figura como “altura” o “stack”). Más espuma protege más en kilómetros largos; menos espuma te da más sensación de suelo y control.</p>
   <div class="big" id="stackv">38 mm</div>
   <div class="ctrl"><label for="stackr">Altura del talón</label><input type="range" id="stackr" min="20" max="48" step="1" value="38"></div>
   <div class="scale" id="stackscale"><div data-r="20-29"><b>Menos de 30 mm</b><span>Firme y cercana al piso. Series y competencias cortas.</span></div>
   <div data-r="30-39"><b>30 a 39 mm</b><span>Equilibrada. Sirve para casi todo el entrenamiento.</span></div>
   <div data-r="40-48"><b>40 mm o más</b><span>Máxima amortiguación. Fondos largos y recuperación.</span></div></div>`;},
  mount(){const r=$("#stackr"),u=()=>{const h=+r.value;$("#stackv").textContent=h+" mm";lab.set({H:h,F:h-8,plate:false,leg:false,tilt:0,hl:"mid",dims:true});
   document.querySelectorAll("#stackscale div").forEach(x=>{const[a,b]=x.dataset.r.split("-").map(Number);x.classList.toggle("on",h>=a&&h<=b);});};r.oninput=u;u();}},
 {k:"pisada",t:"Pisada",view:"atrás",render(){return `<h3>Pisada</h3>
   <p>Es cómo se inclina tu pie cuando apoya, mirado desde atrás. La línea naranja es el eje del talón y la gris, el de la pierna.</p>
   <div class="seg" id="pis"><button data-t="0" aria-pressed="true">Neutra</button><button data-t="0.16" aria-pressed="false">Pronadora</button><button data-t="-0.16" aria-pressed="false">Supinadora</button></div>
   <div class="card" style="margin-top:14px" id="pistx"></div>
   <p class="note" style="margin-top:12px">Para saber la tuya, mirá el desgaste de la suela de tus zapatillas viejas o pedí un análisis a un kinesiólogo. Los estudios indican que elegir por comodidad funciona tan bien como elegir por pisada.</p>`;},
  mount(){const T={"0":["Neutra","El talón queda alineado con la pierna. Es lo más común. Te sirven las zapatillas neutras."],
    "0.16":["Pronadora","El pie se vence hacia adentro al apoyar. Si es marcado, una zapatilla de estabilidad ayuda a frenar ese movimiento."],
    "-0.16":["Supinadora","El pie se inclina hacia afuera. No existen zapatillas para supinadores: lo recomendado es una neutra con buena amortiguación."]};
   const u=t=>{lab.set({H:36,F:28,plate:false,leg:true,tilt:+t,hl:null,dims:false});const[a,b]=T[t];$("#pistx").innerHTML=`<b>${a}</b><p style="margin:4px 0 0">${b}</p>`;
    document.querySelectorAll("#pis button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.t===t));};
   $("#pis").onclick=e=>{const b=e.target.closest("button");if(b)u(b.dataset.t);};u("0");}},
 {k:"placa",t:"Placa",view:"3/4",render(){return `<h3>Placa</h3>
   <p>Es una lámina rígida, de carbono o nylon, metida dentro de la espuma. Vuelve la zapatilla más rígida y hace que el pie ruede hacia adelante con menos esfuerzo.</p>
   <div class="seg" id="pl"><button data-p="1" aria-pressed="true">Con placa</button><button data-p="0" aria-pressed="false">Sin placa</button></div>
   <div class="scale" style="margin-top:14px"><div><b>Carbono</b><span>La más rígida. Competencias y ritmos rápidos.</span></div>
   <div><b>Nylon o varillas</b><span>Más flexible y barata. Entrenamientos de ritmo.</span></div>
   <div><b>Sin placa</b><span>Lo normal para rodar todos los días.</span></div></div>
   <p class="note" style="margin-top:12px">Para empezar a correr no hace falta: la placa rinde más cuanto más rápido vas.</p>`;},
  mount(){const u=v=>{lab.set({H:38,F:30,plate:v==="1",leg:false,tilt:0,hl:null,dims:false});document.querySelectorAll("#pl button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.p===v));};
   $("#pl").onclick=e=>{const b=e.target.closest("button");if(b)u(b.dataset.p);};u("1");}},
 {k:"espuma",t:"Espuma",view:"lado",render(){return `<h3>Espuma</h3>
   <p>Es el material de la mediasuela, la parte resaltada. Define qué tan blanda se siente y cuánta energía te devuelve en cada paso.</p>
   <div class="scale"><div><b>EVA</b><span>La clásica. Barata y firme; pierde rebote con los kilómetros.</span></div>
   <div><b>TPU</b><span>Como la Boost de Adidas. Rebota y dura, pero pesa más.</span></div>
   <div><b>PEBA y supercríticas</b><span>ZoomX, Lightstrike Pro, FF Turbo, PWRRUN PB. Livianas y con mucho rebote; más caras.</span></div></div>
   <p class="note" style="margin-top:12px">En cada ficha del catálogo figura qué espuma usa el modelo.</p>`;},
  mount(){lab.set({H:38,F:30,plate:false,leg:false,tilt:0,hl:"mid",dims:false});}}
];
$("#lanes").innerHTML=LANES.map((l,i)=>`<button class="lane" role="tab" id="lane-${l.k}" aria-selected="false" data-k="${l.k}"><i>${i+1}</i><b>${l.t}</b></button>`).join("");
function openLane(k){const l=LANES.find(x=>x.k===k)||LANES[0];
  document.querySelectorAll(".lane").forEach(b=>b.setAttribute("aria-selected",b.dataset.k===l.k));
  $("#labtext").innerHTML=l.render();l.mount();setView(l.view);$("#labcap").textContent="Modelo genérico · "+l.t.toLowerCase();}
$("#lanes").onclick=e=>{const b=e.target.closest(".lane");if(b)openLane(b.dataset.k);};
document.addEventListener("click",e=>{const a=e.target.closest("[data-lane]");if(a){openLane(a.dataset.lane);drawer(false);}});
openLane("drop");

/* ---------- Catálogo ---------- */
const st={q:"",pis:new Set(),uso:new Set(),marca:new Set(),precio:false,ficha:false,sort:"data",cmp:[]};
$("#stats").innerHTML=[[DATA.length,"modelos"],[BRANDS.length,"marcas"],[DATA.filter(d=>d.tiendas.length).length,"con precio"],
 [DATA.reduce((a,d)=>a+d.tiendas.length,0),"ofertas relevadas"]].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
function opts(el,values,set,label,count){
 el.innerHTML=values.map(v=>`<label class="opt"><input type="checkbox" value="${esc(v)}"> ${esc(label?label(v):v)}<span class="n">${count(v)}</span></label>`).join("");
 el.addEventListener("change",e=>{const v=e.target.value;e.target.checked?set.add(v):set.delete(v);render();});}
opts($("#fPisada"),["Neutra","Estabilidad"],st.pis,v=>PISADA[v],v=>DATA.filter(d=>d.tipo===v).length);
opts($("#fUso"),USOS,st.uso,null,v=>DATA.filter(d=>d.uso===v).length);
opts($("#fMarca"),BRANDS,st.marca,null,v=>DATA.filter(d=>d.m===v).length);
$("#fPrecio").onchange=e=>{st.precio=e.target.checked;render();};
$("#fFicha").onchange=e=>{st.ficha=e.target.checked;render();};
$("#q").oninput=e=>{st.q=e.target.value.trim().toLowerCase();if(location.hash&&location.hash!=="#catalogo"){location.hash="catalogo";}render();};
$("#sort").onchange=e=>{st.sort=e.target.value;render();};
$("#reset").onclick=()=>{st.pis.clear();st.uso.clear();st.marca.clear();st.precio=st.ficha=false;document.querySelectorAll("#filters input").forEach(i=>i.checked=false);render();};
const drawer=o=>{$("#filters").classList.toggle("open",o);$("#scrim").hidden=!o;$("#fbtn").setAttribute("aria-expanded",o);};
$("#fbtn").onclick=()=>{if(!$("#viewHome").hidden){drawer(true);}else{location.hash="catalogo";setTimeout(()=>drawer(true),50);}};
$("#fclose").onclick=()=>drawer(false);$("#scrim").onclick=()=>drawer(false);

function profSVG(d){if(!d.talon||!d.ante)return "";const H=d.talon,F=d.ante,k=34/50,pts=[];
 for(let i=0;i<=20;i++){const x=22+(282-22)*i/20;pts.push([x,topY(x,H,F)]);}
 const p=pts.map(([x,y])=>`${(x/300*100).toFixed(1)},${(34-y*k).toFixed(1)}`).join(" ");
 return `<svg class="prof" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,34 ${p} 98,34" fill="var(--raise)" stroke="var(--accent)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`;}
function card(d){const on=st.cmp.includes(d.id);
 return `<a class="bib" href="#m-${d.id}" aria-label="${esc(d.m+" "+d.mod+" "+d.ver)}">
  <div class="hd"><span class="brand">${esc(d.m)}</span><span class="num">${pad(d.id)}</span></div>
  <h3 class="model">${esc(d.mod)} ${d.ver?`<small>${esc(d.ver)}</small>`:""}</h3>
  ${profSVG(d)}
  <div class="tags">${d.tipo?`<span class="tag">${PISADA[d.tipo]}</span>`:""}<span class="tag">${esc(d.uso)}</span>${d.full?'<span class="tag full">Ficha completa</span>':""}</div>
  ${d.peso?`<div class="mini"><span><b>${d.peso}</b> g</span><span>drop <b>${d.drop}</b> mm</span>${d.talon?`<span>talón <b>${d.talon}</b> mm</span>`:""}</div>`:""}
  <div class="price">${d.min?`<span><span class="from">${d.tiendas[0].desde?"desde":"mejor precio"} · ${d.tiendas.length} ${d.tiendas.length>1?"tiendas":"tienda"}</span><b>${fmt(d.min)}</b></span>`:`<span class="none">Precio sin relevar</span>`}
   <button class="cmp" aria-pressed="${on}" data-c="${d.id}">${on?"✓ Comparando":"+ Comparar"}</button></div></a>`;}
function list(){
 let l=DATA.filter(d=>(!st.q||`${d.m} ${d.mod} ${d.ver} ${d.esp}`.toLowerCase().includes(st.q))&&(!st.pis.size||st.pis.has(d.tipo))
  &&(!st.uso.size||st.uso.has(d.uso))&&(!st.marca.size||st.marca.has(d.m))&&(!st.precio||d.min)&&(!st.ficha||d.full));
 const big=1e12,s=st.sort;
 l.sort(s==="pasc"?(a,b)=>(a.min??big)-(b.min??big):s==="pdesc"?(a,b)=>(b.min??-1)-(a.min??-1):s==="peso"?(a,b)=>(a.peso??big)-(b.peso??big)
  :s==="stack"?(a,b)=>(b.talon??-1)-(a.talon??-1):s==="az"?(a,b)=>a.m.localeCompare(b.m)||a.mod.localeCompare(b.mod):(a,b)=>(b.full-a.full)||((b.min?1:0)-(a.min?1:0))||a.id-b.id);
 return l;}
function render(){const l=list();$("#grid").innerHTML=l.map(card).join("");$("#empty").hidden=l.length>0;$("#count").textContent=`${l.length} de ${DATA.length} modelos`;tray();}
function tray(){const n=st.cmp.length;$("#tray").hidden=n===0||location.hash==="#comparar";$("#traytxt").textContent=`${n} de 3 para comparar`;$("#traygo").disabled=n<2;}
document.addEventListener("click",e=>{const c=e.target.closest(".cmp");if(!c)return;e.preventDefault();e.stopPropagation();
 const id=+c.dataset.c,i=st.cmp.indexOf(id);if(i>=0)st.cmp.splice(i,1);else if(st.cmp.length<3)st.cmp.push(id);
 const on=st.cmp.includes(id);document.querySelectorAll(`.cmp[data-c="${id}"]`).forEach(b=>{b.setAttribute("aria-pressed",on);b.textContent=on?"✓ Comparando":"+ Comparar";});tray();});
$("#trayclear").onclick=()=>{st.cmp=[];render();route();};
$("#traygo").onclick=()=>{location.hash="comparar";};

/* ---------- Detalle ---------- */
const v=(x,u)=>x!=null&&x!==""?`${x} ${u}`:pend;
const specs=d=>[["Pisada",d.tipo?PISADA[d.tipo]:pend],["Uso",esc(d.uso)],["Peso",d.peso?`${d.peso} g <span class="note">(hombre)</span>`:pend],["Drop",v(d.drop,"mm")],
 ["Altura talón",v(d.talon,"mm")],["Altura antepié",v(d.ante,"mm")],["Espuma",d.esp?esc(d.esp):pend],["Placa",d.pl?esc(d.pl):pend]];
let detailViewer=null;
function detail(d){const t=d.tiendas,best=t[0],worst=t[t.length-1],can3d=d.talon&&d.ante;
 return `<button class="back" data-back>← Volver al catálogo</button>
 <div class="dtop"><div>
  <div class="eyebrow">${esc(d.m)} · Dorsal ${pad(d.id)}</div>
  <h1>${esc(d.mod)} ${esc(d.ver)}</h1>
  <div class="badges">${d.tipo?`<span class="badge foot">${PISADA[d.tipo]}</span>`:""}<span class="badge">${esc(d.uso)}</span>${hasPlate(d)?`<span class="badge">${esc(d.pl)}</span>`:""}<span class="badge">${d.ar?"A la venta en Argentina":"Disponibilidad sin confirmar"}</span></div>
  <div class="kpis"><div><span>Mejor precio</span><b>${d.min?fmt(d.min):"—"}</b></div><div><span>Peso</span><b>${d.peso?d.peso+" g":"—"}</b></div>
   <div><span>Drop</span><b>${d.drop!=null?d.drop+" mm":"—"}</b></div><div><span>Talón</span><b>${d.talon?d.talon+" mm":"—"}</b></div></div>
 </div><div>
  ${can3d?`<div class="stage" id="dStage"><div class="lbls"></div><div class="stagecap"><span>A escala con su ficha · modelo genérico</span></div></div>`
   :`<div class="stage"><div class="no3d">El 3D a escala aparece cuando cargamos la altura de talón y antepié de este modelo.</div></div>`}
 </div></div>
 <div class="dgrid"><div>
  <div class="section"><h2>Fotos</h2><div class="photos">${t.length?t.map(s=>`<a class="photo" href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(s.tienda)}</b><span>Ver fotos en la tienda ↗</span></a>`).join("")
   :`<div class="photo"><b>Sin tiendas relevadas</b><span style="color:var(--muted)">Las fotos llegan con los catálogos de las tiendas.</span></div>`}</div>
   ${d.colores.length?`<div class="swatches" style="margin-top:12px">${d.colores.map(([n,c])=>`<span class="sw"><i style="background:${c}"></i>${esc(n)}</span>`).join("")}</div>`:""}</div>
  <div class="section"><h2>Para qué corredor</h2><div class="card">${d.corredor?`<div class="who">
   <div><span class="k">Pisada</span><span class="v">${d.tipo==="Estabilidad"?"Pronadores que buscan control":"Neutros y supinadores"}</span></div>
   <div><span class="k">Nivel</span><span class="v">${esc(d.corredor.nivel)}</span></div>
   <div><span class="k">Ritmo</span><span class="v">${esc(d.corredor.ritmo)}</span></div>
   <div><span class="k">Peso del corredor</span><span class="v">${esc(d.corredor.peso)}</span></div>
   <div><span class="k">Distancias</span><span class="v">${esc(d.corredor.distancia)}</span></div>
   <div><span class="k">No la elijas si</span><span class="v">${esc(d.evitar)}</span></div></div>`:`<p style="margin:0">Todavía no cargamos el perfil de corredor de este modelo.</p>`}</div></div>
  <div class="section"><h2>Ficha técnica</h2><div class="card"><dl class="specs">${specs(d).map(([k,x])=>`<dt>${k}</dt><dd>${x}</dd>`).join("")}</dl></div>
   ${d.fuente?`<p class="note">Datos medibles tomados de <a href="${esc(d.fuente[1])}" target="_blank" rel="noopener">${esc(d.fuente[0])}</a>, donde está la review completa.</p>`:""}
   <p class="note">¿No sabés qué significa algún dato? <a href="#aprender" data-lane="drop">Miralo en 3D</a>.</p></div>
 </div><div>
  <div class="section"><h2>Dónde comprarla · de menor a mayor precio</h2>
  ${t.length?`<div class="ladder">${t.map((s,i)=>`<div class="store ${i===0&&t.length>1?"best":""}"><span class="pos">${i+1}</span>
    <div style="min-width:0"><div class="nm">${esc(s.tienda)}${i===0&&t.length>1?'<span class="pill">Más barata</span>':""}</div>
     <div class="cond">${esc(s.cuotas)}${s.nota?` · ${esc(s.nota)}`:""}</div><div class="cond">Relevado el ${s.fecha}</div></div>
    <div class="pr">${s.desde?'<span class="note">desde</span>':""}<b>${fmt(s.precio)}</b>${s.antes?`<s>${fmt(s.antes)}</s>`:""}<br><a href="${esc(s.url)}" target="_blank" rel="noopener">Ir a la tienda ↗</a></div></div>`).join("")}</div>
   ${t.length>1?`<p class="spread">Entre la más barata y la más cara hay <b>${fmt(worst.precio-best.precio)}</b> de diferencia.</p>`:`<p class="spread">Por ahora relevamos una sola tienda para este modelo.</p>`}`
   :`<div class="card"><p style="margin:0">Todavía no relevamos precios de este modelo en tiendas argentinas.</p></div>`}</div>
  <div class="section"><h2>Opiniones de corredores</h2><div class="card"><p style="margin:0">Todavía no hay opiniones de este modelo.</p>
   <p class="note" style="margin:6px 0 0">Las reseñas de corredores argentinos llegan en la próxima versión: kilómetros, uso y cómo les duró.</p></div></div>
  <div class="section"><button class="cmp" style="font-size:14px;padding:9px 16px" aria-pressed="${st.cmp.includes(d.id)}" data-c="${d.id}">${st.cmp.includes(d.id)?"✓ Comparando":"+ Comparar"}</button></div>
 </div></div>`;}

/* ---------- Comparar ---------- */
const CC=["var(--accent)","var(--ok)","var(--warn)"];
function overlay(ds){const ok=ds.filter(d=>d.talon&&d.ante);if(!ok.length)return "";const ex=3,Hm=Math.max(...ok.map(d=>d.talon))*ex+20;
 const lines=ok.map((d,i)=>{const pts=[];for(let j=0;j<=30;j++){const x=22+(282-22)*j/30;pts.push(`${x},${(Hm-topY(x,d.talon,d.ante)*ex).toFixed(1)}`);}
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${CC[ds.indexOf(d)]}" stroke-width="3"/>`;}).join("");
 return `<div class="overlay"><svg viewBox="0 0 300 ${Hm+12}" role="img" aria-label="Perfil de mediasuela de cada modelo">
  <line x1="0" y1="${Hm}" x2="300" y2="${Hm}" stroke="var(--line)" stroke-width="2"/>
  <text x="4" y="${Hm+10}" font-size="8" fill="var(--muted)" font-family="JetBrains Mono, monospace">TALÓN</text>
  <text x="296" y="${Hm+10}" font-size="8" fill="var(--muted)" text-anchor="end" font-family="JetBrains Mono, monospace">PUNTA</text>${lines}</svg>
  <div class="legend">${ok.map(d=>`<span><i style="background:${CC[ds.indexOf(d)]}"></i>${esc(d.mod)} ${esc(d.ver)} · ${d.talon}/${d.ante} mm</span>`).join("")}</div>
  <p class="note" style="margin:6px 0 0">Altura de la mediasuela, con la escala vertical ampliada ×3 para que se vea la diferencia.</p></div>`;}
function compare(){const ds=st.cmp.map(id=>DATA.find(x=>x.id===id));
 if(ds.length<2)return `<button class="back" data-back>← Volver al catálogo</button><p>Elegí al menos dos modelos para comparar.</p>`;
 const lowP=Math.min(...ds.map(d=>d.min??1e12)),lowW=Math.min(...ds.map(d=>d.peso??1e12));
 const rows=[["Mejor precio",d=>d.min?`<span class="${d.min===lowP?"win":""}">${fmt(d.min)}</span><div class="note">${esc(d.tiendas[0].tienda)}</div>`:pend],
  ["Tiendas relevadas",d=>d.tiendas.length||pend],["Peso",d=>d.peso?`<span class="${d.peso===lowW?"win":""}">${d.peso} g</span>`:pend],
  ...["Pisada","Uso","Drop","Altura talón","Altura antepié","Espuma","Placa"].map(k=>[k,d=>specs(d).find(r=>r[0]===k)[1]]),
  ["Peso del corredor",d=>d.corredor?esc(d.corredor.peso):pend],["Ritmo",d=>d.corredor?esc(d.corredor.ritmo):pend]];
 return `<button class="back" data-back>← Volver al catálogo</button>
  <div class="eyebrow">Comparación</div><h1 style="font-family:var(--display);font-weight:900;font-size:64px;text-transform:uppercase;margin:4px 0 16px;line-height:.9">${ds.length} modelos</h1>
  ${overlay(ds)}
  <div class="tblwrap"><table class="cmpt"><thead><tr><th></th>${ds.map((d,i)=>`<th><a href="#m-${d.id}" style="color:inherit;text-decoration:none;border-bottom:3px solid ${CC[i]}">${esc(d.mod)} ${esc(d.ver)}</a><div class="brand">${esc(d.m)}</div></th>`).join("")}</tr></thead>
  <tbody>${rows.map(([k,f])=>`<tr><th>${k}</th>${ds.map(d=>`<td>${f(d)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="note">En verde, el más barato y el más liviano.</p>`;}

/* ---------- Router ---------- */
document.addEventListener("click",e=>{if(e.target.closest("[data-back]")){location.hash="catalogo";}});
function route(){
 const h=location.hash.slice(1),m=h.match(/^m-(\d+)$/),d=m&&DATA.find(x=>x.id===+m[1]);
 if(detailViewer){detailViewer.destroy();detailViewer=null;}
 $("#viewHome").hidden=!!(d||h==="comparar");$("#viewDetail").hidden=!d;$("#viewCompare").hidden=h!=="comparar";
 if(d){$("#viewDetail").innerHTML=detail(d);document.title=`${d.mod} ${d.ver} · Rodaje`;window.scrollTo(0,0);
   const s=$("#dStage");if(s)detailViewer=Viewer(s,{H:d.talon,F:d.ante,plate:hasPlate(d),dims:true,view:.25});}
 else if(h==="comparar"){$("#viewCompare").innerHTML=compare();document.title="Comparar · Rodaje";window.scrollTo(0,0);}
 else{document.title="Rodaje";render();if(h==="catalogo"||h==="aprender"){const t=document.getElementById(h);t&&setTimeout(()=>t.scrollIntoView({behavior:RM?"auto":"smooth"}),0);}}
 tray();}
addEventListener("hashchange",route);route();
