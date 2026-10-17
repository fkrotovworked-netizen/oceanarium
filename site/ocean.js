/* ============================================================
   ОКЕАН — единая подводная среда на весь сайт.
   Один canvas, ~2 draw call: фоновый шейдер (градиент + лучи +
   каустика + светильник) и одно поле частиц с настоящим параллаксом.

   Глубина — ЧИСТАЯ ФУНКЦИЯ реальной длины страницы после хиро.
   Меняется контент → меняется длина → глубина подстраивается сама,
   ничего пересчитывать руками не нужно.
   ============================================================ */

import * as THREE from './vendor/three.module.js';

/* Управление цветом выключено намеренно.
   С r152+ setHex() переводит sRGB в линейное пространство, а наши
   шейдеры пишут в gl_FragColor напрямую и обратного перевода не делают —
   в итоге вся сцена выходила заметно темнее задуманного.
   Мы задаём цвета в sRGB и сами их смешиваем, поэтому конвертация лишняя. */
THREE.ColorManagement.enabled = false;

const canvas = document.getElementById('ocean');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer:coarse)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;

/* ——— палитра погружения ————————————————————————————————
   Путь идёт по фирменным цветам: foam → brand → deep → abyss,
   а в финале свет возвращается. */
/* Верх поверхности намеренно НЕ белёсый: с прежним 0xBFE6EE аддитивные
   слои (лучи, каустика, светильник) упирались в 255 и весь верхний экран
   превращался в белое пятно. Нужен запас по яркости. */
const STOPS = [
  {d:0.00, top:0x9AD3E2, bot:0x2A7B9F, light:1.00, surf:1.00, par:0.30},
  /* Светлая половина сайта (от лампы до акулы, ≈40% прокрутки после хиро):
     вода держится светлой примерно две трети пути и только потом плавно
     уходит к синеве ролика. */
  {d:0.12, top:0x86C6D9, bot:0x21729A, light:0.92, surf:0.82, par:0.40},
  {d:0.24, top:0x6DB3CD, bot:0x1B6690, light:0.82, surf:0.62, par:0.46},
  {d:0.33, top:0x4D9CBE, bot:0x165884, light:0.68, surf:0.40, par:0.54},
  {d:0.41, top:0x2A72A0, bot:0x0E416C, light:0.52, surf:0.20, par:0.66},
  /* Глубина акулы (секция #ch-deep ≈ d 0.48–0.71) закрыта полнокадровым
     роликом; океан виден только на стыках. Цвет здесь = цвет пустой воды
     ролика ПОСЛЕ цветокоррекции (FILM: uHue/uChroma/uGain) — синий, в тон
     соседних глав. Раньше тут стояла бирюза сырого ролика, и секция
     читалась чужим островом посреди синего сайта (замер по скринам:
     арапайма 205–209°, кормление 206–214°, сырой ролик 195–201°).
     Новый ролик → перемерить и поправить. */
  {d:0.48, top:0x003461, bot:0x001632, light:0.36, surf:0.06, par:0.76},
  {d:0.71, top:0x002B51, bot:0x00122A, light:0.14, surf:0.00, par:0.96},
  /* После акулы — непрерывное погружение до рифа: каждая следующая
     секция чуть глубже и темнее, без подъёмов. Тон тот же синий,
     что у воды ролика, — не чёрный: текст и фото должны читаться. */
  {d:0.78, top:0x062849, bot:0x010F24, light:0.13, surf:0.00, par:0.94},
  {d:0.87, top:0x05223F, bot:0x010C1D, light:0.115, surf:0.00, par:0.90},
  {d:0.95, top:0x041B35, bot:0x010917, light:0.095, surf:0.00, par:0.88},
  {d:1.00, top:0x03162C, bot:0x000611, light:0.08, surf:0.00, par:0.90},
];

const cTop = new THREE.Color(), cBot = new THREE.Color();
const _a = new THREE.Color(), _b = new THREE.Color();
let light = 1, surf = 1, parAmt = .3;

function sampleDepth(d){
  let i = 0;
  while (i < STOPS.length - 2 && d > STOPS[i+1].d) i++;
  const A = STOPS[i], B = STOPS[i+1];
  const t = B.d === A.d ? 0 : (d - A.d) / (B.d - A.d);
  const k = Math.min(1, Math.max(0, t));
  _a.setHex(A.top); _b.setHex(B.top); cTop.copy(_a).lerp(_b, k);
  _a.setHex(A.bot); _b.setHex(B.bot); cBot.copy(_a).lerp(_b, k);
  light  = A.light + (B.light - A.light) * k;
  surf   = A.surf  + (B.surf  - A.surf ) * k;
  parAmt = A.par   + (B.par   - A.par  ) * k;
}

/* ——— фолбэк без WebGL —————————————————————————————————
   Сайт обязан читаться и «погружаться» без 3D: тот же цвет воды
   уезжает в CSS-переменные, градиент делает остальное. */
/* Переменная на <html> наследуется всеми узлами: её смена каждый кадр
   пересчитывала стили всей страницы и перерисовывала все фото с масками.
   С WebGL цвет нужен только фото (.aq-in) — пишем туда и только при смене. */
let cssTop = '', cssBot = '', cssTargets = null;
function pushCssWater(){
  const t = '#' + cTop.getHexString(), b = '#' + cBot.getHexString();
  if (t === cssTop && b === cssBot) return;
  cssTop = t; cssBot = b;
  const els = cssTargets || [document.documentElement];
  for (const el of els){ el.style.setProperty('--water-top', t); el.style.setProperty('--water-bot', b); }
}

/* начальное состояние, чтобы цвет воды был осмысленным
   ещё до первого кадра (и в фолбэке тоже) */
sampleDepth(0); pushCssWater();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:false, powerPreference:'high-performance'});
} catch(e){ renderer = null; }

if (!renderer){
  /* WebGL нет — ведём только CSS-градиент и выходим */
  const onScroll = () => { sampleDepth(depthNow()); pushCssWater(); };
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('resize', onScroll);
  onScroll();
} else {
  document.documentElement.classList.add('has-webgl');
  cssTargets = [...document.querySelectorAll('.aq-in')];
  cssTop = ''; pushCssWater();
  boot();
}

/* ——— глубина как функция реальной длины страницы ——————— */
function heroScroll(){
  const h = document.querySelector('.scroll-space');
  return h ? Math.max(0, h.offsetHeight - innerHeight) : 0;
}
/* Глубина привязана к секции акулы, а не к длине страницы целиком.
   Ролик акулы и вода вокруг него (STOPS 0.48/0.71, столб uSpot)
   подогнаны под глубины, на которых он шёл до перестройки сайта:
   прогресс секции 0 → d 0.484, прогресс 1 → d 0.7145 (замер 2026-09-22,
   1440×900). Теперь сколько бы ни было контента до и после акулы,
   ролик всегда встречает ту же воду. До акулы и после — линейно. */
