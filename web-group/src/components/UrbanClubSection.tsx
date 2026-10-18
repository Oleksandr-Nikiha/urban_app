interface UrbanClubSectionProps {
  onOpenCabinet?: () => void;
}

export function UrbanClubSection({ onOpenCabinet }: UrbanClubSectionProps) {
  const tiers = [
    { range: "До 100 ₴", percent: "1%", desc: "Базовий кешбек для невеликих покупок" },
    { range: "100 – 700 ₴", percent: "3%", desc: "Найпопулярніший рівень для обідів та перекусів" },
    { range: "700,01 – 1 200 ₴", percent: "4%", desc: "Для замовлень на компанію" },
    { range: "1 200,01 – 1 800 ₴", percent: "5%", desc: "Для свят та дружніх зустрічей" },
    { range: "Від 1 800,01 ₴", percent: "7%", desc: "Максимальний рівень кешбеку" },
  ];

  return (
    <section id="urbanclub" className="py-16 sm:py-24 bg-transparent border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Заголовок */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <img src={`${import.meta.env.BASE_URL}logo-club.svg`} alt="" className="h-4 w-4 rounded-full inline-block" />
            <span>Система лояльності Urban Bites</span>
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            URBAN CLUB — накопичуйте бонуси та смакуйте більше
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
            «Накопичуй бонуси та смакуй більше в закладах Urban». Єдиний бонусний рахунок, закріплений за вашим номером телефону.
            Бонуси діють по всій мережі: <strong className="text-white">1 бонус = 1 гривня</strong>.
          </p>
        </div>

        {/* Картки кешбеку */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
          {tiers.map((t) => (
            <div
              key={t.range}
              className="bg-[#14171E] rounded-2xl p-5 border border-white/10 shadow-2xs hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="text-xs font-semibold text-[#94A3B8]">{t.range}</div>
                <div className="font-display text-3xl font-extrabold text-amber-400 mt-1">
                  {t.percent}
                </div>
              </div>
              <p className="text-[11px] text-[#CBD5E1] leading-snug">
                {t.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Особливі привілеї URBAN CLUB */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Блок Дня Народження */}
          <div className="bg-[#181B22] rounded-3xl p-6 sm:p-8 border border-amber-500/20 shadow-sm flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500 text-[#0F1115] flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-sm shadow-amber-500/30">
              🎂
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-amber-400 tracking-wide">
                Святковий подарунок
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                -10% до Дня Народження
              </h3>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">
                Святкуйте смачно! Знижка надається автоматично в день вашого народження,
                напередодні та наступного дня. Кількість замовлень та сума — <strong className="text-white">не обмежені</strong>.
              </p>
            </div>
          </div>

          {/* Блок Списання бонусів */}
          <div className="bg-[#181B22] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-sm flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#222732] text-white border border-white/10 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-sm">
              💳
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-[#94A3B8] tracking-wide">
                Оплата бонусами
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                Оплата до 30% вартості замовлення
              </h3>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">
                Накопичені бонуси можна використати для розрахунку за наступні страви
                (до 30% суми чека, або до 15% при наявності акційних позицій).
                Просто повідомте номер телефону під час замовлення.
              </p>
            </div>
          </div>
        </div>

        {/* CTA для приєднання або перевірки бонусів */}
        <div className="mt-8 bg-[#0B0D10]/95 text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Ваш баланс лояльності
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
              Вже замовляли в наших закладах?
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] max-w-xl">
              Увійдіть за номером телефону або через Telegram, щоб переглянути накопичений кешбек, персональну картку клієнта та історію замовлень по всій мережі.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCabinet}
              className="bg-amber-500 hover:bg-amber-400 text-[#0F1115] px-5 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>👤</span>
              <span>Мій кабінет URBAN CLUB</span>
            </button>
            <a
              href="https://t.me/ncoffee_app_tst_bot"
              target="_blank"
              rel="noreferrer"
              className="bg-[#181B22] hover:bg-[#222732] text-[#F1F5F9] border border-white/15 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              <span>📱</span>
              <span>Urban Bites Bot</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
