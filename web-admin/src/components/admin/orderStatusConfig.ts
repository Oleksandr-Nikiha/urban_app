export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_moderation: {
    label: "Очікує модерації",
    bg: "color-mix(in srgb, #f59e0b 20%, transparent)",
    text: "#d97706",
  },
  confirmed: {
    label: "Підтверджено",
    bg: "color-mix(in srgb, #10b981 20%, transparent)",
    text: "#059669",
  },
  in_progress: {
    label: "Готується",
    bg: "color-mix(in srgb, #3b82f6 20%, transparent)",
    text: "#2563eb",
  },
  cooking: {
    label: "Готується",
    bg: "color-mix(in srgb, #3b82f6 20%, transparent)",
    text: "#2563eb",
  },
  ready: {
    label: "Готове (самовивіз)",
    bg: "color-mix(in srgb, #8b5cf6 20%, transparent)",
    text: "#7c3aed",
  },
  ready_for_pickup: {
    label: "Готове (самовивіз)",
    bg: "color-mix(in srgb, #8b5cf6 20%, transparent)",
    text: "#7c3aed",
  },
  on_the_way: {
    label: "В дорозі (доставка)",
    bg: "color-mix(in srgb, #06b6d4 20%, transparent)",
    text: "#0891b2",
  },
  delivering: {
    label: "В дорозі (доставка)",
    bg: "color-mix(in srgb, #06b6d4 20%, transparent)",
    text: "#0891b2",
  },
  completed: {
    label: "Виконано",
    bg: "color-mix(in srgb, #6b7280 20%, transparent)",
    text: "#4b5563",
  },
  rejected: {
    label: "Відхилено",
    bg: "color-mix(in srgb, #ef4444 20%, transparent)",
    text: "#dc2626",
  },
  cancelled: {
    label: "Скасовано",
    bg: "color-mix(in srgb, #ef4444 20%, transparent)",
    text: "#dc2626",
  },
};

