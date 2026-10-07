# Generador de firmas · Novogar

Una página donde cada empleado completa sus datos y se lleva la firma de correo
lista para pegar en Gmail o en Outlook.

No hay servidor ni base de datos: es HTML, CSS y JavaScript corriendo en el
navegador del que la usa. **Las fotos nunca se suben a ningún lado**: se leen
con `FileReader`, se recortan en un `<canvas>` y se incrustan en la firma. Si
alguien cierra la pestaña, no queda nada.

## Cómo se usa

Entrás, completás el formulario, tocás **Generar mi firma** y te aparece la
firma con el botón para copiarla y las instrucciones de instalación según el
programa de correo que uses.

## Mantenimiento

### Agregar o corregir una sucursal

Editá [`sucursales.js`](sucursales.js). Es una lista de objetos:

```js
{
  "nombre": "Alvear",
  "direccion": "Ruta Provincial 21 KM 4.9",
  "provincia": "Santa Fe",
  "telefono": "0341 3178268"
}
```

El `telefono` es el fijo que aparece en la firma. Si una sucursal no tiene fijo,
dejalo en `""` y la firma muestra sólo el celular.

Quien no encuentre su sucursal puede elegir **Otra** y escribir la dirección a
mano, así que la lista nunca bloquea a nadie.

### Cambiar el logo o los iconos

Están en `assets.js` como data URI. Ese archivo lo genera `gen_assets.py` a
partir de los PNG originales; no conviene editarlo a mano.

### Cambiar el diseño de la firma

Está todo en la función `construirFirma()` de [`app.js`](app.js).

## Por qué la firma está hecha con tablas

Porque Outlook de escritorio renderiza el HTML con el motor de Word, que ignora
flexbox, grid, `border-radius`, `letter-spacing` y los degradados. Las tablas
con estilos en línea son lo único que se ve igual en todos los clientes.

Dos decisiones que vienen de ahí:

- **El nombre y el puesto son texto, no imágenes.** Si fueran imágenes se verían
  idénticos en todos lados, pero desaparecerían para quien usa tema oscuro: el
  cliente de correo no puede aclarar una imagen. Como texto sin color propio,
  heredan el del cliente y se leen bien sobre fondo claro y sobre oscuro.
- **Los dos teléfonos comparten una línea.** Un icono propio para el fijo no se
  distingue del celular a 15px, así que van juntos bajo el mismo icono y el
  interno queda en gris, pegado al fijo.

## Detalles que quizá no se notan

- El correo se sugiere solo a partir del nombre (`nombre.apellido@novogar.com.ar`),
  pero deja de sugerirse apenas el usuario lo edita a mano.
- El enlace del celular se arma en formato internacional con el 9 que llevan los
  móviles argentinos (`+549…`); el del fijo va sin el 9 y, si hay interno, lo
  marca después de una pausa (`tel:+543413176900,,109`).
- La dirección enlaza a Google Maps.
- El botón de copiar usa la API del portapapeles con `text/html` para que al
  pegar conserve el formato, y cae a seleccionar el texto si el navegador no la
  soporta.

## Correr el proyecto localmente

Alcanza con abrir `index.html` en el navegador. Si preferís servirlo:

```bash
python -m http.server 8000
```
