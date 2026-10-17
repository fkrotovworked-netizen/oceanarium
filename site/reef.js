/* ============================================================
   РИФ В ПОДВАЛЕ — спокойный финал (идея Саши)
   Дно: кораллы-оленероги, мозговики, трубчатые губки, горгонарии,
   актинии, трава и водоросли, звёзды и ракушки на песке; светящиеся
   рыбки и пузырьки, мягкое свечение снизу.

   Почему так, а не three.js: сцена статична, двигаются только
   водоросли и щупальца (CSS-поворот, GPU), рыбки и пузырьки (2D-canvas).
   Силуэты строятся один раз как SVG из детерминированного шума —
   одинаковые у всех посетителей, ноль файлов, чёткие на любом DPR.
   Рыбки крутятся ТОЛЬКО пока футер на экране.
   ============================================================ */
(function(){
'use strict';

const reef = document.getElementById('reef');
if (!reef) return;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;

/* детерминированный генератор: риф одинаковый при каждом заходе */
function rng(seed){
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const W = 1600, H = 900;                       // система координат слоёв
const NS = 'http://www.w3.org/2000/svg';

/* ——— цвет ———————————————————————————————————————————————
   Тёмные «драгоценные» тона, в дальних слоях тонут в дымке воды. */
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hx(a), B = hx(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const f1 = v => v.toFixed(1);

/* высота рифа зависит от x: у краёв выше, в центре ниже —
   середина остаётся свободной под текст футера */
const edge = x => MOBILE ? 0.8 : 0.35 + 1.0 * Math.pow(Math.abs(x / W - 0.5) * 2, 1.5);
/* на телефоне сцена обрезается по центру (slice) — видна полоса ≈ 0.33–0.67 ширины,
   туда и сажаем всё; на десктопе высокое — к краям */
const anyX = R => (MOBILE ? 0.3 + R() * 0.4 : R()) * W;
const sideX = R => MOBILE ? anyX(R) : (R() < 0.5 ? R() * 0.36 : 0.64 + R() * 0.36) * W;

/* ——— формы ——————————————————————————————————————————— */
/* оленерог: пучок коротких рогатых веток прямо от дна (не ствол —
   иначе читается деревом), кончики светятся */
function staghorn(o, R, x, y, h, c){
  const paths = [], tips = [];
  const arm = (x0, y0, ang, len, w, d) => {
    const bend = (R() - 0.5) * 0.4;
    const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
    const cx = x0 + Math.sin(ang + bend) * len * 0.5, cy = y0 - Math.cos(ang + bend) * len * 0.5;
    paths.push(`<path d="M${f1(x0)} ${f1(y0)}Q${f1(cx)} ${f1(cy)} ${f1(x1)} ${f1(y1)}" stroke-width="${f1(w)}"/>`);
    if (d <= 0){ tips.push([x1, y1, w]); return; }
    const sp = 0.32 + R() * 0.3;
    arm(x1, y1, ang - sp, len * (0.55 + R() * 0.2), w * 0.78, d - 1);
    arm(x1, y1, ang + sp, len * (0.55 + R() * 0.2), w * 0.78, d - 1);
  };
  const n = 5 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++){
    const a = (i / (n - 1) - 0.5) * 1.9 + (R() - 0.5) * 0.25;
    arm(x + (R() - 0.5) * h * 0.3, y, a, h * (0.34 + R() * 0.22), h * 0.085, 1 + (R() < 0.5 ? 1 : 0));
  }
  o.push(`<g fill="none" stroke="${c.base}" stroke-linecap="round">${paths.join('')}</g>`);
  if (c.tip) o.push(`<g fill="${c.tip}">` + tips.map(([tx, ty, w]) =>
    `<circle cx="${f1(tx)}" cy="${f1(ty)}" r="${f1(w * 0.55)}" opacity=".75"/>`).join('') + `</g>`);
}
/* мозговик: купол с извилинами */
function brain(o, R, x, y, w, h, c){
  o.push(`<path fill="${c.base}" d="M${f1(x - w/2)} ${f1(y)}C${f1(x - w/2)} ${f1(y - h*0.62)} ${f1(x - w*0.3)} ${f1(y - h)} ${f1(x)} ${f1(y - h)}` +
    `C${f1(x + w*0.3)} ${f1(y - h)} ${f1(x + w/2)} ${f1(y - h*0.62)} ${f1(x + w/2)} ${f1(y)}Z"/>`);
  /* извилины: меандры — короткие змейки, изгибающиеся по куполу */
  const g = [], n = Math.round(w / 9);
  for (let i = 0; i < n; i++){
    const t0 = 0.12 + R() * 0.76, u0 = (R() - 0.5) * 1.6;
    let t = t0, u = u0, dir = R() * 6.283;
    const pt = () => { const yy = y - h * t * 0.92, half = w / 2 * Math.sqrt(Math.max(0, 1 - t * t)) * 0.9;
      return [x + u * half * 0.5, yy]; };
    let [px, py] = pt(), d = `M${f1(px)} ${f1(py)}`;
    for (let k = 0; k < 7; k++){
      dir += (R() - 0.5) * 2.2;
      t = Math.min(0.95, Math.max(0.06, t + Math.sin(dir) * 0.07));
      u = Math.min(1.9, Math.max(-1.9, u + Math.cos(dir) * 0.22));
      const [qx, qy] = pt();
      d += `Q${f1((px + qx) / 2 + (R() - 0.5) * 5)} ${f1((py + qy) / 2 + (R() - 0.5) * 5)} ${f1(qx)} ${f1(qy)}`;
      px = qx; py = qy;
    }
    g.push(`<path d="${d}"/>`);
  }
  o.push(`<g fill="none" stroke="${c.groove}" stroke-width="${f1(Math.max(1.3, h * 0.028))}" stroke-linecap="round" stroke-linejoin="round" opacity=".75">${g.join('')}</g>`);
}
/* трубчатые губки: пучок наклонённых труб с тёмными устьями */
function sponge(o, R, x, y, h, c){
  const n = 3 + Math.floor(R() * 3), parts = [];
  for (let i = 0; i < n; i++){
    const th = h * (0.5 + R() * 0.5), tw = h * (0.13 + R() * 0.07);
    const lean = (i - (n - 1) / 2) * tw * 0.9 + (R() - 0.5) * tw;
    const bx = x + (i - (n - 1) / 2) * tw * 0.8, tx = bx + lean, ty = y - th;
    parts.push(`<path fill="${c.base}" d="M${f1(bx - tw*0.42)} ${f1(y)}C${f1(bx - tw*0.46)} ${f1(y - th*0.5)} ${f1(tx - tw*0.62)} ${f1(ty + th*0.2)} ${f1(tx - tw/2)} ${f1(ty)}` +
      `L${f1(tx + tw/2)} ${f1(ty)}C${f1(tx + tw*0.62)} ${f1(ty + th*0.2)} ${f1(bx + tw*0.46)} ${f1(y - th*0.5)} ${f1(bx + tw*0.42)} ${f1(y)}Z"/>` +
      `<ellipse cx="${f1(tx)}" cy="${f1(ty)}" rx="${f1(tw*0.48)}" ry="${f1(tw*0.16)}" fill="${c.inner}"/>`);
  }
  o.push(parts.join(''));
}
/* горгонария: веер из тонких лучей, связанных кружевной сеткой */
function fan(o, R, x, y, h, spread, c){
  const rays = [], N = 18, steps = 7;
  for (let i = 0; i < N; i++){
    const a = (i / (N - 1) - 0.5) * spread;
    let px = x, py = y, ang = a * 0.3; const pts = [[px, py]];
    for (let k = 0; k < steps; k++){
      ang += (a - ang) * 0.5 + (R() - 0.5) * 0.1;
      px += Math.sin(ang) * h / steps; py -= Math.cos(ang) * h / steps * (0.9 + R() * 0.2);
      pts.push([px, py]);
    }
    rays.push(pts);
  }
  const ln = [];
  rays.forEach(p => ln.push(`<path d="M${p.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}" stroke-width="${f1(1.2 + R() * 0.9)}"/>`));
  /* кружево: редкие косые перемычки со сдвигом по высоте, не решётка */
  for (let i = 0; i < N - 1; i++) for (let k = 2; k <= steps; k++){
    if (R() > 0.38) continue;
    const k2 = Math.min(steps, Math.max(1, k + (R() < 0.5 ? -1 : 1)));
    const a = rays[i][k], b = rays[i+1][k2];
    const mx = (a[0] + b[0]) / 2 + (R() - 0.5) * 6, my = (a[1] + b[1]) / 2 - 4 - R() * 6;
    ln.push(`<path d="M${f1(a[0])} ${f1(a[1])}Q${f1(mx)} ${f1(my)} ${f1(b[0])} ${f1(b[1])}" stroke-width=".7"/>`);
  }
  o.push(`<g fill="none" stroke="${c.base}" stroke-linecap="round" opacity=".78">${ln.join('')}</g>`);
}
/* актиния: столбик и венчик щупалец (качаются), кончики светятся */
function anemone(o, R, x, y, s, c){
  o.push(`<path fill="${c.base}" d="M${f1(x - s*0.26)} ${f1(y)}C${f1(x - s*0.3)} ${f1(y - s*0.2)} ${f1(x - s*0.36)} ${f1(y - s*0.34)} ${f1(x - s*0.3)} ${f1(y - s*0.4)}` +
    `L${f1(x + s*0.3)} ${f1(y - s*0.4)}C${f1(x + s*0.36)} ${f1(y - s*0.34)} ${f1(x + s*0.3)} ${f1(y - s*0.2)} ${f1(x + s*0.26)} ${f1(y)}Z"/>`);
  const n = 20 + Math.floor(R() * 8), t = [], tips = [];
  for (let i = 0; i < n; i++){
    const u = i / (n - 1) - 0.5, bx = x + u * s * 0.58, by = y - s * 0.4;
    const ang = u * 2.4 + (R() - 0.5) * 0.3, len = s * (0.36 + R() * 0.3);
    const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len * 0.9;
    const cx = bx + Math.sin(ang * 0.4) * len * 0.6, cy = by - len * 0.75;
    t.push(`<path d="M${f1(bx)} ${f1(by)}Q${f1(cx)} ${f1(cy)} ${f1(ex)} ${f1(ey)}"/>`);
    tips.push(`<circle cx="${f1(ex)}" cy="${f1(ey)}" r="${f1(s * 0.028)}"/>`);
  }
  const sw = `--kd:${f1(4 + R() * 3)}s;--ka:${f1(2.5 + R() * 2.5)}deg;--kdl:${f1(-R() * 6)}s`;
  o.push(`<g class="kelp" style="${sw}"><g fill="none" stroke="${c.tent}" stroke-width="${f1(s * 0.045)}" stroke-linecap="round">${t.join('')}</g>` +
    `<g fill="${c.tip}" opacity=".85">${tips.join('')}</g></g>`);
}
/* лента водоросли / травинка: сужающийся лист, качается */
function blade(o, R, x, y, h, lean, w, col){
  const c1x = x + lean * 0.35 + (R() - 0.5) * 30, c1y = y - h * 0.4;
  const c2x = x + lean * 0.8 + (R() - 0.5) * 40, c2y = y - h * 0.75, tx = x + lean, ty = y - h;
  const sw = `--kd:${f1(6 + R() * 6)}s;--ka:${f1(1.5 + R() * 2.5)}deg;--kdl:${f1(-R() * 8)}s`;
  o.push(`<path class="kelp" fill="${col}" style="${sw}" d="M${f1(x - w/2)} ${f1(y)}C${f1(c1x - w/2)} ${f1(c1y)} ${f1(c2x - w*0.2)} ${f1(c2y)} ${f1(tx)} ${f1(ty)}` +
    `C${f1(c2x + w*0.3)} ${f1(c2y)} ${f1(c1x + w/2)} ${f1(c1y)} ${f1(x + w/2)} ${f1(y)}Z"/>`);
}
function seagrass(o, R, x, y, h, col){
  const n = 4 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) blade(o, R, x + (R() - 0.5) * 30, y + 4, h * (0.5 + R() * 0.5), (R() - 0.5) * 60, 4 + R() * 4, col);
}
/* морская звезда */
function star(o, R, x, y, r, col){
  const rot = R() * 6.283, pts = [];
  for (let i = 0; i < 10; i++){
    const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55]);
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 1; i <= 10; i++){ const p = pts[i % 10], q = pts[i - 1];
    d += `Q${f1((p[0] + q[0]) / 2 + (R() - 0.5) * 2)} ${f1((p[1] + q[1]) / 2)} ${f1(p[0])} ${f1(p[1])}`; }
  o.push(`<path fill="${col}" d="${d}Z"/>`);
}
/* ракушка-гребешок */
function shell(o, R, x, y, r, col, rib){
  let ribs = '';
  for (let i = 1; i < 6; i++){ const a = Math.PI + i * Math.PI / 6;
    ribs += `M${f1(x)} ${f1(y)}L${f1(x + Math.cos(a) * r * 0.9)} ${f1(y + Math.sin(a) * r * 0.62)}`; }
  o.push(`<path fill="${col}" d="M${f1(x - r)} ${f1(y)}A${f1(r)} ${f1(r * 0.7)} 0 0 1 ${f1(x + r)} ${f1(y)}Z"/>` +
    `<path d="${ribs}" stroke="${rib}" stroke-width="1" fill="none"/>`);
}
/* камень */
function rock(o, R, x, y, w, h, col){
  o.push(`<path fill="${col}" d="M${f1(x - w/2)} ${f1(y)}C${f1(x - w*0.5)} ${f1(y - h*0.8)} ${f1(x - w*0.1)} ${f1(y - h)} ${f1(x + w*0.12)} ${f1(y - h*0.92)}` +
    `C${f1(x + w*0.42)} ${f1(y - h*0.8)} ${f1(x + w*0.52)} ${f1(y - h*0.3)} ${f1(x + w/2)} ${f1(y)}Z"/>`);
}
/* дно: песок светлее сверху */
function seabed(R, y0, amp, top, bot, id){
  let d = `M0 ${H}L0 ${y0}`;
  for (let x = 0; x <= W; x += 80) d += `L${x} ${f1(y0 + Math.sin(x * 0.004 + R() * 2) * amp + (R() - 0.5) * amp)}`;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0 - amp}" x2="0" y2="${H}">` +
    `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>` +
    `<path fill="url(#${id})" d="${d}L${W} ${H}Z"/>`;
}

