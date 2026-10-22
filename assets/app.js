(function () {
  'use strict';
  /* La clase .js la agrega el bloque de movimiento (al final del archivo),
     después de marcar lo que ya está en pantalla: así nada parpadea. */

  /* ============================================================
     CONFIGURACIÓN
     ------------------------------------------------------------
     El número de WhatsApp y el nombre de la marca NO se escriben
     acá: salen de web/assets/config.js, que es la fuente única y
     lo que también lee el build. Para cambiarlos, tocá ese archivo
     y corré `node scripts/build-web.js`.

     ENDPOINT   → URL /exec de la Google Apps Script Web App que
                  guarda las consultas en la planilla. Mientras esté
                  vacío, el formulario funciona igual pero solo arma
                  el resumen para mandar por WhatsApp.
                  Ver: docs/formulario-a-google-sheets.md
     ============================================================ */
  var CFG = window.SITE_CONFIG || { marca: {}, contacto: {} };
  var WA_NUMERO = CFG.contacto.whatsapp || '';
  var MARCA = CFG.marca.nombre || '';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxZNxVGSWmm0DtqWFFXwyzXbJR0Z8nOJqW36bodxo-Lh2mPxuyAorEe09701FuDhKSb/exec';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat('es-AR');
  var nav = document.querySelector('.nav');
  var navH = function () { return nav ? nav.offsetHeight : 64; };

  /* ============ NAV: menú móvil ============ */
  var navToggle = $('navToggle');
  var navLinks = $('navLinks');
  function cerrarMenu() {
    if (!navLinks) return;
    navLinks.classList.remove('open');
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Abrir menú');
    }
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
  }

  /* ============ Scroll suave para todos los links internos ============ */
  function irA(target, push) {
    var el = target === 'top' ? null : document.getElementById(target);
    var y = el ? (el.getBoundingClientRect().top + window.scrollY - navH() - 12) : 0;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    if (push) {
      try { history.pushState(null, '', el ? '#' + target : location.pathname); } catch (e) {}
    }
    if (el) {
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }

  [].forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    var href = a.getAttribute('href');
    if (href === '#' || a.hasAttribute('data-instagram')) return;
    a.addEventListener('click', function (e) {
      var id = href.slice(1);
      if (id !== 'top' && !document.getElementById(id)) return;
      e.preventDefault();
      cerrarMenu();
      irA(id === 'top' ? 'top' : id, true);
    });
  });

  /* El borde de la nav al scrollear vive en el loop único de movimiento
     (al final del archivo): un solo requestAnimationFrame para todo. */

  /* El link activo del nav ya viene marcado desde el build con
     class="active" y aria-current="page": ahora que el sitio tiene
     varias páginas, no hace falta calcularlo por scroll. */

  /* La aparición progresiva vive en el bloque de movimiento, al final. */

  /* ============ Calculadora de comisión ============ */
  var slider = $('precio');
  var out = $('precioOut');
  var rP = $('rPrecio'), rC = $('rCom'), rN = $('rNeto');

  function tween(el, to, prefix) {
    if (!el) return;
    if (reduce) { el.textContent = prefix + fmt.format(to); return; }
    var from = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10);
    if (isNaN(from) || from === to) { el.textContent = prefix + fmt.format(to); return; }
    if (el._raf) cancelAnimationFrame(el._raf);
    if (el._fin) clearTimeout(el._fin);
    var t0 = performance.now(), dur = 220;

    /* Red de seguridad: si el navegador suprime requestAnimationFrame
       (pestaña en segundo plano, modo de bajo consumo), la animación no
       avanza y quedaría un número viejo que no coincide con el slider.
       Mostrar mal la comisión es peor que no animarla. */
    el._fin = setTimeout(function () {
      el.textContent = prefix + fmt.format(to);
      if (el._raf) cancelAnimationFrame(el._raf);
    }, dur + 80);

    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + fmt.format(Math.round(from + (to - from) * e));
      if (t < 1) el._raf = requestAnimationFrame(step);
      else clearTimeout(el._fin);
    })(t0);
  }

  function calc() {
    var p = parseInt(slider.value, 10);
    var c = Math.round(p * ((CFG.comision_pct || 4) / 100));
    tween(out, p, '');
    tween(rP, p, 'US$ ');
    tween(rC, c, 'US$ ');
    tween(rN, p - c, 'US$ ');
  }
  if (slider) {
    slider.addEventListener('input', calc);
    calc();
  }

  var bE = $('btnEsencial'), bI = $('btnIntegral');
  var rowCargo = $('rowCargo'), calcFoot = $('calcFoot');
  var planSel = $('plan');
  var FOOT_E = 'El comprador te paga a vos el total. La comisión se liquida una vez concretada la transferencia. En el Plan Esencial los trámites y la gestoría los hacés y los pagás vos.';
  var FOOT_I = 'El comprador te paga a vos el total. La comisión se liquida una vez concretada la transferencia. El Cargo de Gestión Integral se presupuesta según tu vehículo y queda cerrado antes de firmar.';

  function setPlan(integral) {
    if (bE) bE.setAttribute('aria-pressed', String(!integral));
    if (bI) bI.setAttribute('aria-pressed', String(integral));
    if (rowCargo) rowCargo.hidden = !integral;
    if (calcFoot) calcFoot.textContent = integral ? FOOT_I : FOOT_E;
    if (planSel && !planSel.value) {
      planSel.value = integral
        ? 'Plan Integral — venta + todos los trámites'
        : 'Plan Esencial — solo la venta';
    }
  }
  if (bE) bE.addEventListener('click', function () { setPlan(false); });
  if (bI) bI.addEventListener('click', function () { setPlan(true); });

  [].forEach.call(document.querySelectorAll('[data-plan]'), function (a) {
    a.addEventListener('click', function () {
      var v = a.getAttribute('data-plan');
      if (planSel) planSel.value = v;
      setPlan(v.indexOf('Integral') !== -1);
    });
  });

  /* ============ Tasación rápida del hero → precarga el formulario ============ */
  var tasaCard = $('tasaCard');
  if (tasaCard) {
    tasaCard.addEventListener('submit', function (e) {
      e.preventDefault();
      [['h-marca', 'marca'], ['h-modelo', 'modelo'], ['h-anio', 'anio']].forEach(function (par) {
        var src = $(par[0]), dst = $(par[1]);
        if (src && dst && src.value.trim()) dst.value = src.value.trim();
      });
      irA('tasacion', true);
      setTimeout(function () {
        var k = $('km');
        if (k) k.focus({ preventScroll: true });
      }, reduce ? 0 : 480);
    });
  }

  /* ============ Formulario ============ */
  var form = $('form');
  if (!form) return;

  var ver = $('veredicto');
  var res = $('resumen');
  var resTxt = $('resumenTxt');
  var resumenMsg = $('resumenMsg');
  var wa = $('waLink');
  var submitBtn = $('submitBtn');
  /* El veredicto y el resumen cambian sin recargar: se anuncian. */
  if (ver) { ver.setAttribute('role', 'status'); ver.setAttribute('aria-live', 'polite'); }
  if (resumenMsg) resumenMsg.setAttribute('aria-live', 'polite');

  var LABELS = {
    nombre: 'Nombre', whatsapp: 'WhatsApp', email: 'Email',
    plan: 'Plan de interés', canal: 'Nos conoció por',
    marca: 'Marca', modelo: 'Modelo y versión', anio: 'Año', km: 'Kilometraje',
    combustible: 'Combustible', transmision: 'Transmisión', estado: 'Estado general', dueno: 'Dueños',
    vtv: 'VTV', multas: 'Multas', patentes: 'Patentes', titular: 'Titularidad', prenda: 'Prenda', dominio: 'Dominio',
    pretendido: 'Precio pretendido (USD)', tiempo: 'Tiempo intentando vender', urgencia: 'Urgencia',
    localidad: 'Localidad', comentarios: 'Comentarios'
  };
  var REQUERIDOS = ['marca', 'modelo', 'anio', 'km', 'dominio', 'pretendido', 'localidad', 'nombre', 'whatsapp', 'plan', 'canal'];

  function esMailValido(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  /* Dominio: se limpia todo lo que no sea letra o número y se compara
     contra los dos formatos argentinos vigentes —el viejo ABC123 y el
     Mercosur AB123CD—. Un dominio mal tipeado no sirve para pedir el
     informe, así que conviene frenarlo acá y no dos días después. */
  function normalizarDominio(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function esDominioValido(v) {
    return /^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$/.test(normalizarDominio(v));
  }

  function validarCampo(id) {
    var el = $(id);
    if (!el) return true;
    var val = (el.value || '').trim();
    var ok = true;
    if (REQUERIDOS.indexOf(id) !== -1 && !val) ok = false;
    if (id === 'email' && val && !esMailValido(val)) ok = false;
    if (id === 'dominio' && val && !esDominioValido(val)) ok = false;
    el.classList.toggle('invalid', !ok);
    return ok;
  }

  REQUERIDOS.concat(['email']).forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('blur', function () { validarCampo(id); });
    el.addEventListener('input', function () { if (el.classList.contains('invalid')) validarCampo(id); });
  });

  /* Al salir del campo, el dominio queda normalizado: así llega igual a la
     planilla escriba quien escriba, con guiones, espacios o en minúscula. */
  var domEl = $('dominio');
  if (domEl) {
    domEl.addEventListener('blur', function () {
      var limpio = normalizarDominio(domEl.value);
      if (limpio) domEl.value = limpio;
    });
  }

  function armarResumen(veredictoTxt) {
    var lineas = ['CONSULTA DE CONSIGNACIÓN — ' + MARCA, ''];
    Object.keys(LABELS).forEach(function (id) {
      var el = $(id);
      if (el && (el.value || '').trim()) lineas.push(LABELS[id] + ': ' + el.value.trim());
    });
    if (veredictoTxt) lineas.push('', 'Precalificación: ' + veredictoTxt);
    return lineas.join('\n');
  }

  function recolectar(veredictoTxt) {
    var data = {};
    Object.keys(LABELS).forEach(function (id) {
      var el = $(id);
      if (el) data[id] = (el.value || '').trim();
    });
    data.veredicto = veredictoTxt || '';
    data.origen = location.href;
    var hp = $('website');
    data.website = hp ? hp.value : '';
    return data;
  }

  function enviarAlServidor(data) {
    if (!ENDPOINT) return Promise.reject('sin-endpoint');
    var params = new URLSearchParams();
    Object.keys(data).forEach(function (k) { params.append(k, data[k]); });
    return fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: params });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var hp = $('website');
    if (hp && hp.value) return; // honeypot

    var faltan = [];
    REQUERIDOS.forEach(function (id) {
      if (!validarCampo(id)) {
        var val = ($(id).value || '').trim();
        /* Si el campo tiene algo pero no valida, el problema es el formato,
           no que falte: decirlo cambia qué hace la persona. */
        faltan.push(LABELS[id] + (id === 'dominio' && val ? ' (formato: ABC123 o AB123CD)' : ''));
      }
    });
    if ($('email') && $('email').value.trim() && !validarCampo('email')) faltan.push('Email (formato)');

    if (faltan.length) {
      ver.className = 'show rev';
      /* "Revisá" y no "Falta completar": ahora un campo puede fallar por
         formato estando lleno, y el encabezado tiene que cubrir los dos casos. */
      ver.innerHTML = '<b>Revisá ' + faltan.length + ' campo' + (faltan.length > 1 ? 's' : '') + '</b>' + faltan.join(' · ');
      var primerError = form.querySelector('.invalid');
      if (primerError) {
        var y = primerError.getBoundingClientRect().top + window.scrollY - navH() - 24;
        window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
        primerError.focus({ preventScroll: true });
      }
      return;
    }

    /* Sin requisitos de año, km ni precio desde el 21/09/2026 (confirmado
       por Nacho el 22/10/2026): cada auto se mira caso por caso. El campo
       `veredicto` se sigue mandando a la planilla para no correr columnas,
       pero ya no evalúa nada; el resumen de WhatsApp no lo lleva. */
    var veredictoTxt = 'Se revisa caso por caso';
    ver.className = 'show ok';
    ver.innerHTML = '<b>Lo revisamos caso por caso</b>Te contactamos dentro de las 24 horas hábiles para coordinar la tasación sin cargo.';

    var texto = armarResumen('');
    var data = recolectar(veredictoTxt);

    resTxt.textContent = texto;
    wa.href = 'https://wa.me/' + WA_NUMERO + '?text=' + encodeURIComponent(texto);

    if (submitBtn) {
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
      submitBtn.querySelector('.btn-label').textContent = 'Enviando…';
    }

    function terminar(guardado) {
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-label').textContent = 'Enviar y pedir tasación';
      }
      if (resumenMsg) {
        resumenMsg.textContent = guardado
          ? 'Registramos tu consulta y te vamos a responder dentro de las 24 horas hábiles. Si querés que lo veamos hoy mismo, mandanos el resumen por WhatsApp.'
          : 'Copiá el resumen o mandánoslo por WhatsApp y lo revisamos hoy mismo.';
      }
      res.className = 'show';
      var y = res.getBoundingClientRect().top + window.scrollY - navH() - 24;
      window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    }

    enviarAlServidor(data).then(function () { terminar(true); }, function () { terminar(false); });
  });

  var copyBtn = $('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var btn = this;
      var done = function (msg) {
        btn.textContent = msg;
        setTimeout(function () { btn.textContent = 'Copiar resumen'; }, 1800);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(resTxt.textContent).then(function () { done('Copiado'); }, function () { done('No se pudo copiar'); });
      } else {
        done('No se pudo copiar');
      }
    });
  }
})();

