/* Intro "dia de obra" da logo SBJ.
   Roteiro:
   1. Fundo azul, uma linha de chão se estende e o guindaste se ergue.
   2. A lança se estende e o guindaste leva cargas de tijolos pela obra, da direita pra
      esquerda, enquanto todos os prédios sobem juntos, fiada a fiada, de baixo pra cima.
   3. O guindaste sai de cena e a cidade, que estava grande, encolhe até o tamanho da logo.
   4. Os tijolos viram o traço amarelo, o arco se desenha, SBJ sobe e entra o texto.
   5. O fundo azul esmaece e a logo voa até a logo da barra lateral do site.
   Este script precisa rodar logo depois da div #intro (início do body): o relógio da
   animação (CSS) e dos tijolos (JS) só ficam em sincronia se começarem juntos.
   Dados (vetor e tijolos): js/intro-data.js, gerado por dev/gerar-intro.py.
   Roda uma vez por sessão; ?intro na URL força rodar de novo. */
(function () {
  var el = document.getElementById('intro');
  var D = window.SBJ_INTRO;
  if (!el || !D) { if (el) el.remove(); document.documentElement.classList.add('intro-done'); return; }

  var KEY = 'sbjIntroVisto';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    if (sessionStorage.getItem(KEY) && location.search.indexOf('intro') < 0) { el.remove(); document.documentElement.classList.add('intro-done'); return; }
    sessionStorage.setItem(KEY, '1');
  } catch (e) {}

  var NS = 'http://www.w3.org/2000/svg';
  var LIGHT = '#E8F6F7';                 /* letras e texto no fundo azul */
  var CR = '#9FD6DD', CR_SOLID = '#CFEFF2';          /* guindaste */
  var MORTAR = '#9C8E00';
  var BRICK = [['#FFF25E', '#EBD600'], ['#FBEB3A', '#E4CE00'], ['#F6E41C', '#DCC700']];
  var T0 = 650, GAP = 210;               /* ms: 1ª entrega do guindaste e intervalo entre entregas */
  var BR0 = 500, STEP = 38;              /* ms: início dos tijolos e intervalo entre fiadas */
  var CRANE_SCALE = 0.7, HX = 455;       /* escala do guindaste e posição inicial do carrinho */

  function mk(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---- agrupa os tijolos por prédio (da esquerda pra direita: 0..4) */
  function group(b) {
    var cx = b[0] + b[2] / 2;
    return cx < 150 ? 0 : cx < 205 ? 1 : cx < 300 ? 2 : cx < 370 ? 3 : 4;
  }
  var sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
  D.bricks.forEach(function (b) { var k = group(b); sum[k] += b[0] + b[2] / 2; cnt[k]++; });
  /* entregas: da direita (perto da torre) pra esquerda */
  var stops = [4, 3, 2, 1, 0].map(function (k, j) {
    var cx = sum[k] / cnt[k];
    return { cluster: k, t: T0 + j * GAP, x: 500 + (cx - 500) / CRANE_SCALE };
  });

  /* ---- guindaste (coordenadas locais; o grupo é reduzido em CRANE_SCALE) */
  function crane() {
    var yt = 60, yb = 70, i, tw = '', jb = '';
    for (i = 0; i < 23; i++) {
      var y1 = 396 - i * 14.6, y2 = y1 - 14.6;
      tw += 'M' + (i % 2 ? 504 : 488) + ',' + y1 + 'L' + (i % 2 ? 488 : 504) + ',' + y2;
    }
    for (i = 0; i < 49; i++) {
      var x1 = -90 + i * 12.6, x2 = x1 + 12.6;
      jb += 'M' + x1 + ',' + (i % 2 ? yt : yb) + 'L' + x2 + ',' + (i % 2 ? yb : yt);
    }
    var pallet = '';
    [[445,224,10],[455,224,10],[450,230.6,10],[445,230.6,5],[460,230.6,5]].forEach(function (b) {
      pallet += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="6.6" rx=".6" fill="#F6E41C" stroke="' + MORTAR + '" stroke-width=".7"/>';
    });
    return '<g mask="url(#intro-m-crane)"><g class="i-crane" transform="translate(500 396) scale(' + CRANE_SCALE + ') translate(-500 -396)" fill="none" stroke="' + CR + '" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="i-tower">' +
        '<path d="' + tw + '" stroke-width="1.1"/>' +
        '<path d="M488,396V' + yt + 'M504,396V' + yt + 'M496,' + yt + 'V' + (yt - 34) + '" stroke-width="2"/>' +
        '<rect x="478" y="396" width="34" height="6" rx="1" fill="' + CR_SOLID + '" stroke="none"/>' +
        '<rect x="473" y="' + (yb + 2) + '" width="15" height="12" rx="2" fill="#F6E41C" stroke="#9C8E00" stroke-width="1"/>' +
        '<rect x="512" y="' + (yb + 1) + '" width="14" height="15" rx="1.5" fill="' + CR_SOLID + '" stroke="none"/>' +
      '</g>' +
      '<g class="i-jib">' +
        '<path d="' + jb + '" stroke-width="1.1"/>' +
        '<path d="M-90,' + yt + 'H526M-90,' + yb + 'H526" stroke-width="2"/>' +
        '<path d="M496,' + (yt - 34) + 'L-40,' + yt + 'M496,' + (yt - 34) + 'L524,' + yt + '" stroke-width="1"/>' +
      '</g>' +
      '<g class="i-hoistwrap"><g class="i-hoist">' +
        '<rect x="449" y="' + (yb - 1) + '" width="12" height="6" rx="1" fill="' + CR_SOLID + '" stroke="none"/>' +
        '<rect class="i-cable" x="454.55" y="' + (yb + 5) + '" width=".9" height="' + (209 - yb - 5) + '" fill="' + CR_SOLID + '" stroke="none"/>' +
        '<g class="i-load">' +
          '<rect x="452" y="209" width="6" height="5" rx="1" fill="' + CR_SOLID + '" stroke="none"/>' +
          '<path d="M455,214L445,224M455,214L465,224" stroke-width=".8"/>' + pallet +
          '<rect x="443" y="237" width="24" height="2.5" fill="' + CR_SOLID + '" stroke="none"/>' +
        '</g>' +
      '</g></g>' +
    '</g></g>';
  }

  function maskRise(id, cls) {
    return '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="510" height="444">' +
           '<rect class="i-rise ' + cls + '" x="0" y="90" width="510" height="190" fill="#fff"/></mask>';
  }

  var P = D.paths;
  el.innerHTML =
    '<svg class="intro-logo" viewBox="0 0 510 444" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' + BRICK.map(function (c, i) {
        return '<linearGradient id="intro-clay' + i + '" x1="0" y1="0" x2="0" y2="1">' +
               '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>';
      }).join('') +
      '<mask id="intro-m-crane" maskUnits="userSpaceOnUse" x="-100" y="0" width="760" height="444">' +
        '<rect class="i-erge" x="-100" y="10" width="760" height="394" fill="#fff"/></mask>' +
      '<mask id="intro-m-arc" maskUnits="userSpaceOnUse" x="0" y="0" width="510" height="444">' +
        '<circle class="i-arc-mask" cx="255.5" cy="250" r="244" fill="none" stroke="#fff" stroke-width="44" pathLength="100" transform="rotate(140 255.5 250)"/></mask>' +
      maskRise('intro-m-s', 's') + maskRise('intro-m-b', 'b') + maskRise('intro-m-j', 'j') +
      '</defs>' +
      '<g class="i-city">' +
        '<path class="i-ground" d="M-600,396.5H1110" stroke="' + CR + '" stroke-opacity=".4" stroke-width="1.2" fill="none"/>' +
        crane() +
        '<g id="intro-bricks"></g>' +
        '<path class="i-bld" fill="' + D.yellow + '" fill-rule="evenodd" d="' + P.bld + '"/>' +
      '</g>' +
      '<g mask="url(#intro-m-arc)"><path fill="' + D.yellow + '" fill-rule="evenodd" d="' + P.arc + '"/></g>' +
      '<g fill="' + LIGHT + '" fill-rule="evenodd">' +
        '<g mask="url(#intro-m-s)"><path d="' + P.s + '"/></g>' +
        '<g mask="url(#intro-m-b)"><path d="' + P.b + '"/></g>' +
        '<g mask="url(#intro-m-j)"><path d="' + P.j + '"/></g>' +
        '<path class="i-tag" d="' + P.tag + '"/>' +
      '</g>' +
    '</svg>' +
    '<button type="button" class="intro-skip">Pular</button>';

  /* ---- tijolos: [x, y, largura, altura] em coordenadas da logo (510x444) */
  var g = el.querySelector('#intro-bricks');
  D.bricks.forEach(function (b, i) {
    var course = Math.round((D.base - b[1] - D.ch) / D.ch);
    var r = mk('rect', {
      x: b[0], y: b[1], width: b[2], height: b[3], rx: 0.6,
      fill: 'url(#intro-clay' + ((i * 7 + course * 3) % 3) + ')',
      stroke: MORTAR, 'stroke-width': 0.8
    });
    r.style.animationDelay = (BR0 + course * STEP + ((i * 37) % 40)) + 'ms';
    g.appendChild(r);
  });

  /* ---- o carrinho percorre as entregas; a carga desce, solta e uma nova sobe */
  if (!reduce && el.animate) {
    var tS = 500, tE = stops[stops.length - 1].t + 350, dur = tE - tS;
    var off = function (t) { return Math.min(1, Math.max(0, (t - tS) / dur)); };
    var RAISE = -54, kx = [{ offset: 0, transform: 'translateX(0px)', easing: 'ease-in-out' }],
        kc = [{ offset: 0, transform: 'scaleY(.6)' }],
        kl = [{ offset: 0, transform: 'translateY(' + RAISE + 'px)', opacity: 1 }];
    stops.forEach(function (s) {
      kx.push({ offset: off(s.t), transform: 'translateX(' + (s.x - HX) + 'px)', easing: 'ease-in-out' });
      kc.push({ offset: off(s.t - 70), transform: 'scaleY(.6)' }, { offset: off(s.t), transform: 'scaleY(1)' },
              { offset: off(s.t + 70), transform: 'scaleY(.6)' });
      kl.push({ offset: off(s.t - 70), transform: 'translateY(' + RAISE + 'px)', opacity: 1 },
              { offset: off(s.t), transform: 'translateY(0px)', opacity: 1 },
              { offset: off(s.t + 35), transform: 'translateY(-4px)', opacity: 0 },
              { offset: off(s.t + 85), transform: 'translateY(-30px)', opacity: 0 },
              { offset: off(s.t + 130), transform: 'translateY(' + RAISE + 'px)', opacity: 1 });
    });
    /* a Web Animations exige offsets em ordem crescente */
    var mono = function (k) {
      for (var i = 1; i < k.length; i++) if (k[i].offset < k[i - 1].offset) k[i].offset = k[i - 1].offset;
      return k;
    };
    var opt = { delay: tS, duration: dur, fill: 'both' };
    try {            /* um erro aqui nunca pode travar o fim da intro */
      el.querySelector('.i-hoist').animate(mono(kx), opt);
      el.querySelector('.i-cable').animate(mono(kc), opt);
      el.querySelector('.i-load').animate(mono(kl), opt);
    } catch (e) { /* o guindaste fica parado, o resto segue */ }
  }

  var done = false;
  function remove() { if (el.parentNode) el.remove(); document.documentElement.classList.add('intro-done'); }

  /* a logo voa até a logo da barra lateral (se ela estiver visível); senão, só esmaece */
  function fly() {
    var img = document.querySelector('.brand-logo img');
    var svg = el.querySelector('.intro-logo');
    if (!img || !svg || !svg.animate || !img.offsetParent) return false;
    var r = img.getBoundingClientRect();
    if (r.width < 20 || r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) return false;
    var ar = 510 / 444, cw = r.width, ch = r.height;       /* área que a logo ocupa dentro da imagem (object-fit: contain) */
    if (cw / ch > ar) cw = ch * ar; else ch = cw / ar;
    var s = svg.getBoundingClientRect();
    var dx = (r.left + r.width / 2) - (s.left + s.width / 2);
    var dy = (r.top + r.height / 2) - (s.top + s.height / 2);
    var prev = img.style.visibility;
    img.style.visibility = 'hidden';                        /* a imagem real aparece quando a logo chega */
    el.classList.add('fly');
    var landed = false;
    function land() {
      if (landed) return; landed = true;
      img.style.visibility = prev;
      el.classList.add('out-fast');
      setTimeout(remove, 300);
    }
    var a = svg.animate([{ transform: 'none' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (cw / s.width) + ')' }],
      { duration: 500, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' });
    a.onfinish = land;
    setTimeout(land, 700);
    return true;
  }

  function finish(fast) {
    if (done) return; done = true;
    if (fast) { el.classList.add('out-fast'); setTimeout(remove, 300); return; }
    if (!fly()) { el.classList.add('out'); setTimeout(remove, 500); }
  }
  el.addEventListener('click', function () { finish(true); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      finish(true); document.removeEventListener('keydown', onKey);
    }
  });
  setTimeout(function () { finish(false); }, reduce ? 900 : 2800);
})();