const PAL = {
  stag:   {base:'#1d5a6c', tip:'#8ff0f4'},
  brain:  {base:'#284a40', groove:'#4d7d68'},
  sponge: {base:'#33285c', inner:'#0d0820'},
  fan:    {base:'#6a2a55'},
  anem:   {base:'#4a2040', tent:'#a0457a', tip:'#ffa6d2'},
  grass:  '#1b4a3a', kelp:'#17402f', rock:'#152838', star:'#7c3a34', shell:'#6d7c86'
};
/* цвет слоя: ближний — свой, дальние тонут в дымке */
function tint(p, haze, t){
  if (typeof p === 'string') return mix(p, haze, t);
  const o = {}; for (const k in p) o[k] = mix(p[k], haze, t); return o;
}

function layer(seed, o){
  /* на телефоне полоса узкая и над рифом идут ссылки — элементов меньше */
  if (MOBILE){ o = {...o}; for (const k of ['kelp','fans','sponges','stag','rocks','brain','anem','grass','stars','shells'])
    o[k] = Math.round(o[k] * 0.6); }
  /* Качающиеся элементы (CSS-поворот внутри SVG) заставляют перерисовывать
     весь свой SVG каждый кадр. Поэтому слой собирается из нескольких SVG
     в прежнем порядке наложения: back — водоросли (качаются) → fans+дно+
     середина+мозговики (неподвижно, рисуется один раз) → актинии и трава
     (качаются) → звёзды и ракушки. Генератор и порядок вызовов прежние. */
  const R = rng(seed), back = [], fans = [], mid = [], brains = [], sway = [], sand = [];
  const base = H - o.bed, C = k => tint(PAL[k], o.haze, o.h);
  const bed = seabed(R, base, o.bedAmp, mix('#1c3b52', o.haze, o.h), mix('#06121d', o.haze, o.h * 0.6), 'b' + seed);
  for (let i = 0; i < o.kelp; i++){ const x = sideX(R);
    blade(back, R, x, base + 10, (220 + R() * 240) * o.scale * edge(x), (R() - 0.5) * 80, 9 + R() * 8, C('kelp')); }
  for (let i = 0; i < o.fans; i++){ const x = sideX(R);
    fan(fans, R, x, base + 6, (150 + R() * 130) * o.scale * edge(x), 1.4 + R() * 0.6, C('fan')); }
  for (let i = 0; i < o.sponges; i++){ const x = sideX(R);
    sponge(mid, R, x, base + 8, (90 + R() * 80) * o.scale * edge(x), C('sponge')); }
  for (let i = 0; i < o.stag; i++){ const x = anyX(R);
    staghorn(mid, R, x, base + 8, (70 + R() * 70) * o.scale * edge(x), C('stag')); }
  for (let i = 0; i < o.rocks; i++){ const x = anyX(R);
    rock(mid, R, x, base + 12, (60 + R() * 80) * o.scale, (22 + R() * 26) * o.scale, C('rock')); }
  for (let i = 0; i < o.brain; i++){ const x = anyX(R), w = (60 + R() * 60) * o.scale;
    brain(brains, R, x, base + 10, w, w * (0.5 + R() * 0.15), C('brain')); }
  for (let i = 0; i < o.anem; i++){ const x = sideX(R);
    anemone(sway, R, x, base + 8, (70 + R() * 50) * o.scale * Math.min(1.2, edge(x)), C('anem')); }
  for (let i = 0; i < o.grass; i++){ const x = anyX(R);
    seagrass(sway, R, x, base + 8, (60 + R() * 70) * o.scale * edge(x), C('grass')); }
  for (let i = 0; i < o.stars; i++)
    star(sand, R, anyX(R), base + 18 + R() * 20, (9 + R() * 7) * o.scale, C('star'));
  for (let i = 0; i < o.shells; i++)
    shell(sand, R, anyX(R), base + 16 + R() * 18, (7 + R() * 5) * o.scale, C('shell'), mix(C('shell'), '#000000', 0.35));
  const svg = (body, cls) => body ? `<svg xmlns="${NS}" class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>` : '';
  return svg(back.join(''), 'sw') +
         svg(fans.join('') + bed + mid.join('') + brains.join(''), 'st') +
         svg(sway.join(''), 'sw') +
         svg(sand.join(''), 'st');
}

