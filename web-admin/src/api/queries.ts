/**
 * Центральний експорт react-query хуків та ключів кешу.
 * Декомпозовано за доменами:
 * - keys: ключі кешування
 * - catalog: публічний каталог та адреси доставки
 * - auth: реєстрація, логін та профіль
 * - cart: кошик (серверний + гостьовий)
 * - orders: замовлення користувача
 * - adminCatalog: адміністрування страв, категорій, опцій, стоп-листа
 * - adminOperations: адміністрування менеджерів, користувачів, замовлень, аналітики, розсилок
 */

export * from "./queries/keys";
export * from "./queries/catalog";
export * from "./queries/auth";
export * from "./queries/cart";
export * from "./queries/orders";
export * from "./queries/adminCatalog";
export * from "./queries/adminOperations";
