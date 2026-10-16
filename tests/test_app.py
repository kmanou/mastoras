"""Τεστ από άκρη σε άκρη με Playwright (Chromium).
Τρέχουν στη δοκιμαστική λειτουργία ?opfs=1 (ιδιωτικός χώρος του browser αντί για φάκελο).
    pip install pytest playwright && playwright install chromium
    python3 build.py && pytest -q tests
Με SHOTS=1 αποθηκεύονται στιγμιότυπα στο docs/screenshots.
"""
import functools, http.server, os, pathlib, subprocess, threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots" if os.environ.get("SHOTS") else None

def afm(eight: str) -> str:
    """Συνθετικό ΑΦΜ με σωστό ψηφίο ελέγχου (δεν αντιστοιχεί σε πρόσωπο)."""
    s = sum(int(d) * 2 ** (8 - i) for i, d in enumerate(eight))
    return eight + str(s % 11 % 10)

@pytest.fixture(scope="session")
def url():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "dist"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/mastoras.html"
    srv.shutdown()

@pytest.fixture()
def page(url):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1400, "height": 1000}, accept_downloads=True)
        pg = ctx.new_page(); pg.errors = []
        pg.on("pageerror", lambda e: pg.errors.append(str(e)))
        pg.goto(url + "?opfs=1&reset=1"); pg.wait_for_timeout(1200)
        pg.base = url
        yield pg
        assert pg.errors == []
        b.close()

def txt(pg, sel): return pg.locator(sel).first.inner_text().replace("\n", " ")
def shot(pg, name, full=True):
    if SHOTS: SHOTS.mkdir(parents=True, exist_ok=True); pg.screenshot(path=str(SHOTS / name), full_page=full)
def setup(pg, name="Ψυκτική Δοκιμή ΙΚΕ", demo=False, biz=None):
    pg.fill("#s-name", name); pg.fill("#s-act", "Τεχνικές εργασίες"); pg.fill("#s-afm", afm("09401420"))
    if biz: pg.click(f"[data-biz={biz}]")
    for _ in range(3): pg.click("#w-next"); pg.wait_for_timeout(350)
    if demo: pg.check("#w-demo")
    pg.click("#w-next"); pg.wait_for_timeout(2500 if demo else 800)
def issue(pg):
    pg.click("#b-pdf"); pg.wait_for_timeout(300); pg.click(".md footer >> text=Έκδοση & PDF"); pg.wait_for_timeout(1500)

def test_wizard_and_demo(page):
    pg = page
    shot(pg, "1-wizard.png", False)
    pg.fill("#s-name", "Παπαδόπουλος Νίκος"); pg.click("[data-biz=general]"); pg.click("#w-next"); pg.wait_for_timeout(400)
    pg.click("[data-pal=forest]"); pg.wait_for_timeout(300); shot(pg, "2-brand.png", False)
    for _ in range(2): pg.click("#w-next"); pg.wait_for_timeout(350)
    pg.check("#w-demo"); pg.click("#w-next"); pg.wait_for_timeout(2500)
    assert "ΑΝΕΞΟΦΛΗΤΑ" in txt(pg, ".tiles")
    pg.wait_for_timeout(3300); shot(pg, "3-home.png")
    pg.click("[data-go=docs]"); pg.wait_for_timeout(400); assert pg.locator("#rows tr.click").count() >= 6
    pg.click("[data-go=contracts]"); pg.wait_for_timeout(400); pg.locator("#rows tr.click").first.click(); pg.wait_for_timeout(900)
    shot(pg, "5-contract.png")
    pg.click("#b-rmdemo"); pg.click(".md footer >> text=Αφαίρεση"); pg.wait_for_timeout(1500)
    assert pg.evaluate("DB.docs.length") == 0 and pg.evaluate("DB.clients.length") == 0

