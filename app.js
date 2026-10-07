/* Generador de firmas de Novogar.
 *
 * Todo pasa en el navegador: la foto se lee con FileReader, se procesa en un
 * canvas y se mete en la firma como data URI. No se sube nada a ningún lado.
 *
 * La firma se arma con tablas y estilos en línea porque Outlook usa el motor
 * de Word, que ignora flexbox, border-radius y letter-spacing. El nombre y el
 * puesto van como TEXTO sin color propio, para que hereden el del cliente y se
 * lean igual en tema claro y en tema oscuro.
 */

const PILA = "Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Segoe UI', Arial, sans-serif";
const GRIS_SUAVE = '#8A9099';   // legible sobre blanco y sobre negro
const MAIL_DOMINIO = '@novogar.com.ar';
const ULTIMO_PASO = 7;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- utilidades */

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Deja sólo dígitos y arma el tel: internacional.
 *  Los móviles argentinos llevan el 9 después del 54; los fijos, no. */
function enlaceTelefono(numero, esMovil) {
  let d = String(numero).replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (esMovil && d.startsWith('9')) d = d.slice(1);
  d = d.replace(/^0/, '');
  if (esMovil) d = d.replace(/15(?=\d{6,})/, '');
  return 'tel:+54' + (esMovil ? '9' : '') + d;
}

/** nombre.apellido@novogar.com.ar, sin acentos ni partículas intermedias. */
function sugerirMail(nombreCompleto) {
  const limpio = nombreCompleto.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  const partes = limpio.split(' ');
  if (partes.length === 1) return partes[0] + MAIL_DOMINIO;
  return partes.slice(0, -1).join('') + '.' + partes[partes.length - 1] + MAIL_DOMINIO;
}

const mapsLink = (dir) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir + ', Novogar');

function brindis(mensaje) {
  const el = $('#brindis');
  el.textContent = mensaje;
  el.classList.add('visible');
  clearTimeout(brindis._t);
  brindis._t = setTimeout(() => el.classList.remove('visible'), 2800);
}

/** Caja que envuelve lo que quedó visible, para recortar el aire sobrante. */
function cajaVisible(ctx, ancho, alto) {
  const px = ctx.getImageData(0, 0, ancho, alto).data;
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (px[(y * ancho + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: ancho, h: alto } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ------------------------------------------------------------------- la foto */

const foto = {
  imagen: null,
  yaSinFondo: false,  // la foto llegó con transparencia, o sea ya recortada
  ALTO: 126,          // alto final dentro de la firma
  MAX_LADO: 900,      // tope de procesamiento, para no colgar el navegador
};

/** ¿La imagen ya trae transparencia? Si alguien la pasó por remove.bg no hay
 *  que volver a recortarla: cualquier cosa que hagamos sólo puede empeorarla. */
function tieneTransparencia(img) {
  const lado = 220;
  const esc = Math.min(1, lado / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * esc));
  const h = Math.max(1, Math.round(img.height * esc));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let transparentes = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 24) transparentes++;
  // con menos del 3% puede ser sólo una esquina redondeada, no un recorte
  return transparentes / (w * h) > 0.03;
}

/** Procesa la foto y devuelve {src, w, h} lista para la firma. */
function procesarFoto(paraPreview) {
  const img = foto.imagen;
  const escala = Math.min(1, foto.MAX_LADO / Math.max(img.width, img.height));
  const w = Math.round(img.width * escala);
  const h = Math.round(img.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  // si viene recortada, se le saca el aire transparente de alrededor para que
  // la figura ocupe todo el alto disponible
  const caja = foto.yaSinFondo ? cajaVisible(ctx, w, h) : { x: 0, y: 0, w, h };

  // se entrega al doble del tamaño final, para que se vea nítida en retina
  const altoFinal = paraPreview ? 150 : foto.ALTO;
  const factor = (altoFinal * 2) / caja.h;
  const salida = document.createElement('canvas');
  salida.width = Math.round(caja.w * factor);
  salida.height = altoFinal * 2;
  const sctx = salida.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(lienzo, caja.x, caja.y, caja.w, caja.h, 0, 0, salida.width, salida.height);

  return { src: salida.toDataURL('image/png'), w: Math.round(salida.width / 2), h: altoFinal };
}

function dibujarPreview() {
  if (!foto.imagen) return;
  const { src, w } = procesarFoto(true);
  $('#previewFoto').innerHTML =
    `<img src="${src}" alt="Tu foto" style="display:block;height:150px;width:${w}px;" />`;
}

function cargarArchivo(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) {
    brindis('Ese archivo no es una imagen');
    return;
  }
  const lector = new FileReader();
  lector.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      foto.imagen = img;
      foto.yaSinFondo = tieneTransparencia(img);
      $('#yaSinFondo').hidden = !foto.yaSinFondo;
      $('#tieneFondo').hidden = foto.yaSinFondo;
      $('#soltar').hidden = true;
      $('#editor').classList.add('visible');
      dibujarPreview();
    };
    img.onerror = () => brindis('No pude abrir esa imagen');
    img.src = ev.target.result;
  };
  lector.onerror = () => brindis('No pude leer el archivo');
  lector.readAsDataURL(archivo);
}

