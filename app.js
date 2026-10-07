/* Generador de firmas de Novogar.
 *
 * Todo pasa en el navegador: la foto se lee con FileReader, se recorta en un
 * canvas y se mete en la firma como data URI. No se sube nada a ningún lado.
 *
 * La firma se arma con tablas y estilos en línea porque Outlook usa el motor
 * de Word, que ignora flexbox, grid y casi todo el CSS moderno. El nombre y el
 * puesto van como TEXTO, sin color propio, para que hereden el del cliente y
 * se lean igual en tema claro y en tema oscuro.
 */

const PILA = "Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Segoe UI', Arial, sans-serif";
const GRIS_SUAVE = '#8A9099';   // legible sobre blanco y sobre negro
const MAIL_DOMINIO = '@novogar.com.ar';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------------------------------------------------------------- utilidades */

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Deja sólo dígitos y arma el tel: en formato internacional argentino.
 *  Los móviles llevan el 9 después del 54; los fijos, no. */
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
  const nombre = partes.slice(0, partes.length - 1).join('');
  return nombre + '.' + partes[partes.length - 1] + MAIL_DOMINIO;
}

function mapsLink(direccion) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(direccion + ', Novogar');
}

function brindis(mensaje) {
  const el = $('#brindis');
  el.textContent = mensaje;
  el.classList.add('visible');
  clearTimeout(brindis._t);
  brindis._t = setTimeout(() => el.classList.remove('visible'), 2600);
}

/* ------------------------------------------------------------ armado de firma */

function filaContacto(icono, contenido, primera) {
  const pad = primera ? 0 : 4;
  return `<tr>
    <td style="padding:${pad}px 9px 0 0;vertical-align:top;line-height:0;"><img src="${icono}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;margin-top:2px;" /></td>
    <td style="padding:${pad}px 0 0 0;vertical-align:top;font-family:${PILA};font-size:13px;line-height:19px;">${contenido}</td>
  </tr>`;
}

function enlace(texto, href) {
  return `<a href="${href}" style="color:inherit;text-decoration:none;">${escaparHtml(texto)}</a>`;
}

function construirFirma(datos) {
  const ic = ASSETS.iconos;

  let telefonos = enlace(datos.celular, enlaceTelefono(datos.celular, true));
  if (datos.fijo) {
    const interno = datos.interno
      ? `<span style="color:${GRIS_SUAVE};">&nbsp;Int: ${escaparHtml(datos.interno)}</span>` : '';
    let href = enlaceTelefono(datos.fijo, false);
    if (datos.interno) href += ',,' + String(datos.interno).replace(/\D/g, '');
    telefonos += `<span style="color:${GRIS_SUAVE};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`
      + `<a href="${href}" style="color:inherit;text-decoration:none;">${escaparHtml(datos.fijo)}${interno}</a>`;
  } else if (datos.interno) {
    telefonos += `<span style="color:${GRIS_SUAVE};">&nbsp;&nbsp;|&nbsp;&nbsp;Int: ${escaparHtml(datos.interno)}</span>`;
  }

  const filas = [
    filaContacto(ic.tel, telefonos, true),
    filaContacto(ic.mail, enlace(datos.mail, 'mailto:' + datos.mail)),
    datos.direccion ? filaContacto(ic.pin, enlace(datos.direccion, mapsLink(datos.direccion))) : '',
  ].join('');

  const img = datos.imagen;
  const celdaImagen = `<td style="padding:0 20px 0 0;vertical-align:middle;">`
    + `<img src="${img.src}" width="${img.w}" height="${img.h}" alt="${escaparHtml(datos.nombre)}" `
    + `style="display:block;width:${img.w}px;height:${img.h}px;border:0;" /></td>`;

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
  <tr>
    ${celdaImagen}
    <td style="padding:0;vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr><td style="padding:0 0 1px 0;font-family:${PILA};font-size:20px;line-height:26px;font-weight:bold;letter-spacing:.2px;">${escaparHtml(datos.nombre)}</td></tr>
        <tr><td style="padding:0 0 12px 0;font-family:${PILA};font-size:13.5px;line-height:18px;color:${GRIS_SUAVE};">${escaparHtml(datos.puesto)}</td></tr>
        <tr><td style="padding:0;">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${filas}</table>
        </td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

/* --------------------------------------------------------------- la foto */

const foto = {
  imagen: null,
  zoom: 1,
  x: 0.5,          // centro del encuadre, en proporción de la imagen
  y: 0.45,
  LADO: 126,       // tamaño final de la foto en la firma
};

function dibujarFoto() {
  const lienzo = $('#lienzo');
  const ctx = lienzo.getContext('2d');
  const L = lienzo.width;
  ctx.clearRect(0, 0, L, L);
  if (!foto.imagen) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(L / 2, L / 2, L / 2, 0, Math.PI * 2);
  ctx.clip();

  const img = foto.imagen;
  const escala = (L / Math.min(img.width, img.height)) * foto.zoom;
  const ancho = img.width * escala;
  const alto = img.height * escala;
  ctx.drawImage(img, L / 2 - ancho * foto.x, L / 2 - alto * foto.y, ancho, alto);
  ctx.restore();
}

/** Devuelve la foto recortada en círculo, al doble de resolución. */
function fotoRecortada() {
  const L = foto.LADO * 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = L; lienzo.height = L;
  const ctx = lienzo.getContext('2d');
  ctx.beginPath();
  ctx.arc(L / 2, L / 2, L / 2, 0, Math.PI * 2);
  ctx.clip();

  const img = foto.imagen;
  const escala = (L / Math.min(img.width, img.height)) * foto.zoom;
  const ancho = img.width * escala;
  const alto = img.height * escala;
  ctx.drawImage(img, L / 2 - ancho * foto.x, L / 2 - alto * foto.y, ancho, alto);
  return { src: lienzo.toDataURL('image/png'), w: foto.LADO, h: foto.LADO };
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
      foto.zoom = 1; foto.x = 0.5; foto.y = 0.45;
      $('#zoom').value = 100;
      $('#soltar').style.display = 'none';
      $('#editor').classList.add('visible');
      dibujarFoto();
    };
    img.onerror = () => brindis('No pude abrir esa imagen');
    img.src = ev.target.result;
  };
  lector.onerror = () => brindis('No pude leer el archivo');
  lector.readAsDataURL(archivo);
}

