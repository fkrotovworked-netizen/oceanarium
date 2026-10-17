/* ============================================================
   СВЕТИЛЬНИК НАД АКВАРИУМОМ — на стыке хиро и первой главы.
   Настоящая 3D-модель (three.js), а не картинка: анодированный
   алюминиевый корпус, торцевые крышки, матовый рассеиватель снизу.
   Камера стоит строго по центру и чуть ниже лампы — лампа ровная,
   без наклона, снизу виден светящийся рассеиватель.

   Сцена статичная, поэтому рендерим только при изменении размера.
   Холст = CSS-размер × DPR, рисуем 1:1.
   Свечение вокруг — CSS (.lamp-halo) и шейдер воды в ocean.js,
   который берёт положение лампы с этого же элемента (#lamp).
   ============================================================ */

import * as THREE from './vendor/three.module.js';

const host   = document.getElementById('lamp');
const canvas = document.getElementById('lamp-canvas');

/* Цвета задаём в sRGB и сами переводим в линейное пространство.
   ColorManagement выключен глобально в ocean.js (один модуль three на
   весь сайт), поэтому на автоматическое преобразование не полагаемся. */
function lin(hex, k = 1){
  return new THREE.Color().setRGB(
    ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255
  ).convertSRGBToLinear().multiplyScalar(k);
}

/* Прямоугольник со скруглёнными углами — силуэт корпуса спереди */
function rrect(w, h, r){
  const s = new THREE.Shape(), x = -w/2, y = -h/2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);  s.quadraticCurveTo(x + w, y,     x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);  s.quadraticCurveTo(x,     y + h, x,     y + h - r);
  s.lineTo(x, y + r);      s.quadraticCurveTo(x,     y,     x + r, y);
  return s;
}
/* Вытянутый в глубину брусок с фаской по краям.
   Фаска ловит блик — главный признак «настоящего» металла. */
function bar(w, h, d, r, bevel){
  const g = new THREE.ExtrudeGeometry(rrect(w - bevel*2, h - bevel*2, r), {
    depth: d - bevel*2, curveSegments: 10,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6
  });
  g.center();
  return g;
}

/* Корпус — профиль, протянутый вдоль лампы.
   Сечение — суперэллипс: спереди выпуклое (отражение плавно меняется
   сверху вниз — это и делает металл объёмным), сзади почти прямоугольное.
   Нормали считаем аналитически, поэтому поверхность гладкая, без граней. */
