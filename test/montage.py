# Tile screenshots into one sheet: montage.py out.jpg cols width img1 img2 ...
import sys
from PIL import Image
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ims = [Image.open(p).convert('RGB') for p in sys.argv[4:]]
ims = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
h = max(im.height for im in ims); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 4, rows * h + (rows - 1) * 4), (40, 40, 40))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
sheet.save(out, quality=88)
