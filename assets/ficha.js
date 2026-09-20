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
     más chica, con la fecha del tipo de cambio a la vista. */
  (function pesos() {
    var tc = CFG.tipo_cambio;
    if (!tc || !tc.valor) return;
    var fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
    var fecha = String(tc.fecha).split('-').reverse().join('/');
    [].forEach.call(document.querySelectorAll('.precio-ars[data-usd]'), function (el) {
      var usd = parseInt(el.getAttribute('data-usd'), 10);
      if (!usd) return;
      el.textContent = '≈ $ ' + fmt.format(usd * tc.valor) +
        ' · referencia orientativa al ' + fecha + ' (' + tc.fuente + ')';
      el.hidden = false;
    });
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

  function ir(i) {
    var destino = slides[Math.max(0, Math.min(total - 1, i))];
    if (!destino) return;
    track.scrollTo({ left: destino.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
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
