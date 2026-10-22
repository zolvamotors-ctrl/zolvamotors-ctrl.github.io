(function () {
  'use strict';

  /* ============================================================
     ficha.js — galería y referencia en pesos de la ficha
     ------------------------------------------------------------
     Sin librerías. La galería ya funciona sin JavaScript: el track
     es un contenedor con scroll horizontal y scroll-snap, y las
     miniaturas son anclas a cada foto. Esto suma contador,
     flechas, teclado y lightbox.
     ============================================================ */

  var CFG = window.SITE_CONFIG || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ referencia en pesos ============
     El catálogo es en dólares. Esto es una referencia orientativa,
     más chica, con la fecha del tipo de cambio a la vista.
     Al abrir la ficha se pide la cotización del dólar blue del día
     (venta) a dolarapi.com. Si no responde en 4 segundos, se usa el
     valor de respaldo de config.js → tipo_cambio. */
  (function pesos() {
    var els = document.querySelectorAll('.precio-ars[data-usd]');
    if (!els.length) return;
    var fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

    function pintar(valor, fechaISO, fuente) {
      if (!valor) return;
      var fecha = String(fechaISO).slice(0, 10).split('-').reverse().join('/');
      [].forEach.call(els, function (el) {
        var usd = parseInt(el.getAttribute('data-usd'), 10);
        if (!usd) return;
        el.textContent = '≈ $ ' + fmt.format(usd * valor) +
          ' · referencia orientativa al ' + fecha + ' (' + fuente + ')';
        el.hidden = false;
      });
    }

    var tc = CFG.tipo_cambio || {};
    var respaldo = function () { pintar(tc.valor, tc.fecha, tc.fuente); };
    if (!window.fetch) return respaldo();

    var listo = false;
    var reloj = setTimeout(function () { if (!listo) { listo = true; respaldo(); } }, 4000);
    fetch('https://dolarapi.com/v1/dolares/blue', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var v = Number(d && d.venta);
        if (!(v > 100)) throw new Error('valor raro');
        clearTimeout(reloj);
        listo = true;
        pintar(v, d.fechaActualizacion || new Date().toISOString(), 'dólar blue');
      })
      .catch(function () { if (!listo) { listo = true; clearTimeout(reloj); respaldo(); } });
  })();

  /* ============ galería ============ */
  var galeria = document.getElementById('galeria');
  var track = document.getElementById('galTrack');
  if (!galeria || !track) return;

  var slides = [].slice.call(track.children);
  var total = slides.length;
  var salidaN = document.getElementById('galN');
  var minis = [].slice.call(galeria.querySelectorAll('.gal-mini'));
  var prev = galeria.querySelector('.gal-prev');
  var next = galeria.querySelector('.gal-next');
  var actual = 0;

  if (total > 1 && prev && next) { prev.hidden = false; next.hidden = false; }

  function marcar(i) {
    actual = Math.max(0, Math.min(total - 1, i));
    if (salidaN) salidaN.textContent = String(actual + 1);
    minis.forEach(function (m, j) {
      m.classList.toggle('activa', j === actual);
      if (j === actual) m.setAttribute('aria-current', 'true');
      else m.removeAttribute('aria-current');
    });
    if (prev) prev.disabled = actual === 0;
    if (next) next.disabled = actual === total - 1;
  }

  /* Flechas, miniaturas y teclado: el desplazamiento usa la curva de
     panel (ease-drawer). El dedo sigue con el scroll nativo y su
     scroll-snap, que conserva la inercia. */
  function bezier(x1, y1, x2, y2) {
    return function (t) {
      var u = t;
      for (var k = 0; k < 8; k++) {
        var x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
        var dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
        if (Math.abs(x) < 1e-4 || !dx) break;
        u = Math.max(0, Math.min(1, u - x / dx));
      }
      return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
    };
  }
  var drawer = bezier(0.32, 0.72, 0, 1);
  var animando = null, cierre = null;
  function deslizar(x) {
    if (animando) cancelAnimationFrame(animando);
    clearTimeout(cierre);
    if (reduce) { track.scrollLeft = x; return; }
    var x0 = track.scrollLeft, t0 = performance.now(), dur = 420;
    var fin = function () { animando = null; track.scrollLeft = x; track.style.scrollSnapType = ''; };
    track.style.scrollSnapType = 'none';
    animando = requestAnimationFrame(function paso(now) {
      var t = Math.min(1, (now - t0) / dur);
      track.scrollLeft = x0 + (x - x0) * drawer(t);
      if (t < 1) animando = requestAnimationFrame(paso); else fin();
    });
    /* Si el navegador frena los frames (pestaña oculta), igual llega. */
    cierre = setTimeout(function () { if (animando) { cancelAnimationFrame(animando); fin(); } }, dur + 150);
  }

  function ir(i) {
    var destino = slides[Math.max(0, Math.min(total - 1, i))];
    if (!destino) return;
    deslizar(destino.offsetLeft - track.offsetLeft);
    marcar(i);
  }

  /* El scroll manda: si el usuario arrastra, el contador lo sigue. */
  var pendiente = null;
  track.addEventListener('scroll', function () {
    if (pendiente) cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(function () {
      var i = Math.round(track.scrollLeft / (track.clientWidth || 1));
      if (i !== actual) marcar(i);
    });
  }, { passive: true });

  if (prev) prev.addEventListener('click', function () { ir(actual - 1); });
  if (next) next.addEventListener('click', function () { ir(actual + 1); });

  minis.forEach(function (m, j) {
    m.addEventListener('click', function (e) { e.preventDefault(); ir(j); });
  });

  /* Flechas del teclado, solo cuando la galería tiene el foco o el
     mouse encima: no le robamos las flechas al resto de la página. */
  var dentro = false;
  galeria.addEventListener('mouseenter', function () { dentro = true; });
  galeria.addEventListener('mouseleave', function () { dentro = false; });
  galeria.addEventListener('focusin', function () { dentro = true; });
  galeria.addEventListener('focusout', function () { dentro = false; });

  document.addEventListener('keydown', function (e) {
    if (!dentro || lightboxAbierto()) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(actual + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual - 1); }
  });

  /* ============ lightbox ============ */
  var dlg = null;

  function lightboxAbierto() { return dlg && dlg.open; }

  function crear() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.innerHTML =
      '<div class="lightbox-in">' +
        '<div class="lightbox-bar">' +
          '<span class="lightbox-cont"><span id="lbN">1</span> / ' + total + '</span>' +
          '<span><button type="button" data-lb="prev" aria-label="Foto anterior">‹</button> ' +
          '<button type="button" data-lb="next" aria-label="Foto siguiente">›</button> ' +
          '<button type="button" data-lb="cerrar" aria-label="Cerrar">Cerrar ✕</button></span>' +
        '</div>' +
        '<img alt="">' +
      '</div>';
    document.body.appendChild(dlg);

    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      if (b) {
        var a = b.getAttribute('data-lb');
        if (a === 'cerrar') cerrar();
        if (a === 'prev') mostrar(actual - 1);
        if (a === 'next') mostrar(actual + 1);
        return;
      }
      if (e.target === dlg || e.target.classList.contains('lightbox-in')) cerrar();
    });

    /* En la vista ampliada se desliza con el dedo: alcanza con un gesto
       rápido aunque sea corto (velocidad > 0,11 px/ms). */
    var lbImg = dlg.querySelector('img'), px = null, pt = 0;
    lbImg.style.touchAction = 'pan-y';
    lbImg.addEventListener('pointerdown', function (e) { px = e.clientX; pt = performance.now(); });
    lbImg.addEventListener('pointerup', function (e) {
      if (px === null) return;
      var dx = e.clientX - px, v = Math.abs(dx) / Math.max(1, performance.now() - pt);
      px = null;
      if (Math.abs(dx) > 50 || (Math.abs(dx) > 12 && v > 0.11)) mostrar(actual + (dx < 0 ? 1 : -1));
    });
    lbImg.addEventListener('pointercancel', function () { px = null; });

    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(actual + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(actual - 1); }
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    });

    /* El Escape nativo del <dialog> dispara "cancel". No dependemos del
       evento "close" —hay motores que no lo emiten al llamar close()—:
       la limpieza vive en cerrar() y esto solo la engancha. */
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });
    return dlg;
  }

  function cerrar() {
    if (dlg && dlg.open) dlg.close();
    document.body.style.overflow = '';
    var img = slides[actual] && slides[actual].querySelector('img');
    if (img) img.focus({ preventScroll: true });
  }

  function mostrar(i) {
    i = Math.max(0, Math.min(total - 1, i));
    var fuente = slides[i].querySelector('img');
    var img = dlg.querySelector('img');
    img.src = fuente.currentSrc || fuente.src;
    img.alt = fuente.alt;
    if (!reduce && img.animate) {
      img.animate([{ opacity: 0.35, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0)' }],
        { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
    var n = dlg.querySelector('#lbN');
    if (n) n.textContent = String(i + 1);
    marcar(i);
    ir(i);
  }

  slides.forEach(function (s, i) {
    var img = s.querySelector('img');
    if (!img) return;
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-haspopup', 'dialog');
    img.setAttribute('aria-label', 'Ampliar foto — ' + img.alt);
    var abrir = function () {
      crear();
      if (typeof dlg.showModal !== 'function') return; // navegador viejo: se queda con la galería
      mostrar(i);
      dlg.showModal();
      document.body.style.overflow = 'hidden';
    };
    img.addEventListener('click', abrir);
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });
  });

  marcar(0);
})();
