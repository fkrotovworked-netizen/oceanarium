/* ============================================================
   ХОРЕОГРАФИЯ САЙТА ПОСЛЕ ХИРО
   Хиро и его таймлиния живут в index.html и здесь не трогаются.

   Правило проекта: все появления — через fromTo внутри триггера.
   gsap.set + .to ломает обратную прокрутку (см. CLAUDE.md).

   Движение намеренно разное по секциям — каждое что-то значит:
     строки заголовков — выезжают из маски (как в хиро, но без размытия);
     фото — открываются маской со своей стороны + волна воды, потом параллакс;
     «2500 м²» — сжимается трекингом по прокрутке (масштаб);
     указатель видов — линии прочерчиваются, названия фокусируются;
     время кормлений — перещёлкивается, как табло;
     цены — линии и цифры, при смене дня цифры прокручиваются;
     новости — лента въезжает сбоку, куда её потом листают.
   ============================================================ */
(function(){
'use strict';

document.documentElement.classList.add('js');

/* ——— единая точка для покупки билета ——————————————————————
   Продажа сейчас работает виджетом на действующем сайте заказчика.
   При переносе сайта виджет встраивается сюда — меняется одна строка. */
const TICKET_URL = 'https://oceanorenburg.ru/informacziya-dlya-posetitelej/#information';

/* ——— фото: с действующего сайта заказчика (сверено 2026-09-22) ———
   Скопированы в public/media/oceanarium/photos 2026-09-23 — раньше это были
   прямые ссылки на oceanorenburg.ru, и картинки заметно опаздывали за своей
   же анимацией появления (реальный сетевой запрос на чужой хост). */
const UP = 'public/media/oceanarium/photos/';
const IMG = {
  expo:     UP + 'expo.webp',          // 1280×1920, экспозиция (реальное фото)
  sharks:   UP + 'sharks.webp',        // 2560×1707
  croc:     UP + 'croc.webp',          // 2560×1706
  fishfeed: UP + 'fishfeed.webp',      // 2560×2174
  penguin:  UP + 'penguin.webp',       // 1920×2560, пингвин на камнях
  penguins: UP + 'penguins.webp',      // 1707×2560
  family:   UP + 'family.webp'         // 555×627 — мало, нужен исходник
};
/* Фото 2560 px: декод прогреваем в фоне сразу после загрузки — иначе он
   случался в кадре, когда фото открывалось (фриз на появлении).
   Не в критическом пути: decode() ничего не ждёт. */
document.querySelectorAll('img[data-img]').forEach(im => {
  const u = IMG[im.dataset.img]; if (!u) return;
  im.decoding = 'async';
  im.addEventListener('load', () => { if (im.decode) im.decode().catch(() => {}); }, {once:true});
  im.src = u;
});
/* подкраска водой — сплошные слои вокруг фото (см. .aq-in.w в site.css) */
document.querySelectorAll('.aq-in').forEach(box => {
  const img = box.querySelector('img'); if (!img) return;
  const mk = c => { const i = document.createElement('i'); i.className = c; i.setAttribute('aria-hidden', 'true'); return i; };
  box.insertBefore(mk('aq-w0'), img);
  img.after(mk('aq-w1'), mk('aq-w2'));
  box.classList.add('w');
});

document.querySelectorAll('[data-buy]').forEach(a => {
  a.href = TICKET_URL; a.target = '_blank'; a.rel = 'noopener';
});
/* Кнопка хиро вела на «#». Меняем только адрес — вид и анимация хиро прежние. */
const heroCta = document.getElementById('cta');
if (heroCta){ heroCta.href = TICKET_URL; heroCta.target = '_blank'; heroCta.rel = 'noopener'; }

/* ——— время Оренбурга (UTC+5) — для «ближайшего кормления» и «открыто» ——— */
function orenNow(){
  const f = new Intl.DateTimeFormat('ru-RU', {timeZone:'Asia/Yekaterinburg',
    hour:'numeric', minute:'numeric', weekday:'short', hourCycle:'h23'});
  const p = {}; f.formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  const wd = (p.weekday || '').toLowerCase();
  return {min: (+p.hour) * 60 + (+p.minute), weekend: /сб|вс/.test(wd)};
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h*60 + m; };
function inWords(m){
  const h = Math.floor(m/60), mm = m % 60;
  return (h ? h + ' ч ' : '') + (mm || !h ? mm + ' мин' : '').trim();
}

/* ближайшее кормление пингвинов — статус прямо в строке табло */
function updateFeed(){
  const lis = [...document.querySelectorAll('.times li')];
  if (!lis.length) return;
  const now = orenNow().min;
  let next = lis.find(li => toMin(li.dataset.t) + 20 >= now);   // 20 минут — пока кормление идёт
  const tomorrow = !next;
  if (tomorrow) next = lis[0];
  lis.forEach(li => {
    const past = !tomorrow && toMin(li.dataset.t) + 20 < now;
    li.classList.toggle('is-past', past);
    li.classList.toggle('is-next', li === next);
    const em = li.querySelector('em');
    if (li !== next){ em.textContent = past ? 'прошло' : ''; return; }
    const d = toMin(li.dataset.t) - now;
    em.textContent = tomorrow ? 'ближайшее · завтра'
                   : d > 0 ? 'ближайшее · через ' + inWords(d) : 'идёт сейчас';
  });
}
/* открыто ли сейчас: вход и касса до 21:30 */
function updateOpen(){
  const el = document.getElementById('openNow'); if (!el) return;
  const m = orenNow().min, open = m >= 600 && m < 1290;
  el.textContent = open ? 'Сейчас открыто · вход до 21:30' : 'Сейчас закрыто · откроемся в 10:00';
  el.classList.toggle('closed', !open);
  el.hidden = false;
}
updateFeed(); updateOpen();
setInterval(() => { updateFeed(); updateOpen(); }, 60000);

if (!window.gsap){ document.documentElement.classList.remove('js'); return; }
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;
const FINE   = !matchMedia('(pointer:coarse)').matches;
/* Safari считает SVG-фильтры (feDisplacementMap) программно, на CPU, всегда —
   и всегда будет, а не только при первой отрисовке (см. liquidGlass ниже,
   тот же приём определения). Волна на фото в Safari не успевает за своей же
   шторкой: анимация (transform, GPU) идёт по расписанию, а отфильтрованная
   картинка отстаёт — «фото появляется с задержкой». В Chromium фильтр
   быстрый, там волна остаётся. */
const CHROMIUM = !!(navigator.userAgentData && navigator.userAgentData.brands &&
  navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand)));

