/**
 * Центральний експорт react-query хуків та ключів кешу.
 * Декомпозовано за доменами:
 * - keys: ключі кешування
 * - catalog: публічний каталог та адреси доставки
 * - auth: реєстрація, логін та профіль (включаючи useAdminMe)
 * - cart: кошик (серверний + гостьовий)
 * - orders: замовлення користувача
 */

export * from "./queries/keys";
export * from "./queries/catalog";
export * from "./queries/auth";
export * from "./queries/cart";
export * from "./queries/orders";
