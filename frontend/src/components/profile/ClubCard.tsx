interface ClubCardProps {
  fullName: string;
  clientCode: string;
  bonusBalance: number;
}

export function ClubCard({ fullName, clientCode, bonusBalance }: ClubCardProps) {
  return (
    <section className="app-rise space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Картка клієнта</p>

      <div
        className="app-card relative overflow-hidden rounded-3xl p-5 shadow-lg transition-all"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--tg-theme-button-color) 25%, var(--app-surface)), color-mix(in srgb, var(--tg-theme-button-color) 8%, var(--app-surface)))",
          border: "1px solid color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}logo-club.svg`}
                alt="Urban Club"
                className="h-5 w-5 rounded-full object-cover shadow-xs"
              />
              <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--tg-theme-button-color)]">
                URBAN CLUB
              </span>
              <span className="text-xs">✨</span>
            </div>
            <p className="mt-1 text-lg font-bold tracking-tight">{fullName}</p>
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
          >
            <span>●</span>
            <span>Active</span>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-50">Номер картки</p>
            <p className="font-mono text-sm font-bold tracking-widest">{clientCode}</p>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-50">Бонуси</p>
            <p className="text-xl font-extrabold text-[var(--tg-theme-button-color)]">
              {bonusBalance} <span className="text-xs font-semibold opacity-70">бал.</span>
            </p>
          </div>
        </div>

        <div className="mt-4 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
          <p className="text-[11px] opacity-50">
            Бонусна програма: нарахування та оплата замовлень балами Urban Club у закладах Urban Bites.
          </p>
        </div>
      </div>
    </section>
  );
}
