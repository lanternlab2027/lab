"""Build docs/apps/img/<app>.jpg (640x400) from each app's preview.jpg, or og.png when there is no preview.
Previews are cover-cropped; og images are fit to width and padded with their own edge color.
Run: python3 bots/apps_hub/make_thumbs.py"""
from PIL import Image
import os
ROOT = os.path.join(os.path.dirname(__file__), '../../docs')
APPS = ['wrapped', 'reading', 'netflix', 'sport', 'dating', 'awards', 'santa', 'bingo', 'then', 'eats']
W, H = 640, 400
for a in APPS:
    pv = os.path.join(ROOT, a, 'preview.jpg')
    if os.path.exists(pv):
        im = Image.open(pv).convert('RGB')
        s = max(W / im.width, H / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - W) // 2, (im.height - H) // 2
        out = im.crop((x, y, x + W, y + H))
    else:
        im = Image.open(os.path.join(ROOT, a, 'og.png')).convert('RGB')
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        bg = im.getpixel((4, 4))
        out = Image.new('RGB', (W, H), bg)
        out.paste(im, (0, (H - im.height) // 2))
        # soften the seams by stretching the top/bottom rows of the source
        top = im.crop((0, 0, W, 1)).resize((W, (H - im.height) // 2))
        bot = im.crop((0, im.height - 1, W, im.height)).resize((W, H - im.height - (H - im.height) // 2))
        out.paste(top, (0, 0)); out.paste(bot, (0, (H - im.height) // 2 + im.height))
    out.save(os.path.join(ROOT, 'apps/img', a + '.jpg'), quality=82, optimize=True, progressive=True)
    print(a, os.path.getsize(os.path.join(ROOT, 'apps/img', a + '.jpg')))
