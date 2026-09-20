(function () {
  'use strict';
  document.documentElement.classList.add('js');

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

  /* ============ NAV: borde al scrollear · progreso · flotantes ============ */
  var progress = $('progress');
  var waFloat = document.querySelector('.wa-float');
  var toTop = $('toTop');

  function onScroll() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle('scrolled', y > 8);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var r = h > 0 ? y / h : 0;
      progress.style.transform = 'scaleX(' + Math.min(1, Math.max(0, r)) + ')';
    }
    if (waFloat) waFloat.classList.toggle('show', y > 700);
    if (toTop) toTop.classList.toggle('show', y > 1000);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (toTop) toTop.addEventListener('click', function () { irA('top', false); });
  onScroll();

  /* El link activo del nav ya viene marcado desde el build con
     class="active" y aria-current="page": ahora que el sitio tiene
     varias páginas, no hace falta calcularlo por scroll. */

  /* ============ Aparición progresiva ============ */
  var revealables = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revObs.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealables.forEach(function (el) { revObs.observe(el); });
  }

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
    var c = Math.round(p * ((CFG.comision_pct || 5) / 100));
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

    var anio = parseInt($('anio').value, 10);
    var km = parseInt($('km').value, 10);
    var pre = parseInt($('pretendido').value, 10);
    var obs = [];
    if (anio < 2013) obs.push('el año es anterior a 2013');
    if (km > 150000) obs.push('supera los 150.000 km');
    if (pre < 7000) obs.push('el valor está por debajo de US$ 7.000');

    var veredictoTxt;
    if (obs.length) {
      var motivo = obs.length > 1 ? obs.slice(0, -1).join(', ') + ' y ' + obs[obs.length - 1] : obs[0];
      veredictoTxt = 'Fuera del perfil habitual (' + motivo + '). Se revisa caso por caso.';
      ver.className = 'show rev';
      ver.innerHTML = '<b>Lo miramos caso por caso</b>Tu auto queda fuera de nuestro perfil habitual porque ' + motivo + '. Igual lo revisamos y te respondemos: tomamos excepciones cuando la unidad lo justifica.';
    } else {
      veredictoTxt = 'Cumple los tres criterios de admisión.';
      ver.className = 'show ok';
      ver.innerHTML = '<b>Tu auto entra en nuestro perfil</b>Cumple los tres criterios de admisión. Te contactamos dentro de las 24 horas hábiles para coordinar la tasación sin cargo.';
    }

    var texto = armarResumen(veredictoTxt);
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
