/* ============================================================
   АССИСТЕНТ «Спросить океанариум» — ЭКСПЕРИМЕНТ
   Отвечает ТОЛЬКО по подтверждённым данным с oceanorenburg.ru
   (сверено 2026-09-22). Чего нет в базе — честно говорит «не знаю»
   и даёт телефон. Никакой генерации, никаких ключей во фронтенде.

   Архитектура на вырост:
     KB        — база фактов (её же потом отдаём бэкенду как контекст);
     retrieve  — поиск подходящих записей по вопросу;
     providers — local (сейчас) и remote (заготовка: POST на свой
                 сервер, который уже сам ходит в LLM с ключом).
   Включить удалённый режим: до загрузки страницы задать
     window.OCEAN_ASSISTANT = { endpoint: '/api/assistant' }
   Ответ сервера: { html?: string, text?: string }. При ошибке —
   молча откатываемся на локальную базу.
   ============================================================ */
(function(){
'use strict';

const PHONE = '<a href="tel:+73532323642">+7 (3532) 32-36-42</a>';
const TOURS_PHONE = '<a href="tel:+79871991600">+7 (987) 199-16-00</a>';
const TICKET_URL = 'https://oceanorenburg.ru/informacziya-dlya-posetitelej/#information';
const NO_INFO = `<p>У меня нет точной информации об этом. Позвоните в океанариум: ${PHONE} — там подскажут.</p>`;

/* ——— время Оренбурга (UTC+5) ——— */
function orenMin(){
  const p = {};
  new Intl.DateTimeFormat('ru-RU', {timeZone:'Asia/Yekaterinburg', hour:'numeric', minute:'numeric', hourCycle:'h23'})
    .formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  return (+p.hour) * 60 + (+p.minute);
}
const FEEDS = ['11:00', '15:00', '19:00'];
function nextFeed(){
  const m = orenMin();
  for (const t of FEEDS){ const [h, mm] = t.split(':').map(Number); if (h*60 + mm + 20 >= m) return 'Ближайшее — сегодня в ' + t + '.'; }
  return 'Сегодня кормлений больше нет, следующее — завтра в 11:00.';
}
function openNow(){
  const m = orenMin();
  return m >= 600 && m < 1290 ? 'Сейчас открыто, вход и касса — до 21:30.' : 'Сейчас закрыто, откроемся в 10:00.';
}

/* ——— база знаний ———————————————————————————————————————
   keys: основы слов (сравниваются с началом слов вопроса) или фразы.
   w — вес темы: узкие темы важнее общих («экскурсия» важнее «цена»). */
const KB = [
  { id:'prices', w:1, title:'Билеты и цены',
    keys:['билет','цен','стоим','стоит','сколько','прайс','тариф','взросл','детск','семейн'],
    html:() => `<p>Цены (будни / выходные и праздники):</p>
      <ul><li>Взрослый, от 12 лет — <b>1000 / 1300 ₽</b></li>
      <li>Детский, до 11 лет включительно — <b>800 / 1100 ₽</b></li>
      <li>Семейный 2+2 — <b>3000 / 4000 ₽</b>, только в кассе</li></ul>
      <p>Дети до 3 лет — бесплатно. <a href="${TICKET_URL}" target="_blank" rel="noopener">Купить билет</a></p>` },
  { id:'online', w:2, title:'Покупка онлайн',
    keys:['онлайн','оплат','qr','кьюар','турникет','на сайте','купит','купить билет'],
    html:() => `<p>Да, билеты можно купить онлайн. После оплаты на почту придут QR-коды по числу и типу билетов —
      их сканируют на турникете, с экрана телефона или распечатанными.</p>
      <p><a href="${TICKET_URL}" target="_blank" rel="noopener">Купить билет</a></p>` },
  { id:'hours', w:2, title:'Режим работы',
    keys:['режим','работает','работаете','часы','открыт','закрыт','до скольки','во сколько открыва','без выходных','график'],
    html:() => `<p>Ежедневно с <b>10:00 до 22:00</b>, без выходных. Вход и касса — до 21:30.</p><p>${openNow()}</p>` },
  { id:'where', w:2, title:'Где мы находимся',
    keys:['где','адрес','находит','добрат','доехат','проехат','пройти','мармелад','маршрут','карт','как найти'],
    html:() => `<p>Оренбург, <b>Шарлыкское шоссе, 1/2</b>, мегамолл «Мармелад», вход №5.</p>
      <p><a href="https://yandex.ru/maps/?text=%D0%9E%D1%80%D0%B5%D0%BD%D0%B1%D1%83%D1%80%D0%B3%2C%20%D0%A8%D0%B0%D1%80%D0%BB%D1%8B%D0%BA%D1%81%D0%BA%D0%BE%D0%B5%20%D1%88%D0%BE%D1%81%D1%81%D0%B5%2C%201%2F2" target="_blank" rel="noopener">Построить маршрут</a></p>` },
  { id:'tours', w:3, title:'Экскурсии',
    keys:['экскурс','экскурсовод','гид'],
    html:() => `<p>Экскурсия идёт 30–40 минут по главным экспозициям: пингвины Гумбольдта, кубинские крокодилы, акулы, скаты, тропические рыбы.
      Индивидуальные и групповые, по предварительной записи.</p>
      <ul><li>1–5 человек — 2000 ₽</li><li>6–10 — 3000 ₽</li><li>11–20 — 4000 ₽</li><li>от 21 — 5000 ₽</li></ul>
      <p>Цена за группу, входные билеты оплачиваются отдельно. Записаться: ${TOURS_PHONE}</p>` },
  { id:'groups', w:3, title:'Групповые посещения',
    keys:['групп','школ','класс','детский сад','садик','организован','коллектив'],
    html:() => `<p>Групповые билеты (будни / выходные): детский <b>750 / 950 ₽</b>, взрослый <b>950 / 1150 ₽</b>.
      На каждые 10 детей один сопровождающий проходит бесплатно. Нужна предварительная заявка.</p>
      <p><a href="https://oceanorenburg.ru/gruppovye-poseshheniya/" target="_blank" rel="noopener">Оставить заявку</a></p>` },
  { id:'feed', w:3, title:'Кормления',
    keys:['корм','покорм','кормят','кормлен'],
    html:() => `<p>Кормление пингвинов — ежедневно в <b>11:00, 15:00 и 19:00</b>. ${nextFeed()}</p>
      <p>Рыб, акул и крокодилов тоже кормят по расписанию, но его на сайте нет — уточните в кассе или по телефону ${PHONE}.</p>` },
  { id:'perks', w:3, title:'Льготы',
    keys:['льгот','скидк','пенсион','многодет','инвалид','овз','сво','именинн','день рожден','коляск','бесплатн'],
    html:() => `<ul><li>Бесплатно — дети до 3 лет и посетители на инвалидной коляске.</li>
      <li>Дети с ОВЗ — 400 ₽.</li>
      <li>Многодетным, пенсионерам, инвалидам, участникам СВО и их семьям: детский 700 / 1000 ₽, взрослый 900 / 1200 ₽ (будни / выходные), в кассе.</li>
      <li>Именинникам — скидка 30% в день рождения, за 3 дня до и 3 дня после.</li></ul>
      <p>Нужны подтверждающие документы. Скидки не суммируются.</p>` },
  { id:'kids', w:2, title:'Дети',
    keys:['без взросл','одни','самостоятельн','подрост','возраст','с какого'],
    html:() => `<p>Дети младше 14 лет проходят только с совершеннолетним сопровождающим. Дети до 3 лет — бесплатно.</p>` },
  { id:'photo', w:3, title:'Фото',
    keys:['фото','сним','съемк','съёмк','камер','вспышк','видео'],
    html:() => `<p>Да, любительская фото- и видеосъёмка разрешена — без вспышки.</p>` },
  { id:'refund', w:3, title:'Возврат',
    keys:['возврат','вернут','верну','отмен'],
    html:() => `<p>Билеты, купленные онлайн, возвращаются через <a href="https://oceanorenburg.ru/vozvrat-biletov/" target="_blank" rel="noopener">форму возврата</a>:
      код из билета, почта или телефон с покупки, выбор неиспользованных билетов. Деньги вернутся на карту оплаты.</p>` },
  { id:'mail', w:3, title:'Билеты не пришли',
    keys:['не пришл','не пришел','не приш','почт','email','e-mail','ящик','неправильн'],
    html:() => `<p>Напишите в сообщения группы ВКонтакте, на <a href="mailto:info@oceanorenburg.ru">info@oceanorenburg.ru</a> или позвоните ${PHONE}.
      Приложите банковский чек по операции и правильный адрес почты.</p>` },
  { id:'valid', w:3, title:'Срок действия',
    keys:['срок','действ','сгора','перенест','другой день'],
    html:() => `<p>Билет действует полгода со дня покупки. Билет на будний день в выходные и праздники не действует.</p>` },
  { id:'animals', w:2, title:'Обитатели',
    keys:['обитател','животн','рыб','акул','пингвин','крокодил','скат','капибар','варан','арапайм','аксолотл','амбистом','кто живет','кто живёт','живет','живут','виды'],
    html:() => `<p>Более 3000 морских и пресноводных обитателей. Среди них — рифовые акулы, пингвины Гумбольдта, кубинские крокодилы,
      вараны Сальватора, капибара, платиновые скаты-альбиносы, арапаймы, арованы, цихлиды, фловер хорны,
      а с августа — астронотусы Чили Ред и мексиканские амбистомы (аксолотли).</p>` },
  { id:'size', w:2, title:'Об океанариуме',
    keys:['площад','размер','первый','о вас','об океанариум'],
    html:() => `<p>Первый океанариум на Южном Урале и крупнейший в ПФО: более 2500 м² и более 3000 обитателей.</p>` },
  { id:'shop', w:3, title:'Сувениры',
    keys:['сувенир','магазин','игрушк','магнит','подар'],
    html:() => `<p>В океанариуме есть магазин сувениров: игрушки, магниты, одежда с символикой океанариума.</p>` },
  { id:'contacts', w:2, title:'Контакты',
    keys:['телефон','позвон','связат','контакт','номер','вконтакт','телеграм'],
    html:() => `<p>Телефон ${PHONE}, почта <a href="mailto:info@oceanorenburg.ru">info@oceanorenburg.ru</a>.
      Экскурсии: ${TOURS_PHONE}. Мы в <a href="https://t.me/oceanorenburg" target="_blank" rel="noopener">Telegram</a>
      и <a href="https://vk.ru/club237518294" target="_blank" rel="noopener">ВКонтакте</a>.</p>` },
  { id:'hello', w:1, title:'Привет',
    keys:['привет','здравств','добрый день','добрый вечер','доброе утро'],
    html:() => `<p>Здравствуйте! Спросите про билеты, режим работы, кормления, экскурсии или как нас найти.</p>` },
  { id:'thanks', w:1, title:'Спасибо',
    keys:['спасиб','благодар'],
    html:() => `<p>Пожалуйста! Ждём вас в океанариуме.</p>` }
];

/* ——— поиск по базе ———————————————————————————————————— */
const norm = s => ' ' + s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9+\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
function retrieve(q, n){
  const t = norm(q);
  const words = t.trim().split(' ');
  const scored = KB.map(e => {
    let hits = 0;
    for (const k0 of e.keys){
      const k = norm(k0).trim();
      if (k.includes(' ') ? t.includes(' ' + k) : words.some(w => w.startsWith(k))) hits++;
    }
    return {e, score: hits ? hits * e.w : 0};
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, n || 1);
}

/* ——— провайдеры —————————————————————————————————————— */
const local = {
  async ask(q){
    const top = retrieve(q, 2);
    if (!top.length) return {html: NO_INFO, src:null};
    /* если две темы почти равны (напр. «сколько стоит экскурсия для группы») — отвечаем обеими */
    const parts = [top[0]];
    if (top[1] && top[1].score >= top[0].score * 0.8 && top[1].e.id !== 'hello') parts.push(top[1]);
    return {html: parts.map(p => p.e.html()).join(''), src: parts.map(p => p.e.title).join(' · ')};
  }
};
function remote(endpoint){
  return {
    async ask(q, history){
      const ctx = retrieve(q, 3).map(x => ({id:x.e.id, title:x.e.title, text:x.e.html().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}));
      const r = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({question:q, history, context:ctx, rules:'Отвечай только по context. Нет ответа — скажи, что точной информации нет, и дай телефон +7 (3532) 32-36-42.'})});
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
      return {html: j.html || ('<p>' + esc(j.text || '') + '</p>'), src:'сервер'};
    }
  };
}
const cfg = window.OCEAN_ASSISTANT || {};
const provider = cfg.endpoint ? remote(cfg.endpoint) : local;

/* ——— интерфейс ——————————————————————————————————————— */
const CHIPS = ['Билеты и цены', 'Режим работы', 'Где вы находитесь?', 'Какие есть экскурсии?', 'Кормления', 'Льготы'];
const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 12.5a8 8 0 1 1 3.1 6.3L4 20l1-3.3A7.9 7.9 0 0 1 4 12.5Z"/><path d="M8.5 12.6c1.1-1.3 2.2-1.3 3.3 0s2.2 1.3 3.3 0"/></svg>`;

const btn = document.createElement('button');
btn.className = 'asst-btn';
btn.type = 'button';
btn.setAttribute('aria-haspopup', 'dialog');
btn.innerHTML = ICON + '<span>Спросить океанариум</span>';
btn.setAttribute('aria-label', 'Спросить океанариум');

const box = document.createElement('section');
box.className = 'asst';
box.setAttribute('role', 'dialog');
box.setAttribute('aria-label', 'Помощник океанариума');
box.innerHTML = `
  <header class="asst-h">
    <div><b>Океанариум</b><small>Помощник</small></div>
    <button class="asst-x" type="button" aria-label="Закрыть">✕</button>
  </header>
  <div class="asst-log" aria-live="polite">
    <p class="asst-hi">Чем помочь?</p>
    <p class="asst-sub">Отвечаю по данным сайта океанариума: цены, режим, кормления, экскурсии.</p>
    <div class="asst-chips">${CHIPS.map(c => `<button type="button">${c}</button>`).join('')}</div>
  </div>
  <form class="asst-f" autocomplete="off">
    <input type="text" name="q" placeholder="Ваш вопрос" aria-label="Ваш вопрос" maxlength="300">
    <button type="submit" aria-label="Отправить">→</button>
  </form>
  <p class="asst-note">Экспериментальная функция. Если нужного ответа нет — звоните ${PHONE}.</p>`;
btn.dataset.glass = '14'; btn.dataset.frost = '4';
box.dataset.glass = '22'; box.dataset.frost = '10'; box.dataset.refr = '18';
document.body.append(btn, box);
dispatchEvent(new Event('glass:refresh'));

const log = box.querySelector('.asst-log'), form = box.querySelector('form'), input = form.q;
const history = [];

function add(cls, html, text){
  const m = document.createElement('div');
  m.className = 'msg ' + cls;
  if (text != null) m.textContent = text; else m.innerHTML = html;
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
  return m;
}
async function ask(q){
  q = q.trim(); if (!q) return;
  add('me', null, q);
  history.push({role:'user', text:q});
  let a;
  try { a = await provider.ask(q, history.slice(-6)); }
  catch(e){ a = await local.ask(q); }
  const m = add('bot', a.html);
  if (a.src){
    const s = document.createElement('span'); s.className = 'src';
    s.textContent = 'Источник: oceanorenburg.ru · ' + a.src;
    m.appendChild(s);
  }
  history.push({role:'assistant', text:m.textContent});
}

function open(){
  box.classList.add('open'); btn.classList.add('hide');
  btn.setAttribute('aria-expanded', 'true');
  setTimeout(() => input.focus({preventScroll:true}), 250);
}
function close(){
  box.classList.remove('open'); btn.classList.remove('hide');
  btn.setAttribute('aria-expanded', 'false');
  btn.focus({preventScroll:true});
}
btn.addEventListener('click', open);
box.querySelector('.asst-x').addEventListener('click', close);
addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
box.querySelectorAll('.asst-chips button').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
form.addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });

/* Кнопка не спорит с акулой: пока идёт её ролик, прячется. */
const deep = document.getElementById('ch-deep');
if (deep){
  new IntersectionObserver(es => {
    const on = es.some(e => e.isIntersecting && e.intersectionRatio > 0.18);
    btn.classList.toggle('hide', on || box.classList.contains('open'));
  }, {threshold:[0, .18, .4]}).observe(deep);
}

window.__assistant = { ask, retrieve: q => retrieve(q, 3).map(x => x.e.id + ':' + x.score), open, close };
})();
