# -*- coding: utf-8 -*-
"""Genera assets.js: los logos y los iconos como data URI.

Viajan dentro del JS en lugar de ser archivos sueltos para que la firma que se
genera no tenga imágenes remotas: así no se bloquean en el cliente de correo ni
dejan de funcionar si algún día cambia dónde están alojadas.

Correr después de cambiar un logo:

    pip install Pillow
    python gen_assets.py
"""
import base64
import io
import json

from PIL import Image, ImageDraw

ROJO = (214, 16, 30)
Z = 4                 # se dibuja a 4x y se entrega a @2x, para que no quede dentado
ALTO_VERTICAL = 90    # logo dentro de la firma
ALTO_BARRA = 26       # logo del encabezado de la página


def data_uri(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def logo(ruta, alto):
    """Escala un logo a @2x del alto pedido, recortando el aire sobrante.

    Ojo con agrandarlos: los originales son chicos y pasados de cierto tamaño
    se ven blandos. El vertical rinde bien hasta unos 90px de alto.
    """
    img = Image.open(ruta).convert("RGBA")
    caja = img.getchannel("A").getbbox()
    if caja:
        img = img.crop(caja)
    ancho = round(alto * img.width / img.height)
    return {"src": data_uri(img.resize((ancho * 2, alto * 2), Image.LANCZOS)),
            "w": ancho, "h": alto}


def icono(tipo, lado=15, color=ROJO, grosor=1.65):
    """Iconos de línea, dibujados sobre una grilla de 16."""
    L = lado * Z
    im = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = L / 16.0
    t = max(2, round(grosor * u))
    c = color + (255,)

    if tipo == "tel":
        d.rounded_rectangle([5.1 * u, 1.6 * u, 10.9 * u, 14.4 * u], radius=1.7 * u,
                            outline=c, width=t)
        d.rounded_rectangle([6.9 * u, 3.1 * u, 9.1 * u, 3.7 * u], radius=0.3 * u, fill=c)
        d.rounded_rectangle([6.6 * u, 12.3 * u, 9.4 * u, 12.9 * u], radius=0.3 * u, fill=c)
    elif tipo == "mail":
        x0, y0, x1, y1 = 1.4 * u, 3.4 * u, 14.6 * u, 12.6 * u
        d.rounded_rectangle([x0, y0, x1, y1], radius=1.4 * u, outline=c, width=t)
        m = (x0 + x1) / 2
        d.line([x0 + t * 0.6, y0 + t * 0.6, m, 8.6 * u], fill=c, width=t, joint="curve")
        d.line([m, 8.6 * u, x1 - t * 0.6, y0 + t * 0.6], fill=c, width=t, joint="curve")
    elif tipo == "pin":
        d.ellipse([3.1 * u, 1.3 * u, 12.9 * u, 11.1 * u], outline=c, width=t)
        d.line([4.6 * u, 9.3 * u, 8.0 * u, 14.6 * u], fill=c, width=t, joint="curve")
        d.line([11.4 * u, 9.3 * u, 8.0 * u, 14.6 * u], fill=c, width=t, joint="curve")
        d.ellipse([6.6 * u, 4.8 * u, 9.4 * u, 7.6 * u], fill=c)
    else:
        raise ValueError(f"icono desconocido: {tipo}")

    return data_uri(im.resize((lado * 2, lado * 2), Image.LANCZOS))


def main():
    assets = {
        "logoVertical": logo("logo_vertical.png", ALTO_VERTICAL),
        "logoHorizontal": logo("logo_tyni.png", ALTO_BARRA),
        "iconos": {k: icono(k) for k in ("tel", "mail", "pin")},
    }
    with io.open("assets.js", "w", encoding="utf-8") as f:
        f.write("// Generado por gen_assets.py — no editar a mano.\n")
        f.write("// Logos e iconos en data URI: la firma no depende de imágenes remotas.\n")
        f.write("const ASSETS = " + json.dumps(assets, ensure_ascii=False) + ";\n")
    print("assets.js actualizado")


if __name__ == "__main__":
    main()
