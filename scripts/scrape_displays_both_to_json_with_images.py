# scrape_displays_both_to_json_with_images.py
import os
import re
import json
import time
from urllib.parse import urljoin, urlparse

import requests
from playwright.sync_api import sync_playwright


POKEHUB_CATEGORY_PAGES = [
    "https://www.pokehub.fr/categorie-produit/pokemon-coreen/",
    "https://www.pokehub.fr/categorie-produit/pokemon-coreen/page/2/",
    "https://www.pokehub.fr/categorie-produit/pokemon-coreen/page/3/",
]

NIPPON_CATEGORY_PAGES = [
    "https://www.nippontcg.fr/displays-pokemon",
]

OUT_JSON = "products.json"

# Où stocker les images en local
LOCAL_IMAGE_DIR = "images/products"          # dossier sur disque
PUBLIC_IMAGE_PREFIX = "/images/products"     # chemin utilisé dans ton app

DEFAULTS = {
    "category": "Display",
    "badge": "",
    "tags": ["Pokemon"],
    "stock": 10,
    "franchise": "Pokemon",
}

# throttle léger entre les fiches (évite de marteler les sites)
SLEEP_BETWEEN_PRODUCTS_SEC = 0.25


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[’']", "-", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def price_to_cents(price_text: str) -> int:
    # "48,90 €" -> 4890
    t = (price_text or "").replace("\xa0", " ").strip()
    m = re.search(r"(\d+[.,]\d+|\d+)", t)
    if not m:
        return 0
    euros = float(m.group(1).replace(",", "."))
    return int(round(euros * 100))


def is_product_url(base: str, href: str) -> bool:
    if not href:
        return False
    u = urljoin(base, href)
    if "#" in u:
        u = u.split("#", 1)[0]

    # même host
    if urlparse(u).netloc != urlparse(base).netloc:
        return False

    # exclure pages non-produits
    bad = [
        "/categorie-produit/", "/category/",
        "/cart", "/panier",
        "/checkout", "/commander",
        "/compte", "/my-account",
        "/wp-content/",
    ]
    if any(b in u for b in bad):
        return False

    # exclure assets
    if u.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".svg")):
        return False

    # heuristique path
    path = urlparse(u).path.strip("/")
    if len(path) < 3:
        return False
    if path.count("/") < 1:
        return False

    return True


def collect_links(page, category_url: str) -> list[str]:
    page.goto(category_url, wait_until="domcontentloaded")
    page.wait_for_timeout(400)

    links = []
    seen = set()

    for a in page.locator("a").all():
        href = a.get_attribute("href")
        if not is_product_url(category_url, href):
            continue
        u = urljoin(category_url, href).split("#", 1)[0]
        if u not in seen:
            seen.add(u)
            links.append(u)

    return links


def guess_ext_from_headers(content_type: str) -> str:
    ct = (content_type or "").lower()
    if "image/jpeg" in ct or "image/jpg" in ct:
        return "jpg"
    if "image/png" in ct:
        return "png"
    if "image/webp" in ct:
        return "webp"
    return "jpg"


def download_image(url: str, slug: str) -> str:
    if not url:
        return ""

    os.makedirs(LOCAL_IMAGE_DIR, exist_ok=True)

    try:
        # On tente de garder l'extension depuis l'URL si propre
        parsed = urlparse(url)
        path = parsed.path
        ext = ""
        if "." in path:
            ext_candidate = path.rsplit(".", 1)[-1].lower()
            if ext_candidate in ("jpg", "jpeg", "png", "webp"):
                ext = "jpg" if ext_candidate == "jpeg" else ext_candidate

        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()

        if not ext:
            ext = guess_ext_from_headers(r.headers.get("Content-Type", ""))

        filename = f"{slug}.{ext}"
        disk_path = os.path.join(LOCAL_IMAGE_DIR, filename)

        with open(disk_path, "wb") as f:
            f.write(r.content)

        return f"{PUBLIC_IMAGE_PREFIX}/{filename}"

    except Exception:
        # fallback : si download KO, on garde l'URL externe
        return url


