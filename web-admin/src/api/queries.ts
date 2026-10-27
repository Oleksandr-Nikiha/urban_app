/**
 * Центральний експорт react-query хуків та ключів кешу.
 * Декомпозовано за доменами:
 * - keys: ключі кешування
 * - catalog: публічний каталог та адреси доставки
 * - adminCatalog: адміністрування страв, категорій, опцій, стоп-листа
 * - adminOperations: адміністрування менеджерів, користувачів, замовлень, аналітики, розсилок
 */

export * from "./queries/keys";
export * from "./queries/catalog";
export * from "./queries/adminCatalog";
export * from "./queries/adminOperations";
