from pathlib import Path
from PIL import Image


def convert_png_to_ico():
    source_path = Path(r"E:\一男相五女？可是要被攮死的！！\fanqie_assistant\logo.png")
    output_path = source_path.with_name("logo.ico")

    if not source_path.exists():
        print(f"Error: source image not found: {source_path}")
        return

    print("Converting logo.png to logo.ico...")

    try:
        icon_sizes = [(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)]

        image = Image.open(source_path).convert("RGBA")
        image.save(output_path, format="ICO", sizes=icon_sizes)

        print(f"Success: {output_path} generated.")
    except Exception as e:
        print(f"Error converting image: {e}")


if __name__ == "__main__":
    convert_png_to_ico()