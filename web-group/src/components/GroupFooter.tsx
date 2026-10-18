export function GroupFooter() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <footer id="contacts" className="bg-[#0B0D10] text-[#94A3B8] pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Бренд */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Urban Bites"
                className="h-10 sm:h-12 w-10 sm:w-12 rounded-full object-cover shadow-sm"
              />
              <span className="font-display text-2xl font-bold text-white tracking-tight">
                Urban Bites
              </span>
            </div>
            <p className="text-xs uppercase text-amber-400 tracking-wider font-bold">
              Гастрономічний простір Києва
            </p>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Мережа сучасних закладів смаку та гостинності у Києві.
              Urban Pizza & Sushi, Urban Bakery & Coffee та бонусна програма Urban Club.
            </p>
            <div className="pt-1 text-xs text-[#94A3B8]">
              Email:{" "}
              <a href="mailto:support@urbanbites.ua" className="text-[#CBD5E1] underline hover:text-white">
                support@urbanbites.ua
              </a>
            </div>
          </div>

          {/* Заклад 1 */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}logo-pizza.svg`} alt="" className="h-6 w-6 rounded-full inline-block" />
              <span>Urban Pizza & Sushi</span>
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>📍 м. Київ, вул. Набережна, 12</li>
              <li>⏰ Графік & Доставка: 10:30 – 21:30</li>
              <li>
                📞{" "}
                <a href="tel:+380442220011" className="hover:text-white underline">
                  +380 (44) 222-00-11
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/urban-bites/restaurants/"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-bold hover:underline"
                >
                  Відкрити меню та замовити піцу →
                </a>
              </li>
            </ul>
          </div>

          {/* Заклад 2 */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}logo-bakery.svg`} alt="" className="h-6 w-6 rounded-full inline-block" />
              <span>Urban Bakery & Coffee</span>
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>📍 м. Київ, вул. Велика Васильківська, 24</li>
              <li>⏰ Пекарня: 08:00 – 20:00 (Доставка з 10:00)</li>
              <li>
                📞{" "}
                <a href="tel:+380442220022" className="hover:text-white underline">
                  +380 (44) 222-00-22
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/urban-bites/cafe/"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-bold hover:underline"
                >
                  Відкрити меню та замовити круасани →
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Копірайт та юридичні лінки */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div>
            © {new Date().getFullYear()} Urban Bites. Усі права захищено.
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#offer"
              className="hover:text-[#CBD5E1] underline"
            >
              Публічний договір (оферта)
            </a>
            <span>•</span>
            <a
              href="#privacy"
              className="hover:text-[#CBD5E1] underline"
            >
              Конфіденційність
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
