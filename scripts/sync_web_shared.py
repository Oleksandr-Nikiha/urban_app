#!/usr/bin/env python3
"""
Скрипт синхронізації та валідації спільного коду (Shared Code) між трьома сайтами:
- web-pizza (Urban Pizza)
- web-croissants (Urban Bakery)
- web-group (Urban Club Portal)

Джерелом правди є директорія web-shared/.
Спільні модулі:
- types: catalog.ts, cart.ts, order.ts, user.ts
- utils: phone.ts, bonus.ts, productOptions.ts
- hooks: useModalBehavior.ts, useScrollSpy.ts
- api: bonuses.ts
- context: CartContext.tsx (для сайтів із кошиком)
- components/cabinet: TelegramLoginWidget.tsx, OrdersHistoryTab.tsx, LoyaltyBonusTab.tsx
- components/ui: UserAvatar.tsx
"""

import argparse
import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHARED_DIR = ROOT / "web-shared"

# Перелік спільних файлів відносно web-shared/ та їх цільове розташування у сайтах
SHARED_MAPPINGS = [
    # types
    ("types/catalog.ts", ["web-pizza/src/types/catalog.ts", "web-croissants/src/types/catalog.ts", "web-group/src/types/catalog.ts"]),
    ("types/cart.ts", ["web-pizza/src/types/cart.ts", "web-croissants/src/types/cart.ts", "web-group/src/types/cart.ts"]),
    ("types/order.ts", ["web-pizza/src/types/order.ts", "web-croissants/src/types/order.ts", "web-group/src/types/order.ts"]),
    ("types/user.ts", ["web-pizza/src/types/user.ts", "web-croissants/src/types/user.ts", "web-group/src/types/user.ts"]),

    # utils
    ("utils/phone.ts", ["web-pizza/src/utils/phone.ts", "web-croissants/src/utils/phone.ts", "web-group/src/utils/phone.ts"]),
    ("utils/bonus.ts", ["web-pizza/src/utils/bonus.ts", "web-croissants/src/utils/bonus.ts", "web-group/src/utils/bonus.ts"]),
    ("utils/productOptions.ts", ["web-pizza/src/utils/productOptions.ts", "web-croissants/src/utils/productOptions.ts"]),

    # hooks
    ("hooks/useModalBehavior.ts", ["web-pizza/src/hooks/useModalBehavior.ts", "web-croissants/src/hooks/useModalBehavior.ts", "web-group/src/hooks/useModalBehavior.ts"]),
    ("hooks/useScrollSpy.ts", ["web-pizza/src/hooks/useScrollSpy.ts", "web-croissants/src/hooks/useScrollSpy.ts"]),

    # api
    ("api/bonuses.ts", ["web-pizza/src/api/bonuses.ts", "web-croissants/src/api/bonuses.ts", "web-group/src/api/bonuses.ts"]),

    # context
    ("context/CartContext.tsx", ["web-pizza/src/context/CartContext.tsx", "web-croissants/src/context/CartContext.tsx"]),

    # cabinet components
    ("components/cabinet/TelegramLoginWidget.tsx", [
        "web-pizza/src/components/cabinet/TelegramLoginWidget.tsx",
        "web-croissants/src/components/cabinet/TelegramLoginWidget.tsx",
        "web-group/src/components/cabinet/TelegramLoginWidget.tsx"
    ]),
    ("components/cabinet/OrdersHistoryTab.tsx", [
        "web-pizza/src/components/cabinet/OrdersHistoryTab.tsx",
        "web-croissants/src/components/cabinet/OrdersHistoryTab.tsx",
        "web-group/src/components/cabinet/OrdersHistoryTab.tsx"
    ]),
    ("components/cabinet/LoyaltyBonusTab.tsx", [
        "web-pizza/src/components/cabinet/LoyaltyBonusTab.tsx",
        "web-croissants/src/components/cabinet/LoyaltyBonusTab.tsx",
        "web-group/src/components/cabinet/LoyaltyBonusTab.tsx"
    ]),
    ("components/cabinet/PhoneAuthView.tsx", [
        "web-pizza/src/components/cabinet/PhoneAuthView.tsx",
        "web-croissants/src/components/cabinet/PhoneAuthView.tsx",
        "web-group/src/components/cabinet/PhoneAuthView.tsx"
    ]),
    ("components/cabinet/ProfileSettingsTab.tsx", [
        "web-pizza/src/components/cabinet/ProfileSettingsTab.tsx",
        "web-croissants/src/components/cabinet/ProfileSettingsTab.tsx",
        "web-group/src/components/cabinet/ProfileSettingsTab.tsx"
    ]),
    ("components/cabinet/UserCabinetModal.tsx", [
        "web-pizza/src/components/cabinet/UserCabinetModal.tsx",
        "web-croissants/src/components/cabinet/UserCabinetModal.tsx"
    ]),

    # ui components
    ("components/ui/UserAvatar.tsx", [
        "web-pizza/src/components/ui/UserAvatar.tsx",
        "web-croissants/src/components/ui/UserAvatar.tsx",
        "web-group/src/components/ui/UserAvatar.tsx"
    ]),
]


def check_sync() -> list[str]:
    diffs = []
    for src_rel, targets in SHARED_MAPPINGS:
        src_path = SHARED_DIR / src_rel
        if not src_path.is_file():
            diffs.append(f"Джерело не знайдено: web-shared/{src_rel}")
            continue

        for tgt_rel in targets:
            tgt_path = ROOT / tgt_rel
            if not tgt_path.is_file():
                diffs.append(f"Файл відсутній: {tgt_rel}")
                continue

            if not filecmp.cmp(src_path, tgt_path, shallow=False):
                diffs.append(f"Розбіжність: {tgt_rel} відрізняється від web-shared/{src_rel}")

    return diffs


def do_sync() -> None:
    synced_count = 0
    for src_rel, targets in SHARED_MAPPINGS:
        src_path = SHARED_DIR / src_rel
        if not src_path.is_file():
            print(f"⚠️ Пропущено (не знайдено): web-shared/{src_rel}")
            continue

        for tgt_rel in targets:
            tgt_path = ROOT / tgt_rel
            tgt_path.parent.mkdir(parents=True, exist_ok=True)
            if not tgt_path.is_file() or not filecmp.cmp(src_path, tgt_path, shallow=False):
                shutil.copy2(src_path, tgt_path)
                print(f"  • Оновлено {tgt_rel} <- web-shared/{src_rel}")
                synced_count += 1

    print(f"✅ Синхронізацію завершено (оновлено файлів: {synced_count})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Синхронізація shared коду для web-додатків")
    parser.add_argument("--check", action="store_true", help="Лише перевірити розбіжності без перезапису")
    args = parser.parse_args()

    if args.check:
        diffs = check_sync()
        if diffs:
            print("❌ Знайдено розбіжності між сайтами та web-shared:")
            for d in diffs:
                print(f"  {d}")
            return 1
        print("✅ Усі спільні модулі сайтів синхронізовані з web-shared!")
        return 0

    do_sync()
    return 0


if __name__ == "__main__":
    sys.exit(main())
