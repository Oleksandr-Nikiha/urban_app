import { useNavigate } from "react-router-dom";
import type { Order } from "@/api/types";
import { haptic } from "@/telegram/sdk";

interface MyOrdersCardProps {
  orders?: Order[] | null;
}

export function MyOrdersCard({ orders }: MyOrdersCardProps) {
  const navigate = useNavigate();
  const ordersCount = orders?.length ?? 0;
  const isTerminalStatus = (status: string) =>
    ["completed", "delivered", "rejected", "cancelled"].includes(status);

  const activeOrdersCount =
    orders?.filter((o) => !isTerminalStatus(o.status)).length ?? 0;

  const formatActiveBadge = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} активне`;
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return `${count} активні`;
    }
    return `${count} активних`;
  };

  return (
    <section className="app-rise">
      <div
        onClick={() => {
          haptic("light");
          navigate("/orders");
        }}
        className="app-card app-press flex items-center justify-between rounded-2xl p-4 cursor-pointer transition-all"
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
        }}
      >
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ background: "var(--app-tint)" }}
          >
            📦
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">Мої замовлення</p>
              {activeOrdersCount > 0 ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "rgba(234, 179, 8, 0.15)", color: "#eab308" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {formatActiveBadge(activeOrdersCount)}
                </span>
              ) : ordersCount > 0 ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-60"
                  style={{ background: "var(--app-tint)" }}
                >
                  {ordersCount}
                </span>
              ) : null}
            </div>
            <p className="text-xs opacity-60">
              {ordersCount > 0
                ? `Історія та статус ${ordersCount} ${ordersCount === 1 ? "замовлення" : "замовлень"}`
                : "Історія та статус замовлень"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-40">
          <span className="text-base font-bold">→</span>
        </div>
      </div>
    </section>
  );
}
