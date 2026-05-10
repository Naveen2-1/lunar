import os
import json
import requests
import time

# ── Paths ─────────────────────────
BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "missions.json")
IMG_DIR = os.path.join(BASE_DIR, "images")

os.makedirs(IMG_DIR, exist_ok=True)

# ── Load missions ─────────────────
with open(DATA_PATH, "r", encoding="utf-8") as f:
    missions = json.load(f)

print("Downloading mission images...\n")

headers = {
    "User-Agent": "Mozilla/5.0"
}

def download_image(url, filepath):
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(response.content)
            return True
        else:
            return response.status_code
    except Exception as e:
        return str(e)

# ── Download loop ─────────────────
for mission in missions:
    name = (
        mission["name"]
        .replace(" ", "_")
        .replace("'", "")
        .replace("-", "_")
        .lower()
    )

    url = mission.get("image")

    if not url or not url.startswith("http"):
        print(f"⚠ Skipping {name}")
        continue

    ext = url.split(".")[-1].split("?")[0].lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        ext = "jpg"

    filename = f"{name}.{ext}"
    filepath = os.path.join(IMG_DIR, filename)

    print(f"⬇ Downloading {name}...")

    result = download_image(url, filepath)

    # Retry if rate-limited
    if result == 429:
        print(f"⏳ Rate limited → retrying {name} after 2s...")
        time.sleep(2)
        result = download_image(url, filepath)

    if result is True:
        mission["image"] = f"images/{filename}"
        print(f"✔ Success: {name}")

    else:
        print(f"✖ Failed: {name} ({result})")

    # IMPORTANT: delay between requests
    time.sleep(1.5)

# ── Save JSON ─────────────────────
with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(missions, f, indent=2)

print("\n✅ Done!")