const D_IN = 0.484, D_OUT = 0.7145;
let deepEl = null;
function depthNow(){
  const hs = heroScroll();
  const total = document.documentElement.scrollHeight - innerHeight;
  const y = scrollY;
  deepEl = deepEl || document.getElementById('ch-deep');
  if (!deepEl) return Math.min(1, Math.max(0, (y - hs) / Math.max(1, total - hs)));
  const top = deepEl.getBoundingClientRect().top + y;
  const a = top - innerHeight;                  // прогресс ролика 0
  const b = top + deepEl.offsetHeight;          // прогресс ролика 1
  const cl = v => Math.min(1, Math.max(0, v));
  if (y <= a) return D_IN * cl((y - hs) / Math.max(1, a - hs));
  if (y <= b) return D_IN + (D_OUT - D_IN) * (y - a) / Math.max(1, b - a);
  return D_OUT + (1 - D_OUT) * cl((y - b) / Math.max(1, total - b));
}

function boot(){
  const DPR = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;  // без доп. преобразования
  renderer.autoClear = false;

  /* ——— 1. среда: один полноэкранный шейдер ——————————— */
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgU = {
    uTop:{value:cTop}, uBot:{value:cBot},
    uTime:{value:0}, uLight:{value:1}, uSurf:{value:1},
    uLamp:{value:0}, uLampY:{value:0.955}, uSpot:{value:0},
    uPower:{value:1}, uReveal:{value:1},
    /* тёмная вода до включения лампы = низ хиро (замер над лампой ≈ (8–16,12–22,23–32)) */
    uDarkTop:{value:new THREE.Color(0x0C1C34)}, uDarkBot:{value:new THREE.Color(0x07101F)}, uRes:{value:new THREE.Vector2(1,1)}, uDrift:{value:0}
  };
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
    uniforms: bgU, depthTest:false, depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uTop,uBot; uniform float uTime,uLight,uSurf,uLamp,uLampY,uSpot,uDrift;
      uniform float uPower,uReveal; uniform vec3 uDarkTop,uDarkBot;
      uniform vec2 uRes;

      /* Лучи света сверху: веер полос по углу от источника.
         Частоты взяты НЕкратными и с разными скоростями — иначе рисунок
         повторяется и читается как прямые блики объектива, а не как свет
         в воде. Степень низкая: нужны мягкие широкие снопы, не резкие
         линии. Ещё лучи гаснут книзу — вода их съедает. */
      float rays(vec2 uv,float t){
        vec2 p = uv - vec2(0.5 + uDrift, 1.34);
        float a = atan(p.x, -p.y);
        float r = 0.50*sin(a* 8.7 + t*0.105)
                + 0.27*sin(a*17.3 - t*0.079)
                + 0.16*sin(a*28.9 + t*0.058)
                + 0.09*sin(a*46.1 - t*0.037);
        r = clamp(r*0.5 + 0.5, 0.0, 1.0);
        r = pow(r, 2.0);
        return r * smoothstep(0.02, 0.62, uv.y);
      }
      /* Каустика — сетка света у поверхности, две бегущие волны */
      float caustic(vec2 uv,float t){
        vec2 p = uv*vec2(7.0,3.4);
        float v = sin(p.x + t*0.46)*sin(p.y*1.3 - t*0.37)
                + sin(p.x*1.73 - t*0.31)*sin(p.y*0.92 + t*0.49);
        return pow(clamp(v*0.25 + 0.5, 0.0, 1.0), 5.0);
      }
      void main(){
        vec2 uv = vUv;
        vec3 col = mix(uBot, uTop, pow(uv.y, 1.35));

        float up = smoothstep(0.0, 0.95, uv.y);
        col += uTop * rays(uv, uTime) * up * uLight * 0.17;
        col += uTop * caustic(uv, uTime) * pow(up,2.2) * uSurf * 0.16;

        /* «Свет включается»: пока лампа не горит, вода — цвета низа хиро.
           Загорелась — сначала светлеет пятно под ней (мигает вместе с ней),
           потом по прокрутке вся вода (uReveal). Над лампой светлая вода
           не должна быть вообще, пока сама лампа ещё в кадре (или в кадре
           её потухший силуэт) — сверху остаётся тёмный зал, светлая вода
           строго под лампой. Раньше здесь было (1.0 − 0.65×above) —
           намеренная «протечка» света на 35% вверх; заказчик её не хотел
           видеть вовсе, оставляю полный ноль над лампой. */
        if (uReveal < 0.999){
          vec3 dark = mix(uDarkBot, uDarkTop, pow(uv.y, 1.35));
          float below = max(0.0, uLampY - uv.y);
          float ends  = smoothstep(0.0, 0.12, uv.x) * (1.0 - smoothstep(0.88, 1.0, uv.x));
          float above = smoothstep(uLampY - 0.01, uLampY + 0.03, uv.y);
          float pool  = uPower * (1.0 - smoothstep(0.0, 0.5, below)) * (1.0 - above) * mix(0.55, 1.0, ends);
          float lit   = max(uReveal * (1.0 - above), pool);
          col = mix(dark, col, clamp(lit, 0.0, 1.0));
        }

        /* Свет светильника в воде. Сам светильник теперь 3D-модель на
           стыке хиро (lamp.js), поэтому своей яркой полосы шейдер больше
           не рисует — только ореол и разлив вниз, и не у верхней кромки,
           а там, где лампа реально на экране (uLampY, 1 = верх кадра).
           Уехала лампа выше кадра — свет по-прежнему падает сверху
           и слабеет с расстоянием.
           (Был пересвет: разлив на 70% экрана почти белым — не повторять.) */
        if (uLamp > 0.001){
          float y0 = uLampY;
          float d  = abs(uv.y - y0);
          float halo  = smoothstep(0.042, 0.0, d);
          float spill = smoothstep(0.24, 0.0, max(0.0, y0 - uv.y)) * step(uv.y, y0);
          float ends  = smoothstep(0.0, 0.09, uv.x) * smoothstep(1.0, 0.91, uv.x);
          col += vec3(0.86,0.96,1.0) * (halo*0.26 + spill*0.09) * ends * uLamp;
        }

        /* Световой столб над акулой — такой же, как в ролике (замер
           пустого кадра: конус сверху по центру, ±0.1 кадра у верха,
           книзу шире и слабее). Горит только на глубине акулы: на стыке
           ролик проявляется поверх того же света, и шва не видно. */
        if (uSpot > 0.001){
          float sx = 0.16 + 0.06*(1.0 - uv.y);      /* под финальный ролик: столб шире */
          float gx = exp(-0.5 * pow((uv.x - 0.5)/sx, 2.0));
          /* белое ядро (R) гаснет книзу быстрее, чем бирюза */
          vec3 fall = vec3(pow(uv.y, 2.6), pow(uv.y, 1.8), pow(uv.y, 1.8));
          col += vec3(0.45,0.43,0.40) * gx * fall * uSpot;
        }

        /* виньетка + дизер против полос на градиенте */
        vec2 q = uv - 0.5;
        col *= 1.0 - dot(q,q)*0.55;
        float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453);
        col += (dither - 0.5)/255.0;
        gl_FragColor = vec4(col, 1.0);
      }`
  })));

  /* ——— 2. взвесь: одно поле частиц, весь дрейф в шейдере ——
     Points = один draw call; CPU за кадр не делает ничего. */
  const COUNT = reduce ? 0 : (MOBILE ? 700 : 2600);
  const SPAN = 120;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
  cam.position.z = 0;

  let points = null;
  if (COUNT > 0){
    const pos = new Float32Array(COUNT*3), seed = new Float32Array(COUNT), size = new Float32Array(COUNT);
    for (let i=0;i<COUNT;i++){
      pos[i*3]   = (Math.random()-0.5)*90;
      pos[i*3+1] = (Math.random()-0.5)*SPAN;
      pos[i*3+2] = -2 - Math.random()*78;      // разная дальность → параллакс
      seed[i] = Math.random();
      size[i] = 0.7 + Math.random()*2.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed,1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size,1));
    points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0}, uCamY:{value:0}, uSpan:{value:SPAN},
                uAmt:{value:0.3}, uDpr:{value:DPR}, uTint:{value:cTop}},
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:`
        attribute float aSeed, aSize;
        uniform float uTime,uCamY,uSpan,uAmt,uDpr;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.11 + aSeed*6.283)*0.7;
          p.y += cos(uTime*0.08 + aSeed*4.13)*0.5;
          /* бесконечное поле: заворачиваем по вертикали вокруг камеры */
          p.y = mod(p.y - uCamY, uSpan) - uSpan*0.5;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          float dist = -mv.z;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uDpr * (52.0/max(dist,0.001));
          /* дальние гаснут — атмосферная перспектива */
          vA = uAmt * smoothstep(86.0, 6.0, dist) * (0.22 + 0.78*fract(aSeed*7.31));
        }`,
      fragmentShader:`
        precision mediump float;
        varying float vA; uniform vec3 uTint;
        void main(){
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.06, r) * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uTint, a);
        }`
    }));
    points.frustumCulled = false;
    scene.add(points);
  }

  /* ——— встречи: обитатель ВНУТРИ сцены ————————————————
     Не плита поверх океана, а плоскость с вырезанной текстурой в самой
     воде. Поэтому животное получает цвет текущей глубины, а взвесь
     проходит перед ним — вода на всём сайте остаётся одна, наша.

     Состояние держим простым объектом: его удобно крутить из GSAP.
       a   — видимость 0..1
       x,y — положение в долях половины кадра (0 = центр, ±1 = край)
       s   — высота в долях высоты кадра
       rot — наклон, радианы
       fog — насколько объект утоплен в цвет воды */
  const encounters = {};
  const texLoader = new THREE.TextureLoader();

  function addEncounter(name, url){
    const state = {a:0, x:0, y:0, s:0.6, rot:0, fog:0.30};
    const mat = new THREE.ShaderMaterial({
      uniforms:{uMap:{value:null}, uTint:{value:new THREE.Color()},
                uAlpha:{value:0}, uFog:{value:0.3}},
      transparent:true, depthWrite:false,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`
        precision highp float;
        varying vec2 vUv; uniform sampler2D uMap; uniform vec3 uTint;
        uniform float uAlpha,uFog;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          if (t.a < 0.004) discard;
          /* утапливаем в цвет воды — так объект принадлежит глубине,
             а не лежит на ней наклейкой */
          vec3 c = mix(t.rgb, uTint, uFog);
          gl_FragColor = vec4(c, t.a * uAlpha);
        }`
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat);
    mesh.position.z = -20;
    mesh.visible = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    const rec = {mesh, mat, state, aspect:1};
    encounters[name] = rec;
    texLoader.load(url, t => {
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      mat.uniforms.uMap.value = t;
      rec.aspect = t.image.width / t.image.height;
    });
    return state;
  }

  function updateEncounters(){
    for (const k in encounters){
      const e = encounters[k], s = e.state;
      e.mesh.visible = s.a > 0.002 && !!e.mat.uniforms.uMap.value;
      if (!e.mesh.visible) continue;
      const dist = Math.abs(e.mesh.position.z - cam.position.z);
      const fh = 2 * Math.tan(cam.fov * Math.PI / 360) * dist;   // высота кадра
      const fw = fh * cam.aspect;
      const h = fh * s.s;
      e.mesh.scale.set(h * e.aspect, h, 1);
      e.mesh.position.x = cam.position.x + s.x * fw * 0.5;
      e.mesh.position.y = cam.position.y + s.y * fh * 0.5;
      e.mesh.rotation.z = s.rot;
      /* кадр секвенции выбирается ВРЕМЕНЕМ, ход «туда-обратно» */
      if (e.seq){
        const n = e.seq.texs.length;
        if (n > 1){
          const p = clock.t * e.seq.fps;
          const cyc = Math.floor(p) % (2*n - 2);
          const fi  = cyc < n ? cyc : (2*n - 2 - cyc);
          const t = e.seq.texs[fi];
          if (t) e.mat.uniforms.uMap.value = t;
          e.seq.cur = fi;
          e.seq.ready = e.seq.texs.filter(Boolean).length;
        }
      }
      e.mat.uniforms.uAlpha.value = s.a;
      e.mat.uniforms.uFog.value = s.fog;
      e.mat.uniforms.uTint.value.copy(cBot);
    }
  }

  /* ——— живая встреча: секвенция кадров с альфой ————————————
     Анимацию ведёт ВРЕМЯ, а положение — скролл. Если повесить и то и
     другое на скролл, животное замирает ровно тогда, когда человек
     остановился читать, — а нужно наоборот: оно должно жить, пока его
     разглядывают.

     Ход «туда-обратно», а не по кругу: первый и последний кадры не
     совпадают, и закольцованное воспроизведение дало бы рывок на стыке.
     При такой мелкой амплитуде обратный ход незаметен. */
  function addEncounterSeq(name, dir, count, fps){
    const state = addEncounter(name, dir + '/f_000.webp');
    const rec = encounters[name];
    const step = MOBILE ? 3 : 1;                 // на телефоне экономим память
    const list = [];
    for (let i = 0; i < count; i += step) list.push(i);
    const texs = new Array(list.length).fill(null);
    list.forEach((f, i) => {
      texLoader.load(dir + '/f_' + String(f).padStart(3,'0') + '.webp', t => {
        t.colorSpace = THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        texs[i] = t;
        if (i === 0){
          rec.mat.uniforms.uMap.value = t;
          rec.aspect = t.image.width / t.image.height;
        }
      });
    });
    rec.seq = {texs, fps};
    return state;
  }

  const ENC_DIR = 'public/media/oceanarium/encounters/';
  /* Пингвины, скат и арапайма сняты по решению заказчика (2026-09-21):
     вырезки выглядели наклейками, а на полнокадровые ролики для всех нет
     кредитов. Остаётся только акула — до её ролика.
     ['penguin','ray','arapaima'].forEach(n => addEncounter(n, ENC_DIR + n + '-cut.webp')); */
  /* 49 кадров = каждый 4-й из 193 при 24 fps, значит играем на 6 fps —
     это реальное время исходника. Амплитуда движения крошечная, поэтому
     низкая частота не читается как рывки. */
  /* Акула-вырезка снята: её заменил полнокадровый ролик (FILM ниже).
     addEncounterSeq('shark', ENC_DIR + 'shark-seq', 49, 6); */

  /* ——— ПОЛНОКАДРОВЫЙ РОЛИК ВСТРЕЧИ (акула) ————————————————
     Целый кадр фильма, как хиро, — не вырезка и не плита поверх сайта.
     Рисуется в ЭТОЙ ЖЕ сцене: поверх фоновой воды, но ПОД взвесью —
     частицы нашего океана плывут и перед акулой, вода на сайте одна.
     Стык с океаном — по пустой воде: ролик начинается и кончается без
     акулы, а цвет океана на этой глубине подогнан под воду ролика (STOPS).
     Кадр выбирает прокрутка секции (как в хиро), не время.
     Одна текстура на GPU: при смене кадра меняем ей картинку. */
  const FILM = {
    sec: document.getElementById('ch-deep'),
    /* финальный ролик 1080p: десктоп — кадр целиком, телефон — кроп центра
       607×1080, как у хиро (tools/film_frames.py, каждый 2-й кадр, q90) */
    dir: ENC_DIR + (MOBILE ? 'shark-film-m/' : 'shark-film/'),
    count: 181,
    /* [прогресс секции, кадр]. Прогресс 0 — верх секции у низа экрана,
       1 — низ секции у верха. Текст главы по центру экрана при 0.5 и
       уезжает вверх к ~0.72. Раскладка по финальному ролику:
         0–0.08    пустая вода (0–1.7 с), ролик проявляется поверх океана
         0.08–0.30 подплывает из глубины по центру и уходит вправо (–6 с)
         0.30–0.38 пустая вода до склейки ролика (–7.75 с)
         0.38–0.50 входит справа крупно; к 0.5 морда на ~47% ширины,
                   в 9% от текста (9.1 с)
         0.50–0.62 подходит к тексту медленно, пока его читают; край текста
                   пересекает к ~0.59, когда текст уже выше акулы
         0.62–0.75 проходит целиком под уехавшим текстом (–12.5 с)
         0.75–0.95 крен вниз-влево и уход; с 0.84 растворяется, чтобы исчезнуть
                   до заголовка «Кормление» (заходит снизу около 0.95) */
    keys: [[0.00,0],[0.08,20],[0.30,72],[0.38,93],[0.50,108],[0.62,116],
           [0.75,150],[0.88,172],[0.95,180],[1.00,180]],
    /* Склейка внутри ролика: модель сшила два куска с разным цветом.
       До кадра 187 исходника (7.79 с) вода синяя (208° — уже тон сайта),
       после — бирюзовая (191°). Вторую половину приводим к первой
       (подбор по зонам пустой воды: совпадение в пределах 1–4 уровней),
       а сам стык растворяем наплывом: 6 кадров после склейки смешиваются
       с последним кадром до неё (там пусто, акула только входит у края). */
    cut: 94,                            // первый кадр второй половины (исходник 188)
    dissolve: 7,
    gradeB: {hue:-0.22, chroma:1.20, gain:1.02},
    imgs: [], started: false, p: 0, idx: -1, shown: -1, a: 0, force: null
  };
  const filmTex = new THREE.Texture();
  filmTex.colorSpace = THREE.NoColorSpace;
  filmTex.minFilter = filmTex.magFilter = THREE.LinearFilter;
  filmTex.generateMipmaps = false;
  /* Цветокоррекция под воду сайта. Сырой ролик бирюзовый (≈197°) с серым
     столбом света, сайт — синий (≈207°). Крутим тон и поднимаем цветность
     ТОЛЬКО у холодных пикселей (вода, свет): тёплая кожа акулы остаётся
     натуральной — общий поворот сделал бы её серо-синей, а общая
     насыщенность — рыжей. Яркость ведём по прогрессу: на входе ролик
     светлее (стык с более светлой водой выше), к выходу темнее — акула
     встречается по дороге вглубь, а не на отдельной сцене. */
  const filmTex2 = new THREE.Texture();          // последний кадр до склейки — для наплыва
  filmTex2.colorSpace = THREE.NoColorSpace;
  filmTex2.minFilter = filmTex2.magFilter = THREE.LinearFilter;
  filmTex2.generateMipmaps = false;
  /* Два прохода. Тяжёлое — дебендинг (9 выборок), цветокоррекция склейки,
     наплыв — считается ОДИН раз на кадр ролика, в его родном разрешении,
     в текстуру с плавающей точкой (filmPrep). На экран каждый кадр идёт
     лёгкий проход: object-fit cover, яркость, живое зерно — попиксельно,
     как было. Раньше всё тяжёлое считалось на каждый из ~5.5 млн пикселей
     экрана в каждом кадре — это и была цена секции акулы в Safari. */
  const filmU = {uMap:{value:filmTex}, uMap2:{value:filmTex2}, uMix:{value:0},
                 uImg:{value:new THREE.Vector2(16, 9)},
                 uHue:{value:0}, uChroma:{value:1}};
  const prepScene = new THREE.Scene();
  prepScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
    uniforms: filmU, depthTest:false, depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv; uniform sampler2D uMap, uMap2; uniform float uMix;
      uniform vec2 uImg; uniform float uHue, uChroma;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      /* Дебендинг (как в видеоплеерах): в ролик зашиты ступеньки тёмного
         градиента — кольца вокруг столба света. Усредняем соседей в радиусе
         6–16 px кадра, но только тех, кто отличается меньше чем на 3 уровня:
         ступенька сглаживается, край акулы (перепад больше) остаётся резким. */
      vec3 deband(vec2 uv, vec3 c){
        vec2 px = 1.0 / uImg;
        float ang = hash(gl_FragCoord.xy) * 6.2832;
        vec3 acc = c; float n = 1.0;
        for (int i = 0; i < 8; i++){
          float a = ang + float(i) * 0.7854;
          float r = 6.0 + 10.0 * fract(float(i) * 0.618 + ang);
          vec3 sm = texture2D(uMap, uv + vec2(cos(a), sin(a)) * r * px).rgb;
          vec3 d = abs(sm - c);
          if (max(max(d.r, d.g), d.b) < 3.0/255.0){ acc += sm; n += 1.0; }
        }
        return acc / n;
      }
      /* YIQ: I > 0 — тёплое (кожа), I < 0 — холодное (вода, свет).
         Тон и цветность крутим только у холодного — кожа акулы остаётся живой. */
      vec3 grade(vec3 c, float hue, float chroma){
        float Y = dot(c, vec3(0.299, 0.587, 0.114));
        float I = dot(c, vec3(0.596,-0.274,-0.322));
        float Q = dot(c, vec3(0.211,-0.523, 0.312));
        float cool = 1.0 - smoothstep(-0.03, 0.0, I);
        float t = hue * cool, k = 1.0 + (chroma - 1.0) * cool;
        float cs = cos(t), sn = sin(t);
        float I2 = (I*cs - Q*sn) * k, Q2 = (I*sn + Q*cs) * k;
        return vec3(Y + 0.956*I2 + 0.621*Q2, Y - 0.272*I2 - 0.647*Q2, Y - 1.106*I2 + 1.703*Q2);
      }
      void main(){
        vec3 c = grade(deband(vUv, texture2D(uMap, vUv).rgb), uHue, uChroma);
        /* наплыв через склейку: первая половина ролика в коррекции не нуждается */
        if (uMix > 0.001) c = mix(c, texture2D(uMap2, vUv).rgb, uMix);
        gl_FragColor = vec4(c, 1.0);
      }`
  })));
  let filmPrep = new THREE.WebGLRenderTarget(16, 9, {type:THREE.HalfFloatType, format:THREE.RGBAFormat,
    minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, depthBuffer:false, generateMipmaps:false});
  filmPrep.texture.colorSpace = THREE.NoColorSpace;
  let prepDirty = true;
  const showU = {uPrep:{value:filmPrep.texture}, uA:{value:0}, uRes:bgU.uRes, uTime:bgU.uTime,
                 uImg:filmU.uImg, uGain:{value:1}};
  const filmMesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
    uniforms: showU, transparent:true, depthTest:false, depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv; uniform sampler2D uPrep; uniform float uA, uTime, uGain;
      uniform vec2 uRes, uImg;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        /* object-fit: cover — на телефоне сам вырезает центр кадра */
        vec2 uv = vUv;
        float sr = uRes.x/uRes.y, ir = uImg.x/uImg.y;
        if (sr > ir) uv.y = (uv.y - 0.5) * (ir/sr) + 0.5;
        else         uv.x = (uv.x - 0.5) * (sr/ir) + 0.5;
        vec3 c = clamp(texture2D(uPrep, uv).rgb * uGain, 0.0, 1.0);
        /* Живое зерно, как в хиро: в ролике зашиты ступеньки тёмного
           градиента (кольца вокруг столба света, 14 уровней на 760 px).
           ±2.5 уровня шума их разбивают; на светлом (акула) слабее. */
        float n = hash(gl_FragCoord.xy + fract(uTime*7.13)*97.0);
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        c += (n - 0.5) * (2.5/255.0) * (1.0 - 0.6*lum);
        gl_FragColor = vec4(c, uA);
      }`
  }));
  filmMesh.renderOrder = 1;
  filmMesh.visible = false;
  bgScene.add(filmMesh);
  function renderPrep(){
    const w = filmU.uImg.value.x, h = filmU.uImg.value.y;
    if (filmPrep.width !== w || filmPrep.height !== h) filmPrep.setSize(w, h);
    renderer.setRenderTarget(filmPrep);
    renderer.render(prepScene, bgCam);
    renderer.setRenderTarget(null);
    prepDirty = false;
  }

  /* Грузим, когда до секции остаётся пара экранов. Сначала опорные
     кадры (каждый 8-й), потом гуще — при быстрой прокрутке всегда есть
     что показать. Без decode() в критическом пути: только onload. */
  function loadFilm(){
    if (FILM.started) return;
    FILM.started = true;
    FILM.imgs = new Array(FILM.count).fill(null);
    const order = [], seen = new Set();
    for (const st of [8, 4, 2, 1])
      for (let i = 0; i < FILM.count; i += st) if (!seen.has(i)){ seen.add(i); order.push(i); }
    let k = 0, busy = 0;
    const next = () => {
      while (busy < 6 && k < order.length){
        const i = order[k++]; busy++;
        const im = new Image();
        im.decoding = 'async';
        im.onload  = () => { FILM.imgs[i] = im; busy--; next(); };
        im.onerror = () => { busy--; next(); };
        im.src = FILM.dir + 'f_' + String(i).padStart(3,'0') + '.webp';
      }
    };
    next();
  }
  if (FILM.sec){
    new IntersectionObserver((es, io) => {
      if (es.some(e => e.isIntersecting)){ loadFilm(); io.disconnect(); }
    }, {rootMargin:'200% 0px'}).observe(FILM.sec);
  }
  const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
  function filmFrameAt(p){
    const K = FILM.keys;
    for (let i = 1; i < K.length; i++){
      if (p <= K[i][0]){
        const [p0, f0] = K[i-1], [p1, f1] = K[i];
        return Math.round(f0 + (f1 - f0) * (p - p0) / (p1 - p0));
      }
    }
    return K[K.length-1][1];
  }
  /* Загрузка <img> в текстуру в Safari стоит 15–19 мс на кадр 1080p
     (из ImageBitmap — ещё дороже, 18–39), а из готового массива пикселей —
     1–2 мс. Поэтому кадры вокруг текущего (с запасом по ходу прокрутки)
     декодируют в пиксели два фоновых потока: fetch → ImageBitmap →
     OffscreenCanvas → строки переворачиваются под WebGL. Сверено: байт
     в байт как прежняя загрузка из <img> (UNPACK_FLIP_Y, без цветовой
     конверсии). Нет OffscreenCanvas в потоке — прежний путь через <img>. */
  const RAW_WORKER = `
    const pool = [];
    self.onmessage = async e => {
      if (e.data.back){ pool.push(e.data.back); return; }   // буфер вернулся — переиспользуем
      const {i, url} = e.data;
      try {
        const blob = await (await fetch(url)).blob();
        const bm = await createImageBitmap(blob, {colorSpaceConversion:'none', premultiplyAlpha:'none'});
        const w = bm.width, h = bm.height;
        const x = new OffscreenCanvas(w, h).getContext('2d', {willReadFrequently:true});
        x.drawImage(bm, 0, 0); bm.close();
        const d = x.getImageData(0, 0, w, h).data, row = w * 4;
        let b = pool.pop(); if (!b || b.byteLength !== d.length) b = new ArrayBuffer(d.length);
        const fl = new Uint8Array(b);
        for (let y = 0; y < h; y++) fl.set(d.subarray((h - 1 - y) * row, (h - y) * row), y * row);
        self.postMessage({i, w, h, buf: fl.buffer}, [fl.buffer]);
      } catch(err){ self.postMessage({i, err: 1}); }
    };`;
  const RAW = new Map();                          // кадр → {w,h,data} | null (в работе) | false (ошибка)
  const rawWorkers = [];
  let rawFly = 0, rawNext = 0, rawDir = 1, rawLast = -1, rawDead = false;
  try {
    if (typeof OffscreenCanvas !== 'undefined' && window.Worker){
      const u = URL.createObjectURL(new Blob([RAW_WORKER], {type:'text/javascript'}));
      for (let k = 0; k < 2; k++){
        const w = new Worker(u);
        w.onmessage = e => {
          const m = e.data; rawFly = Math.max(0, rawFly - 1);
          if (m.err){ RAW.set(m.i, false); if (!RAW.size || [...RAW.values()].every(v => v === false)) rawDead = true; return; }
          if (RAW.has(m.i)) RAW.set(m.i, {w: m.w, h: m.h, data: new Uint8Array(m.buf), wk: w});
          else w.postMessage({back: m.buf}, [m.buf]);
        };
        w.onerror = () => { rawDead = true; };
        rawWorkers.push(w);
      }
    }
  } catch(e){ rawWorkers.length = 0; }
  /* буфер кадра отдаём обратно потоку, если он уже не нужен ни окну, ни текстурам */
  function recycle(v){
    if (!v || !v.data || filmRing.some(t => t && t.image.data === v.data)) return;
    try { v.wk.postMessage({back: v.data.buffer}, [v.data.buffer]); } catch(e){}
  }
  function feedRaw(c){
    if (!rawWorkers.length || rawDead) return;
    if (rawLast >= 0 && c !== rawLast) rawDir = c > rawLast ? 1 : -1;
    rawLast = c;
    const lo = c - (rawDir > 0 ? 3 : 9), hi = c + (rawDir > 0 ? 9 : 3);
    for (const [k, v] of RAW) if (k < lo - 3 || k > hi + 3){ RAW.delete(k); recycle(v); }
    for (let d = 0; d <= 9 && rawFly < 4; d++){
      for (const i of (rawDir > 0 ? [c + d, c - d] : [c - d, c + d])){
        if (i < lo || i > hi || i < 0 || i >= FILM.count || RAW.has(i) || rawFly >= 4) continue;
        RAW.set(i, null); rawFly++;
        const url = new URL(FILM.dir + 'f_' + String(i).padStart(3,'0') + '.webp', location.href).href;
        rawWorkers[rawNext++ % rawWorkers.length].postMessage({i, url});
      }
    }
  }
  /* Кольцо из трёх текстур: новый кадр пишется в ту, которую видеокарта
     точно уже не читает, — иначе драйвер ждёт конца прошлого кадра
     (замер Safari: стоя — 9/119 медленных, при прокрутке — большинство). */
  const filmRing = [null, null, null];
  let ringAt = 0;
  function useRaw(r){
    ringAt = (ringAt + 1) % filmRing.length;
    let t = filmRing[ringAt];
    if (!t || t.image.width !== r.w || t.image.height !== r.h){
      if (t) t.dispose();
      t = filmRing[ringAt] = new THREE.DataTexture(r.data, r.w, r.h, THREE.RGBAFormat);
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.flipY = false;                             // строки уже перевёрнуты в потоке
    } else t.image.data = r.data;
    t.needsUpdate = true;
    filmU.uMap.value = t;
  }
  function nearestFilm(i){
    for (let d = 0; d < FILM.count; d++){
      if (FILM.imgs[i - d]) return i - d;
      if (FILM.imgs[i + d]) return i + d;
    }
    return -1;
  }
  function updateFilm(){
    if (!FILM.sec) return;
    const r = FILM.sec.getBoundingClientRect();
    const tp = Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + innerHeight)));
    /* сглаживание тем же приёмом, что в хиро.
       Скачок (загрузка страницы ниже акулы, восстановление прокрутки,
       переход по якорю мгновенно) — ставим кадр сразу: иначе прогресс
       тянется с 0 и акула проплывает поверх чужой секции. */
    const jump = !FILM.seen || Math.abs(tp - FILM.p) > 0.3;
    FILM.seen = true;
    FILM.p += (tp - FILM.p) * (reduce || snapReq || jump ? 1 : 0.18);
    if (Math.abs(tp - FILM.p) < 0.0001) FILM.p = tp;
    const a = FILM.force != null ? FILM.force
            : smooth01(0.0, 0.08, FILM.p) * (1 - smooth01(0.84, 0.95, FILM.p));
    FILM.a = a;
    FILM.idx = filmFrameAt(FILM.p);
    const j = a > 0.002 && FILM.started ? nearestFilm(FILM.idx) : -1;
    filmMesh.visible = j >= 0;
    if (j < 0) return;
    feedRaw(j);
    if (j !== FILM.shown){
      const im = FILM.imgs[j], raw = RAW.get(j);
      if (raw) useRaw(raw);
      else { filmTex.image = im; filmTex.needsUpdate = true; filmU.uMap.value = filmTex; }
      filmU.uImg.value.set(im.naturalWidth, im.naturalHeight);
      FILM.shown = j;
      prepDirty = true;
    }
    /* вторая половина ролика — в тон первой; наплыв через склейку */
    const seg2 = j >= FILM.cut, G = FILM.gradeB;
    const hue = seg2 ? G.hue : 0, chroma = seg2 ? G.chroma : 1;
    if (hue !== filmU.uHue.value || chroma !== filmU.uChroma.value) prepDirty = true;
    filmU.uHue.value    = hue;
    filmU.uChroma.value = chroma;
    const last = FILM.imgs[FILM.cut - 1];
    let mix = 0;
    if (seg2 && last && j < FILM.cut + FILM.dissolve - 1)
      mix = 1 - (j - FILM.cut + 1) / FILM.dissolve;
    if (mix > 0 && filmTex2.image !== last){ filmTex2.image = last; filmTex2.needsUpdate = true; prepDirty = true; }
    if (mix !== filmU.uMix.value) prepDirty = true;
    filmU.uMix.value = mix;
    /* яркость ведём по прогрессу: на входе светлее, к выходу темнее —
       акула встречается по дороге вглубь */
    showU.uGain.value = (seg2 ? G.gain : 1) * (1.12 - 0.12 * FILM.p);
    showU.uA.value = a;
  }

  /* ——— размеры ——————————————————————————————————————— */
  function resize(){
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    bgU.uRes.value.set(w, h);
    cam.aspect = w/h; cam.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* ——— цикл ——————————————————————————————————————————
     Во время хиро не рендерим вообще: там уже крутится своя
     секвенция кадров, и делить с ней кадровый бюджет незачем. */
  let t0 = performance.now(), depth = 0, shown = 0, active = false;
  const lampEl = document.getElementById('lamp');
  const clock = {t:0};

  /* Хиро непрозрачен и держит экран целиком до scrollY = heroScroll(),
     поэтому раньше океан не виден. Рисуем его только перед самым стыком:
     вывод WebGL-холста каждый кадр под закрытым хиро стоил в Safari
     большинства медленных кадров конца хиро. Шейдеры уже собраны при
     загрузке (прогрев ниже), так что заранее греть незачем. */
  function active_(){
    return scrollY > heroScroll() - innerHeight*0.06;
  }

  /* ——— растворение кромки хиро в воде: полоса воды ПОВЕРХ хиро ————
     Раньше — CSS-маска на .hero, растущая по прокрутке. Её градиент
     размером со всё окно Safari перерисовывал на CPU и заново грузил
     в GPU на каждом кадре (~21 МБ) — медленные кадры прямо перед
     включением лампы. Математика та же, но наоборот: не «хиро с
     прозрачностью m поверх воды», а «вода с прозрачностью 1−m поверх
     хиро» — это одно и то же смешивание. Полоса высотой 22% окна,
     та же сцена (те же материалы и значения этого кадра), m — ровно
     формула маски из lamp.js: 1 выше (кромка − F), линейно до 0 у кромки,
     F = min(0.8·подъём, 0.22)·высота окна. Под полосой остаётся
     настоящий океан, так что щели не бывает и при отставании на кадр. */
  const band = (() => {
    const host = document.querySelector('.scroll-space');
    if (!host || !lampEl) return null;
    const cv = document.createElement('canvas');
    cv.id = 'ocean-band'; cv.setAttribute('aria-hidden', 'true');
    let r2;
    try { r2 = new THREE.WebGLRenderer({canvas:cv, antialias:false, alpha:true, premultipliedAlpha:true, powerPreference:'high-performance'}); }
    catch(e){ return null; }
    r2.setPixelRatio(DPR);
    r2.outputColorSpace = THREE.LinearSRGBColorSpace;
    r2.autoClear = false; r2.setClearColor(0x000000, 0);
    host.appendChild(cv);
    const mU = {uY0:{value:0}, uYb:{value:0}, uF:{value:1}, uBH:{value:1}, uDpr:{value:DPR}};
    const mulScene = new THREE.Scene();
    /* умножение уже нарисованной воды (цвет и альфа) на 1−m */
    mulScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
      uniforms:mU, depthTest:false, depthWrite:false, transparent:true,
      blending:THREE.CustomBlending, blendEquation:THREE.AddEquation,
      blendSrc:THREE.ZeroFactor, blendDst:THREE.SrcAlphaFactor,
      blendSrcAlpha:THREE.ZeroFactor, blendDstAlpha:THREE.SrcAlphaFactor,
      vertexShader:`void main(){gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader:`
        precision highp float;
        uniform float uY0,uYb,uF,uBH,uDpr;
        void main(){
          float y = uY0 + (uBH - gl_FragCoord.y / uDpr);   /* строка окна сверху, CSS px */
          float m = clamp((uYb - y) / uF, 0.0, 1.0);        /* непрозрачность хиро = маска */
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - m);
        }`
    })));
    let bh = 0, on = false;
    const size = () => { bh = Math.ceil(innerHeight * 0.22) + 2; r2.setSize(innerWidth, bh, false); cv.style.height = bh + 'px'; };
    size(); addEventListener('resize', size);
    document.documentElement.classList.add('band-fade');
    const render = (y0, yb, F) => {
      const H = innerHeight;
      r2.setViewport(0, -(H - y0 - bh), innerWidth, H);       // та же «полноэкранная» сцена, видна полоса
      mU.uY0.value = y0; mU.uYb.value = yb; mU.uF.value = F; mU.uBH.value = bh;
      const fv = filmMesh.visible; filmMesh.visible = false;
      r2.clear(); r2.render(bgScene, bgCam); r2.render(scene, cam);
      filmMesh.visible = fv;
      r2.setViewport(0, 0, innerWidth, bh);
      r2.render(mulScene, bgCam);
    };
    return {
      draw(yb){
        const H = innerHeight, rise = 1 - yb / H, F = Math.min(rise * 0.8, 0.22) * H;
        const vis = rise > 0.001 && yb > 0 && F >= 0.5;
        if (vis !== on){ on = vis; cv.style.visibility = vis ? 'visible' : 'hidden'; }
        if (!vis) return;
        const y0 = Math.round((yb - F) * DPR) / DPR;          // по сетке пикселей — без пересэмплирования
        cv.style.transform = 'translateY(' + y0 + 'px)';
        render(y0, yb, F);
      },
      hide(){ if (on){ on = false; cv.style.visibility = 'hidden'; } },
      warm(){ render(0, innerHeight, 1); }
    };
  })();

  /* Страховка от просевшего кадра: band.draw() прячет полосу только внутри
     frame(), а именно на входе в первую главу этот кадр иногда «тормозит»
     (once()-анимации сразу нескольких элементов — см. HANDOFF, Safari).
     Пропущенный кадр = полоса виснет видимой поверх уже нового контента
     («свет лампы поверх фото»). scroll — независимое событие, не ждёт
     кадровый бюджет rAF, прячет сразу, как только лампа ушла за кромку. */
  if (band && lampEl) addEventListener('scroll', () => {
    if (lampEl.getBoundingClientRect().top <= 0) band.hide();
  }, {passive:true});

  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - t0)/1000); t0 = now;

    const was = active;
    active = active_();
    if (active !== was) canvas.style.opacity = active ? '1' : '0';
    if (!active){ if (band) band.hide(); return; }   // кадровый бюджет отдан хиро

    depth = depthNow();
    /* сглаживание, тем же приёмом, что и в хиро */
    /* скачок прокрутки (загрузка ниже хиро, якорь) — без протяжки через всю палитру */
    const leap = !was || Math.abs(depth - shown) > 0.15;
    shown += (depth - shown) * (reduce || snapReq || leap ? 1 : 0.12);
    if (Math.abs(depth - shown) < 0.0002) shown = depth;

    sampleDepth(shown);

    clock.t += (reduce || window.__oceanPause) ? 0 : dt;       // пауза — только для сравнения кадров
    bgU.uTime.value  = clock.t;
    bgU.uLight.value = light;
    bgU.uSurf.value  = surf;
    /* светильник виден только на самой поверхности */
    /* включение лампы (lamp.js) и заливка воды её светом по прокрутке */
    const lampPower = window.__lamp ? window.__lamp.power : 1;
    bgU.uPower.value = lampPower;
    /* …и светит оттуда, где он на экране: центр лампы (#lamp) */
    let lampTop = -1;
    if (lampEl){
      const r = lampEl.getBoundingClientRect();
      lampTop = r.top;
      /* .lamp-ref (эталон размеров) стоит top:calc(var(--lamp-h)*-.5) внутри
         #lamp — его собственный центр совпадает с ВЕРХОМ #lamp (offset 0).
         Раньше к r.top прибавляли ещё половину высоты .lamp-ref — расчётный
         центр лампы уезжал ниже настоящего. */
      const lampY = 1 - r.top / innerHeight;
      bgU.uLampY.value = lampY;
      /* Яркость самого ореола/разлива у лампы — гаснет, как только её
         центр уходит выше экрана (uLampY > ~1). Раньше гасла по ОБЩЕЙ
         глубине страницы (shown/0.085) — порог, не связанный с тем, где
         лампа реально на экране: при другой длине хиро/секций свечение
         могло остаться, когда сама 3D-модель уже давно ушла за кромку —
         «свечение заходит за высоту лампы». Теперь оба привязаны к одной
         и той же величине и гаснут синхронно с моделью. */
      bgU.uLamp.value = (1 - smooth01(0.92, 1.08, lampY)) * lampPower;
      /* вся вода светлеет, пока лампа поднимается с 72% экрана к верху.
         Второй порог (−0.08) — тот же, на котором гаснет uLamp выше:
         раньше здесь стояло 0.05 (лампа ещё видна на экране), и в зазоре
         между «uReveal уже 1» и «лампа ещё не погасла» затемнение над
         лампой отключалось совсем — вода вспыхивала над ней так же ярко,
         как под, хотя сама лампа ещё стояла в кадре. */
      bgU.uReveal.value = lampPower * smooth01(0.72, -0.08, r.top / innerHeight);
    }
    bgU.uDrift.value = Math.sin(clock.t*0.05)*0.03;
    /* столб света — только на глубине акулы (см. STOPS 0.48–0.71) */
    bgU.uSpot.value  = smooth01(0.44, 0.48, shown) * (1 - smooth01(0.71, 0.76, shown));

    if (points){
      points.material.uniforms.uTime.value = clock.t;
      /* спуск камеры сквозь взвесь — источник ощущения движения вниз */
      points.material.uniforms.uCamY.value = shown * 210;
      points.material.uniforms.uAmt.value  = parAmt;
    }
    /* лёгкий дрейф камеры, чтобы мир не был мёртвым на паузе */
    if (!reduce){
      cam.position.x = Math.sin(clock.t*0.07)*0.5;
      cam.position.y = Math.cos(clock.t*0.05)*0.35;
    }

    updateEncounters();
    updateFilm();
    /* запись в DOM — после всех чтений геометрии, иначе браузер
       пересчитывает стили посреди кадра */
    pushCssWater();
    snapReq = false;
    /* взвесь — примета нашей воды: она же плывёт и перед акулой и
       связывает ролик с сайтом. Прореживаем чуть-чуть — у кадра своя */
    /* в темноте до включения лампы взвесь почти не видна — светить ей нечем */
    if (points) points.material.uniforms.uAmt.value =
      parAmt * (1 - 0.15 * FILM.a) * (0.25 + 0.75 * bgU.uReveal.value);

    if (filmMesh.visible && prepDirty) renderPrep();
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(scene, cam);
    if (band) band.draw(lampTop);

    /* Отладочный съём пикселей. Панель предпросмотра не композитит
       canvas корректно, поэтому картинку проверяем замером, а не глазом. */
    if (grabReq){
      grabReq = false;
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(4);
      const at = (fx, fy) => {
        gl.readPixels(Math.round(fx*(w-1)), Math.round(fy*(h-1)), 1, 1,
                      gl.RGBA, gl.UNSIGNED_BYTE, px);
        return [px[0], px[1], px[2]];
      };
      grabOut = {                    // fy снизу вверх, как в GL
        top:    at(0.50, 0.97), upper: at(0.50, 0.80),
        mid:    at(0.50, 0.50), lower: at(0.50, 0.20),
        bottom: at(0.50, 0.03), leftMid: at(0.12, 0.50)
      };
    }

    /* Съём ВСЕГО кадра в картинку. Панель предпросмотра не композитит
       canvas, поэтому иначе сцену вообще не видно — и легко принять
       пересвет за «светильник работает». */
    if (grabFullReq){
      grabFullReq = false;
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const c2 = c.getContext('2d');
      const id = c2.createImageData(w, h);
      for (let y = 0; y < h; y++){                    // GL снизу вверх
        const s = (h - 1 - y) * w * 4;
        id.data.set(px.subarray(s, s + w * 4), y * w * 4);
      }
      c2.putImageData(id, 0, 0);
      if (grabFullRes) grabFullRes(c.toDataURL('image/png'));
    }

    frames++;
  }
  let grabReq = false, grabOut = null, frames = 0, snapReq = false;
  let grabFullReq = false, grabFullRes = null;

  /* Прогрев: шейдеры (и конвейеры Metal у ANGLE) собираются при первой
     отрисовке. Без этого сборка приходилась на появление лампы и на вход
     ролика акулы — заметный фриз. Рисуем один раз под хиро (его не видно). */
  filmMesh.visible = true;
  renderPrep();
  renderer.clear(); renderer.render(bgScene, bgCam); renderer.render(scene, cam);
  filmMesh.visible = false;
  if (band) band.warm();                     // ролик в полосе не бывает — его текстура живёт в основном контексте
  /* кадр прогрева не показываем: холст скрыт до первого настоящего кадра */
  if (!active_()) canvas.style.opacity = '0';

  requestAnimationFrame(frame);

  /* наружу — для замеров и для хореографии встреч */
  window.__ocean = {
    get depth(){ return shown; },
    get target(){ return depth; },
    get active(){ return active; },
    get particles(){ return COUNT; },
    get dpr(){ return DPR; },
    get water(){ return ['#'+cTop.getHexString(), '#'+cBot.getHexString()]; },
    get lamp(){ return bgU.uLamp.value; },
    get light(){ return light; },
    frames(){ const f = frames; frames = 0; return f; },
    grab(){ grabReq = true; return new Promise(r => setTimeout(() => r(grabOut), 120)); },
    grabFull(){ return new Promise(r => { grabFullRes = r; grabFullReq = true; }); },
    /* состояние встречи — его крутит GSAP из site.js */
    enc(name){ return encounters[name] && encounters[name].state; },
    film(){ return {p:FILM.p, idx:FILM.idx, shown:FILM.shown, a:FILM.a,
      loaded:FILM.imgs.filter(Boolean).length, total:FILM.count}; },
    /* принудительная видимость ролика (null — по прокрутке): сравнить воду */
    filmForce(v){ FILM.force = v; },
    /* для замеров: следующий кадр без сглаживания (сразу к прокрутке) */
    snap(){ snapReq = true; },
    /* для замеров производительности: отключение частей сцены */
    dbg: {get points(){ return points; }, bgScene, renderer, FILM, filmU, showU, filmMesh,
      prepType(t){ filmPrep.dispose(); filmPrep = new THREE.WebGLRenderTarget(16, 9, {type:t === 8 ? THREE.UnsignedByteType : THREE.HalfFloatType,
        format:THREE.RGBAFormat, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, depthBuffer:false, generateMipmaps:false});
        filmPrep.texture.colorSpace = THREE.NoColorSpace; showU.uPrep.value = filmPrep.texture; prepDirty = true; }},
    seq(name){ const e = encounters[name]; return e && e.seq
      ? {cur:e.seq.cur, ready:e.seq.ready, total:e.seq.texs.length, fps:e.seq.fps} : null; }
  };
  /* site.js грузится раньше (module отложен), поэтому сообщаем о готовности */
  dispatchEvent(new Event('ocean:ready'));
}
