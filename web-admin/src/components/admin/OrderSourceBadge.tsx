interface OrderSourceBadgeProps {
  source?: string | null;
  tableNumber?: string | number | null;
  staffName?: string | null;
  showDetails?: boolean;
}

export function OrderSourceBadge({
  source,
  tableNumber,
  staffName,
  showDetails = false,
}: OrderSourceBadgeProps) {
  const s = (source || "telegram").toLowerCase();

  if (s === "pos") {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1"
          style={{
            background: "rgba(16, 185, 129, 0.15)",
            color: "#059669",
            border: "1px solid rgba(16, 185, 129, 0.25)",
          }}
        >
          <span>🏛️</span>
          <span>Заклад</span>
        </span>
        {tableNumber != null && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              color: "#059669",
            }}
          >
            {/^\d+$/.test(String(tableNumber).trim())
              ? `Стіл #${tableNumber}`
              : String(tableNumber)}
          </span>
        )}
        {showDetails && staffName && (
          <span className="text-[11px] opacity-70">
            Офіціант: <strong className="font-semibold">{staffName}</strong>
          </span>
        )}
      </div>
    );
  }

  if (s === "web_croissants") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: "rgba(200, 130, 62, 0.15)",
          color: "#a15914",
        }}
      >
        🥐 Веб-сайт
      </span>
    );
  }

  if (s === "web_pizza") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: "rgba(239, 68, 68, 0.15)",
          color: "#dc2626",
        }}
      >
        🍕 Веб-сайт
      </span>
    );
  }

  if (s === "web_group" || s === "web") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: "rgba(99, 102, 241, 0.15)",
          color: "#4f46e5",
        }}
      >
        🌐 Веб-сайт
      </span>
    );
  }

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        background: "rgba(59, 130, 246, 0.15)",
        color: "#2563eb",
      }}
    >
      🤖 Telegram
    </span>
  );
}
