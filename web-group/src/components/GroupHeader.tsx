import { useState } from "react";
import type { UserProfile } from "../types/user.ts";

interface GroupHeaderProps {
  onOpenCabinet?: () => void;
  userProfile?: UserProfile | null;
}

export function GroupHeader({ onOpenCabinet, userProfile }: GroupHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

  const navItems = [
    { label: "Проєкти", href: "#projects" },
    { label: "URBAN CLUB", href: "#urbanclub" },
    { label: "Акції", href: "#promotions" },
    { label: "Партнерство", href: "#partnership" },
    { label: "Вакансії", href: "#careers" },
    { label: "Контакти", href: "#contacts" },
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0F1115]/90 backdrop-blur-md border-b border-white/10 shadow-xs">
      {/* Інформаційна верхня плашка */}
      <div className="bg-[#0B0D10] text-[#94A3B8] text-xs py-2 px-4 sm:px-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-amber-400">🌟 Urban Bites</span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span className="hidden sm:inline text-[#CBD5E1]">Смак великого міста в один клік</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={onOpenCabinet}
              className="text-[#CBD5E1] hover:text-amber-400 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <span>🎁</span>
              <span>
                {userProfile?.bonuses !== undefined && userProfile.bonuses > 0
                  ? `URBAN CLUB (${userProfile.bonuses} б.)`
                  : "URBAN CLUB Лояльність"}
              </span>
            </button>
            <a
              href="mailto:support@urbanbites.ua"
              className="hidden md:inline text-[#94A3B8] hover:text-white transition-colors"
            >
              support@urbanbites.ua
            </a>
          </div>
        </div>
      </div>

      {/* Основний хедер */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Логотип */}
        <a href="#top" className="flex items-center gap-3 group">
          <img
            src={logoSrc}
            alt="Urban Bites"
            className="h-10 sm:h-12 w-10 sm:w-12 rounded-full object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <div>
            <span className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight block leading-tight">
              Urban Bites
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#94A3B8] tracking-wider uppercase block">
              Мережа смаку • Київ
            </span>
          </div>
        </a>

        {/* Десктоп-навігація */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#CBD5E1]">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.href);
              }}
              className="hover:text-amber-400 transition-colors py-1"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Швидкі кнопки переходу до замовлення та кабінету */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Кнопка кабінету URBAN CLUB */}
          <button
            type="button"
            onClick={onOpenCabinet}
            className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Особистий кабінет URBAN CLUB"
          >
            <span>🎁</span>
            <span className="hidden md:inline">
              {userProfile?.name ? userProfile.name.split(" ")[0] : "URBAN CLUB"}
            </span>
            {userProfile?.bonuses !== undefined && userProfile.bonuses > 0 && (
              <span className="bg-amber-500 text-[#0F1115] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {userProfile.bonuses}
              </span>
            )}
          </button>

          <a
            href="/urban-bites/restaurants/"
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#181B22] hover:bg-[#222732] text-white border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <span>🍕</span>
            <span>Піца & Суші</span>
          </a>
          <a
            href="/urban-bites/cafe/"
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#181B22] hover:bg-[#222732] text-white border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <span>🥐</span>
            <span>Круасани</span>
          </a>

          {/* Мобільна кнопка гамбургера */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#181B22] border border-white/10 text-white hover:bg-[#222732] cursor-pointer"
            aria-label="Меню"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Мобільне меню */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#14171E] px-4 py-5 space-y-4 animate-in slide-in-from-top-2">
          {/* Кнопка кабінету в мобільному меню */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCabinet?.();
            }}
            className="w-full flex items-center justify-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer hover:bg-amber-500/20"
          >
            <span>🎁</span>
            <span>
              {userProfile?.name
                ? `Кабінет URBAN CLUB (${userProfile.name.split(" ")[0]})`
                : "Особистий кабінет URBAN CLUB"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-white/10">
            <a
              href="/urban-bites/restaurants/"
              className="flex items-center justify-center gap-1.5 bg-[#181B22] hover:bg-[#222732] border border-white/10 text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>🍕</span>
              <span>Pizza & Sushi</span>
            </a>
            <a
              href="/urban-bites/cafe/"
              className="flex items-center justify-center gap-1.5 bg-[#181B22] hover:bg-[#222732] border border-white/10 text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>🥐</span>
              <span>Bakery & Coffee</span>
            </a>
          </div>
          <nav className="flex flex-col space-y-2.5 text-sm font-semibold text-[#CBD5E1]">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="py-1.5 hover:text-amber-400 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