const S = MOBILE ? 0.5 : 1;
const L = {
  far:  {bed:150, bedAmp:14, haze:'#0e2f4a', h:.62, scale:0.8*S,  kelp:9, fans:4, sponges:3, stag:5, rocks:2, brain:2, anem:0, grass:3, stars:0, shells:0},
  mid:  {bed:95,  bedAmp:16, haze:'#0b2740', h:.34, scale:1.0*S,  kelp:5, fans:3, sponges:3, stag:5, rocks:3, brain:3, anem:2, grass:5, stars:1, shells:2},
  near: {bed:40,  bedAmp:18, haze:'#061a2c', h:.08, scale:1.25*S, kelp:2, fans:1, sponges:2, stag:3, rocks:2, brain:2, anem:3, grass:6, stars:3, shells:3}
};
reef.querySelector('.far').innerHTML  = layer(11, L.far);
reef.querySelector('.mid').innerHTML  = layer(23, L.mid);
reef.querySelector('.near').innerHTML = layer(37, L.near);

/* ——— качание без перерисовки ————————————————————————————————
   CSS-поворот элементов ВНУТРИ svg заставлял браузер перерисовывать весь
   svg-слой в каждом кадре (Safari: подвал 77 медленных кадров из 119).
   Поэтому каждый элемент качающегося слоя (.sw) выносится в свой
   маленький <svg> ровно на то же место: тот же viewBox-кусок, тот же
   масштаб «slice», та же точка вращения (низ-центр его контура, как
   transform-box: fill-box; transform-origin: 50% 100%) и те же параметры
   качания. Поворачивает уже видеокарта. Порядок наложения прежний. */
