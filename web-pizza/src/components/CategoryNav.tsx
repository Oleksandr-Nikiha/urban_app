import { useEffect, useMemo, useRef } from "react";
import type { Category, ProductListItem } from "../types/catalog.ts";

interface CategoryNavProps {
  categories: Category[];
  selectedCategoryId: number | null;
  activeNavId: string | number | null;
  activeSubcategoryId?: number | null;
  onSelectCategory: (id: number) => void;
  onSelectNav: (id: string | number) => void;
  onSelectSubcategory?: (subcatId: number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  productsByCategory?: Record<number, ProductListItem[]>;
}

export function CategoryNav({
  categories,
  selectedCategoryId,
  activeNavId,
  onSelectCategory,
  onSelectNav,
  searchQuery,
  onSearchChange,
  productsByCategory = {},
}: CategoryNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  // Фільтруємо кореневі категорії: тільки ті, де є доступні страви
  const rootCategories = useMemo(() => {
    return categories.filter(
      (c) => c.parent_id === null && (productsByCategory[c.id]?.length || 0) > 0,
    );
  }, [categories, productsByCategory]);

  const isInfoActive =
    typeof activeNavId === "string" &&
    ["about", "delivery", "careers", "contacts"].includes(activeNavId);

  // Фіксуємо точну динамічну висоту навігаційної плашки
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--category-nav-height",
        `${Math.round(height)}px`,
      );
    };

    updateHeight();

    const ro = new ResizeObserver(() => {
      updateHeight();
    });
    ro.observe(el);

    window.addEventListener("resize", updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  // Розумне автопрокручування активної категорії без підгинання під пошуковий рядок
  useEffect(() => {
    if (!categoriesScrollRef.current || searchQuery) return;
    const targetKey = String(activeNavId ?? selectedCategoryId);
    const container = categoriesScrollRef.current;

    // Якщо активна перша коренева категорія — завжди скидаємо на початок
    if (rootCategories.length > 0 && String(rootCategories[0].id) === targetKey) {
      container.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    const activeBtn = container.querySelector<HTMLElement>(
      `[data-category-id="${targetKey}"]`,
    );
    if (!activeBtn) return;

    const activeRect = activeBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Якщо кнопка вже повністю у видимій зоні — скрол не чіпаємо взагалі
    if (activeRect.left >= containerRect.left && activeRect.right <= containerRect.right) {
      return;
    }

    if (activeRect.left < containerRect.left) {
      container.scrollBy({
        left: activeRect.left - containerRect.left - 16,
        behavior: "smooth",
      });
    } else if (activeRect.right > containerRect.right) {
      container.scrollBy({
        left: activeRect.right - containerRect.right + 16,
        behavior: "smooth",
      });
    }
  }, [activeNavId, selectedCategoryId, searchQuery, rootCategories]);

  return (
    <div
      ref={navRef}
      data-category-nav="true"
      className="sticky z-30 bg-[#121417]/85 backdrop-blur-md border-b border-white/10 py-2.5 sm:py-3 shadow-lg shadow-black/20"
      style={{ top: "calc(var(--header-height, 96px) - 1px)" }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
          {/* Поле швидкого пошуку */}
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8] pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Пошук піци, ролів, бургерів..."
              className="w-full bg-[#1A1D24] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#D34528]/40 focus:border-[#D34528] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                title="Очистити пошук"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Горизонтальний ряд категорій меню */}
          <div
            ref={categoriesScrollRef}
            className="flex-1 min-w-0 relative flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar"
          >
            {rootCategories.map((cat) => {
              const isSelected =
                !searchQuery &&
                !isInfoActive &&
                (activeNavId === cat.id || selectedCategoryId === cat.id);
              const isSushi = /суші|рол|сет|sushi|roll/i.test(cat.name);
              const isPizza = /піц|піцц|pizza/i.test(cat.name);

              return (
                <button
                  key={cat.id}
                  data-category-id={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? isSushi
                        ? "bg-[#1E3A2F] text-white shadow-md shadow-[#1E3A2F]/40 border border-emerald-500/40"
                        : isPizza
                        ? "bg-[#D34528] text-white shadow-md shadow-[#D34528]/40 border border-[#E2583E]/50"
                        : "bg-white/20 text-white shadow-md border border-white/20"
                      : isSushi
                      ? "bg-[#1A1D24] hover:bg-[#1E2729] text-emerald-400 border border-emerald-500/25"
                      : isPizza
                      ? "bg-[#1A1D24] hover:bg-[#251D1D] text-[#E2583E] border border-[#D34528]/30"
                      : "bg-[#1A1D24] hover:bg-[#222731] text-[#94A3B8] hover:text-white border border-white/10"
                  }`}
                >
                  {cat.icon && <span className="text-sm sm:text-base">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              );
            })}

            {/* Розділювач */}
            <div className="h-5 w-px bg-white/15 mx-1 shrink-0" />

            {/* Інформаційні секції */}
            <button
              data-category-id="about"
              type="button"
              onClick={() => onSelectNav("about")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "about"
                  ? "bg-white/15 text-white shadow-md border border-white/20"
                  : "bg-[#1A1D24] hover:bg-[#222731] text-[#94A3B8] hover:text-white border border-white/10"
              }`}
            >
              <span>ℹ️</span>
              <span>Про нас</span>
            </button>
            <button
              data-category-id="delivery"
              type="button"
              onClick={() => onSelectNav("delivery")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "delivery"
                  ? "bg-white/15 text-white shadow-md border border-white/20"
                  : "bg-[#1A1D24] hover:bg-[#222731] text-[#94A3B8] hover:text-white border border-white/10"
              }`}
            >
              <span>🛵</span>
              <span>Доставка</span>
            </button>
            <button
              data-category-id="careers"
              type="button"
              onClick={() => onSelectNav("careers")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "careers"
                  ? "bg-white/15 text-white shadow-md border border-white/20"
                  : "bg-[#1A1D24] hover:bg-[#222731] text-[#94A3B8] hover:text-white border border-white/10"
              }`}
            >
              <span>💼</span>
              <span>Вакансії</span>
            </button>
            <button
              data-category-id="contacts"
              type="button"
              onClick={() => onSelectNav("contacts")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                !searchQuery && activeNavId === "contacts"
                  ? "bg-white/15 text-white shadow-md border border-white/20"
                  : "bg-[#1A1D24] hover:bg-[#222731] text-[#94A3B8] hover:text-white border border-white/10"
              }`}
            >
              <span>📍</span>
              <span>Контакти</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