/* ------------------------------------------------------------- validación */

function marcarError(campo, mensaje) {
  const input = document.getElementById(campo);
  const span = document.querySelector(`[data-error="${campo}"]`);
  if (span) span.textContent = mensaje || '';
  if (input) input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  return !mensaje;
}

function validar() {
  let ok = true;
  const nombre = $('#nombre').value.trim();
  ok = marcarError('nombre', nombre.length < 3 ? 'Escribí tu nombre y apellido' : '') && ok;
  ok = marcarError('puesto', $('#puesto').value.trim() ? '' : 'Falta el puesto') && ok;

  const mail = $('#mail').value.trim();
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  ok = marcarError('mail', mailOk ? '' : 'Revisá el correo') && ok;

  const cel = $('#celular').value.replace(/\D/g, '');
  ok = marcarError('celular', cel.length >= 8 ? '' : 'Revisá el celular') && ok;

  if (!ok) {
    const primero = document.querySelector('[aria-invalid="true"]');
    if (primero) { primero.focus(); primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  return ok;
}

/* ------------------------------------------------------------------ eventos */

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

function sucursalElegida() {
  const v = $('#sucursal').value;
  const campo = $('#campoDireccion');
  const pista = $('#pistaSucursal');
  if (v === 'otra') {
    campo.hidden = false;
    pista.textContent = 'Escribí la dirección como querés que aparezca.';
    return null;
  }
  campo.hidden = true;
  if (v === '') { pista.textContent = ''; return null; }
  const s = SUCURSALES[Number(v)];
  pista.textContent = s.telefono ? `Teléfono de la sucursal: ${s.telefono}` : '';
  return s;
}

let firmaActual = '';

function generar() {
  if (!validar()) return;

  const s = sucursalElegida();
  const usarFoto = document.querySelector('input[name=imagen]:checked').value === 'foto';

  if (usarFoto && !foto.imagen) {
    brindis('Elegí una foto o cambiá a la opción del logo');
    $('#soltar').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  let direccion = '';
  if (s) direccion = `${s.direccion}, ${s.nombre}, ${s.provincia}`;
  else if ($('#sucursal').value === 'otra') direccion = $('#direccion').value.trim();

  const datos = {
    nombre: $('#nombre').value.trim(),
    puesto: $('#puesto').value.trim(),
    mail: $('#mail').value.trim(),
    celular: $('#celular').value.trim(),
    fijo: s ? s.telefono : '',
    interno: $('#interno').value.trim(),
    direccion,
    imagen: usarFoto ? fotoRecortada() : ASSETS.logoVertical,
  };

  firmaActual = construirFirma(datos);
  $('#vistaClara').innerHTML = firmaActual;
  $('#vistaOscura').innerHTML = firmaActual;
  $('#resultado').classList.add('visible');
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copiar() {
  if (!firmaActual) return;
  try {
    // Se copia como text/html para que al pegar mantenga el formato. El
    // text/plain es el respaldo para los campos que no aceptan HTML.
    const texto = $('#vistaClara').innerText;
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([firmaActual], { type: 'text/html' }),
      'text/plain': new Blob([texto], { type: 'text/plain' }),
    })]);
    brindis('Firma copiada ✓  Ahora pegala con Ctrl+V');
  } catch (e) {
    // Safari viejo y algunos navegadores no tienen ClipboardItem: se
    // selecciona la vista previa para que el usuario copie a mano.
    const rango = document.createRange();
    rango.selectNodeContents($('#vistaClara'));
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(rango);
    try {
      document.execCommand('copy');
      brindis('Firma copiada ✓  Ahora pegala con Ctrl+V');
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
<p style="font-size:13px;color:#6E737A;max-width:640px;">Seleccioná la firma de abajo con el mouse, copiala con Ctrl+C y pegala en la configuración de firma de tu correo.</p>
<hr style="border:none;border-top:1px solid #E2E4E8;margin:18px 0;" />
${firmaActual}
</body></html>`;
  const blob = new Blob([pagina], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'firma-novogar.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  brindis('Archivo descargado');
}

function iniciar() {
  $('#logoBarra').src = ASSETS.logoHorizontal.src;
  poblarSucursales();

  // el mail se sugiere mientras se escribe el nombre, salvo que ya lo hayan tocado
  let mailTocado = false;
  $('#mail').addEventListener('input', () => { mailTocado = true; });
  $('#nombre').addEventListener('input', (e) => {
    if (!mailTocado) $('#mail').value = sugerirMail(e.target.value);
  });

  $('#sucursal').addEventListener('change', sucursalElegida);

  $$('input[name=imagen]').forEach((r) => r.addEventListener('change', () => {
    $('#zonaFoto').classList.toggle('visible', r.value === 'foto' && r.checked);
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
    $('#editor').classList.remove('visible');
    soltar.style.display = '';
    $('#archivo').value = '';
  });

  $('#zoom').addEventListener('input', (e) => {
    foto.zoom = Number(e.target.value) / 100;
    dibujarFoto();
  });

  // arrastrar para encuadrar, con mouse o con el dedo
  const lienzo = $('#lienzo');
  let arrastrando = false, ultimo = null;
  const mover = (e) => {
    if (!arrastrando || !foto.imagen) return;
    const p = e.touches ? e.touches[0] : e;
    if (ultimo) {
      const escala = (lienzo.width / Math.min(foto.imagen.width, foto.imagen.height)) * foto.zoom;
      foto.x = Math.min(1, Math.max(0, foto.x - (p.clientX - ultimo.x) / (foto.imagen.width * escala)));
      foto.y = Math.min(1, Math.max(0, foto.y - (p.clientY - ultimo.y) / (foto.imagen.height * escala)));
      dibujarFoto();
    }
    ultimo = { x: p.clientX, y: p.clientY };
    e.preventDefault();
  };
  const soltarArrastre = () => { arrastrando = false; ultimo = null; };
  const empezar = (e) => { arrastrando = true; ultimo = null; mover(e); };
  lienzo.addEventListener('mousedown', empezar);
  lienzo.addEventListener('touchstart', empezar, { passive: false });
  window.addEventListener('mousemove', mover);
  lienzo.addEventListener('touchmove', mover, { passive: false });
  window.addEventListener('mouseup', soltarArrastre);
  lienzo.addEventListener('touchend', soltarArrastre);

  $('#formulario').addEventListener('submit', (e) => { e.preventDefault(); generar(); });
  $('#copiar').addEventListener('click', copiar);
  $('#descargar').addEventListener('click', descargar);
  $('#volver').addEventListener('click', () => {
    $('#formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#nombre').focus();
  });

  $$('.pestana').forEach((tab) => tab.addEventListener('click', () => {
    $$('.pestana').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    $$('.panel-pestana').forEach((p) => p.classList.remove('visible'));
    $('#panel-' + tab.dataset.panel).classList.add('visible');
  }));
}

document.addEventListener('DOMContentLoaded', iniciar);