function split(){
  const out = [];
  reef.querySelectorAll('.reef-l svg.sw').forEach(sv => {
    const box = document.createElement('div');
    box.className = 'sw-box';
    const items = [];
    [...sv.children].forEach(el => {
      const bb = el.getBBox();
      const kelp = el.classList.contains('kelp');
      /* запас под обводку и кончики щупалец (bbox их не учитывает) */
      const pad = kelp && el.tagName.toLowerCase() === 'g' ? 12 : 2;
      const m = document.createElementNS(NS, 'svg');
      m.setAttribute('viewBox', `${f1(bb.x - pad)} ${f1(bb.y - pad)} ${f1(bb.width + pad*2)} ${f1(bb.height + pad*2)}`);
      m.setAttribute('preserveAspectRatio', 'none');
      m.setAttribute('aria-hidden', 'true');
      if (kelp){
        m.setAttribute('class', 'kelp');
        m.setAttribute('style', el.getAttribute('style') || '');
        el.classList.remove('kelp'); el.removeAttribute('style');
      }
      m.appendChild(el);
      box.appendChild(m);
      items.push({m, bb, pad, kelp});
    });
    sv.replaceWith(box);
    out.push({box, items});
  });
  return out;
}
const sways = /[?&]nosplit\b/.test(location.search) ? [] : split();   // ?nosplit — для сравнения со старой отрисовкой
/* раскладка как у viewBox 0 0 W H с preserveAspectRatio="xMidYMax slice" */
function placeSways(){
  sways.forEach(({box, items}) => {
    const cw = box.clientWidth, ch = box.clientHeight;
    if (!cw || !ch) return;
    const k = Math.max(cw / W, ch / H), x0 = (cw - W * k) / 2, y0 = ch - H * k;
    items.forEach(({m, bb, pad, kelp}) => {
      const st = m.style;
      st.left = (x0 + (bb.x - pad) * k) + 'px'; st.top = (y0 + (bb.y - pad) * k) + 'px';
      st.width = ((bb.width + pad * 2) * k) + 'px'; st.height = ((bb.height + pad * 2) * k) + 'px';
      if (kelp) st.transformOrigin = ((bb.width / 2 + pad) * k) + 'px ' + ((bb.height + pad) * k) + 'px';
    });
  });
}
placeSways();
addEventListener('resize', placeSways);

