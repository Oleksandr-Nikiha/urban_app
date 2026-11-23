import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { ApiError, getAdminToken } from "@/api/client";
import { useAdminMe, useMe } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { ErrorBox, Spinner } from "@/components/ui";
import { CategoriesPage } from "@/pages/CategoriesPage";

// Легкі динамічні імпорти другорядних сторінок для code-splitting та прискорення старту TMA
const CartPage = lazy(() => import("@/pages/CartPage").then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const ContactsPage = lazy(() => import("@/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const OrderSuccessPage = lazy(() => import("@/pages/OrderSuccessPage").then((m) => ({ default: m.OrderSuccessPage })));
const OrdersPage = lazy(() => import("@/pages/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const ProductPage = lazy(() => import("@/pages/ProductPage").then((m) => ({ default: m.ProductPage })));
const ProductsPage = lazy(() => import("@/pages/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));

import {
  getTelegramStartParam,
  isStartParamConsumed,
  markStartParamConsumed,
  isTelegramWebApp,
} from "@/telegram/env";

function AdminRedirect() {
  useEffect(() => {
    const search = window.location.search;
    const hash = window.location.hash;
    window.location.href = `/urban-bites/admin/${search}${hash}`;
  }, []);
  return <Spinner />;
}

function resolveTargetOrderId(): string | null {
  const startParam = getTelegramStartParam();
  if (startParam && !isStartParamConsumed(startParam)) {
    const match = startParam.match(/^(?:order_?)?(\d+)$/i);
    if (match) return match[1];
  }
  if (typeof window !== "undefined") {
    if (window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get("order_id") || sp.get("edit_order");
      if (id && /^\d+$/.test(id)) return id;
    }
    if (window.location.hash) {
      const hp = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
      const id = hp.get("order_id") || hp.get("edit_order");
      if (id && /^\d+$/.test(id)) return id;
    }
  }
  return null;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { isPending, error, refetch } = useMe();
  const { data: adminMe, isPending: isAdminMePending } = useAdminMe();
  const isTg = isTelegramWebApp();

  const isStaff = Boolean(adminMe?.is_staff || getAdminToken());
  const targetOrderId = resolveTargetOrderId();

  useEffect(() => {
    if (isAdminRoute) {
      const sp = getTelegramStartParam();
      if (sp) markStartParamConsumed(sp);
      return;
    }

    if (isAdminMePending && isTg) {
      return;
    }

    const checkAndRedirect = () => {
      const orderId = resolveTargetOrderId();
      if (
        orderId &&
        !location.pathname.startsWith("/admin") &&
        location.pathname !== `/orders/${orderId}/success`
      ) {
        markStartParamConsumed();
        if (isStaff) {
          window.location.href = `/urban-bites/admin/?order_id=${orderId}`;
        } else {
          navigate(`/orders/${orderId}/success`, { replace: true });
        }
        return true;
      }
      return false;
    };

    if (checkAndRedirect()) return;

    // Перевіряємо повторно у разі асинхронного завантаження Telegram WebApp SDK
    const interval = setInterval(() => {
      if (checkAndRedirect()) {
        clearInterval(interval);
      }
    }, 150);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [location.pathname, navigate, isStaff, isAdminMePending, isTg, isAdminRoute]);

  // Якщо передано ID замовлення (через startapp або order_id), ведемо в адмінку (для персоналу) або на екран відстеження (для клієнта)
  if (
    targetOrderId &&
    !isAdminRoute &&
    location.pathname !== `/orders/${targetOrderId}/success` &&
    (!isAdminMePending || !isTg)
  ) {
    markStartParamConsumed();
    if (isStaff) {
      window.location.href = `/urban-bites/admin/?order_id=${targetOrderId}`;
      return <Spinner />;
    }
    return <Navigate to={`/orders/${targetOrderId}/success`} replace />;
  }

  // Для адмін-панелі (/admin, /admin/login) не показуємо онбординг або блокувальні екрани клієнта
  if (!isAdminRoute) {
    if (isPending && isTg) return <Spinner />;

    // 401 означає, що бекенд не визнав підпис initData всередині Telegram.
    if (isTg && error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl">🔒</div>
          <p className="mt-4 font-medium">Не вдалося підтвердити сесію</p>
          <p className="mt-2 text-sm opacity-60">
            Відкрийте застосунок через кнопку «Меню» в боті Urban Bites.
          </p>
          <p className="mt-4 text-xs opacity-40">{error.detail}</p>
        </div>
      );
    }

    // Інші помилки мережі (500 тощо)
    if (error && !(error instanceof ApiError && error.status === 401)) {
      return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CategoriesPage />} />
          <Route path="/categories/:categoryId" element={<ProductsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
        {/* Картка товару, чекаут, реєстрація, екран успіху — без клієнтської нижньої панелі */}
        <Route path="/admin/*" element={<AdminRedirect />} />
        <Route path="/admin" element={<AdminRedirect />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/products/:productId" element={<ProductPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders/:orderId/success" element={<OrderSuccessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
