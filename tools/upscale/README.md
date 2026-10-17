# Upscale + Retusche

Fotos 4-fach hochskalieren (Real-ESRGAN x4plus, läuft auf der CPU) und kleine Logos oder Abzeichen sauber entfernen.

```sh
pip install torch pillow numpy
# Gewichte (einmalig, BSD-3, Xintao Wang): RealESRGAN_x4plus.pth von den Releases von xinntao/Real-ESRGAN
python upscale.py RealESRGAN_x4plus.pth in.jpg out.png
python retouch.py in.png out.png x0 y0 x1 y1
```

- **`upscale.py`** baut das RRDBNet nach und lädt nur die Gewichte (`weights_only=True`), ohne fremden Code auszuführen. Ein Bild von etwa 400 px dauert auf der CPU 1–3 Minuten.
- **`retouch.py`** füllt das Rechteck `x0 y0 x1 y1` mit einem Verlauf aus seinen Randpixeln (Coons-Patch) und blendet die Kanten weich ein. Das eignet sich für kleine Embleme auf glatten Flächen wie Motorhauben oder Wänden, nicht für Gesichter oder Muster.
