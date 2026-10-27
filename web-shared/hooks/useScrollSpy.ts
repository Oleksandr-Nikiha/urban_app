import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "../types/catalog.ts";

interface UseScrollSpyOptions {
  categories: Category[];
  searchQuery?: string;
  onClearSearch?: () => void;
}

export function useScrollSpy({
  categories,
  searchQuery = "",
  onClearSearch,
}: UseScrollSpyOptions) {
  const rootCategories = categories.filter((c) => c.parent_id === null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [activeNavId, setActiveNavId] = useState<string | number | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Встановлення початкової категорії при завантаженні каталогу
  useEffect(() => {
    if (rootCategories.length > 0 && selectedCategoryId === null) {
      const firstId = rootCategories[0].id;
      setSelectedCategoryId(firstId);
      setActiveNavId(firstId);
    }
  }, [rootCategories, selectedCategoryId]);

  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Обчислення повної висоти закріплених панелей (шапка + навігація категорій)
  const getStickyNavHeight = useCallback(() => {
    const headerEl = document.querySelector("header");
    const navEl = document.querySelector("[data-category-nav]");
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 96;
    const navH = navEl ? navEl.getBoundingClientRect().height : 56;
    return Math.round(headerH + navH);
  }, []);

  // Точний розрахунок Y-координати початку меню під липкою панеллю
  const getMenuTopScrollY = useCallback(() => {
    const heroEl = document.getElementById("hero");
    const headerEl = document.querySelector<HTMLElement>("header");
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 96;

    if (heroEl) {
      const heroRect = heroEl.getBoundingClientRect();
      const heroBottom = heroRect.bottom + window.scrollY;
      return Math.max(0, Math.round(heroBottom - headerH));
    }

    const navEl = document.querySelector<HTMLElement>("[data-category-nav]");
    if (navEl) {
      const navRect = navEl.getBoundingClientRect();
      return Math.max(0, Math.round(navRect.top + window.scrollY - headerH));
    }

    const menuEl = document.getElementById("menu");
    if (menuEl) {
      const menuRect = menuEl.getBoundingClientRect();
      const navH =
        document.querySelector("[data-category-nav]")?.getBoundingClientRect().height || 56;
      return Math.max(0, Math.round(menuRect.top + window.scrollY - headerH - navH));
    }

    return 0;
  }, []);

  const scrollToMenuTop = useCallback(() => {
    const targetY = getMenuTopScrollY();
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, [getMenuTopScrollY]);

  // Scrollspy: точне визначення активної секції під час скролу сторінки
  const updateActiveElementsOnScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    if (rootCategories.length === 0) return;

    // Якщо доскролили до самого низу сторінки — активні контакти
    const contactsEl = document.getElementById("contacts");
    if (contactsEl) {
      const contactsRect = contactsEl.getBoundingClientRect();
      if (contactsRect.top < window.innerHeight && contactsRect.bottom > 0) {
        const scrollBottom = window.innerHeight + window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        if (scrollBottom >= docHeight - 80) {
          setActiveNavId("contacts");
          setActiveSubcategoryId(null);
          return;
        }
      }
    }

    const stickyHeight = getStickyNavHeight();
    const focalY = stickyHeight + 40;

    // 1. Інформаційні секції сайту
    const infoSections = [
      { id: "about", elementId: "about" },
      { id: "delivery", elementId: "delivery" },
      { id: "careers", elementId: "careers" },
      { id: "contacts", elementId: "contacts" },
    ];

    let foundInfo = false;
    for (const sec of infoSections) {
      const el = document.getElementById(sec.elementId);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY && rect.bottom > 0) {
        setActiveNavId(sec.id);
        setActiveSubcategoryId(null);
        foundInfo = true;
      }
    }
    if (foundInfo) return;

    // 2. Визначення поточної активної категорії в меню
    let currentRoot: number = rootCategories[0].id;
    for (const cat of rootCategories) {
      const el = document.getElementById(`category-${cat.id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY) {
        currentRoot = cat.id;
      }
    }
    setActiveNavId(currentRoot);
    setSelectedCategoryId(currentRoot);

    // Підкатегорії поточної видимої кореневої категорії
    const subcats = categories.filter((c) => c.parent_id === currentRoot);
    if (subcats.length > 0) {
      let currentSub: number | null = null;
      for (const sub of subcats) {
        const el = document.getElementById(`subcategory-${sub.id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= focalY) {
          currentSub = sub.id;
        }
      }
      setActiveSubcategoryId(currentSub);
    } else {
      setActiveSubcategoryId(null);
    }
  }, [categories, rootCategories, getStickyNavHeight]);

  // Зняття програмного блокування при ручному скролі користувача
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
      }
    };

    window.addEventListener("wheel", handleUserInteraction, { passive: true });
    window.addEventListener("touchmove", handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleUserInteraction);
      window.removeEventListener("touchmove", handleUserInteraction);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Throttled scroll listener
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveElementsOnScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [updateActiveElementsOnScroll]);

  // Плавний перехід до конкретної категорії меню
  const handleSelectCategory = (id: number) => {
    if (searchQuery && onClearSearch) {
      onClearSearch();
    }

    setSelectedCategoryId(id);
    setActiveNavId(id);
    setActiveSubcategoryId(null);
    isProgrammaticScrollRef.current = true;

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    const target = document.getElementById(`category-${id}`);
    if (target) {
      const stickyHeight = getStickyNavHeight();
      const targetY = Math.max(
        0,
        target.getBoundingClientRect().top + window.scrollY - (stickyHeight + 16),
      );
      window.scrollTo({ top: targetY, behavior: "smooth" });
    } else {
      scrollToMenuTop();
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateActiveElementsOnScroll();
    }, 600);
  };

  const handleScrollToMenu = () => {
    scrollToMenuTop();
  };

  // Навігація по верхніх посиланнях або інформаційних секціях
  const handleSelectNav = (id: string | number) => {
    if (typeof id === "number") {
      handleSelectCategory(id);
      return;
    }

    if (id === "menu") {
      scrollToMenuTop();
      return;
    }

    if (searchQuery && onClearSearch) {
      onClearSearch();
    }
    setActiveNavId(id);
    setActiveSubcategoryId(null);
    isProgrammaticScrollRef.current = true;

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    const target = document.getElementById(id);
    if (target) {
      const stickyHeight = getStickyNavHeight();
      const targetY = Math.max(
        0,
        target.getBoundingClientRect().top + window.scrollY - (stickyHeight + 16),
      );
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateActiveElementsOnScroll();
    }, 700);
  };

  const handleSelectSubcategory = (subcatId: number | null) => {
    if (searchQuery && onClearSearch) {
      onClearSearch();
    }
    setActiveSubcategoryId(subcatId);

    if (subcatId === null) {
      if (selectedCategoryId) {
        handleSelectCategory(selectedCategoryId);
      } else {
        scrollToMenuTop();
      }
      return;
    }

    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    const target = document.getElementById(`subcategory-${subcatId}`);
    if (target) {
      const stickyHeight = getStickyNavHeight();
      const targetY = Math.max(
        0,
        target.getBoundingClientRect().top + window.scrollY - (stickyHeight + 16),
      );
      window.scrollTo({ top: targetY, behavior: "smooth" });
    } else {
      scrollToMenuTop();
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      updateActiveElementsOnScroll();
    }, 700);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    selectedCategoryId,
    setSelectedCategoryId,
    activeNavId,
    setActiveNavId,
    activeSubcategoryId,
    showScrollTop,
    handleSelectCategory,
    handleSelectSubcategory,
    handleSelectNav,
    handleScrollToMenu,
    scrollToTop,
  };
}
