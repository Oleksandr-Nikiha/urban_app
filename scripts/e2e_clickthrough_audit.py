#!/usr/bin/env python3
"""
E2E Click-through Visual Audit for Urban Bites App
Simulates realistic user journeys across:
1. Client TMA (Telegram Mini App)
2. Web Vitrines (Pizza & Sushi, Croissants, Group Portal)
3. POS Terminal (Waiters / Cashiers)
4. Admin Portal (Management)

Saves full-page and component screenshots to /home/alex/Development/urban_app/media/screenshots/
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path("/home/alex/Development/urban_app")
SCREENSHOTS_DIR = ROOT_DIR / "media" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Token generation
sys.path.insert(0, str(ROOT_DIR / "api"))
from src.auth.admin_token import create_admin_token

BOT_TOKEN = "8507652656:AAEN36rPD-EvHSCwV-tBoKmWHoVpHeYC6gs"
ADMIN_TELEGRAM_ID = 395090043

def run_audit():
    print("🚀 Starting Urban Bites E2E Visual Audit...")
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ==========================================
        # 1. TMA CLIENT JOURNEY (Mobile Viewport)
        # ==========================================
        print("\n📱 [1/6] Auditing Client TMA (Mobile Viewport 390x844)...")
        tma_ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            ignore_https_errors=True,
        )
        tma_page = tma_ctx.new_page()

        try:
            # 1.1 TMA Home
            tma_page.goto("https://nikiga-ax.duckdns.org/urban-bites/app/", wait_until="networkidle", timeout=15000)
            tma_page.wait_for_timeout(1500)
            img_home = SCREENSHOTS_DIR / "01_tma_catalog.png"
            tma_page.screenshot(path=str(img_home), full_page=False)
            results["01_tma_catalog"] = str(img_home)
            print(f"  ✅ Saved: {img_home.name}")

            # 1.2 Open Category 'Піца'
            pizza_cat = tma_page.query_selector("button:has-text('Піца')")
            if pizza_cat:
                pizza_cat.click()
                tma_page.wait_for_timeout(1500)

            # Click dish 'Tonno e Olive'
            dish = tma_page.query_selector("text=Tonno e Olive")
            if not dish:
                dish = tma_page.query_selector("button:has-text('₴')")
            if dish:
                dish.click()
                tma_page.wait_for_timeout(1500)

            # 1.3 Product Modal
            img_modal = SCREENSHOTS_DIR / "02_tma_product_modal.png"
            tma_page.screenshot(path=str(img_modal), full_page=False)
            results["02_tma_product_modal"] = str(img_modal)
            print(f"  ✅ Saved: {img_modal.name}")

            # Click Add to Cart
            add_btn = tma_page.query_selector("button:has-text('В кошик'), button:has-text('Додати')")
            if add_btn:
                add_btn.click()
                tma_page.wait_for_timeout(1000)

            # 1.4 Cart
            tma_page.goto("https://nikiga-ax.duckdns.org/urban-bites/app/cart", wait_until="networkidle", timeout=10000)
            tma_page.wait_for_timeout(1500)
            img_cart = SCREENSHOTS_DIR / "03_tma_cart.png"
            tma_page.screenshot(path=str(img_cart), full_page=False)
            results["03_tma_cart"] = str(img_cart)
            print(f"  ✅ Saved: {img_cart.name}")

            # 1.5 Checkout
            checkout_btn = tma_page.query_selector("button:has-text('Оформити')")
            if checkout_btn:
                checkout_btn.click()
                tma_page.wait_for_timeout(2000)
            else:
                tma_page.goto("https://nikiga-ax.duckdns.org/urban-bites/app/checkout?locationId=1", wait_until="networkidle", timeout=10000)
                tma_page.wait_for_timeout(2000)

            img_checkout = SCREENSHOTS_DIR / "04_tma_checkout.png"
            tma_page.screenshot(path=str(img_checkout), full_page=False)
            results["04_tma_checkout"] = str(img_checkout)
            print(f"  ✅ Saved: {img_checkout.name}")

        except Exception as e:
            print(f"  ⚠️ TMA flow exception: {e}")
        finally:
            tma_ctx.close()

        # ==========================================
        # 2. WEB PIZZA VITRINE (Desktop Viewport)
        # ==========================================
        print("\n🍕 [2/6] Auditing Web Pizza Vitrine (Desktop 1366x768)...")
        pizza_ctx = browser.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1.5, ignore_https_errors=True)
        pizza_page = pizza_ctx.new_page()

        try:
            pizza_page.goto("http://127.0.0.1:5175", wait_until="networkidle", timeout=15000)
            pizza_page.wait_for_timeout(1500)

            # 2.1 Hero & Menu
            img_pizza_main = SCREENSHOTS_DIR / "05_web_pizza_vitrine.png"
            pizza_page.screenshot(path=str(img_pizza_main), full_page=False)
            results["05_web_pizza_vitrine"] = str(img_pizza_main)
            print(f"  ✅ Saved: {img_pizza_main.name}")

            # 2.2 Click a product card to open ProductModal
            pizza_cards = pizza_page.query_selector_all("button:has-text('В кошик'), button:has-text('Обрати')")
            if pizza_cards:
                pizza_cards[0].click()
                pizza_page.wait_for_timeout(1500)

            img_pizza_modal = SCREENSHOTS_DIR / "06_web_pizza_modal.png"
            pizza_page.screenshot(path=str(img_pizza_modal), full_page=False)
            results["06_web_pizza_modal"] = str(img_pizza_modal)
            print(f"  ✅ Saved: {img_pizza_modal.name}")

            # 2.3 Open Cart Drawer
            cart_icon = pizza_page.query_selector("button:has-text('Кошик'), button:has-text('🛍️')")
            if cart_icon:
                cart_icon.click()
                pizza_page.wait_for_timeout(1000)

            img_pizza_cart = SCREENSHOTS_DIR / "07_web_pizza_cart.png"
            pizza_page.screenshot(path=str(img_pizza_cart), full_page=False)
            results["07_web_pizza_cart"] = str(img_pizza_cart)
            print(f"  ✅ Saved: {img_pizza_cart.name}")

        except Exception as e:
            print(f"  ⚠️ Pizza flow exception: {e}")
        finally:
            pizza_ctx.close()

        # ==========================================
        # 3. WEB CROISSANTS VITRINE
        # ==========================================
        print("\n🥐 [3/6] Auditing Web Croissants Vitrine...")
        croissant_ctx = browser.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1.5, ignore_https_errors=True)
        croissant_page = croissant_ctx.new_page()

        try:
            croissant_page.goto("http://127.0.0.1:5174", wait_until="networkidle", timeout=15000)
            croissant_page.wait_for_timeout(1500)

            img_croissant = SCREENSHOTS_DIR / "08_web_croissants_vitrine.png"
            croissant_page.screenshot(path=str(img_croissant), full_page=False)
            results["08_web_croissants_vitrine"] = str(img_croissant)
            print(f"  ✅ Saved: {img_croissant.name}")

        except Exception as e:
            print(f"  ⚠️ Croissants flow exception: {e}")
        finally:
            croissant_ctx.close()

        # ==========================================
        # 4. WEB GROUP PORTAL
        # ==========================================
        print("\n🏢 [4/6] Auditing Web Group Portal...")
        group_ctx = browser.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1.5, ignore_https_errors=True)
        group_page = group_ctx.new_page()

        try:
            group_page.goto("http://127.0.0.1:5176", wait_until="networkidle", timeout=15000)
            group_page.wait_for_timeout(1500)

            img_group = SCREENSHOTS_DIR / "09_web_group_portal.png"
            group_page.screenshot(path=str(img_group), full_page=False)
            results["09_web_group_portal"] = str(img_group)
            print(f"  ✅ Saved: {img_group.name}")

        except Exception as e:
            print(f"  ⚠️ Group flow exception: {e}")
        finally:
            group_ctx.close()

        # ==========================================
        # 5. POS TERMINAL (Tablet 1280x800)
        # ==========================================
        print("\n⚡ [5/6] Auditing POS Terminal (Tablet 1280x800)...")
        pos_ctx = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1.5, ignore_https_errors=True)
        pos_page = pos_ctx.new_page()

        try:
            pos_page.goto("https://nikiga-ax.duckdns.org/urban-bites/pos/", wait_until="networkidle", timeout=15000)
            pos_page.wait_for_timeout(1000)

            # 5.1 PIN Lock Screen
            img_pos_pin = SCREENSHOTS_DIR / "10_pos_pin_lock.png"
            pos_page.screenshot(path=str(img_pos_pin), full_page=False)
            results["10_pos_pin_lock"] = str(img_pos_pin)
            print(f"  ✅ Saved: {img_pos_pin.name}")

            # 5.2 Enter PIN 1111
            btn_1 = pos_page.query_selector("button:has-text('1')")
            if btn_1:
                for _ in range(4):
                    btn_1.click()
                    pos_page.wait_for_timeout(150)

            pos_page.wait_for_timeout(2000)

            # 5.3 POS Main View
            img_pos_main = SCREENSHOTS_DIR / "11_pos_main_terminal.png"
            pos_page.screenshot(path=str(img_pos_main), full_page=False)
            results["11_pos_main_terminal"] = str(img_pos_main)
            print(f"  ✅ Saved: {img_pos_main.name}")

            # 5.4 Click a Product Card -> Modal with Stop-list toggle
            dish = pos_page.query_selector("text=Tonno e Olive")
            if not dish:
                dish = pos_page.query_selector("button:has-text('+')")
            if dish:
                dish.click()
                pos_page.wait_for_timeout(1500)
                img_pos_modal = SCREENSHOTS_DIR / "12_pos_product_stoplist.png"
                pos_page.screenshot(path=str(img_pos_modal), full_page=False)
                results["12_pos_product_stoplist"] = str(img_pos_modal)
                print(f"  ✅ Saved: {img_pos_modal.name}")

                # Close modal
                close_btn = pos_page.query_selector("button:has-text('✕')")
                if close_btn:
                    close_btn.click()
                    pos_page.wait_for_timeout(1000)

            # 5.5 Check Active Orders View
            orders_btn = pos_page.query_selector("button:has-text('Чеки')")
            if orders_btn:
                orders_btn.click()
                pos_page.wait_for_timeout(1500)
                img_pos_orders = SCREENSHOTS_DIR / "13_pos_active_orders.png"
                pos_page.screenshot(path=str(img_pos_orders), full_page=False)
                results["13_pos_active_orders"] = str(img_pos_orders)
                print(f"  ✅ Saved: {img_pos_orders.name}")

        except Exception as e:
            print(f"  ⚠️ POS flow exception: {e}")
        finally:
            pos_ctx.close()

        # ==========================================
        # 6. ADMIN PORTAL (Desktop 1440x900)
        # ==========================================
        print("\n🛡️ [6/6] Auditing Admin Portal (Desktop 1440x900)...")
        admin_ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5, ignore_https_errors=True)
        admin_page = admin_ctx.new_page()

        try:
            # 6.1 Admin Login Page
            admin_page.goto("https://nikiga-ax.duckdns.org/urban-bites/admin/login", wait_until="networkidle", timeout=15000)
            admin_page.wait_for_timeout(1500)

            img_admin_login = SCREENSHOTS_DIR / "14_admin_login.png"
            admin_page.screenshot(path=str(img_admin_login), full_page=False)
            results["14_admin_login"] = str(img_admin_login)
            print(f"  ✅ Saved: {img_admin_login.name}")

            # 6.2 Authenticate as Admin
            admin_token = create_admin_token(ADMIN_TELEGRAM_ID, BOT_TOKEN)
            admin_page.evaluate(f"localStorage.setItem('urban_admin_token', '{admin_token}');")
            admin_page.goto("https://nikiga-ax.duckdns.org/urban-bites/admin/", wait_until="networkidle", timeout=15000)
            admin_page.wait_for_timeout(2500)

            # 6.3 Admin Dashboard
            img_admin_dash = SCREENSHOTS_DIR / "15_admin_dashboard.png"
            admin_page.screenshot(path=str(img_admin_dash), full_page=False)
            results["15_admin_dashboard"] = str(img_admin_dash)
            print(f"  ✅ Saved: {img_admin_dash.name}")

            # 6.4 Admin Menu & Dishes
            menu_link = admin_page.query_selector("button:has-text('Меню та категорії'), a:has-text('Меню та категорії')")
            if menu_link:
                menu_link.click()
                admin_page.wait_for_timeout(2000)
                img_admin_menu = SCREENSHOTS_DIR / "16_admin_menu.png"
                admin_page.screenshot(path=str(img_admin_menu), full_page=False)
                results["16_admin_menu"] = str(img_admin_menu)
                print(f"  ✅ Saved: {img_admin_menu.name}")

        except Exception as e:
            print(f"  ⚠️ Admin flow exception: {e}")
        finally:
            admin_ctx.close()

        browser.close()

    print(f"\n🎉 Audit complete! Captured {len(results)} high-res screenshots.")
    for key, path in sorted(results.items()):
        print(f"  • {key}: {path}")

if __name__ == "__main__":
    run_audit()
