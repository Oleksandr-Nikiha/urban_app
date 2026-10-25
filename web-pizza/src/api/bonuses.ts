export interface BonusTransaction {
  id: number;
  user_id: number;
  order_id: number | null;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

export async function fetchBonusHistory(params: {
  phone?: string | null;
  telegram_id?: number | null;
  limit?: number;
}): Promise<BonusTransaction[]> {
  const parts: string[] = [];
  if (params.phone) parts.push(`phone=${encodeURIComponent(params.phone)}`);
  if (params.telegram_id) parts.push(`telegram_id=${params.telegram_id}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  if (parts.length === 0) return [];

  try {
    const res = await fetch(`/api/auth/bonuses/history?${parts.join("&")}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
