export function Footer() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <footer
      id="contacts"
      className="bg-[#0B0D10] text-[#94A3B8] pt-16 pb-12 border-t border-white/10"
      style={{
        scrollMarginTop:
          "calc(var(--header-height, 96px) + var(--category-nav-height, 56px) + 16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Колонка 1: Про нас */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Urban Bakery & Coffee"
                className="h-12 w-12 rounded-full object-cover shadow-md border border-white/10"
              />
              <div>
                <div className="font-bold text-white text-base leading-tight">
                  Urban Bakery & Coffee
                </div>
                <div className="text-xs text-[#E69A38] font-medium">
                  Artisan Bread & Specialty Coffee
                </div>
              </div>
            </div>
            <div className="text-xs uppercase text-[#E69A38] tracking-wider font-bold">
              Перша пекарня задоволення
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-sm">
              Справжня майстерня смаку у Києві. Щодня випікаємо великі хрусткі круасани,
              свіжу випічку, бенто-піци та варимо ароматну specialty каву.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#1A1D24] hover:bg-[#E69A38] text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border border-white/10"
              >
                <span>📷</span>
                <span>Instagram: @urbanbakery.coffee</span>
              </a>
            </div>
          </div>

          {/* Колонка 2: Контакти та локація */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="font-display text-lg font-bold text-white">
              Локація та контакти
            </h3>
            <ul className="space-y-2.5 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2.5">
                <span>📍</span>
                <div>
                  <a
                    href="https://maps.app.goo.gl/jeX4BLChZar5k1so6"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline underline-offset-2 transition-colors"
                  >
                    м. Київ, вул. Велика Васильківська, 24
                  </a>
                  <div className="text-xs text-[#64748B]">На мапі Google Maps</div>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <span>🥐</span>
                <span>Пекарня: Щодня 08:00 – 21:00</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span>🛵</span>
                <span>Доставка: Щодня 10:00 – 21:00 (від 250 ₴ безкоштовно)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span>📞</span>
                <a
                  href="tel:+380442220022"
                  className="hover:text-white font-semibold transition-colors"
                >
                  +380 (44) 222-00-22
                </a>
              </li>
            </ul>
          </div>

          {/* Колонка 3: Мережа Urban Bites & Вакансії */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-display text-lg font-bold text-white">
              Urban Bites & Партнерам
            </h3>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <a
                  href="/urban-bites/restaurants/"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🍕</span>
                  <span>Urban Pizza & Sushi</span>
                </a>
              </li>
              <li>
                <a
                  href="/urban-bites/"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🌐</span>
                  <span>Мережа Urban Bites</span>
                </a>
              </li>
              <li>
                <a
                  href="/urban-bites/#partnership"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>🤝</span>
                  <span>Кав'ярням / Співпраця</span>
                </a>
              </li>
              <li>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSd89y1NvhZNHfuzBynttut1wk58yS1tmyK8VtkHcKnt3k56QA/viewform?usp=sf_link"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300 text-amber-200 transition-colors flex items-center gap-1.5"
                >
                  <span>💼</span>
                  <span>Вакансії: робота в команді</span>
                </a>
              </li>
              <li className="pt-1">
                <a
                  href="/urban-bites/#offer"
                  className="text-xs text-[#64748B] hover:text-[#94A3B8] underline"
                >
                  Публічний договір (оферта)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Нижній копірайт */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div>
            © {new Date().getFullYear()} Urban Bakery & Coffee. Усі права захищено.
          </div>
          <div>
            Мережа смаку Urban Bites • м. Київ
          </div>
        </div>
      </div>
    </footer>
  );
}