const heroEl = document.querySelector('.scroll-space');
const heroScroll = () => Math.max(0, heroEl.offsetHeight - innerHeight);

/* ============================================================
   1. ПОЯВЛЕНИЯ ГЛАВЫ АКУЛЫ И ОБЩИЕ (data-r без значения)
   Набор прежний — секция акулы должна выглядеть как раньше.
   ============================================================ */
const REVEAL = {
  '.eyebrow': [{autoAlpha:0, x:-12, letterSpacing:'0.5em'},
               {autoAlpha:1, x:0, letterSpacing:'0.3em', duration:1.0, ease:'power3.out'}],
  '.ch-t':    [{yPercent:40, autoAlpha:0, filter:'blur(12px)'},
               {yPercent:0, autoAlpha:1, filter:'blur(0px)', duration:1.3, ease:'power3.out'}],
  '.ch-p':    [{autoAlpha:0}, {autoAlpha:1, duration:1.1, ease:'power2.out'}],
  '.more':    [{autoAlpha:0, x:-16}, {autoAlpha:1, x:0, duration:.9, ease:'power3.out'}],
  '.in-frame':[{autoAlpha:0, x:-10}, {autoAlpha:1, x:0, duration:.9, ease:'power3.out'}]
};

/* ============================================================
   2. ПОЯВЛЕНИЯ ИНФОРМАЦИОННЫХ СЕКЦИЙ (data-r="тип")
   Играют один раз: повтор при прокрутке назад в тексте раздражает.
   ============================================================ */
function once(el, build, start){
  ScrollTrigger.create({trigger:el, start:start || 'top 86%', once:true,
    onEnter: () => build()});
}

/* строки заголовка — каждая выезжает из своей маски */
function prepLines(el){
  [...el.children].forEach(s => {
    if (s.querySelector('.li')) return;
    const i = document.createElement('span'); i.className = 'li';
    while (s.firstChild) i.appendChild(s.firstChild);
    s.appendChild(i);
  });
  return el.querySelectorAll('.li');
}

/* ——— SVG с фильтром → готовая картинка, один раз ——————————————
   feTurbulence браузер считает на CPU при КАЖДОЙ перерисовке элемента
   (в Safari — всегда программно). Шум статичен, поэтому считаем его
   один раз: рисуем то же SVG в canvas и дальше работаем с растром. */
function rasterSvg(svg, w, h, blob){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        if (!blob) return res(c.toDataURL('image/png'));
        c.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/png');
      } catch(e){ res(null); }
    };
    im.onerror = () => res(null);
    im.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  });
}

/* волна воды на фото при появлении: у каждого кадра свой фильтр.
   Шум (тот же feTurbulence, те же частоты и seed) заранее снят в картинку
   под размер кадра — prepWave(). Пока снимок не готов — прежний фильтр.
   color-interpolation-filters: у исходного фильтра шум и смещение жили
   в одном пространстве (сырые значения шума = смещение); здесь то же
   достигается sRGB и при снятии, и при смещении. */
let wavesSvg = null, waveN = 0;
function wavesRoot(){
  if (!wavesSvg){
    wavesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wavesSvg.setAttribute('width', 0); wavesSvg.setAttribute('height', 0);
    wavesSvg.style.position = 'absolute';
    document.body.appendChild(wavesSvg);
  }
  return wavesSvg;
}
function prepWave(img){
  if (img._wave) return;
  const w = img.offsetWidth, h = img.offsetHeight;
  const seed = (++waveN) * 7;
  img._wave = {seed, f: null};
  if (!w || !h) return;
  const X = -0.05*w, Y = -0.05*h, W = 1.1*w, H = 1.1*h, pw = Math.ceil(W), ph = Math.ceil(H);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${X} ${Y} ${pw} ${ph}">` +
    `<filter id="n" filterUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${pw}" height="${ph}" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="${seed}"/></filter>` +
    `<rect x="${X}" y="${Y}" width="${pw}" height="${ph}" filter="url(#n)"/></svg>`;
  rasterSvg(svg, pw, ph).then(url => {
    if (!url) return;
    const id = 'wave' + seed;
    /* фильтр создаём сразу, задолго до показа — картинка шума успевает загрузиться */
    wavesRoot().insertAdjacentHTML('beforeend',
      `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
         <feImage href="${url}" x="${X}" y="${Y}" width="${pw}" height="${ph}" preserveAspectRatio="none" result="n"/>
         <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
       </filter>`);
    const fEl = wavesSvg.querySelector('#' + id);
    img._wave.f = {id, map: fEl.querySelector('feDisplacementMap'), el: fEl, X, Y, W: pw, H: ph};
  });
}
/* Шаг волны. Фильтр считается программно (Safari — всегда на CPU) по всей
   своей области, а видна лишь часть кадра: при появлении фото закрыто
   раскрытием и частью ниже экрана, а само фото больше рамки (118% и масштаб).
   Поэтому область фильтра каждый кадр сужаем до видимого прямоугольника
   с запасом на максимальное смещение (scale/2) — видимые пиксели те же.
   Смещение меньше ¼ пикселя не видно — тогда фильтр снимаем. */