function sweep(L, D, n1, n2, seg = 96){
  const a = D/2, b = 0.5, pts = [];
  for (let i = 0; i <= seg; i++){
    const t = (i / seg) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const n = c >= 0 ? n1 : n2;                 // перед / зад
    const z = a * Math.sign(c) * Math.pow(Math.abs(c), 2/n);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), 2/n);
    /* градиент |z/a|^n + |y/b|^n = 1 */
    let nz = (n/a) * Math.sign(z) * Math.pow(Math.abs(z/a), n-1);
    let ny = (n/b) * Math.sign(y) * Math.pow(Math.abs(y/b), n-1);
    const l = Math.hypot(nz, ny) || 1;
    pts.push([y, z, ny/l, nz/l]);
  }
  const pos = [], nor = [], uv = [], idx = [];
  const N = pts.length;
  for (let e = 0; e < 2; e++){
    const x = e ? L/2 : -L/2;
    pts.forEach(([y, z, ny, nz], i) => {
      pos.push(x, y, z); nor.push(0, ny, nz);
      uv.push(x, i / (N - 1) * 3.2);             // u вдоль лампы — для шлифовки
    });
  }
  for (let i = 0; i < N - 1; i++){
    const A = i, B = i + 1, C = N + i, E = N + i + 1;
    idx.push(A, C, B, B, C, E);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* Шлифовка алюминия: горизонтальные штрихи в карте шероховатости.
   Видны только в бликах — как у настоящего профиля. */
function brushed(){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(118,118,118)'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 1400; i++){
    const y = Math.random() * c.height, v = 90 + Math.random() * 70;
    x.fillStyle = `rgba(${v},${v},${v},${0.10 + Math.random()*0.22})`;
    x.fillRect(Math.random() * c.width - 200, y, 200 + Math.random() * 900, 0.6 + Math.random());
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
} catch(e){ renderer = null; }

if (host && canvas && renderer){
  document.documentElement.classList.add('has-lamp');
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(10, 1, 0.1, 5000);

  /* ——— окружение для отражений ——————————————————————————
     Что отражает корпус, то и делает его объёмным:
     сверху — софтбокс (блик по верхней фаске),
     снизу — освещённая бирюзовая вода аквариума,
     сзади камеры — тёмный зал с тонкой световой полосой. */
  /* Окружение — сфера с плавным градиентом по направлению, а не набор
     плоскостей: у плоскостей жёсткие края, и глянец отражал их полосами,
     как хром. Здесь каждая зона мягко перетекает в соседнюю. */
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uBox:   {value: lin(0xF2FAFF, 2.6)},    // софтбокс над лампой
      uRoom:  {value: lin(0x0A1626, 1.0)},    // тёмный зал на уровне глаз
      uGlow:  {value: lin(0x9FD0E8, 0.55)},   // мягкий свет зала за камерой
      uWater: {value: lin(0x2A7B9F, 0.85)}    // освещённая вода снизу
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir;
      uniform vec3 uBox, uRoom, uGlow, uWater;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = uRoom;
        c = mix(c, uBox,   smoothstep(0.30, 0.85, d.y));
        c = mix(c, uWater, smoothstep(-0.05, -0.55, d.y));
        /* широкая мягкая полоса света за спиной зрителя — средний блик */
        c += uGlow * exp(-pow((d.y - 0.12) / 0.16, 2.0)) * smoothstep(-0.2, 0.7, d.z);
        gl_FragColor = vec4(c, 1.0);
      }`
  })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.02).texture;

  /* ——— материалы ——————————————————————————————————————— */
  const rough = brushed();
  const matBody = new THREE.MeshPhysicalMaterial({
    color: lin(0x2F5290), metalness: 1, roughness: 0.36, roughnessMap: rough,
    clearcoat: 0.8, clearcoatRoughness: 0.22              // прозрачный слой анодирования
  });
  const matCap = new THREE.MeshPhysicalMaterial({
    color: lin(0x2A313C), metalness: 0.8, roughness: 0.32,
    clearcoat: 0.5, clearcoatRoughness: 0.15            // графитовый сатин
  });
  /* рассеиватель светится сам; яркость ведёт «включение» (см. ниже) */
  const DIFF_ON  = lin(0xE6F6FF, 2.4);
  const DIFF_OFF = lin(0x9AA6B0, 0.22);      // погашенный: матовый пластик, чуть тлеет
  const matDiff = new THREE.MeshBasicMaterial({color: DIFF_OFF.clone()});

  const lamp = new THREE.Group();
  scene.add(lamp);
  const parts = {};

  /* Пропорции в единицах высоты корпуса (h = 1). Длина — по экрану. */
  const D = 1.25;          // глубина корпуса
  const CAP = 0.95;        // ширина торцевой крышки

  function build(L){
    for (const k in parts){ lamp.remove(parts[k]); parts[k].geometry.dispose(); }

    const bodyL = L - CAP*2 + 0.3;               // концы корпуса прячутся в крышки
    parts.body = new THREE.Mesh(sweep(bodyL, D, 3.0, 7.0), matBody);
    /* шлифовка: одна «плитка» текстуры на ~10 высот корпуса */
    rough.repeat.set(1/10, 1);

    parts.capL = new THREE.Mesh(bar(CAP, 1.05, D*1.03, 0.26, 0.09), matCap);
    parts.capR = parts.capL.clone();
    parts.capL.position.x = -(L/2 - CAP/2);
    parts.capR.position.x =  (L/2 - CAP/2);

    /* рассеиватель — матовая линза в днище, чуть утоплена в корпус */
    parts.diff = new THREE.Mesh(new THREE.BoxGeometry(bodyL - 0.3, 0.05, D*0.66), matDiff);
    parts.diff.position.y = -0.5 + 0.012;

    for (const k in parts) lamp.add(parts[k]);
  }

  /* ——— размеры и камера ————————————————————————————————
     Размеры лампы берём из CSS (невидимый .lamp-ref: высота --lamp-h,
     отступы как у сетки), чтобы разметка, свечение и 3D не расходились.
     Камера ниже лампы на угол PITCH и смотрит в её центр: лампа строго
     горизонтальна. */
  const PITCH = 9 * Math.PI / 180;
  const HFOV  = 36 * Math.PI / 180;
  let lastKey = '';

  const ref = host.querySelector('.lamp-ref');   // эталон размеров из CSS

  function layout(){
    const r = canvas.getBoundingClientRect(), q = ref.getBoundingClientRect();
    const W = Math.round(r.width), H = Math.round(r.height);
    if (!W || !H || !q.height) return;
    const lampH = q.height;
    const inset = q.left - r.left;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const key = [W, H, lampH, inset, DPR].join('|');
    if (key === lastKey) return;
    lastKey = key;

    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);

    const lampW = W - inset*2;
    const L = lampW / lampH;                 // длина в высотах корпуса
    build(L);

    /* Ширина видимого поля на расстоянии dist должна быть W/lampH
       высот корпуса — тогда лампа ровно занимает lampW пикселей. */
    const viewW = W / lampH;
    const dist = viewW / (2 * Math.tan(HFOV/2));
    cam.aspect = W / H;
    cam.fov = 2 * Math.atan(Math.tan(HFOV/2) / cam.aspect) * 180 / Math.PI;
    cam.position.set(0, -dist * Math.sin(PITCH), dist * Math.cos(PITCH) + D/2);
    cam.lookAt(0, 0, D/2);
    cam.near = dist * 0.5; cam.far = dist * 2;
    cam.updateProjectionMatrix();

    renderer.render(scene, cam);   // цвет рассеивателя уже выставлен applyPower()
  }

  let pend = false;
  const ask = () => { if (!pend){ pend = true; requestAnimationFrame(() => { pend = false; layout(); }); } };
  addEventListener('resize', ask);
  new ResizeObserver(ask).observe(canvas);
  layout();

  /* ——— «СВЕТ ВКЛЮЧАЕТСЯ» ——————————————————————————————
     Хиро кончается в темноте (яркость ≈10), а вода под лампой светлая
     (≈150–210). Чтобы не было скачка, вода после хиро стартует такой же
     тёмной, лампа въезжает погасшей и загорается, когда поднимается выше
     72% экрана, — и уже её свет заливает воду (это делает ocean.js,
     читая __lamp.power). Выключается обратно ниже 84% (гистерезис,
     чтобы не мигала на границе). Зажигание — по времени, с одним лёгким
     «подмигиванием», как у настоящего светильника; гашение — плавное. */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IGNITE = [[0, 0], [0.08, 0.55], [0.16, 0.16], [0.34, 0.62], [1.0, 1.0]];  // [с, мощность]
  const FLOOR = 0.0;
  let power = FLOOR, target = 0, from = FLOOR, t0 = 0, animating = false;

  function curve(t){
    for (let i = 1; i < IGNITE.length; i++){
      if (t <= IGNITE[i][0]){
        const [a, va] = IGNITE[i-1], [b, vb] = IGNITE[i];
        const k = (t - a) / (b - a);
        return va + (vb - va) * (i === IGNITE.length - 1 ? 1 - Math.pow(1 - k, 2) : k);
      }
    }
    return 1;
  }
  function applyPower(){
    matDiff.color.copy(DIFF_OFF).lerp(DIFF_ON, power);
    scene.environmentIntensity = 0.7 + 0.3 * power;
    host.style.setProperty('--lamp-on', power.toFixed(3));
    renderer.render(scene, cam);
  }
  function step(now){
    /* метка кадра rAF бывает чуть раньше момента переключения — не даём уйти в минус */
    const t = Math.max(0, (now - t0) / 1000);
    if (target === 1) power = reduce ? 1 : curve(t);
    else power = reduce ? FLOOR : from + (FLOOR - from) * Math.min(1, t / 0.45);
    applyPower();
    const done = target === 1 ? (reduce || t >= 1.0) : (reduce || t >= 0.45);
    if (done){ power = target === 1 ? 1 : FLOOR; applyPower(); animating = false; return; }
    requestAnimationFrame(step);
  }
  function switchTo(v){
    if (v === target) return;
    target = v; from = power; t0 = performance.now();
    if (!animating){ animating = true; requestAnimationFrame(step); }
  }

  /* Кромка хиро растворяется, пока он уезжает вверх: маска на .hero
     растёт от 0 до 22vh. Пока хиро залип (стык у низа экрана или ниже),
     маски нет вовсе — утверждённый кадр хиро не меняется. */
  const hero = document.getElementById('hero');
  function onScroll(){
    const y = host.getBoundingClientRect().top / innerHeight;   // центр лампы: 0 — верх, 1 — низ
    if (y < 0.72) switchTo(1); else if (y > 0.84) switchTo(0);
    if (hero){
      const rise = 1 - y;
      if (rise > 0.001){
        hero.classList.add('fading');
        hero.style.setProperty('--hero-fade', Math.min(rise * 0.8, 0.22) * innerHeight + 'px');
      } else hero.classList.remove('fading');
    }
  }
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('resize', onScroll);
  applyPower();
  onScroll();

  /* наружу — для замеров: панель предпросмотра не композитит canvas,
     поэтому кадр снимаем сразу после рендера в data URL */
  window.__lamp = {
    get power(){ return power; },
    render: () => { lastKey = ''; layout(); },
    grab: () => { renderer.render(scene, cam); return canvas.toDataURL('image/png'); }
  };
}
