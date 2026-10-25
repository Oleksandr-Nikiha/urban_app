import type { BroadcastSegment } from "@/api/types";

export interface SegmentOption {
  id: BroadcastSegment;
  label: string;
  desc: string;
  icon: string;
}

export const SEGMENT_OPTIONS: SegmentOption[] = [
  {
    id: "all",
    label: "Всі клієнти",
    desc: "Усі зареєстровані користувачі з номером телефону",
    icon: "👥",
  },
  {
    id: "active_30d",
    label: "Активні за 30 днів",
    desc: "Зробили хоча б 1 замовлення за останній місяць",
    icon: "⚡",
  },
  {
    id: "inactive",
    label: "Давно не замовляли",
    desc: "Не замовляли понад 30 днів або взагалі без замовлень",
    icon: "💤",
  },
  {
    id: "top_orders",
    label: "Топ-замовники (VIP)",
    desc: "Постійні клієнти (від 2-х успішних замовлень)",
    icon: "👑",
  },
];
