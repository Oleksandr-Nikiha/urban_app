export function ProjectsSection() {
  return (
    <section id="projects" className="py-16 sm:py-24 bg-transparent border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Заголовок секції */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Наші заклади
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Проєкти мережі Urban Bites
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8]">
            Оберіть заклад за смаком та замовляйте улюблені страви онлайн з доставкою або самовивозом
          </p>
        </div>

        {/* Картки двох закладів */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {/* Картка 1: Urban Pizza & Sushi */}
          <div className="bg-[#14171E] rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-white/10 flex flex-col justify-between hover:border-white/20 hover:shadow-2xl transition-all duration-300 group">
            <div className="space-y-6">
              {/* Зображення */}
              <div className="aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#181B22] relative shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"
                  alt="Urban Pizza & Sushi"
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                />
                <div className="absolute top-3 left-3 bg-[#0F1115]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
                  <span>🍕🍣</span>
                  <span>Піца, Суші, Бургери</span>
                </div>
                <div className="absolute bottom-3 right-3 bg-[#0F1115]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-white/10">
                  🛵 10:30 – 21:30
                </div>
              </div>

              {/* Інфо */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`${import.meta.env.BASE_URL}logo-pizza.svg`}
                      alt="Urban Pizza & Sushi"
                      className="h-8 w-8 rounded-full object-cover shadow-xs"
                    />
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      Urban Pizza & Sushi
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shrink-0">
                    Працює зараз
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <span>📍</span>
                  <span>м. Київ, вул. Набережна, 12</span>
                </div>

                <p className="text-sm text-[#CBD5E1] leading-relaxed">
                  Перша швидка доставка задоволення у Києві. Гаряча неаполітанська піца на
                  48-годинному тісті, щедрі роли зі свіжим охолодженим лососем, соковиті бургери,
                  боули та комбо-бокси.
                </p>

                {/* Теги */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🍕 16 видів піци
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🍣 Сети від 450 ₴
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🍔 Крафтові бургери
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🛵 Безкоштовно від 250 ₴
                  </span>
                </div>
              </div>
            </div>

            {/* Дії */}
            <div className="pt-6 mt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href="/urban-bites/restaurants/"
                className="flex-1 bg-[#D34528] hover:bg-[#E2583E] text-white py-3.5 px-5 rounded-2xl font-bold text-center text-sm shadow-md shadow-[#D34528]/25 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Перейти до замовлення</span>
                <span>→</span>
              </a>
              <a
                href="tel:+380442220011"
                className="bg-[#181B22] hover:bg-[#202530] text-[#F1F5F9] border border-white/15 py-3.5 px-4 rounded-2xl font-bold text-sm text-center transition-colors flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>+380 (44) 222-00-11</span>
              </a>
            </div>
          </div>

          {/* Картка 2: Urban Bakery & Coffee */}
          <div className="bg-[#14171E] rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-white/10 flex flex-col justify-between hover:border-white/20 hover:shadow-2xl transition-all duration-300 group">
            <div className="space-y-6">
              {/* Зображення */}
              <div className="aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#181B22] relative shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80"
                  alt="Urban Bakery & Coffee"
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                />
                <div className="absolute top-3 left-3 bg-[#0F1115]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
                  <span>🥐☕</span>
                  <span>Пекарня & Кав'ярня</span>
                </div>
                <div className="absolute bottom-3 right-3 bg-[#0F1115]/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-white/10">
                  ⏰ 08:00 – 20:00
                </div>
              </div>

              {/* Інфо */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`${import.meta.env.BASE_URL}logo-bakery.svg`}
                      alt="Urban Bakery & Coffee"
                      className="h-8 w-8 rounded-full object-cover shadow-xs"
                    />
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      Urban Bakery & Coffee
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shrink-0">
                    Працює зараз
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <span>📍</span>
                  <span>м. Київ, вул. Велика Васильківська, 24</span>
                </div>

                <p className="text-sm text-[#CBD5E1] leading-relaxed">
                  Справжня пекарня задоволення у Києві. Щодня свіжа випічка з 08:00:
                  великі французькі круасани з солодкими та ситними начинками, авторська specialty кава,
                  гарячі бенто-піци та ролліни.
                </p>

                {/* Теги */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🥐 100% листкове масло
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    ☕ Авторська кава
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🍕 Бенто-піци
                  </span>
                  <span className="text-[11px] font-semibold bg-[#181B22] border border-white/10 text-[#CBD5E1] px-2.5 py-1 rounded-lg">
                    🛵 Доставка від 250 ₴
                  </span>
                </div>
              </div>
            </div>

            {/* Дії */}
            <div className="pt-6 mt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href="/urban-bites/cafe/"
                className="flex-1 bg-[#E69A38] hover:bg-[#F5A742] text-[#0F1115] py-3.5 px-5 rounded-2xl font-extrabold text-center text-sm shadow-md shadow-amber-500/20 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Перейти до замовлення</span>
                <span>→</span>
              </a>
              <a
                href="tel:+380442220022"
                className="bg-[#181B22] hover:bg-[#202530] text-[#F1F5F9] border border-white/15 py-3.5 px-4 rounded-2xl font-bold text-sm text-center transition-colors flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>+380 (44) 222-00-22</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