/* ------------------------------------------------------------ armado de firma */

function filaContacto(icono, contenido, primera) {
  const pad = primera ? 0 : 4;
  return `<tr>
    <td style="padding:${pad}px 9px 0 0;vertical-align:top;line-height:0;"><img src="${icono}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;margin-top:2px;" /></td>
    <td style="padding:${pad}px 0 0 0;vertical-align:top;font-family:${PILA};font-size:13px;line-height:19px;">${contenido}</td>
  </tr>`;
}

const enlace = (texto, href) => `<a href="${href}" style="color:inherit;text-decoration:none;">${escaparHtml(texto)}</a>`;

function construirFirma(d) {
  const ic = ASSETS.iconos;

  let telefonos = enlace(d.celular, enlaceTelefono(d.celular, true));
  if (d.fijo) {
    const interno = d.interno ? `<span style="color:${GRIS_SUAVE};">&nbsp;Int: ${escaparHtml(d.interno)}</span>` : '';
    let href = enlaceTelefono(d.fijo, false);
    if (d.interno) href += ',,' + String(d.interno).replace(/\D/g, '');
    telefonos += `<span style="color:${GRIS_SUAVE};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`
      + `<a href="${href}" style="color:inherit;text-decoration:none;">${escaparHtml(d.fijo)}${interno}</a>`;
  } else if (d.interno) {
    telefonos += `<span style="color:${GRIS_SUAVE};">&nbsp;&nbsp;|&nbsp;&nbsp;Int: ${escaparHtml(d.interno)}</span>`;
  }

  const filas = [
    filaContacto(ic.tel, telefonos, true),
    filaContacto(ic.mail, enlace(d.mail, 'mailto:' + d.mail)),
    d.direccion ? filaContacto(ic.pin, enlace(d.direccion, mapsLink(d.direccion))) : '',
  ].join('');

  const img = d.imagen;
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
  <tr>
    <td style="padding:0 20px 0 0;vertical-align:middle;"><img src="${img.src}" width="${img.w}" height="${img.h}" alt="${escaparHtml(d.nombre)}" style="display:block;width:${img.w}px;height:${img.h}px;border:0;" /></td>
    <td style="padding:0;vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr><td style="padding:0 0 1px 0;font-family:${PILA};font-size:20px;line-height:26px;font-weight:bold;letter-spacing:.2px;">${escaparHtml(d.nombre)}</td></tr>
        <tr><td style="padding:0 0 12px 0;font-family:${PILA};font-size:13.5px;line-height:18px;color:${GRIS_SUAVE};">${escaparHtml(d.puesto)}</td></tr>
        <tr><td style="padding:0;">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${filas}</table>
        </td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

/* ----------------------------------------------------------- navegación */

let pasoActual = 0;

function marcarError(campo, mensaje) {
  const input = document.getElementById(campo);
  const span = document.querySelector(`[data-error="${campo}"]`);
  if (span) span.textContent = mensaje || '';
  if (input) input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  return !mensaje;
}

/** Valida sólo lo que corresponde al paso que se está dejando. */
function pasoValido(paso) {
  switch (paso) {
    case 1:
      return marcarError('nombre', $('#nombre').value.trim().length < 3 ? 'Escribí tu nombre y apellido' : '');
    case 2:
      return marcarError('puesto', $('#puesto').value.trim() ? '' : 'Falta tu puesto');
    case 3:
      return marcarError('mail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('#mail').value.trim()) ? '' : 'Revisá el correo');
    case 4: {
      const v = $('#sucursal').value;
      if (!v) return marcarError('sucursal', 'Elegí una sucursal');
      if (v === 'otra' && !$('#direccion').value.trim()) return marcarError('sucursal', 'Escribí la dirección');
      return marcarError('sucursal', '');
    }
    case 5:
      return marcarError('celular', $('#celular').value.replace(/\D/g, '').length >= 8 ? '' : 'Revisá el celular');
    default:
      return true;
  }
}

function irA(destino) {
  if (destino > pasoActual) {
    for (let p = pasoActual; p < destino; p++) {
      if (!pasoValido(p)) {
        const malo = document.querySelector('[aria-invalid="true"]');
        if (malo) malo.focus();
        return;
      }
    }
  }

  $$('.pantalla').forEach((s) => s.classList.remove('activa'));
  const siguiente = document.querySelector(`.pantalla[data-paso="${destino}"]`);
  siguiente.classList.add('activa');
  pasoActual = destino;

  $('#barraProgreso').style.width = (destino / ULTIMO_PASO * 100) + '%';
  $('#cuentaPasos').textContent = destino === 0 ? ''
    : destino === ULTIMO_PASO ? 'Listo' : `Paso ${destino} de 6`;

  window.scrollTo({ top: 0, behavior: sinMovimiento() ? 'auto' : 'smooth' });
  const primero = siguiente.querySelector('input:not([type=hidden]):not([type=radio]):not([type=file]), select');
  if (primero && destino > 0 && destino < ULTIMO_PASO) {
    setTimeout(() => primero.focus({ preventScroll: true }), sinMovimiento() ? 0 : 320);
  }
}

/* ------------------------------------------------------------- resultado */

let firmaActual = '';

function generar() {
  for (let p = 1; p <= 5; p++) {
    if (!pasoValido(p)) { irA(p); return; }
  }

  const usarFoto = document.querySelector('input[name=imagen]:checked').value === 'foto';
  if (usarFoto && !foto.imagen) {
    brindis('Elegí una foto o volvé a la opción del logo');
    return;
  }

  const v = $('#sucursal').value;
  const suc = (v && v !== 'otra') ? SUCURSALES[Number(v)] : null;
  const direccion = suc ? `${suc.direccion}, ${suc.nombre}, ${suc.provincia}` : $('#direccion').value.trim();

  firmaActual = construirFirma({
    nombre: $('#nombre').value.trim(),
    puesto: $('#puesto').value.trim(),
    mail: $('#mail').value.trim(),
    celular: $('#celular').value.trim(),
    fijo: suc ? suc.telefono : '',
    interno: $('#interno').value.trim(),
    direccion,
    imagen: usarFoto ? procesarFoto(false) : ASSETS.logoVertical,
  });

  $('#vistaClara').innerHTML = firmaActual;
  $('#vistaOscura').innerHTML = firmaActual;
  irA(ULTIMO_PASO);
}

async function copiar() {
  if (!firmaActual) return;
  try {
    // text/html para que al pegar conserve el formato; text/plain es el
    // respaldo para los campos que no aceptan HTML
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([firmaActual], { type: 'text/html' }),
      'text/plain': new Blob([$('#vistaClara').innerText], { type: 'text/plain' }),
    })]);
    brindis('Firma copiada ✓  Pegala con Ctrl+V');
  } catch (e) {
    const rango = document.createRange();
    rango.selectNodeContents($('#vistaClara'));
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(rango);
    try {
      document.execCommand('copy');
      brindis('Firma copiada ✓  Pegala con Ctrl+V');
    } catch (_) {
      brindis('Tu navegador no deja copiar solo: ya te la seleccioné, usá Ctrl+C');
    }
  }
}