/* ============================================================
   PRECARGA DESDE EL COTIZADOR DE LA PORTADA
   ------------------------------------------------------------
   La tarjeta del hero de index.html no calcula ningún precio:
   hace GET a consigna-tu-auto.html con `vehiculo`, `anio` y `km`
   y esta función los vuelca en el formulario largo, así la
   persona no reescribe lo que ya tipeó.

   `vehiculo` viene como un solo texto ("Ford Focus 1.6 S") y el
   formulario tiene marca y modelo separados: se parte en el
   primer espacio. Es una heurística, no una base de datos —
   marcas de dos palabras (Alfa Romeo, Land Rover, Mercedes
   Benz) se contemplan a mano abajo.

   Sin JS el formulario sigue funcionando: los campos quedan
   vacíos y la persona los completa, que es el comportamiento
   que había antes de esto.
   ============================================================ */
(function precargaDesdeCotizador() {
  var form = document.getElementById('marca');
  if (!form) return;                       // no estamos en consigna-tu-auto
  var q;
  try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
  if (!q || !q.toString()) return;

  var DOS_PALABRAS = ['alfa romeo', 'land rover', 'mercedes benz', 'mercedes-benz', 'great wall'];

  function poner(id, valor) {
    var el = document.getElementById(id);
    if (!el || !valor) return;
    el.value = String(valor).trim();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  var vehiculo = (q.get('vehiculo') || '').trim().replace(/\s+/g, ' ');
  if (vehiculo) {
    var bajo = vehiculo.toLowerCase();
    var corte = vehiculo.indexOf(' ');
    for (var i = 0; i < DOS_PALABRAS.length; i++) {
      if (bajo.indexOf(DOS_PALABRAS[i]) === 0) {
        corte = DOS_PALABRAS[i].length;
        break;
      }
    }
    if (corte > 0) {
      poner('marca', vehiculo.slice(0, corte));
      poner('modelo', vehiculo.slice(corte));
    } else {
      poner('marca', vehiculo);
    }
  }
  poner('anio', q.get('anio'));
  poner('km', q.get('km'));

  /* Llevar el foco al primer campo vacío que quedó, no al tope
     de la página: la persona ya empezó a completar. */
  var pendiente = document.getElementById('modelo');
  if (pendiente && !pendiente.value) pendiente.focus({ preventScroll: true });
})();

/* ============================================================
   MOVIMIENTO
   ------------------------------------------------------------
   Técnica de referencias/hiagentik-referencia.html con la paleta
   de Zolva: reveals que solo ocultan lo que todavía no se vio, un
   solo requestAnimationFrame para todo lo que depende del scroll,
   la línea de los pasos, el rodillo del 4 %, los niveles de los
   planes, copiar, la pausa del fondo y el estado del cotizador.
   Con prefers-reduced-motion todo queda visible y quieto.
   ============================================================ */
(function movimiento() {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hayIO = 'IntersectionObserver' in window;
  var EASE_OUT = 'cubic-bezier(.23,1,.32,1)';
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v) { return Math.min(1, Math.max(0, v)); };

  function enPantalla(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }
  function alVer(els, fn, umbral) {
    if (!hayIO) { els.forEach(fn); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } });
    }, { threshold: umbral || 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---- Reveals ------------------------------------------------
     Lo que ya está en pantalla se marca ANTES de poner .js: se ve
     de entrada y no parpadea. Lo demás entra con 70 ms entre
     hermanos. Terminada la entrada se saca el atributo y el
     elemento recupera sus propias transiciones (hover, bordes). */
  /* Páginas fijas: el mismo sistema de entradas sin tocar su HTML.
     Las legales (su h1 no lleva .split) quedan quietas a propósito. */
  if (document.querySelector('.pag-head h1.split')) {
    $$('main > section .sec-head, main .prosa > h2, main .prosa > h3, main .prosa > p, main .prosa > ul,' +
      ' main .prosa > ol, main .prosa > .dato, main .faq > details, main .form-aside, main .tabla-wrap,' +
      ' main .accesos-grid > a, main .contacto-datos > div, main .aside-wa').forEach(function (el) {
      if (!el.hasAttribute('data-reveal') && !(el.parentNode && el.parentNode.closest('[data-reveal]'))) {
        el.setAttribute('data-reveal', '');
      }
    });
  }
  var reveals = $$('[data-reveal]');
  var soltar = function (el) { el.removeAttribute('data-reveal'); };
  reveals.forEach(function (el) { if (reduce || enPantalla(el)) el.classList.add('in'); });
  root.classList.add('js');
  reveals.forEach(function (el) { if (el.classList.contains('in')) soltar(el); });
  /* Escalonado: los que entran en la misma tanda del observer salen con
     70 ms entre uno y otro (tope 6). El --d que trae el build se respeta. */
  var tanda = 0, tandaT = null;
  alVer(reveals.filter(function (el) { return !el.classList.contains('in'); }), function (el) {
    if (!el.style.getPropertyValue('--d')) {
      el.style.setProperty('--d', String(Math.min(tanda++, 6)));
      clearTimeout(tandaT);
      tandaT = setTimeout(function () { tanda = 0; }, 50);
    }
    el.classList.add('in');
    var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
    setTimeout(function () { soltar(el); }, 900 + d * 70);
  });

  /* ---- La línea de los pasos ----------------------------------
     k = cuánto del bloque ya pasó por el 72 % de la pantalla. Cada
     paso enciende al llegar su turno y llena su tramo (--sp). */
  var pasos = $$('[data-steps]');
  if (reduce) pasos.forEach(function (ol) { ol.classList.add('resuelto'); });
  function pasosFrame() {
    var vh = window.innerHeight;
    pasos.forEach(function (ol) {
      var r = ol.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var k = clamp((vh * 0.72 - r.top) / (r.height * 0.85));
      var items = ol.children, n = items.length;
      for (var i = 0; i < n; i++) {
        var sp = clamp(k * n - i).toFixed(3);
        if (items[i]._sp !== sp) { items[i]._sp = sp; items[i].style.setProperty('--sp', sp); }
        items[i].classList.toggle('lit', k > i / n + 0.02);
      }
    });
  }

  /* ---- El circuito de la plata (Cómo funciona) ----------------
     Escena pegajosa ligada al scroll. Filas = movimientos de plata;
     columnas = comprador, dueño y Zolva. La seña y el saldo van del
     comprador al dueño (Zolva solo verifica el comprobante) y recién
     al final la comisión va del dueño a Zolva. Sin horas ni plazos.
     Con movimiento reducido no se activa: queda el esquema quieto y
     resuelto, con los pasos en una lista. */
  var circuitoFrame = null;
  (function () {
    var sec = document.getElementById('circuito');
    if (!sec || reduce) return;
    var pista = sec.querySelector('.plata-pista'), stage = sec.querySelector('.plata-stage');
    var filas = $$('.plata-fila', sec), cap = sec.querySelector('.plata-cap');
    var saltear = sec.querySelector('.plata-saltear'), lista = sec.querySelector('.plata-pasos');
    var textos = $$('.plata-pasos li', sec).map(function (li) { return li.textContent; });
    if (!pista || !stage || !cap || !saltear || !lista || !filas.length || textos.length < 4) return;
    sec.classList.add('vivo');
    lista.classList.add('sr-only');
    saltear.hidden = false;
    var TRAMOS = [[0.08, 0.26, 0.30], [0.38, 0.56, 0.60], [0.68, 0.86, 2]];
    var CAPS = [[0, 0], [0.30, 1], [0.38, 0], [0.60, 1], [0.68, 2], [0.90, 3]];
    var suave = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var capAct = 0, tok = 0;
    cap.textContent = textos[0];
    function ponerCap(i) {
      if (i === capAct) return;
      capAct = i;
      var t = ++tok;
      cap.classList.add('swap');
      setTimeout(function () { if (t !== tok) return; cap.textContent = textos[i]; cap.classList.remove('swap'); }, 200);
    }
    var navEl = document.querySelector('.nav');
    function medida() {
      return {
        navH: navEl ? navEl.offsetHeight : 0,
        span: Math.max(1, pista.offsetHeight - stage.offsetHeight),
        top: pista.getBoundingClientRect().top,
        alto: pista.offsetHeight
      };
    }
    circuitoFrame = function () {
      var m = medida();
      if (m.top > window.innerHeight + 100 || m.top + m.alto < -100) return;
      var p = clamp((m.navH - m.top) / m.span);
      var W = filas[0].clientWidth;
      var anchos = filas.map(function (f) { return f.querySelector('.ficha').offsetWidth; });
      filas.forEach(function (f, i) {
        var tr = TRAMOS[i], ficha = f.querySelector('.ficha'), ok = f.querySelector('.plata-ok');
        var de = +f.getAttribute('data-de'), a = +f.getAttribute('data-a');
        var x0 = W * (de * 2 + 1) / 6 - anchos[i] / 2, x1 = W * (a * 2 + 1) / 6 - anchos[i] / 2;
        var q = clamp((p - tr[0]) / (tr[1] - tr[0]));
        ficha.style.transform = 'translateX(' + (x0 + (x1 - x0) * suave(q)).toFixed(1) + 'px)';
        f.classList.toggle('llego', q >= 1);
        if (ok) ok.classList.toggle('on', p >= tr[2]);
      });
      var k = 0;
      CAPS.forEach(function (c) { if (p >= c[0]) k = c[1]; });
      ponerCap(k);
      saltear.classList.toggle('gone', p >= 0.92);
    };
    saltear.addEventListener('click', function () {
      var m = medida();
      var destino = m.top + window.scrollY - m.navH + m.span * 0.96, y0 = window.scrollY;
      window.scrollTo({ top: destino, behavior: 'smooth' });
      setTimeout(function () { if (Math.abs(window.scrollY - y0) < 4) window.scrollTo(0, destino); }, 900);
    });
  })();

  /* ---- Un solo rAF para todo lo que depende del scroll -------- */
  var nav = document.querySelector('.nav');
  var pedido = false;
  function frame() {
    pedido = false;
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 8);
    if (!reduce && pasos.length) pasosFrame();
    if (circuitoFrame) circuitoFrame();
  }
  function alScroll() { if (!pedido) { pedido = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', alScroll, { passive: true });
  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(alScroll, 120); });
  window.addEventListener('load', alScroll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alScroll);
  frame();

  /* ---- Rodillo de dígitos (el 4 %) ----------------------------
     Los dígitos suben de a uno, con desenfoque; el recuadro no
     cambia de ancho. No cuenta desde 0. */
  var rodillos = $$('.roll');
  rodillos.forEach(function (el) {
    var txt = el.textContent.trim();
    el.innerHTML = txt.split('').map(function (c) {
      return '<span class="rd" aria-hidden="true"><i>' + c + '</i></span>';
    }).join('') + '<span class="sr-only">' + txt + '</span>';
  });
  var rodar = function (el) {
    el.classList.add('rodo');
    if (reduce || !el.animate) return;
    $$('.rd > i', el).forEach(function (d, k) {
      d.animate([
        { transform: 'translateY(70%)', opacity: 0, filter: 'blur(4px)' },
        { transform: 'none', opacity: 1, filter: 'blur(0)' }
      ], { duration: 560, delay: 120 + k * 60, easing: EASE_OUT, fill: 'backwards' });
    });
  };
  if (reduce) rodillos.forEach(rodar); else alVer(rodillos, rodar, 0.6);

  /* ---- Niveles de los planes: se encienden de a uno ----------- */
  $$('.lights').forEach(function (l) {
    var n = parseInt(l.getAttribute('data-lit'), 10) || 0;
    var luces = $$('span', l).slice(0, n);
    var prender = function () {
      luces.forEach(function (s, i) {
        if (reduce) s.classList.add('lit');
        else setTimeout(function () { s.classList.add('lit'); }, 250 + i * 220);
      });
    };
    if (reduce) prender(); else alVer([l], prender, 0.6);
  });

  /* ---- Copiar WhatsApp y mail ---------------------------------
     Si el portapapeles falla (http, permisos), selecciona el dato
     para que se copie a mano. El aviso va por aria-live. */
  var aviso = document.getElementById('copyStatus');
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.copy');
    if (!btn) return;
    var valor = btn.getAttribute('data-copy') || '';
    var vuelta = function () { btn.textContent = 'Copiar'; btn.classList.remove('ok'); };
    var hecho = function () {
      btn.textContent = 'Copiado'; btn.classList.add('ok');
      if (aviso) { aviso.textContent = ''; aviso.textContent = btn.getAttribute('data-aviso') || 'Copiado'; }
      clearTimeout(btn._t); btn._t = setTimeout(vuelta, 1600);
    };
    var seleccionar = function () {
      var el = btn.previousElementSibling;
      if (el) {
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      btn.textContent = 'Seleccionado';
      clearTimeout(btn._t); btn._t = setTimeout(vuelta, 1600);
    };
    try { navigator.clipboard.writeText(valor).then(hecho, seleccionar); } catch (err) { seleccionar(); }
  });

  /* ---- Pausa del fondo del hero -------------------------------
     Los brillos derivan más de 5 s: se pueden frenar, y se frenan
     solos fuera de pantalla o con la pestaña oculta. */
  $$('.hero').forEach(function (h) {
    var fx = h.querySelector('.fx'), btn = h.querySelector('.fx-pausa');
    if (!fx || !btn || reduce) return;
    btn.hidden = false;
    var manual = false, fuera = false;
    var aplicar = function () { fx.classList.toggle('pausado', manual || fuera || document.hidden); };
    btn.addEventListener('click', function () {
      manual = !manual;
      btn.setAttribute('aria-pressed', String(manual));
      btn.querySelector('.fx-pausa-t').textContent = manual ? 'Reanudar movimiento' : 'Pausar movimiento';
      aplicar();
    });
    if (hayIO) new IntersectionObserver(function (es) { fuera = !es[0].isIntersecting; aplicar(); }).observe(h);
    document.addEventListener('visibilitychange', aplicar);
  });

  /* ---- Cotizador del hero: estado mientras abre el formulario --
     El envío no cambia: sigue siendo un GET a consigna-tu-auto. */
  $$('form.tasa-card').forEach(function (f) {
    var b = f.querySelector('button[type=submit]');
    var l = b && b.querySelector('.btn-label');
    if (!l) return;
    var txt = l.textContent;
    f.addEventListener('submit', function () {
      b.classList.add('loading'); b.setAttribute('aria-busy', 'true');
      l.textContent = 'Abriendo el formulario…';
    });
    window.addEventListener('pageshow', function () {
      b.classList.remove('loading'); b.removeAttribute('aria-busy'); l.textContent = txt;
    });
  });
})();
