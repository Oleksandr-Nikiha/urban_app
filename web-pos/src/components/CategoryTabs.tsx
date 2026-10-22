import type { Category } from "../types";

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (catId: number | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function CategoryTabs({
  categories,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: CategoryTabsProps) {
  // Тільки кореневі категорії
  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col space-y-2 sm:space-y-3 pb-2 sm:pb-3 shrink-0">
      {/* Search and All-items */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs sm:text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Швидкий пошук у меню..."
            className="w-full bg-[#13171F] border border-white/10 rounded-xl pl-8 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs bg-white/10 rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories horizontal scroll pills */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 sm:space-x-2 border shrink-0 ${
            selectedCategoryId === null
              ? "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20"
              : "bg-[#13171F] border-white/5 text-zinc-300 hover:border-white/20 hover:text-white"
          }`}
        >
          <span>🔥</span>
          <span>Всі</span>
        </button>

        {rootCategories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 sm:space-x-2 border shrink-0 ${
                isSelected
                  ? "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20"
                  : "bg-[#13171F] border-white/5 text-zinc-300 hover:border-white/20 hover:text-white"
              }`}
            >
              {cat.icon && <span>{cat.icon}</span>}
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
