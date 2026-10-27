import { useEffect, useMemo, useState } from "react";
import {
  PIZZA_LOCATION_ID,
  fetchCategories,
  fetchLocationInfo,
  fetchProductsByCategory,
  fetchWebProfile,
} from "./api/client.ts";
import { UserCabinetModal } from "./components/cabinet/UserCabinetModal.tsx";
import { CartDrawer } from "./components/CartDrawer.tsx";
import { CategoryNav } from "./components/CategoryNav.tsx";
import { CheckoutModal } from "./components/CheckoutModal.tsx";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Hero } from "./components/Hero.tsx";
import { LAST_ORDER_STORAGE_KEY, OrderTrackingModal } from "./components/OrderTrackingModal.tsx";
import { ProductModal } from "./components/ProductModal.tsx";
import { AboutSection } from "./components/sections/AboutSection.tsx";
import { CareersSection } from "./components/sections/CareersSection.tsx";
import { DeliverySection } from "./components/sections/DeliverySection.tsx";
import { MenuSection } from "./components/sections/MenuSection.tsx";
import { useScrollSpy } from "./hooks/useScrollSpy.ts";
import type { Category, LocationInfo, ProductListItem } from "./types/catalog.ts";
import type { OrderOut } from "./types/order.ts";
import {
  getSharedCookie,
  isUserAuthenticated,
  loadSavedProfile,
  saveSharedProfile,
  USER_PROFILE_STORAGE_KEY,
  type UserProfile,
} from "./types/user.ts";

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Record<number, ProductListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);

  // Стан пошуку
  const [searchQuery, setSearchQuery] = useState("");

  // Авторизація та профіль клієнта
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReason, setAuthReason] = useState<"cabinet" | "checkout" | null>(null);
  const [pendingCheckoutAfterAuth, setPendingCheckoutAfterAuth] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => isUserAuthenticated(userProfile), [userProfile]);

  // Модальні вікна
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCabinetOpen, setIsCabinetOpen] = useState(false);

  // Відстеження замовлення наживо
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [initialTrackingOrder, setInitialTrackingOrder] = useState<OrderOut | null>(null);
  const [isNewlyCreatedOrder, setIsNewlyCreatedOrder] = useState(false);

  // Scrollspy & Плавний скрол
  const {
    selectedCategoryId,
    activeNavId,
    activeSubcategoryId,
    showScrollTop,
    handleSelectCategory,
    handleSelectNav,
    handleSelectSubcategory,
    handleScrollToMenu,
    scrollToTop,
  } = useScrollSpy({
    categories,
    searchQuery,
    onClearSearch: () => setSearchQuery(""),
  });

  // Ініціалізація трекінгу з URL (?order=123) та збережених даних
  useEffect(() => {
    try {
      const savedLast = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
      if (savedLast) {
        const parsed = parseInt(savedLast, 10);
        if (parsed && !isNaN(parsed)) {
          setLastOrderId(parsed);
        }
      }

      let savedUser = loadSavedProfile();
      if (!savedUser) {
        const cookiePhone = getSharedCookie("urban_auth_phone");
        const cookieTg = getSharedCookie("urban_auth_tg");
        if (cookiePhone || cookieTg) {
          savedUser = {
            name: "Клієнт",
            phone: cookiePhone || "",
            telegram_id: cookieTg ? Number(cookieTg) : null,
            street: "",
            house: "",
            apartment: "",
            bonuses: 50,
            isAuthenticated: true,
          };
        }
      }

      if (savedUser && isUserAuthenticated(savedUser)) {
        const isVerified = Boolean(savedUser.is_phone_verified || savedUser.telegram_id);
        const initialUser: UserProfile = {
          ...savedUser,
          is_phone_verified: isVerified,
          bonuses: savedUser.bonuses ?? 50,
        };
        setUserProfile(initialUser);
        if (savedUser.name) {
          setUserName(savedUser.name);
        }
        if (savedUser.avatar_url) {
          setUserAvatarUrl(savedUser.avatar_url);
        }

        // Синхронізуємо профіль із сервером (верифікація, адреса, бонуси)
        if (savedUser.telegram_id || savedUser.phone) {
          void fetchWebProfile({
            telegram_id: savedUser.telegram_id,
            phone: savedUser.phone,
          }).then((serverUser) => {
            if (serverUser) {
              setUserProfile((prev) => {
                const synced: UserProfile = {
                  ...(prev || savedUser),
                  name: serverUser.full_name || prev?.name || savedUser.name,
                  first_name: serverUser.first_name || prev?.first_name,
                  last_name: serverUser.last_name || prev?.last_name,
                  phone: serverUser.phone || prev?.phone || savedUser.phone,
                  telegram_id: serverUser.telegram_id || prev?.telegram_id || savedUser.telegram_id,
                  is_phone_verified:
                    serverUser.is_phone_verified ||
                    Boolean(serverUser.telegram_id) ||
                    Boolean(prev?.telegram_id),
                  street: prev?.street || serverUser.delivery_address || "",
                  additional_address: prev?.additional_address || serverUser.additional_address || "",
                  client_code: serverUser.client_code || prev?.client_code,
                  bonuses: serverUser.bonus_balance ?? prev?.bonuses ?? 50,
                };
                saveSharedProfile(synced);
                if (synced.name) setUserName(synced.name);
                return synced;
              });
            }
          });
        }
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get("order");
    if (orderParam) {
      const parsed = parseInt(orderParam, 10);
      if (parsed && !isNaN(parsed)) {
        setTrackingOrderId(parsed);
        setIsTrackingOpen(true);
      }
    }
  }, []);

  const handleOpenCabinet = () => {
    setAuthReason("cabinet");
    setIsCabinetOpen(true);
  };

  const handleOpenCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleAuthSuccess = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    setUserName(newProfile.name || newProfile.first_name || null);
    setUserAvatarUrl(newProfile.avatar_url || null);

    if (pendingCheckoutAfterAuth) {
      setPendingCheckoutAfterAuth(false);
      setIsCabinetOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  const handleProfileUpdated = (prof: UserProfile) => {
    if (isUserAuthenticated(prof)) {
      setUserProfile(prof);
      setUserName(prof.name || prof.first_name || null);
      setUserAvatarUrl(prof.avatar_url || null);
    } else {
      setUserProfile(null);
      setUserName(null);
      setUserAvatarUrl(null);
    }
  };

  const handleOpenTracking = (orderId?: number | null) => {
    const targetId = orderId || lastOrderId;
    if (!targetId) return;
    setTrackingOrderId(targetId);
    setIsNewlyCreatedOrder(false);
    setIsTrackingOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("order", String(targetId));
    window.history.replaceState({}, "", url.toString());
  };

  const handleCloseTracking = () => {
    setIsTrackingOpen(false);
    setInitialTrackingOrder(null);
    setIsNewlyCreatedOrder(false);

    const url = new URL(window.location.href);
    url.searchParams.delete("order");
    window.history.replaceState({}, "", url.toString());
  };

  const handleOrderCreatedSuccess = (order: OrderOut, createdProfile?: UserProfile) => {
    setLastOrderId(order.id);
    setTrackingOrderId(order.id);
    setInitialTrackingOrder(order);
    setIsNewlyCreatedOrder(true);
    setIsTrackingOpen(true);

    if (order.contact_name) {
      setUserName(order.contact_name);
    }

    if (createdProfile) {
      setUserProfile(createdProfile);
    } else {
      try {
        const saved = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        if (saved) {
          const parsed: UserProfile = JSON.parse(saved);
          setUserProfile(parsed);
        }
      } catch {}
    }

    const url = new URL(window.location.href);
    url.searchParams.set("order", String(order.id));
    window.history.replaceState({}, "", url.toString());
  };

  // Завантаження категорій та страв
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([fetchCategories(PIZZA_LOCATION_ID), fetchLocationInfo(PIZZA_LOCATION_ID)])
      .then(async ([cats, loc]) => {
        if (!isMounted) return;
        setCategories(cats);
        setLocationInfo(loc);

        const rootCats = cats.filter((c) => c.parent_id === null);

        const productsMap: Record<number, ProductListItem[]> = {};
        await Promise.all(
          rootCats.map(async (cat) => {
            try {
              const items = await fetchProductsByCategory(cat.id);
              productsMap[cat.id] = items;
            } catch (err) {
              console.error(`Помилка для категорії ${cat.id}`, err);
              productsMap[cat.id] = [];
            }
          }),
        );

        if (!isMounted) return;
        setProductsByCategory(productsMap);
      })
      .catch((err) => {
        console.error("Помилка завантаження даних", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const rootCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories],
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredProductsByCategory = useMemo(() => {
    if (!normalizedSearch) return productsByCategory;
    const res: Record<number, ProductListItem[]> = {};
    for (const [catIdStr, items] of Object.entries(productsByCategory)) {
      const catId = Number(catIdStr);
      res[catId] = items.filter(
        (item) =>
          item.name.toLowerCase().includes(normalizedSearch) ||
          (item.category_name && item.category_name.toLowerCase().includes(normalizedSearch)),
      );
    }
    return res;
  }, [productsByCategory, normalizedSearch]);

  const totalSearchResults = useMemo(() => {
    if (!normalizedSearch) return 0;
    return Object.values(filteredProductsByCategory).reduce(
      (sum, list) => sum + list.length,
      0,
    );
  }, [filteredProductsByCategory, normalizedSearch]);

  const visibleCategories = useMemo(() => {
    if (normalizedSearch) {
      return rootCategories.filter(
        (cat) => (filteredProductsByCategory[cat.id]?.length || 0) > 0,
      );
    }
    return rootCategories;
  }, [rootCategories, filteredProductsByCategory, normalizedSearch]);

  return (
    <div id="top" className="min-h-screen flex flex-col bg-transparent text-[#F1F5F9]">
      {/* Шапка сайту */}
      <Header
        onOpenCart={() => setIsCartOpen(true)}
        phone={locationInfo?.phones[0] || "+380 (44) 222-00-11"}
        address={locationInfo?.address || "м. Київ, вул. Набережна, 12"}
        activeNavId={activeNavId}
        onSelectNav={handleSelectNav}
        lastOrderId={lastOrderId}
        onOpenTracking={() => handleOpenTracking()}
        onOpenCabinet={handleOpenCabinet}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        isAuthenticated={isAuthenticated}
      />

      {/* Головний банер (Hero) */}
      <Hero onScrollToMenu={handleScrollToMenu} />

      {/* Липка навігація категоріями та пошук */}
      {rootCategories.length > 0 && (
        <CategoryNav
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          activeNavId={activeNavId}
          activeSubcategoryId={activeSubcategoryId}
          onSelectCategory={handleSelectCategory}
          onSelectNav={handleSelectNav}
          onSelectSubcategory={handleSelectSubcategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          productsByCategory={filteredProductsByCategory}
        />
      )}

      {/* Секція Меню з каталогом та пошуком */}
      <MenuSection
        categories={visibleCategories}
        allCategories={categories}
        productsByCategory={filteredProductsByCategory}
        loading={loading}
        searchQuery={searchQuery}
        totalSearchResults={totalSearchResults}
        onClearSearch={() => setSearchQuery("")}
        onSelectProduct={(id) => setSelectedProductId(id)}
      />

      {/* Секція Про пекарню */}
      <AboutSection />

      {/* Секція Доставка та оплата */}
      <DeliverySection />

      {/* Секція Вакансії */}
      <CareersSection />

      {/* Футер сайту */}
      <Footer />

      {/* Модалка товару */}
      {selectedProductId && (
        <ProductModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
        />
      )}

      {/* Слайдер кошика */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOpenCheckout={handleOpenCheckout}
        isAuthenticated={isAuthenticated}
      />

      {/* Модалка чекауту */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleOrderCreatedSuccess}
        isAuthenticated={isAuthenticated}
        userProfile={userProfile}
        onRequireAuth={() => {
          setIsCheckoutOpen(false);
          setAuthReason("checkout");
          setPendingCheckoutAfterAuth(true);
          setIsCabinetOpen(true);
        }}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Особистий кабінет клієнта */}
      <UserCabinetModal
        isOpen={isCabinetOpen}
        onClose={() => {
          setIsCabinetOpen(false);
          setPendingCheckoutAfterAuth(false);
        }}
        onOpenTracking={(id) => handleOpenTracking(id)}
        onOpenCart={() => setIsCartOpen(true)}
        isAuthenticated={isAuthenticated}
        authReason={authReason}
        onAuthSuccess={handleAuthSuccess}
        onProfileUpdated={handleProfileUpdated}
        brandTitle="Urban Pizza & Sushi"
        locationSubtitle="Urban Pizza & Sushi • м. Київ"
        cartEmoji="🍕"
      />

      {/* Модалка відстеження замовлення наживо */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        orderId={trackingOrderId}
        initialOrder={initialTrackingOrder}
        isNewlyCreated={isNewlyCreatedOrder}
        onClose={handleCloseTracking}
      />

      {/* Кнопка Нагору */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Піднятися нагору"
          className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1E232B] text-white shadow-2xl hover:bg-[#2A313C] flex items-center justify-center font-bold text-base sm:text-lg active:scale-90 transition-all cursor-pointer border border-white/15 animate-in fade-in zoom-in-75 duration-200"
        >
          ⬆️
        </button>
      )}
    </div>
  );
}
