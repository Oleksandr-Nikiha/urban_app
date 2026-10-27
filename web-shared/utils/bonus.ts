/**
 * Утиліти розрахунку бонусів та кешбеку URBAN CLUB для веб-сайтів.
 *
 * Сітка кешбеку:
 * - Сума <= 50 ₴: 0% (бонуси не нараховуються)
 * - Сума 50.01 – 100 ₴: 1%
 * - Сума 100.01 – 700 ₴: 3%
 * - Сума 700.01 – 1 200 ₴: 5%
 * - Сума 1 200.01 – 1 800 ₴: 7%
 * - Понад 1 800 ₴: 10%
 */

export function getBonusCashbackRate(amount: number): number {
  if (amount <= 50) return 0;
  if (amount <= 100) return 0.01;
  if (amount <= 700) return 0.03;
  if (amount <= 1200) return 0.05;
  if (amount <= 1800) return 0.07;
  return 0.10;
}

export function calculateBonusCashback(amount: number): number {
  const rate = getBonusCashbackRate(amount);
  return Math.floor(amount * rate);
}

export function getBonusCashbackPercentLabel(amount: number): string {
  const rate = getBonusCashbackRate(amount);
  return `${Math.round(rate * 100)}%`;
}
