(function () {
  'use strict';

  /* ============================================================
     catalogo.js — filtrado del catálogo, del lado del cliente
     ------------------------------------------------------------
     Solo se carga en la portada y solo cuando hay suficientes
     autos como para que filtrar tenga sentido (el umbral está en
     config.js → catalogo.min_filtros).

     El HTML ya trae la grilla completa renderizada por el build:
     sin JavaScript el catálogo se ve y se navega igual. Esto
     agrega filtrado, orden y URL compartible, nada más.
     ============================================================ */

  var datosEl = document.getElementById('datosCatalogo');
  var grilla = document.getElementById('grilla');
  var barra = document.getElementById('filtros');
  var form = document.getElementById('filtrosForm');
  if (!datosEl || !grilla || !barra || !form) return;

  var AUTOS;
  try { AUTOS = JSON.parse(datosEl.textContent); } catch (e) { return; }
  if (!AUTOS.length) return;

  var CFG = window.SITE_CONFIG || {};
  var cuenta = document.getElementById('cuenta');
  var sinRes = document.getElementById('sinResultados');
  var orden = document.getElementById('orden');
  var btnAbrir = document.getElementById('filtrosAbrir');
  var btnLimpiar = document.getElementById('filtrosLimpiar');
  var elCuenta = document.getElementById('filtrosCuenta');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* La barra existe solo con JS: sin JS no habría cómo aplicarla. */
  barra.hidden = false;

  var miles = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var sinAcentos = function (s) {
    return String(s).normalize
      ? String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      : String(s).toLowerCase();
  };

  /* ============ definición de los filtros ============
     Cada uno sabe leerse del form, escribirse en la URL y decidir
     si un auto pasa. Agregar un filtro es agregar una entrada. */
  var FILTROS = [
    { k: 'q', el: 'f-q', etiqueta: 'la búsqueda por texto', pasa: function (a, v) {
        var t = sinAcentos(a.marca + ' ' + a.modelo + ' ' + a.version);
        return sinAcentos(v).split(/\s+/).every(function (p) { return t.indexOf(p) !== -1; });
      } },
    { k: 'marca', el: 'f-marca', etiqueta: 'la marca', pasa: function (a, v) { return a.marca === v; } },
    { k: 'precio_min', el: 'f-precio-min', num: true, etiqueta: 'el precio mínimo', pasa: function (a, v) { return a.precio_usd >= v; } },
    { k: 'precio_max', el: 'f-precio-max', num: true, etiqueta: 'el precio máximo', pasa: function (a, v) { return a.precio_usd <= v; } },
    { k: 'anio_min', el: 'f-anio-min', num: true, etiqueta: 'el año desde', pasa: function (a, v) { return a.anio >= v; } },
    { k: 'anio_max', el: 'f-anio-max', num: true, etiqueta: 'el año hasta', pasa: function (a, v) { return a.anio <= v; } },
    { k: 'km_max', el: 'f-km', num: true, etiqueta: 'el kilometraje máximo', pasa: function (a, v) { return a.km <= v; } },
    { k: 'transmision', el: 'f-transmision', etiqueta: 'la transmisión', pasa: function (a, v) { return a.transmision === v; } },
    { k: 'combustible', el: 'f-combustible', etiqueta: 'el combustible', pasa: function (a, v) { return a.combustible === v; } },
    { k: 'carroceria', el: 'f-carroceria', etiqueta: 'la carrocería', pasa: function (a, v) { return a.carroceria === v; } },
    { k: 'localidad', el: 'f-localidad', etiqueta: 'la localidad', pasa: function (a, v) { return a.localidad === v; } }
  ];

  var soloEl = document.getElementById('f-solo');

  function leerForm() {
    var estado = { solo: soloEl ? soloEl.checked : true, orden: orden ? orden.value : 'recientes' };
    FILTROS.forEach(function (f) {
      var el = document.getElementById(f.el);
      var v = el ? String(el.value).trim() : '';
      if (v === '') return;
      estado[f.k] = f.num ? Number(v) : v;
      if (f.num && !isFinite(estado[f.k])) delete estado[f.k];
    });
    return estado;
  }

  function escribirForm(estado) {
    FILTROS.forEach(function (f) {
      var el = document.getElementById(f.el);
      if (el) el.value = estado[f.k] != null ? estado[f.k] : '';
    });
    if (soloEl) soloEl.checked = estado.solo !== false;
    if (orden && estado.orden) orden.value = estado.orden;
  }

  function leerUrl() {
    var p = new URLSearchParams(location.search);
    var estado = { solo: p.get('solo') !== '0', orden: p.get('orden') || 'recientes' };
    FILTROS.forEach(function (f) {
      var v = p.get(f.k);
      if (v == null || v === '') return;
      estado[f.k] = f.num ? Number(v) : v;
      if (f.num && !isFinite(estado[f.k])) delete estado[f.k];
    });
    return estado;
  }

  function escribirUrl(estado) {
    var p = new URLSearchParams();
    FILTROS.forEach(function (f) { if (estado[f.k] != null) p.set(f.k, estado[f.k]); });
    if (estado.solo === false) p.set('solo', '0');
    if (estado.orden && estado.orden !== 'recientes') p.set('orden', estado.orden);
    var q = p.toString();
    try {
      history.replaceState(null, '', q ? location.pathname + '?' + q : location.pathname);
    } catch (e) { /* file:// no deja tocar la URL; el filtrado funciona igual */ }
  }

  /* ============ filtrado y orden ============ */
  function filtrar(estado, saltear) {
    return AUTOS.filter(function (a) {
      if (estado.solo !== false && a.estado !== 'disponible') return false;
      return FILTROS.every(function (f) {
        if (f.k === saltear) return true;
        return estado[f.k] == null || f.pasa(a, estado[f.k]);
      });
    });
  }

  var ORDENES = {
    'recientes': function (a, b) {
      return (b.destacado - a.destacado) || String(b.fecha_publicacion).localeCompare(String(a.fecha_publicacion));
    },
    'precio-asc': function (a, b) { return a.precio_usd - b.precio_usd; },
    'precio-desc': function (a, b) { return b.precio_usd - a.precio_usd; },
    'km-asc': function (a, b) { return a.km - b.km; }
  };

  /* ============ render ============
     Mismo marcado que genera build-web.js, para que la grilla no
     cambie de forma cuando el JS toma el control. */
  function tarjeta(a, i) {
    var badge = a.estado === 'disponible' ? '' :
      '<span class="badge badge-' + a.estado + '">' + (a.estado === 'vendido' ? 'Vendido' : 'Reservado') + '</span>';
    var datos = [a.anio, miles(a.km) + ' km', a.transmision, a.localidad]
      .map(function (d) { return '<span>' + esc(d) + '</span>'; })
      .join('<i aria-hidden="true">·</i>');

    return '<article class="auto" data-codigo="' + a.codigo + '">' +
      '<a class="auto-link" href="' + a.url + '" aria-label="Ver ficha de ' + esc(a.nombre) + '">' +
        '<div class="auto-foto">' + badge +
          '<img src="' + a.foto.replace(/^\//, '') + '" alt="' + esc(a.nombre) + '" width="800" height="600"' +
          (i < 4 ? '' : ' loading="lazy"') + ' decoding="async">' +
        '</div>' +
        '<div class="auto-cuerpo">' +
          '<p class="auto-marca">' + esc(a.marca) + '</p>' +
          '<h3 class="auto-modelo">' + esc(a.modelo) + ' <span>' + esc(a.version) + '</span></h3>' +
          '<p class="auto-precio"><span class="cur">US$</span> ' + miles(a.precio_usd) + '</p>' +
          '<p class="auto-datos mono">' + datos + '</p>' +
        '</div>' +
      '</a></article>';
  }

  /* Cuál de los filtros activos es el que más achica la búsqueda:
     se prueba sacando uno por vez y se mira cuál devuelve más. */
  function masRestrictivo(estado) {
    var mejor = null, mejorN = 0;
    FILTROS.forEach(function (f) {
      if (estado[f.k] == null) return;
      var n = filtrar(estado, f.k).length;
      if (n > mejorN) { mejorN = n; mejor = f; }
    });
    return mejor && mejorN > 0 ? { filtro: mejor, n: mejorN } : null;
  }

  function pintar(estado) {
    var res = filtrar(estado).sort(ORDENES[estado.orden] || ORDENES.recientes);

    if (cuenta) cuenta.textContent = res.length + (res.length === 1 ? ' auto' : ' autos');
    if (elCuenta) {
      var activos = FILTROS.filter(function (f) { return estado[f.k] != null; }).length;
      elCuenta.hidden = activos === 0;
      elCuenta.textContent = activos ? '· ' + activos : '';
    }

    if (res.length) {
      grilla.innerHTML = res.map(tarjeta).join('');
      grilla.hidden = false;
      if (sinRes) sinRes.hidden = true;
    } else {
      grilla.innerHTML = '';
      grilla.hidden = true;
      if (sinRes) {
        var pista = masRestrictivo(estado);
        sinRes.hidden = false;
        sinRes.innerHTML = '<b>Ningún auto coincide con esa búsqueda</b>' +
          (pista
            ? 'Si soltás ' + pista.filtro.etiqueta + ' aparecen ' + pista.n +
              (pista.n === 1 ? ' auto' : ' autos') + '.'
            : 'Probá con menos filtros.') +
          '<br><button type="button" class="btn btn-ghost" data-limpiar>Limpiar filtros</button>';
      }
    }
    escribirUrl(estado);
  }

  function aplicar() { pintar(leerForm()); }

  /* ============ eventos ============ */
  form.addEventListener('submit', function (e) { e.preventDefault(); aplicar(); cerrarPanel(); });
  form.addEventListener('change', function (e) {
    if (e.target.type === 'search' || e.target.type === 'number') return; // esos van por input
    if (!esMobile()) aplicar();
  });

  var reloj = null;
  form.addEventListener('input', function (e) {
    if (e.target.type !== 'search' && e.target.type !== 'number') return;
    if (esMobile()) return;
    clearTimeout(reloj);
    reloj = setTimeout(aplicar, 220);
  });

  if (orden) orden.addEventListener('change', aplicar);

  function limpiar() {
    escribirForm({ solo: true, orden: orden ? orden.value : 'recientes' });
    aplicar();
  }
  if (btnLimpiar) btnLimpiar.addEventListener('click', function () { limpiar(); cerrarPanel(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-limpiar]')) limpiar();
  });

  /* ---- panel de filtros en mobile ---- */
  function esMobile() { return window.matchMedia('(max-width:900px)').matches; }
  function cerrarPanel() {
    if (!esMobile()) return;
    form.classList.remove('abierto');
    document.body.style.overflow = '';
    if (btnAbrir) { btnAbrir.setAttribute('aria-expanded', 'false'); btnAbrir.focus(); }
  }
  if (btnAbrir) {
    btnAbrir.addEventListener('click', function () {
      var abierto = form.classList.toggle('abierto');
      btnAbrir.setAttribute('aria-expanded', String(abierto));
      document.body.style.overflow = abierto ? 'hidden' : '';
      if (abierto) {
        var primero = document.getElementById('f-q');
        if (primero && !reduce) primero.focus({ preventScroll: true });
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && form.classList.contains('abierto')) cerrarPanel();
  });

  /* ============ arranque ============
     Si la URL trae filtros (por ejemplo desde el bloque SEO del pie
     o un link compartido), se aplican. Si no, se deja la grilla que
     ya vino del build y no se repinta nada. */
  var inicial = leerUrl();
  escribirForm(inicial);
  var hayFiltros = FILTROS.some(function (f) { return inicial[f.k] != null; }) ||
    inicial.solo === false || inicial.orden !== 'recientes';
  if (hayFiltros) pintar(inicial);
})();
