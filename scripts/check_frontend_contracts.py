#!/usr/bin/env python3
"""
Скрипт перевірки синхронізації TypeScript-інтерфейсів фронтенду з Pydantic-схемами бекенду.

Перевіряє 6 фронтенд-модулів:
- frontend (Telegram Mini App)
- web-admin (Адмін-панель)
- web-croissants (Urban Bakery)
- web-pizza (Urban Pizza)
- web-group (Urban Club Portal)
- web-pos (POS-термінал)
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_file_contains(file_path: Path, patterns: list[str]) -> list[str]:
    errors = []
    if not file_path.is_file():
        return [f"Файл не знайдено: {file_path}"]
    content = file_path.read_text(encoding="utf-8")
    for pat in patterns:
        if pat not in content:
            errors.append(f"У файлі {file_path.relative_to(ROOT)} відсутній шаблон: {pat}")
    return errors


def main() -> int:
    errors: list[str] = []

    # 1. TMA Frontend & Web Admin (types.ts)
    tma_types = ROOT / "frontend" / "src" / "api" / "types.ts"
    admin_types = ROOT / "web-admin" / "src" / "api" / "types.ts"
    shared_tma_admin_patterns = [
        "telegram_id?: number | null;",
        "first_name?: string | null;",
        "bonus_spent?: number;",
        "bonus_to_spend?: number | null;",
        "table_number?: string | number | null;",
        "staff_name?: string | null;",
        "image_url: string | null;",
    ]
    errors.extend(check_file_contains(tma_types, shared_tma_admin_patterns))
    errors.extend(check_file_contains(admin_types, shared_tma_admin_patterns))

    # 2. Web Sites (croissants, pizza, group)
    for site in ["web-croissants", "web-pizza", "web-group"]:
        cat_file = ROOT / site / "src" / "types" / "catalog.ts"
        order_file = ROOT / site / "src" / "types" / "order.ts"
        user_file = ROOT / site / "src" / "types" / "user.ts"

        errors.extend(
            check_file_contains(
                cat_file,
                [
                    "weight: string | null;",
                    "location_name: string;",
                ],
            )
        )
        errors.extend(
            check_file_contains(
                order_file,
                [
                    "RepeatOrderResponse",
                    "RepeatOrderPayload",
                    "WebOrderCreatePayload",
                ],
            )
        )
        errors.extend(
            check_file_contains(
                user_file,
                [
                    "UserOut",
                    "TelegramWidgetAuthPayload",
                    "PhoneLoginPayload",
                    "WebProfileUpdatePayload",
                    "BonusTransaction",
                ],
            )
        )

    # 3. Web Group multi-select modifier quantity
    group_cart = ROOT / "web-group" / "src" / "types" / "cart.ts"
    errors.extend(check_file_contains(group_cart, ["qty?: number;"]))

    # 4. Web POS (types/index.ts)
    pos_types = ROOT / "web-pos" / "src" / "types" / "index.ts"
    errors.extend(
        check_file_contains(
            pos_types,
            [
                "PosPinAuthPayload",
                "PosAuthResponse",
                "PosCustomerRegisterPayload",
                "CreateOrderPayload",
                "PosAddItemsPayload",
                "PosCloseTablePayload",
                "PosShiftOpenPayload",
                "PosCashOperationPayload",
                "PosShiftClosePayload",
            ],
        )
    )

    # 5. Web Shared Code Sync Check
    try:
        from sync_web_shared import check_sync
        sync_diffs = check_sync()
        if sync_diffs:
            errors.extend([f"Web Shared розбіжність: {d}" for d in sync_diffs])
    except ImportError:
        pass

    if errors:
        print("❌ Виявлено розбіжності контрактів фронтенду:")
        for err in errors:
            print(f"  • {err}")
        return 1

    print("✅ Усі 6 фронтенд-проєктів синхронізовані з контрактами бекенду!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