function descargar() {
  if (!firmaActual) return;
  const pagina = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /><title>Mi firma · Novogar</title></head>
<body style="margin:0;padding:28px;font-family:${PILA};">
<p style="font-size:13px;color:#6E737A;max-width:640px;">Seleccioná la firma de abajo con el mouse, copiala con Ctrl+C y pegala en la configuración de firma de tu correo. Si usás Thunderbird, no copies nada: apuntale a este mismo archivo.</p>
<hr style="border:none;border-top:1px solid #E2E4E8;margin:18px 0;" />
${firmaActual}
</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([pagina], { type: 'text/html;charset=utf-8' }));
  a.download = 'firma-novogar.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  brindis('Archivo descargado');
}

/* --------------------------------------------------------------- arranque */

function tipear(texto, destino, alTerminar) {
  if (sinMovimiento()) { destino.textContent = texto; alTerminar(); return; }
  let i = 0;
  (function paso() {
    destino.textContent = texto.slice(0, ++i);
    if (i < texto.length) setTimeout(paso, texto[i - 1] === ',' ? 180 : 42);
    else setTimeout(alTerminar, 380);
  })();
}

function poblarSucursales() {
  const select = $('#sucursal');
  select.innerHTML = '<option value="">Elegí tu sucursal…</option>';
  SUCURSALES.forEach((s, i) => {
    const op = document.createElement('option');
    op.value = String(i);
    op.textContent = `${s.nombre} — ${s.direccion}`;
    select.appendChild(op);
  });
  const otra = document.createElement('option');
  otra.value = 'otra';
  otra.textContent = 'Otra / no figura en la lista';
  select.appendChild(otra);
}

