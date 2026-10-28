import * as THREE from "three";

export const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim()||"#888";

/* ---------- 3D: zapatilla genérica paramétrica (mm) ---------- */
const L=290;
const sstep=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function seg(x,P){if(x<=P[0][0])return P[0][1];for(let i=1;i<P.length;i++){const[a,va]=P[i-1],[b,vb]=P[i];if(x<=b)return va+(vb-va)*sstep((x-a)/(b-a));}return P[P.length-1][1];}
export function topY(x,H,F){return x<25?H:x<195?H+(F-H)*(x-25)/170:F*(1-.3*(x-195)/95);}
function botY(x){return x<30?Math.pow((30-x)/30,2)*9:x<205?0:Math.pow((x-205)/85,2)*22;}
function halfW(x,side){const R=34;if(x<=R)return Math.sqrt(Math.max(0,R*R-(R-x)*(R-x)));
 if(side>0){if(x<=210)return seg(x,[[R,34],[140,38],[210,44]]);const t=(x-210)/80;return 44*Math.pow(Math.max(0,1-t*t*t),.5);}
 if(x<=200)return seg(x,[[R,34],[90,29],[150,29],[200,44]]);const t=(x-200)/90;return 44*Math.pow(Math.max(0,1-t*t*t),.5);}
const spw=(v,n)=>Math.sign(v)*Math.pow(Math.abs(v),2/n);
function shoeSurf(H,F){
 const info=x=>{const wl=halfW(x,1),wm=halfW(x,-1),b=botY(x),tp=topY(x,H,F)+(x>200?b*.9:0);
  return{b,tp,zc:(wl-wm)/2,hw:(wl+wm)/2,u:seg(x,[[0,36],[16,44],[55,31],[100,43],[140,49],[190,37],[240,21],[290,8]])+2,n:seg(x,[[0,3.6],[105,3.6],[150,2.4]]),hl:Math.max(0,1-x/80)};};
 const midZ=(I,y)=>{const hh=(I.tp-I.b)/2,yy=Math.min(1,Math.abs((y-I.b-hh)/hh)),f=1+(.05+.09*I.hl)*(1-(y-I.b)/(I.tp-I.b||1));return I.zc+I.hw*Math.pow(1-Math.pow(yy,4.5),1/4.5)*f;};
 const mid=(x,t)=>{const I=info(x),a=2*Math.PI*t,hh=(I.tp-I.b)/2,y=I.b+hh+hh*spw(Math.sin(a),4.5),f=1+(.05+.09*I.hl)*(1-(y-I.b)/(I.tp-I.b||1));return[y,I.zc+I.hw*spw(Math.cos(a),4.5)*f];};
 const pad=(x0,x1)=>(x,t)=>{const I=info(x),a=2*Math.PI*t,k=Math.min(1,(x-x0)/8,(x1-x)/8),f=1+.14*I.hl;return[I.b-1.6+2.4*Math.max(.05,k)*spw(Math.sin(a),6),I.zc+I.hw*f*.98*spw(Math.cos(a),6)];};
 const upper=(x,t)=>{const I=info(x),a=Math.PI*t;return[I.tp-2+I.u*spw(Math.sin(a),I.n),I.zc+.88*I.hw*spw(Math.cos(a),I.n)];};
 const overlay=(fn,side)=>(x,t)=>{const I=info(x),h=Math.max(0,Math.min(1,fn(x))),am=Math.asin(Math.pow(h,I.n/2)),a=side>0?t*am:Math.PI-t*am;return[I.tp-2.2+I.u*spw(Math.sin(a),I.n),I.zc+.88*1.035*I.hw*spw(Math.cos(a),I.n)];};
 const plateY=x=>{const I=info(x);return I.b+(I.tp-I.b)*.42;};
 const plate=(x,t)=>{const I=info(x),a=2*Math.PI*t;return[plateY(x)+1.3*spw(Math.sin(a),8),I.zc+.8*I.hw*spw(Math.cos(a),8)];};
 const surf=(x,z)=>{const I=info(x),w=.88*I.hw||1e-6,r=Math.min(1,Math.abs((z-I.zc)/w));return I.tp-2+I.u*Math.pow(1-Math.pow(r,I.n),1/I.n);};
 const tongue=(x,t)=>{const I=info(x),a=2*Math.PI*t,y0=surf(x,I.zc);return[y0+1.4+1.8*spw(Math.sin(a),6),I.zc+9*spw(Math.cos(a),6)];};
 const heel=(x,y)=>{const I=info(x),r=Math.max(0,(y-I.tp+2)/I.u);return x+12*r*r*Math.max(0,1-x/70);};
 function loft(ring,K,closed,warp,x0=0,x1=290){const N=80,pos=[],uv=[],idx=[];
  for(let i=0;i<=N;i++){const x=x0+(x1-x0)*(1-Math.cos(Math.PI*i/N))/2;
   for(let j=0;j<K;j++){const[y,z]=ring(x,j/(closed?K:K-1));pos.push((warp?warp(x,y):x)-145,y,z);uv.push(x/290,j/(K-1));}}
  for(let i=0;i<N;i++)for(let j=0;j<(closed?K:K-1);j++){const a=i*K+j,b=i*K+(j+1)%K,c=a+K,d=b+K;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
 return{info,midZ,mid,pad,upper,overlay,plate,plateY,surf,tongue,heel,loft};
}
export function Viewer(host,init){
  const p=Object.assign({H:36,F:28,plate:false,tilt:0,leg:false,dims:true,hl:null,auto:!RM,view:.55},init||{});
    let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(e){host.insertAdjacentHTML("afterbegin",'<div class="no3d">Tu navegador no tiene WebGL activado, así que el 3D no se puede mostrar.</div>');return {set(){},view(){},destroy(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.insertBefore(renderer.domElement,host.firstChild);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(26,1,1,5000);
  cam.position.set(0,170,650);cam.lookAt(0,44,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x334455,.95));
  const dl=new THREE.DirectionalLight(0xffffff,.75);dl.position.set(300,500,400);scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,.3);dl2.position.set(-400,200,-300);scene.add(dl2);
  const root=new THREE.Group(),tilt=new THREE.Group();scene.add(root);root.add(tilt);
  const fixed=new THREE.Group();root.add(fixed);
  const lbHost=host.querySelector(".lbls");let labels=[];
  let rotY=p.view,target=p.view,rotX=0,drag=null,visible=true,raf,lastT=0;
  const mats=[];
  const knit=(()=>{const c=document.createElement("canvas");c.width=c.height=64;const g=c.getContext("2d");g.fillStyle="#e4e4e4";g.fillRect(0,0,64,64);g.fillStyle="#ffffff";
    for(let y=0;y<64;y+=8)for(let x=0;x<64;x+=8){g.beginPath();g.ellipse(x+4,y+4,3.2,2.4,0,0,7);g.fill();}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(20,4);t.anisotropy=4;return t;})();
  const shadow=(()=>{const c=document.createElement("canvas");c.width=c.height=128;const g=c.getContext("2d"),r=g.createRadialGradient(64,64,4,64,64,64);
    r.addColorStop(0,"rgba(0,0,0,.45)");r.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
  function M(color,o){const m=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.75,metalness:.05},o||{}));mats.push(m);return m;}
  function clear(g){while(g.children.length){const c=g.children.pop();c.geometry&&c.geometry.dispose();}}
  function extr(shape,depth,mat,bevel){const g=new THREE.ExtrudeGeometry(shape,Object.assign({depth,steps:1,curveSegments:18,bevelEnabled:true,bevelThickness:3,bevelSize:2,bevelSegments:3},bevel||{}));g.translate(-L/2,0,-depth/2);return new THREE.Mesh(g,mat);}
  function rod(x1,y1,z1,x2,y2,z2,r,mat){const a=new THREE.Vector3(x1,y1,z1),b=new THREE.Vector3(x2,y2,z2),len=a.distanceTo(b);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
  function lab(text,x,y,z,acc,g){const el=document.createElement("div");el.className="lbl"+(acc?" a":"");el.textContent=text;lbHost.appendChild(el);labels.push({el,v:new THREE.Vector3(x,y,z),g:g||tilt});}
  function build(){
    clear(tilt);clear(fixed);mats.forEach(m=>m.dispose());mats.length=0;labels.forEach(l=>l.el.remove());labels=[];
    const H=p.H,F=p.F,acc=tok("--accent"),up=tok("--upper"),ov=tok("--overlay"),sole=tok("--sole"),S=shoeSurf(H,F),D=THREE.DoubleSide;
    const midMat=M(p.hl==="mid"?acc:0xF4F1EC,{side:D,roughness:.5,transparent:p.plate,opacity:p.plate?.35:1,depthWrite:!p.plate,emissive:p.hl==="mid"?acc:0x000000,emissiveIntensity:p.hl==="mid"?.18:0});
    tilt.add(new THREE.Mesh(S.loft(S.mid,44,true),midMat));
    /* suela de goma en dos tacos: talón y antepié */
    const rub=M(sole,{side:D,roughness:.95});
    tilt.add(new THREE.Mesh(S.loft(S.pad(1,98),28,true,null,1,98),rub));
    tilt.add(new THREE.Mesh(S.loft(S.pad(150,289),28,true,null,150,289),rub));
    /* capellada de malla + refuerzos de talón y puntera */
    tilt.add(new THREE.Mesh(S.loft(S.upper,40,false,S.heel),M(up,{side:D,roughness:.85,map:knit})));
    const ovm=M(ov,{side:D,roughness:.6});
    const hw=(x,y)=>S.heel(x,y)-2*Math.max(0,1-x/22),tw=x=>x+2*Math.max(0,(x-268)/22);
    for(const sd of [1,-1]){
      tilt.add(new THREE.Mesh(S.loft(S.overlay(x=>.6*Math.min(1,(80-x)/34),sd),16,false,hw,0,80),ovm));
      tilt.add(new THREE.Mesh(S.loft(S.overlay(x=>.45*Math.min(1,(x-222)/26),sd),16,false,tw,222,290),ovm));}
    /* lengüeta y cordones */
    tilt.add(new THREE.Mesh(S.loft(S.tongue,20,true,null,98,192),M(0xE9EDF2,{side:D,roughness:.9})));
    const lace=M(0xF4F1EC,{roughness:.6});
    for(let k=0;k<6;k++){const X=112+k*14,I=S.info(X),sp=.3*.88*I.hw,z1=I.zc-sp,z2=I.zc+sp;
      tilt.add(rod(X-L/2,S.surf(X,z1)+3.6,z1,X-L/2+5,S.surf(X,z2)+3.6,z2,1.5,lace));}
    /* abertura del cuello */
    const cx=62,rx=38,rz=18,cg=new THREE.RingGeometry(.001,1,48,6),cp=cg.attributes.position;
    for(let i=0;i<cp.count;i++){const X=cx+cp.getX(i)*rx,Z=S.info(X).zc+cp.getY(i)*rz,Y=S.surf(X,Z)+.6;cp.setXYZ(i,S.heel(X,Y)-L/2,Y,Z);}
    cg.computeVertexNormals();tilt.add(new THREE.Mesh(cg,M(0x12161d,{side:D,roughness:1})));
    const rim=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2,X=cx+Math.cos(a)*rx,Z=S.info(X).zc+Math.sin(a)*rz,Y=S.surf(X,Z)+1.4;rim.push(new THREE.Vector3(S.heel(X,Y)-L/2,Y,Z));}
    tilt.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim,true),120,3,10,true),M(ov,{roughness:.7})));
    /* tirador del talón */
    {const I=S.info(4),Y=S.surf(4,I.zc)-3,X=S.heel(4,Y);const tab=new THREE.Mesh(new THREE.TorusGeometry(8,2.2,10,24,Math.PI),M(acc,{roughness:.5}));
     tab.rotation.z=Math.PI/2;tab.position.set(X-L/2-1,Y,I.zc);tilt.add(tab);}
    /* línea de la mediasuela en el lateral */
    const ln=[];for(let X=18;X<=236;X+=6){const I=S.info(X),Y=I.b+(I.tp-I.b)*.42;ln.push(new THREE.Vector3(X-L/2,Y,S.midZ(I,Y)+.2));}
    tilt.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ln),140,1.1,8,false),M(acc,{roughness:.5})));
    /* sombra */
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false}));mats.push(sh.material);
    sh.rotation.x=-Math.PI/2;sh.scale.set(360,130,1);sh.position.y=-3;fixed.add(sh);
    if(p.plate){tilt.add(new THREE.Mesh(S.loft(S.plate,24,true),M(acc,{metalness:.3,roughness:.4,side:D})));lab("Placa",0,S.plateY(145),58,true);}
    if(p.dims){const dm=M(acc),zf=64,hx=-L/2+40,fx=60;
      tilt.add(rod(hx,0,zf,hx,H,zf,1.4,dm));tilt.add(rod(fx,0,zf,fx,F,zf,1.4,dm));
      tilt.add(rod(hx,H,zf,hx+40,H,zf,.8,dm));tilt.add(rod(fx,F,zf,fx-40,F,zf,.8,dm));
      lab(`Talón ${H} mm`,hx,H+16,zf,true);lab(`Antepié ${F} mm`,fx,F+16,zf,true);
      lab(`Drop ${+(H-F).toFixed(1)} mm`,(hx+fx)/2,Math.max(H,F)+46,zf,false);}
    if(p.leg){const legM=M(tok("--muted")),axM=M(acc),hx=-L/2+40;
      fixed.add(rod(hx,H+90,0,hx,H+330,0,5,legM));
      tilt.add(rod(hx,-6,0,hx,H+62,0,3,axM));
      lab("Eje de la pierna",hx,H+300,0,false,fixed);lab("Eje del talón",hx,-24,0,true);}
    resize();
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight||w*.75;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  const ro=new ResizeObserver(resize);ro.observe(host);
  const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;},{threshold:0});io.observe(host);
  const cv=renderer.domElement;
  cv.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,r:target,rx:rotX};cv.setPointerCapture(e.pointerId);});
  cv.addEventListener("pointermove",e=>{if(!drag)return;target=drag.r+(e.clientX-drag.x)*.01;rotX=Math.max(-.5,Math.min(.6,drag.rx+(e.clientY-drag.y)*.006));});
  const up=()=>{drag=null;};cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  const tmp=new THREE.Vector3();
  function frame(t){raf=requestAnimationFrame(frame);if(!visible)return;const dt=Math.min(.05,(t-lastT)/1000||0);lastT=t;
    if(p.auto&&!drag)target+=dt*.35;rotY+=(target-rotY)*.12;root.rotation.y=rotY;root.rotation.x+=(rotX-root.rotation.x)*.12;
    tilt.rotation.x+=(p.tilt-tilt.rotation.x)*.1;root.position.y=0;
    renderer.render(scene,cam);
    const w=host.clientWidth,h=host.clientHeight;
    for(const l of labels){tmp.copy(l.v);l.g.localToWorld(tmp);tmp.project(cam);
      l.el.style.transform=`translate(${(tmp.x*.5+.5)*w}px,${(-tmp.y*.5+.5)*h}px) translate(-50%,-50%)`;l.el.style.opacity=tmp.z<1?1:0;}}
  build();raf=requestAnimationFrame(frame);
  const mq=matchMedia("(prefers-color-scheme: dark)");mq.addEventListener&&mq.addEventListener("change",build);
  return{set(o){Object.assign(p,o);build();},view(v,auto){target=rotY+((v-rotY)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;rotX=0;if(auto!==undefined)p.auto=auto&&!RM;},
    destroy(){cancelAnimationFrame(raf);ro.disconnect();io.disconnect();clear(tilt);clear(fixed);mats.forEach(m=>m.dispose());knit.dispose();shadow.dispose();renderer.dispose();renderer.forceContextLoss&&renderer.forceContextLoss();cv.remove();labels.forEach(l=>l.el.remove());}};
}