function clipRect(box, r){
  const wp = box._wipe;
  const cp = !wp ? (box.style.clipPath || '') :
    wp.dir === 'iris' ? `circle(${75 * wp.e}% at 50% 55%)` :
    `inset(${wp.dir === 'up' ? (1 - wp.e) * 100 : 0}% ${wp.dir === 'left' ? (1 - wp.e) * 100 : 0}% ` +
    `${wp.dir === 'down' ? (1 - wp.e) * 100 : 0}% ${wp.dir === 'right' ? (1 - wp.e) * 100 : 0}%)`;
  let m = cp.match(/inset\(([-\d.]+)%\s+([-\d.]+)%\s+([-\d.]+)%\s+([-\d.]+)%/);
  if (m) return {l: r.left + r.width * m[4] / 100, t: r.top + r.height * m[1] / 100,
                 r: r.right - r.width * m[2] / 100, b: r.bottom - r.height * m[3] / 100};
  m = cp.match(/circle\(([-\d.]+)%\s+at\s+([-\d.]+)%\s+([-\d.]+)%/);
  if (m){
    const rad = m[1] / 100 * Math.hypot(r.width, r.height) / Math.SQRT2;
    const cx = r.left + r.width * m[2] / 100, cy = r.top + r.height * m[3] / 100;
    return {l: cx - rad, t: cy - rad, r: cx + rad, b: cy + rad};
  }
  return {l: r.left, t: r.top, r: r.right, b: r.bottom};
}
function waveStep(img, w, s){
  w.map.setAttribute('scale', s.toFixed(1));
  if (!w.el) return;                                   // запасной фильтр (без снимка шума)
  const box = img.closest('.aq-in'), br = box.getBoundingClientRect(), ir = img.getBoundingClientRect();
  const c = clipRect(box, br);
  /* запас за краем экрана: прокрутка в Safari асинхронна и за кадр успевает
     подвинуть страницу — полоса у края не должна остаться без фото */
  const vm = innerHeight * 0.25;
  const l = Math.max(c.l, br.left), t = Math.max(c.t, br.top, -vm);
  const rr = Math.min(c.r, br.right), bb = Math.min(c.b, br.bottom, innerHeight + vm);
  const kx = img.offsetWidth / (ir.width || 1), ky = img.offsetHeight / (ir.height || 1);
  const pad = s / 2 + 8;
  let x0 = (l - ir.left) * kx - pad, y0 = (t - ir.top) * ky - pad;
  let x1 = (rr - ir.left) * kx + pad, y1 = (bb - ir.top) * ky + pad;
  x0 = Math.max(x0, w.X); y0 = Math.max(y0, w.Y);
  x1 = Math.min(x1, w.X + w.W); y1 = Math.min(y1, w.Y + w.H);
  if (x1 - x0 < 1 || y1 - y0 < 1){ x0 = w.X; y0 = w.Y; x1 = x0 + 1; y1 = y0 + 1; }
  const f = w.el;
  f.setAttribute('filterUnits', 'userSpaceOnUse');
  f.setAttribute('x', x0.toFixed(1)); f.setAttribute('y', y0.toFixed(1));
  f.setAttribute('width', (x1 - x0).toFixed(1)); f.setAttribute('height', (y1 - y0).toFixed(1));
}
function waveFilter(img){
  if (!img._wave) prepWave(img);
  const W = img._wave;
  if (W.f) return W.f;
  if (W.t) return W.t;
  const id = 'wavet' + W.seed;
  wavesRoot().insertAdjacentHTML('beforeend',
    `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
       <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="${W.seed}" result="n"/>
       <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
     </filter>`);
  return (W.t = {id, map: wavesSvg.querySelector('#' + id + ' feDisplacementMap')});
}

/* ——— растворение фото в воде ————————————————————————————
   Маска — SVG: градиент прозрачности, изогнутый шумом (feTurbulence +
   feDisplacementMap), поэтому край уходит в воду не линейкой, а неровно,
   как сквозь толщу воды. Направления: b — вниз, l — влево, r — вправо,
   bl — вниз-влево, bs — короткое вниз (карточки). Тянется на рамку
   (mask-size:100% 100%) — CSS: .aq.fade-* (site.css). */
(function dissolveMasks(){
  const G = {
    b:  [0,0,0,1, .4, .88], l: [1,0,0,0, .44, .9], r: [0,0,1,0, .44, .9],
    bl: [1,0,0,1, .42, .88], bs: [0,0,0,1, .6, .96]
  };
  /* Адрес маски — прямо в правиле CSS, НЕ в custom property: значение
     var() браузер разбирает заново при каждом пересчёте стиля фото (а он
     идёт при смене цвета воды во время прокрутки) и заново декодирует
     маску — замер: 20 fps на секции с фото против 60 с прямым url(). */
  const css = document.createElement('style');
  document.head.appendChild(css);
  const rules = {};
  const put = (k, url) => {
    /* та же плитка шума и у зерна хиро (.grain, слой в 4 экрана): Safari
       пересчитывал её feTurbulence при каждой перерисовке уходящего хиро */
    rules[k] = k === 'grain'
      ? `.foot::after,.grain{background-image:url("${url}");background-size:160px 160px}`
      : `.aq.fade-${k} .aq-in{-webkit-mask-image:url("${url}");mask-image:url("${url}")}`;
    css.textContent = Object.values(rules).join('\n');
  };
  for (const k in G){
    const [x1,y1,x2,y2,a,b] = G[k];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="none">` +
      `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="#fff"/><stop offset="${a}" stop-color="#fff"/>` +
      `<stop offset="${b}" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<filter id="f" x="-30%" y="-30%" width="160%" height="160%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="3" seed="${k.length*11+k.charCodeAt(0)}"/>` +
      `<feDisplacementMap in="SourceGraphic" scale="120" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
      `<rect x="-80" y="-80" width="560" height="560" fill="url(#g)" filter="url(#f)"/></svg>`;
    put(k, 'data:image/svg+xml,' + encodeURIComponent(svg));
    /* Маска — SVG с фильтром: браузер пересчитывал шум при каждой
       перерисовке фото. Снимаем её в картинку один раз (маска мягкая,
       1024² с запасом) и подменяем, когда готова. */
    const sized = svg.replace('<svg ', '<svg width="1024" height="1024" ');
    rasterSvg(sized, 1024, 1024, true).then(url => { if (url) put(k, url); });
  }
  /* зерно подвала — тот же приём: плитка 160 px, снятая в растр под DPR */
  const gd = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1))), gs = 160 * gd;
  rasterSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${gs}" height="${gs}" viewBox="0 0 160 160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`, gs, gs, true)
    .then(url => { if (url) put('grain', url); });
})();

/* при наведении по фото проходит одна мягкая волна */
function ripple(fig){
  const img = fig.querySelector('img'); if (!img || MOBILE || reduce || !CHROMIUM) return;
  let busy = false;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  idle(() => prepWave(img));
  fig.addEventListener('pointerenter', () => {
    if (busy || img.style.filter) return;
    busy = true; const w = waveFilter(img);
    img.style.filter = `url(#${w.id})`;
    const o = {s:0};
    gsap.timeline({onComplete: () => { img.style.filter = ''; busy = false; }})
      .to(o, {s:14, duration:.45, ease:'sine.out', onUpdate: () => waveStep(img, w, o.s)})
      .to(o, {s:0, duration:1.1, ease:'sine.inOut', onUpdate: () => {
        waveStep(img, w, o.s);
        if (o.s < 0.5 && img.style.filter) img.style.filter = '';
      }});
  });
}
document.querySelectorAll('.aq:not(.mini)').forEach(ripple);

/* ——— раскрытие фото «шторкой» ————————————————————————————
   Раньше — анимация clip-path на .aq-in. Но на нём же маска растворения,
   и каждое изменение clip-path заставляло Safari заново сводить весь
   маскированный блок (фото 2560 px + волна) — 50–90 мс на кадр при
   появлении. Теперь то же раскрытие делается трансформациями: обёртка
   с overflow:hidden едет, содержимое едет ей навстречу — видимая область
   ровно та же, что у inset()/circle() прежней анимации (те же края,
   easing, длительность), а маска и скругления неподвижны.
   e — прогресс раскрытия после easing (0 закрыто, 1 открыто). */
const CLIP = {up:1, down:1, left:1, right:1, iris:1};
function makeWipe(box, dir){
  const outer = document.createElement('div'), inner = document.createElement('div');
  outer.className = 'aq-wipe'; inner.className = 'aq-wipe-in';
  while (box.firstChild) inner.appendChild(box.firstChild);
  const hl = document.createElement('i'); hl.className = 'aq-w3'; hl.setAttribute('aria-hidden', 'true');
  inner.appendChild(hl);                       // блик и кант прежнего ::after — тоже под шторкой
  outer.appendChild(inner); box.appendChild(outer);
  box.classList.add('wiped');
  box.style.clipPath = 'none';
  const set = box._setWipe = e => {
    box._wipe = {dir, e};
    const k = (1 - e) * 100;
    if (dir === 'iris'){
      /* circle(75%·e at 50% 55%): радиус в % от √((w²+h²)/2) */
      const w = box.offsetWidth, h = box.offsetHeight;
      const R = 0.75 * Math.hypot(w, h) / Math.SQRT2, cx = w * 0.5, cy = h * 0.55;
      const sc = Math.max(e, 1e-4);
      outer.style.cssText = `inset:auto;left:${cx - R}px;top:${cy - R}px;width:${2*R}px;height:${2*R}px;` +
        `border-radius:50%;transform:scale(${sc});visibility:${e > 0 ? 'visible' : 'hidden'}`;
      inner.style.cssText = `inset:auto;left:${R - cx}px;top:${R - cy}px;width:${w}px;height:${h}px;` +
        `transform-origin:${cx}px ${cy}px;transform:scale(${1 / sc})`;
      return;
    }
    const [ox, oy] = dir === 'up' ? [0, k] : dir === 'down' ? [0, -k] : dir === 'left' ? [-k, 0] : [k, 0];
    outer.style.transform = `translate(${ox}%,${oy}%)`;
    inner.style.transform = `translate(${-ox}%,${-oy}%)`;
  };
  return set;
}

const TYPES = {
  lines(el){
    const lis = prepLines(el);
    gsap.set(lis, {yPercent:115});
    once(el, () => gsap.fromTo(lis, {yPercent:115}, {yPercent:0, duration:1.25, ease:'expo.out', stagger:.09}));
  },
  fade(el){
    gsap.set(el, {autoAlpha:0, y:16});
    once(el, () => gsap.fromTo(el, {autoAlpha:0, y:16}, {autoAlpha:1, y:0, duration:1.0, ease:'power2.out', delay:.12}));
  },
  aq(el){
    const box = el.querySelector('.aq-in'), img = el.querySelector('img');
    const wipe = makeWipe(box, CLIP[el.dataset.dir] ? el.dataset.dir : 'up');
    wipe(0);
    gsap.set(img, {scale:1.22});
    const cap = el.querySelector('figcaption');
    if (cap) gsap.set(cap, {autoAlpha:0});
    once(el, () => {
      const tl = gsap.timeline(), rv = {e:0};
      tl.fromTo(rv, {e:0}, {e:1, duration:1.5, ease:'expo.inOut', onUpdate: () => wipe(rv.e)}, 0)
        .fromTo(img, {scale:1.22}, {scale:1, duration:2.0, ease:'expo.out'}, .15);
      if (cap) tl.fromTo(cap, {autoAlpha:0, x:-8}, {autoAlpha:1, x:0, duration:.8, ease:'power2.out'}, 1.0);
      /* вода «успокаивается»: как и в ripple() — сперва разгон, потом гаснет,
         потом фильтр снимаем совсем. Раньше смещение стартовало сразу на
         максимуме (70) в тот же миг, когда шторка ещё только приоткрывалась —
         только что показавшийся край фото дёргало сильным сдвигом вместо
         мягкой волны. Разгон синхронный с открытием шторки, пик ниже.
         Только Chromium — в Safari тот же фильтр всегда на CPU, и фото
         отставало от собственной шторки («появляется с задержкой»). */
      if (!MOBILE && CHROMIUM){
        const w = waveFilter(img);
        img.style.filter = `url(#${w.id})`;
        const o = {s:0};
        tl.to(o, {s:32, duration:.5, ease:'sine.out', onUpdate: () => waveStep(img, w, o.s)}, 0)
          .to(o, {s:0, duration:1.7, ease:'power2.out',
            onUpdate: () => {
              if (!img.style.filter) return;
              waveStep(img, w, o.s);
              if (o.s < 0.5) img.style.filter = '';
            },
            onComplete: () => { img.style.filter = ''; }}, .5);
      }
    }, 'top 88%');
    /* параллакс внутри рамки — кадр живёт в воде, пока его листают */
    const sp = parseFloat(el.dataset.speed || 6);
    gsap.fromTo(img, {yPercent:-sp/2}, {yPercent:sp/2, ease:'none',
      scrollTrigger:{trigger:el, start:'top bottom', end:'bottom top', scrub:.6}});
  },
  facts(el){
    const kids = [...el.children];
    gsap.set(kids, {autoAlpha:0, y:18});
    once(el, () => {
      gsap.fromTo(kids, {autoAlpha:0, y:18}, {autoAlpha:1, y:0, duration:.9, ease:'power3.out', stagger:.1});
      el.querySelectorAll('[data-count]').forEach(n => {
        const to = +n.dataset.count, o = {v:0};
        gsap.to(o, {v:to, duration:1.8, ease:'power2.out',
          onUpdate: () => n.textContent = Math.round(o.v)});
      });
    }, 'top 92%');
  },
  giant(el){
    /* масштаб экспозиции: цифра собирается трекингом по прокрутке */
    const s = el.querySelector('span'), m = el.querySelector('small');
    gsap.fromTo(s, {letterSpacing:'0.04em', yPercent:18, autoAlpha:.15},
      {letterSpacing:'-0.055em', yPercent:0, autoAlpha:1, ease:'none',
       scrollTrigger:{trigger:el, start:'top 95%', end:'top 35%', scrub:.8}});
    gsap.fromTo(m, {autoAlpha:0, y:-20}, {autoAlpha:.8, y:0, ease:'none',
       scrollTrigger:{trigger:el, start:'top 70%', end:'top 40%', scrub:.8}});
  },
  list(el){
    const kids = [...el.children];
    gsap.set(kids, {autoAlpha:0, y:22});
    once(el, () => gsap.fromTo(kids, {autoAlpha:0, y:22},
      {autoAlpha:1, y:0, duration:.9, ease:'power3.out', stagger:.06}));
  },
  times(el){
    /* табло: цифры перещёлкиваются по очереди */
    const sp = el.querySelectorAll('li span');
    gsap.set(sp, {yPercent:105});
    once(el, () => gsap.fromTo(sp, {yPercent:105}, {yPercent:0, duration:1.1, ease:'expo.out', stagger:.14}), 'top 90%');
  },
  rows(el){
    const pls = el.querySelectorAll('.pl'), dls = el.querySelectorAll(':scope > div');
    if (pls.length){
      const lines = el.querySelectorAll('.pl i');
      gsap.set(lines, {scaleX:0}); gsap.set(el.querySelectorAll('.pl span,.pl b,.label,.note'), {autoAlpha:0});
      once(el, () => {
        gsap.fromTo(el.querySelectorAll('.label,.pl span'), {autoAlpha:0, x:-10}, {autoAlpha:1, x:0, duration:.7, stagger:.07, ease:'power2.out'});
        gsap.fromTo(lines, {scaleX:0}, {scaleX:1, duration:1.1, ease:'expo.out', stagger:.08, delay:.1});
        gsap.fromTo(el.querySelectorAll('.pl b,.note'), {autoAlpha:0, x:10}, {autoAlpha:1, x:0, duration:.7, stagger:.08, delay:.35, ease:'power2.out'});
      });
      return;
    }
    gsap.set(dls, {autoAlpha:0, y:14});
    once(el, () => gsap.fromTo(dls, {autoAlpha:0, y:14}, {autoAlpha:1, y:0, duration:.8, ease:'power2.out', stagger:.07}));
  }
};


document.querySelectorAll('[data-r]').forEach(el => {
  const type = el.dataset.r;
  if (reduce){
    if (type === 'lines') prepLines(el);
    gsap.set(el, {autoAlpha:1});
    return;
  }
  if (type && TYPES[type]){ TYPES[type](el); return; }

  let p = null;
  for (const sel in REVEAL) if (el.matches(sel)){ p = REVEAL[sel]; break; }
  const from = p ? p[0] : {autoAlpha:0, y:24};
  const to   = p ? p[1] : {autoAlpha:1, y:0, duration:1.0, ease:'power3.out'};
  ScrollTrigger.create({
    trigger: el, start: 'top 86%', end: 'bottom 12%',
    toggleActions: 'play none none reverse',
    animation: gsap.fromTo(el, from, to)
  });
});

/* финальный заголовок: медленнее и шире — это точка, а не очередной блок */
const fin = document.querySelector('.finale h2');
if (fin && !reduce){
  const lis = prepLines(fin);
  /* letter-spacing — раскладочное свойство: анимировать его вместе с
     yPercent значило пересчитывать раскладку текста на каждом кадре
     1.8-секундного твина (не композит, в отличие от transform) — на
     крупном заголовке заметно проседал fps. Трекинг ставим сразу
     финальным значением, без покадровой интерполяции. */
  gsap.set(lis, {yPercent:115, letterSpacing:'-0.035em'});
  once(fin, () => gsap.fromTo(lis, {yPercent:115},
    {yPercent:0, duration:1.8, ease:'expo.out', stagger:.14}), 'top 80%');
}

/* ============================================================
   3. ЦЕНЫ: «Соберите поход» — калькулятор на стеклянном билете
   Будни/выходные — по умолчанию сегодняшний день по Оренбургу.
   Онлайн продаются только отдельные билеты, поэтому сумма — по ним,
   а семейный 2+2 (только в кассе) — подсказкой, когда он выгоднее.
   ============================================================ */
(function tickets(){
  const seg = document.querySelector('.seg'), tix = document.getElementById('tix');
  if (!seg || !tix) return;
  const btns = [...seg.querySelectorAll('button')], thumb = seg.querySelector('.seg-thumb');
  const rows = [...tix.querySelectorAll('.tix-row')];
  const sumEl = document.getElementById('tixSum'), whoEl = document.getElementById('tixWho');
  const tip = document.getElementById('tixTip'), dayEl = tix.querySelector('.tix-day');
  const FAMILY = {wd:3000, we:4000}, MAX = 20;
  const n = {a:2, k:2, t:0};
  let cur = orenNow().weekend ? 'we' : 'wd';
  const shown = {v:0};
  const fmt = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const plural = (x, one, few, many) => {
    const m10 = x % 10, m100 = x % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  const price = k => +rows.find(r => r.dataset.k === k).dataset[cur];

  const place = () => {
    const b = btns.find(x => x.dataset.day === cur);
    thumb.style.width = b.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  };

  function render(anim){
    const a = price('a'), k = price('k');
    const total = n.a * a + n.k * k;
    rows.forEach(r => {
      const q = n[r.dataset.k];
      r.querySelector('output').textContent = q;
      r.querySelector('[data-d="-1"]').disabled = q <= 0;
      r.querySelector('[data-d="1"]').disabled = q >= MAX;
      r.classList.toggle('on', q > 0);
      const each = r.querySelector('.tix-each b');
      if (each) each.textContent = fmt(+r.dataset[cur]);
    });
    dayEl.textContent = cur === 'we' ? 'выходные' : 'будни';

    if (!anim || reduce){ shown.v = total; sumEl.textContent = fmt(total); }
    else gsap.to(shown, {v:total, duration:.7, ease:'power3.out', overwrite:true,
      onUpdate: () => { sumEl.textContent = fmt(shown.v); }});

    const who = [];
    if (n.a) who.push(n.a + ' ' + plural(n.a, 'взрослый', 'взрослых', 'взрослых'));
    if (n.k) who.push(n.k + ' ' + plural(n.k, 'ребёнок', 'ребёнка', 'детей'));
    if (n.t) who.push(n.t + ' ' + plural(n.t, 'малыш', 'малыша', 'малышей') + ' до 3 лет');
    whoEl.textContent = who.length ? who.join(', ') : 'Добавьте билеты';

    /* подсказки: без взрослых детей не пускают; семейный выгоднее в кассе */
    let msg = '', warn = false;
    const fam = Math.min(Math.floor(n.a / 2), Math.floor(n.k / 2));
    if ((n.k || n.t) && !n.a){ msg = 'Дети младше 14 лет проходят только со взрослым'; warn = true; }
    else if (fam > 0){
      const cash = total - fam * (2*a + 2*k - FAMILY[cur]);
      msg = 'В кассе — ' + (fam > 1 ? fam + ' семейных' : 'семейным') + ' 2+2: <b>' + fmt(cash) +
            ' ₽</b>, выгода ' + fmt(total - cash) + ' ₽';
    }
    tip.hidden = !msg;
    tip.classList.toggle('warn', warn);
    tip.querySelector('span').innerHTML = msg;
  }

  rows.forEach(r => r.querySelectorAll('.step button').forEach(b => b.addEventListener('click', () => {
    const k = r.dataset.k;
    n[k] = Math.min(MAX, Math.max(0, n[k] + +b.dataset.d));
    render(true);
    if (!reduce){
      const o = r.querySelector('output');
      gsap.fromTo(o, {yPercent: +b.dataset.d > 0 ? 40 : -40, autoAlpha:0}, {yPercent:0, autoAlpha:1, duration:.4, ease:'power3.out'});
    }
  })));
  const set = (day, anim) => {
    cur = day;
    btns.forEach(b => b.setAttribute('aria-selected', b.dataset.day === day));
    place();
    render(anim);
  };
  btns.forEach(b => b.addEventListener('click', () => { if (b.dataset.day !== cur) set(b.dataset.day, true); }));
  set(cur, false);
  addEventListener('resize', place);
  if (document.fonts) document.fonts.ready.then(place);
})();

/* ============================================================
   ЛЕНТА ВИДОВ — бесконечная, во всю ширину. Едет в сторону прокрутки
   и разгоняется от её скорости; под курсором притормаживает.
   ============================================================ */
(function marquee(){
  document.querySelectorAll('.marquee').forEach(m => {
    const tr = m.querySelector('.mq-track'), list = tr.querySelector('.mq-list');
    const copy = list.cloneNode(true); copy.setAttribute('aria-hidden', 'true');
    tr.appendChild(copy);
    if (reduce) return;
    let x = 0, dir = -1, boost = 0, w = list.offsetWidth, vis = false, hover = false, lastY = scrollY;
    const measure = () => { w = list.offsetWidth; };
    addEventListener('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(m);
    m.addEventListener('pointerenter', () => { hover = true; });
    m.addEventListener('pointerleave', () => { hover = false; });
    gsap.ticker.add((t, dt) => {
      const dy = scrollY - lastY; lastY = scrollY;
      if (!vis || !w) return;
      if (dy) dir = dy > 0 ? -1 : 1;
      boost += (Math.min(60, Math.abs(dy)) - boost) * 0.08;
      const v = (hover ? 0.3 : 1) * (0.8 + boost * 0.3);
      x += dir * v * Math.min(dt, 50) / 16.67;
      if (x <= -w) x += w; else if (x > 0) x -= w;
      tr.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    });
  });
})();

/* ============================================================
   4. ВОПРОСЫ: аккордеон, открыт один
   ============================================================ */
(function faq(){
  const items = [...document.querySelectorAll('.acc-i')];
  const close = it => {
    it.classList.remove('open');
    it.querySelector('button').setAttribute('aria-expanded', 'false');
    gsap.to(it.querySelector('.acc-p'), {height:0, duration:reduce ? 0 : .5, ease:'power3.inOut'});
  };
  items.forEach((it, k) => {
    const b = it.querySelector('button'), p = it.querySelector('.acc-p');
    p.id = 'acc-p' + k; b.setAttribute('aria-controls', p.id);
    b.addEventListener('click', () => {
      const open = !it.classList.contains('open');
      items.forEach(o => { if (o !== it && o.classList.contains('open')) close(o); });
      if (!open){ close(it); return; }
      it.classList.add('open'); b.setAttribute('aria-expanded', 'true');
      gsap.fromTo(p, {height:0}, {height:'auto', duration:reduce ? 0 : .6, ease:'power3.out',
        onComplete: () => ScrollTrigger.refresh()});
      gsap.fromTo(p.firstElementChild, {autoAlpha:0, y:-6}, {autoAlpha:1, y:0, duration:.5, delay:.08, ease:'power2.out'});
    });
  });
})();

/* ============================================================
   6. НАВИГАЦИЯ, ШКАЛА ГЛАВ, ТЕКУЩИЙ РАЗДЕЛ
   ============================================================ */
const nav = document.getElementById('nav');
const railD = document.getElementById('railD');
const railList = document.getElementById('railList');
const railMark = document.getElementById('railMark');
const track = document.getElementById('railTrack');
const secs = [...document.querySelectorAll('[data-rail]')];
secs.forEach(s => {
  const li = document.createElement('li');
  li.textContent = s.dataset.rail;
  li.addEventListener('click', () => goTo(s));
  railList.appendChild(li);
});
const railItems = [...railList.children];
const navLinks = [...document.querySelectorAll('.nav-links a')];

const burger = document.getElementById('navBurger');
if (burger){
  burger.addEventListener('click', () => {
    const o = !nav.classList.contains('open');
    nav.classList.toggle('open', o);
    burger.setAttribute('aria-expanded', o);
  });
  navLinks.forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
  }));
}

/* Переход к разделу. offsetTop тут не годится: главы лежат в
   position:relative <main>, и offsetTop считается от него — промах
   на всю высоту хиро. Приземляемся на надзаголовок раздела. */
function goTo(t){
  const anchor = t.querySelector('.eyebrow') || t;
  const y = anchor.getBoundingClientRect().top + scrollY - (t.id === 'hero' ? 0 : 110);
  scrollTo({top: t.id === 'hero' ? 0 : Math.max(0, y), behavior: reduce ? 'auto' : 'smooth'});
}
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    goTo(t);
  });
});

