/* Animación de la pisada vista desde atrás (pierna derecha): el pie se levanta, apoya el talón y rueda.
   Neutra: casi no rueda. Pronadora: el tobillo se vence hacia adentro. Supinadora: queda apoyado sobre el borde de afuera.
   Con "zapa de estabilidad" la pronación se corrige casi a neutra (refuerzo firme del lado de adentro). */
const NS = "http://www.w3.org/2000/svg";
/* ángulo máximo de la zapa (negativo = hacia adentro) y cuánto se dobla la pierna contra ella */
const TIPOS = {
  neutra: { zapa: -3, pierna: 2, pivote: "in" },
  pronadora: { zapa: -14, pierna: 14, pivote: "in" },
  supinadora: { zapa: 10, pierna: -10, pivote: "out" },
  estable: { zapa: -4, pierna: 3, pivote: "in" },
};
const RM = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Pisada(host) {
  const PIE_IN = 64, PIE_OUT = 136, SUELO = 236, TOBILLO = 168;
  host.innerHTML = `<svg viewBox="0 0 200 270" class="pz-svg" role="img" aria-label="Pierna derecha vista desde atrás mientras corre">
    <defs><linearGradient id="pzPiel" x1="0" x2="1"><stop offset="0" stop-color="#E9B892"/><stop offset=".55" stop-color="#F3CBA8"/><stop offset="1" stop-color="#D99F79"/></linearGradient></defs>
    <text x="8" y="16" class="pz-lado">ADENTRO</text><text x="192" y="16" class="pz-lado" text-anchor="end">AFUERA</text>
    <line x1="100" y1="26" x2="100" y2="${SUELO}" class="pz-ref"/>
    <ellipse cx="100" cy="${SUELO + 4}" rx="44" ry="5" class="pz-sombra"/>
    <line x1="10" y1="${SUELO + 1}" x2="190" y2="${SUELO + 1}" class="pz-suelo"/>
    <g class="pz-pie"><g class="pz-zapa">
      <g class="pz-pierna">
        <path d="M66 26 C 64 70, 74 118, 86 ${TOBILLO - 6} L 114 ${TOBILLO - 6} C 126 118, 136 70, 134 26 Z" fill="url(#pzPiel)"/>
        <path d="M88 ${TOBILLO - 14} Q 100 ${TOBILLO - 22} 112 ${TOBILLO - 14}" class="pz-aquiles"/>
        <line x1="100" y1="40" x2="100" y2="${TOBILLO}" class="pz-eje"/>
      </g>
      <path d="M72 ${TOBILLO - 6} Q 70 ${TOBILLO + 22} 66 200 L 134 200 Q 130 ${TOBILLO + 22} 128 ${TOBILLO - 6} Q 100 ${TOBILLO - 14} 72 ${TOBILLO - 6} Z" class="pz-capellada"/>
      <path d="M86 ${TOBILLO + 2} Q 100 ${TOBILLO - 2} 114 ${TOBILLO + 2}" class="pz-cuello"/>
      <rect x="${PIE_IN}" y="200" width="${PIE_OUT - PIE_IN}" height="27" rx="7" class="pz-media"/>
      <rect x="${PIE_IN}" y="200" width="22" height="27" rx="6" class="pz-poste"/>
      <rect x="${PIE_IN + 1}" y="225" width="${PIE_OUT - PIE_IN - 2}" height="9" rx="4" class="pz-suela"/>
      <rect x="${PIE_IN + 1}" y="227" width="16" height="7" rx="3" class="pz-gaste pz-gaste-in"/>
      <rect x="${PIE_OUT - 17}" y="227" width="16" height="7" rx="3" class="pz-gaste pz-gaste-out"/>
      <line x1="100" y1="${TOBILLO}" x2="100" y2="232" class="pz-eje"/>
    </g></g>
  </svg>`;
  const $ = s => host.querySelector(s);
  const pie = $(".pz-pie"), zapa = $(".pz-zapa"), pierna = $(".pz-pierna"), sombra = $(".pz-sombra"), svg = $("svg");
  let tipo = "neutra", raf = 0, t0 = 0, visible = true;
  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  /* ciclo de 1,1 s: 0-.30 en el aire, .30-.40 apoya el talón (un poco hacia afuera, como todos),
     .40-.65 rueda hasta el máximo, .65-.85 despega y vuelve, .85-1 sube */
  function pose(f) {
    const T = TIPOS[tipo];
    let alto = 0, ang = 0;
    if (f < 0.3) { alto = Math.sin(f / 0.3 * Math.PI) * 26 + 4; ang = 3; }
    else if (f < 0.4) { const k = (f - 0.3) / 0.1; alto = 4 * (1 - k); ang = 3; }
    else if (f < 0.65) { ang = 3 + (T.zapa - 3) * ease((f - 0.4) / 0.25); }
    else if (f < 0.85) { const k = (f - 0.65) / 0.2; ang = T.zapa + (3 - T.zapa) * ease(k); alto = 4 * k; }
    else { ang = 3; alto = 4; }
    const apoyo = alto < 1;
    const px = ang < 0 ? PIE_IN : PIE_OUT;
    pie.setAttribute("transform", `translate(0 ${-alto})`);
    zapa.setAttribute("transform", apoyo ? `rotate(${ang} ${px} ${SUELO})` : `rotate(${ang} 100 ${SUELO})`);
    const flex = T.zapa ? (ang - 3) / (T.zapa - 3) : 0;
    pierna.setAttribute("transform", `rotate(${T.pierna * Math.max(0, flex)} 100 ${TOBILLO})`);
    sombra.setAttribute("rx", 44 - alto * 0.6); sombra.setAttribute("opacity", 0.35 - alto * 0.008);
    svg.classList.toggle("pz-carga", apoyo && Math.abs(ang - 3) > 2);
  }
  function loop(t) { if (!t0) t0 = t; pose(((t - t0) / 1100) % 1); raf = requestAnimationFrame(loop); }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; frenar(); if (visible && !RM) raf = requestAnimationFrame(loop); });
  function frenar() { cancelAnimationFrame(raf); raf = 0; }
  io.observe(host);
  return {
    set(k) { tipo = TIPOS[k] ? k : "neutra"; svg.dataset.tipo = tipo; if (RM) pose(0.62); },
    destroy() { frenar(); io.disconnect(); },
  };
}