def extract_product(page, product_url: str, language: str) -> dict:
    page.goto(product_url, wait_until="domcontentloaded")
    page.wait_for_timeout(250)

    # Title
    title = ""
    for sel in ["h1.product_title", "h1.entry-title", "h1"]:
        loc = page.locator(sel).first
        if loc.count() > 0:
            title = clean(loc.inner_text())
            if title:
                break

    # Price
    price_text = ""
    for sel in ["p.price", ".summary .price", ".price"]:
        loc = page.locator(sel).first
        if loc.count() > 0:
            price_text = clean(loc.inner_text())
            if price_text:
                break

    # Description
    desc = ""
    for sel in [
        "div.woocommerce-Tabs-panel--description",
        "div#tab-description",
        "div.woocommerce-product-details__short-description",
        "div.summary",
    ]:
        loc = page.locator(sel).first
        if loc.count() > 0:
            txt = clean(loc.inner_text())
            if txt and len(txt) >= 20:
                desc = txt
                break

    # Image URL (featured)
    img_url = ""
    for sel in [
        "figure.woocommerce-product-gallery__wrapper img",
        ".woocommerce-product-gallery img",
        "img.wp-post-image",
    ]:
        loc = page.locator(sel).first
        if loc.count() > 0:
            src = (loc.get_attribute("data-src") or loc.get_attribute("src") or "").strip()
            if src:
                img_url = urljoin(product_url, src)
                break

    name = title
    slug = slugify(name)

    # Téléchargement image + remplacement par chemin local
    local_img = download_image(img_url, slug) if slug else (img_url or "")

    return {
        "name": name,
        "slug": slug,
        "category": DEFAULTS["category"],
        "franchise": DEFAULTS["franchise"],
        "language": language,
        "price": price_to_cents(price_text),
        "description": desc,
        "badge": DEFAULTS["badge"],
        "image": local_img,
        "tags": DEFAULTS["tags"],
        "stock": DEFAULTS["stock"],
    }


def scrape_site(playwright, site_name: str, category_pages: list[str], language: str) -> list[dict]:
    browser = playwright.chromium.launch(headless=True)
    ctx = browser.new_context(
        locale="fr-FR",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    )
    page = ctx.new_page()

    links = []
    for cat in category_pages:
        links.extend(collect_links(page, cat))

    # dedupe
    seen = set()
    uniq_links = []
    for u in links:
        if u in seen:
            continue
        seen.add(u)
        uniq_links.append(u)

    products = []
    for i, u in enumerate(uniq_links, 1):
        try:
            prod = extract_product(page, u, language=language)
            # skip si pas de title
            if prod["name"]:
                products.append(prod)
        except Exception:
            pass
        time.sleep(SLEEP_BETWEEN_PRODUCTS_SEC)

    browser.close()
    print(f"[{site_name}] {len(products)} produits extraits (sur {len(uniq_links)} liens)")
    return products


def main():
    with sync_playwright() as p:
        all_products = []

        # PokeHub: coréen
        all_products.extend(
            scrape_site(p, "pokehub", POKEHUB_CATEGORY_PAGES, language="Coreen")
        )

        # NipponTCG: japonais
        all_products.extend(
            scrape_site(p, "nippontcg", NIPPON_CATEGORY_PAGES, language="Japonnais")
        )

    # Dédoublonnage final par slug (au cas où)
    by_slug = {}
    for prod in all_products:
        slug = prod.get("slug") or ""
        if not slug:
            continue
        by_slug[slug] = prod

    final = list(by_slug.values())

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print(f"OK -> {OUT_JSON} ({len(final)} produits)")
    print(f"Images -> ./{LOCAL_IMAGE_DIR} (référencées via {PUBLIC_IMAGE_PREFIX}/...)")


if __name__ == "__main__":
    main()