/* Сначала все чтения геометрии, потом записи: запись посреди чтений
   заставляла браузер пересчитывать раскладку в каждом кадре.
   Маркер шкалы двигаем transform'ом (без раскладки), то же положение. */
let lastSec = -1, lastPast = null, lastMark = '';
function tick(){
  requestAnimationFrame(tick);
  const past = scrollY > heroScroll() - innerHeight * 0.6;
  let k = -1, mark = lastMark;
  if (past){
    const d = window.__ocean ? window.__ocean.depth : 0;
    if (track) mark = 'translate(-50%,calc(-50% + ' + (d * track.offsetHeight) + 'px))';
    /* текущий раздел — тот, чей верх прошёл 45% экрана */
    for (let i = 0; i < secs.length; i++){
      if (secs[i].getBoundingClientRect().top < innerHeight * 0.45) k = i;
    }
  }
  if (past !== lastPast){
    nav.classList.toggle('on', past);
    railD.classList.toggle('on', past);
    document.documentElement.classList.toggle('past-hero', past);
    lastPast = past;
  }
  if (!past) return;
  if (mark !== lastMark){ railMark.style.transform = mark; lastMark = mark; }
  if (k !== lastSec){
    railItems.forEach((li, i) => li.classList.toggle('on', i === k));
    const id = k >= 0 ? secs[k].id : '';
    navLinks.forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + id));
    lastSec = k;
  }
}
requestAnimationFrame(tick);

