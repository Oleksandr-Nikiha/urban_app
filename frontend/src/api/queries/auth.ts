import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, api, hasTelegramAuth, removeUserToken, setUserToken } from "@/api/client";
import type { AdminMe, BonusTransaction, RegisterPayload, User, UserUpdatePayload } from "@/api/types";
import { keys } from "./keys";

// --- Профіль і автентифікація ---

/**
 * 404 тут — не помилка, а «користувач ще не зареєстрований»: саме так бекенд
 * відповідає на /me для незнайомого telegram_id. Тому не ретраїмо і віддаємо null.
 * У режимі звичайного вебу без Telegram або при 401 повертаємо null (гість).
 */
export function useMe(): UseQueryResult<User | null> {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      if (!hasTelegramAuth()) {
        return null;
      }
      try {
        const user = await api.get<User>("/me");
        if (user.auth_token) {
          setUserToken(user.auth_token);
        }
        return user;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null;
        throw e;
      }
    },
    retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.post<User>("/register", payload),
    onSuccess: (user) => {
      if (user.auth_token) {
        setUserToken(user.auth_token);
      }
      qc.setQueryData(keys.me, user);
      void qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function usePhoneLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { phone: string; full_name?: string; telegram_id?: number | null }) =>
      api.post<User>("/auth/phone-login", payload),
    onSuccess: (user) => {
      if (user.auth_token) {
        setUserToken(user.auth_token);
      }
      qc.setQueryData(keys.me, user);
      void qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    removeUserToken();
    qc.setQueryData(keys.me, null);
    void qc.invalidateQueries({ queryKey: keys.cart });
  };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) => api.patch<User>("/me", payload),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

export function useMyBonusHistory() {
  return useQuery({
    queryKey: ["me", "bonuses", "history"],
    queryFn: () => api.get<BonusTransaction[]>("/me/bonuses/history"),
    staleTime: 30_000,
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: keys.adminMe,
    queryFn: () => api.get<AdminMe>("/admin/me"),
    staleTime: 30_000,
  });
}
