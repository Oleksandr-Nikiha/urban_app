import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { ApiError, getAdminToken } from "@/api/client";
import { useAdminMe, useMe } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { ErrorBox, Spinner } from "@/components/ui";
import { CartPage } from "@/pages/CartPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProductPage } from "@/pages/ProductPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";

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
  );
}