/* ============================================================
   7. КУРСОР И МАГНИТ
   Хиро вешает кольцо и магнит только на свой #cta; здесь — на всё
   интерактивное после хиро, одинаково по сайту.
   ============================================================ */
const ring = document.getElementById('ring');
if (ring && FINE){
  const HOT = 'a, button, [role="tab"], .rail-d li';
  document.addEventListener('pointerover', e => {
    const h = e.target.closest(HOT);
    if (h && !h.closest('.hero')) ring.classList.add('on');
  });
  document.addEventListener('pointerout', e => {
    const h = e.target.closest(HOT);
    if (h && !h.closest('.hero') && !(e.relatedTarget && h.contains(e.relatedTarget))) ring.classList.remove('on');
  });
  document.querySelectorAll('[data-magnet], .nav-cta, .more, .link-arrow').forEach(b => {
    b.addEventListener('pointerleave', () => gsap.to(b, {x:0, y:0, duration:.7, ease:'elastic.out(1,.45)'}));
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      gsap.to(b, {x:(e.clientX - r.left - r.width/2) * .18,
                  y:(e.clientY - r.top - r.height/2) * .30,
                  duration:.5, ease:'power3.out'});
    });
  });
}

/* ============================================================
   ЖИДКОЕ СТЕКЛО — [data-glass="ширина_кромки_px"]
   Преломление — SVG-фильтр в backdrop-filter (приём liquid-glass-react):
   карта смещений (R = x, G = y) считается под размер элемента, кромка
   работает как линза, у трёх каналов чуть разный масштаб — лёгкая
   хроматическая аберрация. Браузер считает фильтр вместе с прокруткой,
   поэтому стекло не отстаёт и не двоится (WebGL-вариант отставал на кадр).
   Только Chromium: Safari/Firefox url() в backdrop-filter не рисуют —
   там html.lg-soft, мягкий blur с тем же кантом (site.css).
   ============================================================ */