function iniciar() {
  $('#logoBarra').src = ASSETS.logoHorizontal.src;
  poblarSucursales();

  tipear('Hola, vamos a generar tu firma…', $('#tipeo'), () => {
    $('#cursor').classList.add('apagado');
    ['#subtitulo', '#navBienvenida', '#tarjetitas'].forEach((sel, i) => {
      setTimeout(() => $(sel).classList.add('visible'), i * 130);
    });
  });

  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => irA(Number(b.dataset.ir))));
  $('#generar').addEventListener('click', generar);
  $('#copiar').addEventListener('click', copiar);
  $('#descargar').addEventListener('click', descargar);

  // Enter avanza al paso siguiente
  $$('input').forEach((input) => input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (pasoActual === 6) generar();
    else if (pasoActual < 6) irA(pasoActual + 1);
  }));

  let mailTocado = false;
  $('#mail').addEventListener('input', () => { mailTocado = true; });
  $('#nombre').addEventListener('input', (e) => {
    if (!mailTocado) $('#mail').value = sugerirMail(e.target.value);
  });

  $('#sucursal').addEventListener('change', () => {
    const v = $('#sucursal').value;
    $('#campoDireccion').hidden = v !== 'otra';
    const pista = $('#pistaSucursal');
    if (v === 'otra') pista.textContent = 'Escribí la dirección como querés que aparezca.';
    else if (!v) pista.textContent = '';
    else {
      const s = SUCURSALES[Number(v)];
      pista.textContent = s.telefono ? `Teléfono de la sucursal: ${s.telefono}` : 'Esta sucursal no tiene fijo cargado.';
    }
    marcarError('sucursal', '');
  });

  $$('input[name=imagen]').forEach((r) => r.addEventListener('change', () => {
    $('#zonaFoto').hidden = !(r.value === 'foto' && r.checked);
  }));

  const soltar = $('#soltar');
  soltar.addEventListener('click', () => $('#archivo').click());
  soltar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#archivo').click(); }
  });
  ['dragenter', 'dragover'].forEach((ev) => soltar.addEventListener(ev, (e) => {
    e.preventDefault(); soltar.classList.add('encima');
  }));
  ['dragleave', 'drop'].forEach((ev) => soltar.addEventListener(ev, (e) => {
    e.preventDefault(); soltar.classList.remove('encima');
  }));
  soltar.addEventListener('drop', (e) => cargarArchivo(e.dataTransfer.files[0]));
  $('#archivo').addEventListener('change', (e) => cargarArchivo(e.target.files[0]));

  $('#otraFoto').addEventListener('click', () => {
    foto.imagen = null;
    foto.yaSinFondo = false;
    $('#yaSinFondo').hidden = true;
    $('#tieneFondo').hidden = true;
    $('#editor').classList.remove('visible');
    soltar.hidden = false;
    $('#archivo').value = '';
  });

  $$('.pestana').forEach((tab) => tab.addEventListener('click', () => {
    $$('.pestana').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    $$('.panel-pestana').forEach((p) => p.classList.remove('visible'));
    $('#panel-' + tab.dataset.panel).classList.add('visible');
  }));
}

document.addEventListener('DOMContentLoaded', iniciar);
