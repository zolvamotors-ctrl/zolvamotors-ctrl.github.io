/* ============================================================
   config.js — FUENTE ÚNICA DE VERDAD
   ------------------------------------------------------------
   Marca, dominio, contacto y parámetros del sitio. Nada de esto
   se escribe a mano en el HTML: `scripts/build-web.js` lee este
   archivo y lo inyecta al generar las páginas, y el navegador lo
   carga para los cálculos del lado del cliente.

   Si cambia el nombre comercial, se cambia ACÁ y se corre:
       node scripts/build-web.js

   Este archivo se lee de dos maneras a la vez:
     · en el navegador  → define la global SITE_CONFIG
     · en Node (build)  → module.exports al final del archivo
   Por eso está escrito en ES5 y sin import/export.
   ============================================================ */

var SITE_CONFIG = {

  /* ---- Marca -------------------------------------------------
     PENDIENTE: nombre no confirmado (falta INPI + dominio).
     `inicial` es la letra del monograma del logo.             */
  marca: {
    nombre:   'Zolva',
    inicial:  'Z',
    tagline:  'Consignación digital',
    // Descripción corta, se usa en el footer y en las meta tags.
    bajada:   'Vos seguís usando el auto; nosotros nos ocupamos de venderlo. Consignación de autos usados.'
  },

  /* ---- Dominio y URLs ---------------------------------------
     `url` sin barra final. Se usa en canonical, Open Graph y
     sitemap.xml. Mientras sea placeholder, no publicar.       */
  dominio: 'zolvamotors.netlify.app',
  url:     'https://zolvamotors.netlify.app',

  /* ---- Contacto ---------------------------------------------
     Los campos vacíos NO se renderizan (nada de links a "#"):
     dejalos en '' hasta que existan de verdad.                */
  contacto: {
    /* El mail operativo de la marca. NO es el personal de Nacho: es el
       que se publica y al que llegan los avisos del formulario (ver
       formulario/Codigo.gs → NOTIF_EMAIL). Si se vacía, deja de
       renderizarse en /contacto.html, en el pie y en /privacidad.html. */
    whatsapp:          '5491140499479',
    whatsapp_visible:  '+54 9 11 4049 9479',
    email:             'zolvamotors@gmail.com',
    instagram_url:     '',
    instagram_usuario: '',
    zona:              'AMBA — Zona Norte del Gran Buenos Aires',
    // Vacío a propósito: todavía no hay horario fijo de atención. Mientras
    // esté así, la fila "Horarios" no se renderiza en /contacto.html.
    // Cuando lo definas, escribilo acá y vuelve sola.
    horarios:          '',
    respuesta:         'Respondemos dentro de las 24 horas hábiles.'
  },

  /* ---- Condiciones comerciales ------------------------------
     Estos números salen del contrato. Cambiarlos acá cambia
     todos los textos generados; no los toques sin revisar
     `docs/validacion-legal.md`.                               */
  comision_pct:  5,
  exclusividad:  '30 días corridos',

  /* ---- Referencia en pesos ----------------------------------
     Los precios del catálogo son en USD. Esto se usa SOLO para
     mostrar una referencia orientativa, más chica, bajo el
     precio en dólares, y siempre con la fecha a la vista.     */
  tipo_cambio: {
    valor:  1450,
    fecha:  '2026-08-31',
    fuente: 'dólar MEP'
  },

  /* ---- Criterios de admisión de vehículos -------------------
     El build avisa por consola si un auto del JSON no los
     cumple. No los relaja: los reporta.                       */
  criterios: {
    anio_min:       2013,
    km_max:         150000,
    precio_min_usd: 7000
  },

  /* ---- Umbrales del catálogo --------------------------------
     min_filtros → con menos autos disponibles que esto, la barra
                   de filtros no se muestra.
     min_seo     → con menos publicaciones que esto, no se genera
                   el bloque de enlaces SEO por marca/localidad.
     vendidos_portada → cuántos vendidos entran en el carrusel. */
  catalogo: {
    min_filtros:      8,
    min_seo:          20,
    vendidos_portada: 6
  }
};

if (typeof module !== 'undefined' && module.exports) { module.exports = SITE_CONFIG; }