(function liquidGlass(){
  const els = [...document.querySelectorAll('[data-glass]')];
  if (!els.length) return;
  document.documentElement.classList.add(CHROMIUM ? 'lg-svg' : 'lg-soft');
  if (!CHROMIUM) return;

  const REFR = 30, CA = 0.07, FROST = 0.5;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(svg);

  function dispMap(w, h, rad, band){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x2 = c.getContext('2d'), id = x2.createImageData(w, h), D = id.data;
    const bx = w/2, by = h/2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const px = x + .5 - bx, py = y + .5 - by;
      const qx = Math.abs(px) - bx + rad, qy = Math.abs(py) - by + rad;
      const d = Math.hypot(Math.max(qx,0), Math.max(qy,0)) + Math.min(Math.max(qx,qy), 0) - rad;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0){ const l = Math.hypot(qx, qy) || 1; nx = qx/l; ny = qy/l; }
      else if (qx > qy) nx = 1; else ny = 1;
      nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1;
      const k = Math.min(1, Math.max(0, 1 + d/band)), f = k*k*k;
      const i = (y*w + x)*4;
      D[i]   = 128 - 127*nx*f;       // берём картинку ближе к центру —
      D[i+1] = 128 - 127*ny*f;       // кромка «загибает» фон внутрь
      D[i+2] = 128; D[i+3] = 255;
    }
    x2.putImageData(id, 0, 0);
    return c.toDataURL();
  }

  function build(el, k){
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 4 || h < 4 || (el._lgW === w && el._lgH === h)) return;
    el._lgW = w; el._lgH = h;
    const rad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w/2, h/2);
    const band = parseFloat(el.dataset.glass) || 26;
    /* маленьким элементам — слабее линза; там, где под элементом
       проезжает текст (навигация, помощник), — больше матовости */
    const refr = parseFloat(el.dataset.refr) || Math.min(REFR, band);
    const frost = parseFloat(el.dataset.frost) || FROST;
    const S = refr * 2, id = 'lg-' + k;
    const ch = (sc, m) => `<feDisplacementMap in="s" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="d${m}"/>` +
      `<feColorMatrix in="d${m}" type="matrix" values="${m==='r'?'1 0 0 0 0 0 0 0 0 0 0 0 0 0 0':m==='g'?'0 0 0 0 0 0 1 0 0 0 0 0 0 0 0':'0 0 0 0 0 0 0 0 0 0 0 0 1 0 0'} 0 0 0 1 0" result="${m}"/>`;
    let f = svg.querySelector('#' + id);
    if (!f){ f = document.createElementNS(NS, 'filter'); f.id = id; svg.appendChild(f); }
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', h);
    f.innerHTML =
      `<feImage href="${dispMap(w, h, rad, band)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${frost}" result="s"/>` +
      ch(S, 'r') + ch(S*(1-CA), 'g') + ch(S*(1-2*CA), 'b') +
      `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`;
    const bf = `url(#${id}) saturate(1.12)`;
    el.style.webkitBackdropFilter = bf; el.style.backdropFilter = bf;
  }
  const ro = new ResizeObserver(es => es.forEach(e => build(e.target, els.indexOf(e.target))));
  const add = el => {
    els.push(el); build(el, els.length - 1); ro.observe(el);
    /* блик за курсором */
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, {passive:true});
  };
  const first = els.splice(0); first.forEach(add);
  /* новые стеклянные элементы (например, собранные из JS) */
  addEventListener('glass:refresh', () =>
    document.querySelectorAll('[data-glass]').forEach(el => { if (!els.includes(el)) add(el); }));
})();

/* ——— пересчёт после загрузки шрифтов и картинок ——————————————
   Шрифты меняют высоту блоков, а от высоты зависит глубина. */
if (document.fonts && document.fonts.ready){
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
addEventListener('load', () => ScrollTrigger.refresh());

window.__site = {
  get chapters(){ return document.querySelectorAll('[data-ch]').length; },
  get pageVh(){ return Math.round(document.documentElement.scrollHeight / innerHeight * 100); },
  get todos(){ return document.querySelectorAll('[data-todo]').length; },
  goTo(id){ goTo(document.getElementById(id)); },
  waveStep(img, s){ const w = img._wave && img._wave.f; if (w) waveStep(img, w, s); return !!w; }
};

})();