/* Само качание — Web Animations с конкретными числами у каждого элемента.
   CSS-кейфреймы брали угол из var(--ka) — такие анимации WebKit не отдаёт
   композитору и считает на главном потоке (107 элементов в каждом кадре).
   Параметры те же: ±ka°, период kd, задержка kdl, ease-in-out, туда-обратно. */
const swayAnims = [];
if (!reduce && sways.length && Element.prototype.animate){
  sways.forEach(({items}) => items.forEach(({m, kelp}) => {
    if (!kelp) return;
    const ka = parseFloat(m.style.getPropertyValue('--ka')) || 2;
    const kd = parseFloat(m.style.getPropertyValue('--kd')) || 9;
    const kdl = parseFloat(m.style.getPropertyValue('--kdl')) || 0;
    m.style.animation = 'none';
    const a = m.animate([{transform:`rotate(${-ka}deg)`}, {transform:`rotate(${ka}deg)`}],
      {duration: kd * 1000, delay: kdl * 1000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out'});
    a.pause();
    swayAnims.push(a);
  }));
}

/* ——— риф поднимается из темноты, слои с разной скоростью ———
   Раньше слои только ехали по yPercent, оставаясь непрозрачными всё
   время — плоские яркие силуэты кораллов буквально въезжали в кадр,
   как вырезанная картинка, а не «проступали». Добавил autoAlpha в ту же
   fromTo: слой одновременно поднимается и проявляется, к моменту
   появления на своей полной яркости мотив уже почти неподвижен —
   резкого «въезда» не видно. */
if (window.gsap && window.ScrollTrigger && !reduce){
  const foot = document.getElementById('foot');
  [['.far', 6], ['.mid', 12], ['.near', 20]].forEach(([sel, amt]) => {
    gsap.fromTo(reef.querySelector(sel), {yPercent:amt, autoAlpha:0}, {yPercent:0, autoAlpha:1, ease:'none',
      scrollTrigger:{trigger:foot, start:'top bottom', end:'bottom bottom', scrub:.8}});
  });
  gsap.fromTo(reef.querySelector('.reef-glow'), {autoAlpha:0}, {autoAlpha:1, ease:'none',
    scrollTrigger:{trigger:foot, start:'top bottom', end:'bottom bottom', scrub:.8}});
}

/* ——— светящиеся рыбки ———————————————————————————————— */
const cv = document.getElementById('reefFish');
const ctx = cv.getContext('2d');
const DPR = Math.min(devicePixelRatio || 1, 1.5);
let cw = 0, ch = 0;
function size(){
  cw = cv.clientWidth; ch = cv.clientHeight;
  cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
/* свечение — один заранее нарисованный спрайт, без shadowBlur на кадр */
function sprite(rgb){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},.55)`); gr.addColorStop(.35, `rgba(${rgb},.16)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
const COLD = sprite('150,240,255'), WARM = sprite('255,120,180');
const R = rng(5);
/* на телефоне футер высокий и текст идёт столбцом — рыбки держатся у дна, не над ссылками */
const fish = Array.from({length: MOBILE ? 4 : 9}, (_, i) => ({
  x: R(), y: MOBILE ? 0.8 + R() * 0.12 : 0.52 + R() * 0.38, v: (0.010 + R() * 0.014) * (R() < 0.5 ? -1 : 1),
  len: 5 + R() * 6, amp: 0.006 + R() * 0.012, ph: R() * 6.28, warm: i === 3 || i === 7
}));
function draw(t){
  ctx.clearRect(0, 0, cw, ch);
  for (const f of fish){
    const x = f.x * cw, y = (f.y + Math.sin(t * 0.0006 + f.ph) * f.amp) * ch;
    const dir = Math.sign(f.v), L2 = f.len;
    const gs = L2 * 7;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(f.warm ? WARM : COLD, x - gs/2, y - gs/2, gs, gs);
    /* тело и хвост — несколько пикселей, но с направлением и взмахом */
    const wag = Math.sin(t * 0.012 + f.ph) * L2 * 0.25;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = f.warm ? '#ffd1e6' : '#dffbff';
    ctx.beginPath(); ctx.ellipse(x, y, L2 * 0.55, L2 * 0.2, 0, 0, 6.283); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - dir * L2 * 0.45, y);
    ctx.lineTo(x - dir * L2 * 0.95, y - L2 * 0.28 + wag);
    ctx.lineTo(x - dir * L2 * 0.95, y + L2 * 0.28 + wag);
    ctx.closePath(); ctx.globalAlpha = 0.6; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
/* пузырьки: поднимаются от дна у краёв, покачиваясь, и тают */
const bubbles = Array.from({length: MOBILE ? 6 : 14}, () => newBubble(true));
function newBubble(any){
  const x = R() < 0.5 ? R() * 0.3 : 0.7 + R() * 0.3;
  return {x, y: any ? 0.45 + R() * 0.55 : 1.02, r: 1.2 + R() * 2.4, v: 0.03 + R() * 0.04, ph: R() * 6.28};
}
function drawBubbles(t){
  ctx.lineWidth = 1;
  for (const b of bubbles){
    const x = (b.x + Math.sin(t * 0.0015 + b.ph) * 0.004) * cw, y = b.y * ch;
    const a = Math.min(1, (b.y - 0.35) / 0.25);
    if (a <= 0) continue;
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = '#bfefff';
    ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = 0.7 * a; ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.28, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
let live = false, last = 0;
function loop(t){
  if (!live) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  for (const f of fish){
    f.x += f.v * dt;
    if (f.x > 1.08) f.x = -0.08; else if (f.x < -0.08) f.x = 1.08;
  }
  for (let i = 0; i < bubbles.length; i++){
    bubbles[i].y -= bubbles[i].v * dt;
    if (bubbles[i].y < 0.35) bubbles[i] = newBubble(false);
  }
  draw(t);
  drawBubbles(t);
}
size();
addEventListener('resize', () => { size(); if (!live) draw(performance.now()); });
draw(0);
/* Запуск покачивания (WAAPI, десятки элементов) и канвы рыбок совпадал
   по кадру с началом gsap-scrub слоёв рифа (.far/.mid/.near трогаются в
   тот же момент входа в футер) — весь старт разом попадал в самый
   заметный кадр появления, отсюда «рывок». Пуск — на холостом такте
   (requestIdleCallback), гашение — сразу, без задержки. */
const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
new IntersectionObserver(es => {
  const on = es.some(e => e.isIntersecting);
  reef.classList.toggle('live', on && !reduce);
  if (!on){ swayAnims.forEach(a => a.pause()); live = false; return; }
  if (reduce) return;
  idle(() => {
    swayAnims.forEach(a => a.play());
    if (!live){ live = true; last = 0; requestAnimationFrame(loop); }
  });
}, {rootMargin:'100px 0px'}).observe(reef);

window.__reef = { get live(){ return live; }, fish: fish.length };
})();