def test_full_flow(page):
    pg = page
    setup(pg)
    pg.click("[data-q=client]"); pg.fill("#c-name", "Πελάτης Α"); pg.fill("#c-afm", "123456789"); pg.wait_for_timeout(300)
    assert "δεν είναι έγκυρο" in txt(pg, "#afmw")
    pg.fill("#c-afm", afm("12345678")); pg.wait_for_timeout(900)
    pg.click("#b-np"); pg.wait_for_timeout(600)
    pg.locator("#items .it-t").first.click(); pg.keyboard.type("Κλιματιστικό Daikin 12.000 BTU")
    pg.locator("#items [data-f=p]").first.click(); pg.keyboard.type("500"); pg.keyboard.press("Tab")
    pg.click("#b-add"); pg.keyboard.type("Εργασία"); pg.locator("#items [data-f=p]").nth(1).click(); pg.keyboard.type("100"); pg.keyboard.press("Tab"); pg.wait_for_timeout(300)
    pg.locator("#items tr").nth(1).hover(); pg.locator(".lopt").nth(1).click()
    pg.fill("#li-disc", "10"); pg.fill("#li-vat", "13"); pg.check("#li-cat"); pg.click(".md footer >> text=Εφαρμογή"); pg.wait_for_timeout(500)
    assert "721,70" in txt(pg, "#sums")
    issue(pg)
    assert "ΠΡ-" in txt(pg, ".subbar .dt") and pg.locator("#page [contenteditable]").count() == 0
    pg.click("#pa-adv"); pg.click("#pa-add"); pg.wait_for_timeout(500); assert "Μερική" in txt(pg, ".statuscard .sc-row")
    pg.click("#pa-add"); pg.wait_for_timeout(500); assert "Εξοφλήθηκε" in txt(pg, ".statuscard .sc-row")
    shot(pg, "4-proforma.png")
    pg.click("#b-tocon"); pg.wait_for_timeout(1200); issue(pg)
    pg.click("#v-new"); pg.wait_for_timeout(300); pg.locator("[data-vm]").first.select_option("fix")
    pg.click(".md footer >> text=Αποθήκευση & δελτίο"); pg.wait_for_timeout(900)
    assert "Δελτίο επίσκεψης" in txt(pg, ".subbar .dt"); shot(pg, "6-visit.png")
    pg.click("[data-go=docs]"); pg.wait_for_timeout(400); pg.locator("#rows tr.click").first.click(); pg.wait_for_timeout(600)
    pg.click("#b-cancel"); pg.click(".md footer >> text=Ακύρωση εγγράφου"); pg.wait_for_timeout(500); pg.click(".md footer >> text=Πίσω")
    assert pg.get_attribute("#page", "data-wm") == "ΑΚΥΡΩΘΗΚΕ"
    pg.click("[data-go=docs]"); pg.wait_for_timeout(400)
    with pg.expect_download() as dl: pg.click("#b-csv")
    assert dl.value.suggested_filename.endswith(".csv")

def test_logo_upload(page, tmp_path):
    pg = page
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (800, 300), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((20, 20, 280, 280), fill=(200, 40, 60, 255)); d.rectangle((320, 110, 780, 190), fill=(30, 30, 30, 255))
    f = tmp_path / "logo.png"; im.save(f)
    pg.fill("#s-name", "Δοκιμή"); pg.click("#w-next"); pg.wait_for_timeout(400)
    pg.set_input_files("#b-file", str(f)); pg.wait_for_timeout(1500)
    assert "ανέβηκε" in txt(pg, "#b-logo-info") and pg.input_value("#b-mode") == "plate"

def test_second_window_and_legacy(page):
    pg = page
    setup(pg)
    pg2 = pg.context.new_page(); pg2.goto(pg.base + "?opfs=1"); pg2.wait_for_timeout(1500)
    assert "ήδη ανοιχτή" in txt(pg2, ".gate h1"); pg2.close()
    # settings from a version before 3.0: no brand, two-word name
    pg.evaluate("""async()=>{const r=await navigator.storage.getDirectory();for await(const [k] of r.entries()) await r.removeEntry(k,{recursive:true});
      const d=await r.getDirectoryHandle('Ρυθμίσεις',{create:true});const f=await d.getFileHandle('ρυθμίσεις.json',{create:true});const w=await f.createWritable();
      await w.write(JSON.stringify({version:1,iss:{name:'Παπαδόπουλος Νίκος',act:'Ψύξη & κλιματισμός',afm:''},accounts:[{bank:'Τράπεζα',iban:'GR00'}],defaults:{vat:24,adv:80,days:30}}));await w.close();}""")
    pg.reload(); pg.wait_for_timeout(1500)
    assert pg.locator(".setup").count() == 0 and "Ν. ΠΑΠΑΔΟΠΟΥΛΟΣ" in txt(pg, ".brandmini")

def test_print_pages(page, tmp_path):
    pg = page
    setup(pg, demo=True)
    def pages():
        pg.emulate_media(media="print"); f = tmp_path / "x.pdf"
        pg.pdf(path=str(f), format="A4", print_background=True, prefer_css_page_size=True); pg.emulate_media(media="screen")
        return f.read_bytes().count(b"/Type /Page") - f.read_bytes().count(b"/Type /Pages")
    pg.click("[data-go=docs]"); pg.wait_for_timeout(400); pg.locator("#rows tr.click", has_text="Μερική").first.click(); pg.wait_for_timeout(900)
    assert pages() == 1
    pg.click("[data-go=contracts]"); pg.wait_for_timeout(400); pg.locator("#rows tr.click").last.click(); pg.wait_for_timeout(900)
    pg.locator("[data-vsheet]").first.click(); pg.wait_for_timeout(800)
    assert pages() == 1
