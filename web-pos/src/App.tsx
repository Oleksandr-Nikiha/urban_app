import { useEffect, useMemo, useRef, useState } from "react";
import {
  addItemsToOrder,
  authByPin,
  createPosOrder,
  fetchCurrentShift,
  fetchMenu,
  fetchPosOrders,
  fetchStaffList,
  lookupCustomer,
  updateOrderStatus,
} from "./api/client";
import { ActiveOrdersView } from "./components/ActiveOrdersView";
import { CategoryTabs } from "./components/CategoryTabs";
import { OrderCart } from "./components/OrderCart";
import { PaymentModal } from "./components/PaymentModal";
import { PinLockScreen } from "./components/PinLockScreen";
import { PosHeader } from "./components/PosHeader";
import { ProductGrid } from "./components/ProductGrid";
import { ProductModal } from "./components/ProductModal";
import { ShiftModal } from "./components/ShiftModal";
import type {
  CartItem,
  CartItemOption,
  Category,
  CustomerData,
  PosOrder,
  PosShift,
  Product,
  ProductVariant,
  StaffMember,
} from "./types";
import { playNewOrderChime, playReadyChime } from "./utils/audio";

export function App() {
  // Staff & Lock
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Active location: 1 - Pizza & Sushi, 2 - Bakery & Cafe
  const [locationId, setLocationId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"terminal" | "orders">("terminal");
  const [mobileTab, setMobileTab] = useState<"menu" | "cart">("menu");

  // Cash Shift Management
  const [shiftData, setShiftData] = useState<{
    isOpen: boolean;
    shift: PosShift | null;
  }>({
    isOpen: false,
    shift: null,
  });
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Sound notifications
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("pos_sound_enabled");
    return saved !== null ? saved === "true" : true;
  });

  // Menu data
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<"dine_in" | "pickup">("dine_in");
  const [tableNumber, setTableNumber] = useState<string>("1");
  const [orderComment, setOrderComment] = useState("");
  const [appendingOrderId, setAppendingOrderId] = useState<number | null>(null);

  // Customer Loyalty
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [bonusSpent, setBonusSpent] = useState<number>(0);

  // Modals
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | null>(null);

  // Orders list and audio tracking
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const prevOrdersRef = useRef<PosOrder[]>([]);
  const isFirstLoadRef = useRef<boolean>(true);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("pos_sound_enabled", String(next));
      return next;
    });
  };

  // 1. Initial staff load
  useEffect(() => {
    fetchStaffList()
      .then((list) => {
        setStaffList(list);
      })
      .catch((err) => console.error("Error loading staff:", err));
  }, []);

  const loadShift = () => {
    fetchCurrentShift(locationId)
      .then((res) => {
        setShiftData({
          isOpen: res.is_open,
          shift: res.shift || null,
        });
      })
      .catch((err) => console.error("Error loading shift:", err));
  };

  const loadOrders = (isInitial = false) => {
    fetchPosOrders(locationId)
      .then((data) => {
        if (!isInitial && !isFirstLoadRef.current && soundEnabled) {
          const prev = prevOrdersRef.current;
          const prevIds = new Set(prev.map((o) => o.id));

          // Check if brand new order arrived
          const hasNewOrder = data.some((o) => !prevIds.has(o.id));

          // Check if an existing order just turned 'ready'
          const hasOrderTurnedReady = data.some((o) => {
            const old = prev.find((p) => p.id === o.id);
            return old && old.status !== "ready" && o.status === "ready";
          });

          if (hasOrderTurnedReady) {
            playReadyChime();
          } else if (hasNewOrder) {
            playNewOrderChime();
          }
        }

        prevOrdersRef.current = data;
        if (isInitial) {
          isFirstLoadRef.current = false;
        }
        setOrders(data);
      })
      .catch((err) => console.error("Error loading orders:", err));
  };

  // 2. Load menu, shift & orders on location change
  useEffect(() => {
    setLoadingMenu(true);
    fetchMenu(locationId)
      .then((data) => {
        setCategories(data);
        setSelectedCategoryId(null);
      })
      .catch((err) => console.error("Error loading menu:", err))
      .finally(() => setLoadingMenu(false));

    isFirstLoadRef.current = true;
    loadOrders(true);
    loadShift();
  }, [locationId]);

  // 3. Periodic silent auto-refresh (every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders(false);
      loadShift();
    }, 10000);
    return () => clearInterval(interval);
  }, [locationId, soundEnabled]);

  // Filtered products
  const displayedProducts = useMemo(() => {
    // Flatten products from categories
    const allProducts: Product[] = [];
    const seenIds = new Set<number>();

    for (const cat of categories) {
      if (selectedCategoryId === null || cat.id === selectedCategoryId || cat.parent_id === selectedCategoryId) {
        if (cat.products) {
          for (const p of cat.products) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allProducts.push(p);
            }
          }
        }
      }
    }

    if (!searchQuery.trim()) return allProducts;

    const q = searchQuery.toLowerCase().trim();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [categories, selectedCategoryId, searchQuery]);

  // Handle staff login
  const handlePinSuccess = (staff: StaffMember) => {
    setCurrentStaff(staff);
    if (staff.location_id) {
      setLocationId(staff.location_id);
    }
    setIsLocked(false);
  };

  // Product selection: direct add if no custom options, or open modal
  const handleSelectProduct = (product: Product) => {
    const hasMultipleVariants = product.variants && product.variants.length > 1;
    const hasOptions = product.option_groups && product.option_groups.length > 0;

    if (!hasMultipleVariants && !hasOptions && product.variants.length === 1) {
      // Add directly
      handleAddToCart(product, product.variants[0], [], 1);
    } else {
      setModalProduct(product);
    }
  };

  // Add customized item to cart
  const handleAddToCart = (
    product: Product,
    variant: ProductVariant,
    options: CartItemOption[],
    qty: number,
    comment?: string
  ) => {
    const optIdsKey = options
      .map((o) => `${o.option_item_id}x${o.qty || 1}`)
      .sort()
      .join("-");
    const cartId = `${variant.id}_${optIdsKey}_${comment || ""}`;

    // Options cost with free_count per option group
    let extraOptionsCost = 0;
    for (const group of product.option_groups || []) {
      const chosenInGroup = options.filter((o) => o.group_id === group.group_id);
      const deltas: number[] = [];
      for (const o of chosenInGroup) {
        for (let i = 0; i < (o.qty || 1); i++) {
          deltas.push(o.price);
        }
      }
      deltas.sort((a, b) => b - a);
      const charged = deltas.slice(group.free_count);
      extraOptionsCost += charged.reduce((sum, d) => sum + d, 0);
    }
    const unitPrice = variant.price + extraOptionsCost;

    setCartItems((prev) => {
      const existing = prev.find((it) => it.cart_id === cartId);
      if (existing) {
        return prev.map((it) =>
          it.cart_id === cartId ? { ...it, qty: it.qty + qty } : it
        );
      }
      return [
        ...prev,
        {
          cart_id: cartId,
          product_id: product.id,
          product_name: product.name,
          image_url: product.image_url,
          variant_id: variant.id,
          variant_label: variant.label,
          unit_price: unitPrice,
          qty,
          options,
          comment,
        },
      ];
    });
  };

  const handleUpdateQty = (cartId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => (it.cart_id === cartId ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    );
  };

  const handleRemoveItem = (cartId: string) => {
    setCartItems((prev) => prev.filter((it) => it.cart_id !== cartId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCustomer(null);
    setCustomerQuery("");
    setBonusSpent(0);
    setOrderComment("");
  };

  // Loyalty lookup
  const handleLookupCustomer = async () => {
    if (!customerQuery.trim()) return;
    try {
      const res = await lookupCustomer(customerQuery);
      setCustomer(res);
      if (!res.found) {
        alert("Гостя за таким номером не знайдено");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBonus = () => {
    if (!customer) return;
    if (bonusSpent > 0) {
      setBonusSpent(0);
    } else {
      const subtotal = cartItems.reduce((acc, curr) => acc + curr.unit_price * curr.qty, 0);
      const toSpend = Math.min(subtotal, customer.bonus_balance);
      setBonusSpent(toSpend);
    }
  };

  // Send Dine-in order directly to kitchen without payment
  const handleSendDineInToKitchen = async () => {
    if (cartItems.length === 0) return;
    try {
      const payload = {
        location_id: locationId,
        fulfillment_type: "dine_in" as const,
        table_number: tableNumber || "1",
        staff_id: currentStaff?.id,
        staff_name: currentStaff?.staff_name || "Персонал",
        customer_phone: customer?.phone || (customerQuery ? customerQuery : undefined),
        customer_name: customer?.first_name || undefined,
        payment_method: "pending" as const,
        bonus_spent: 0,
        comment: orderComment || undefined,
        items: cartItems.map((it) => ({
          variant_id: it.variant_id,
          qty: it.qty,
          option_variant_ids: it.options.flatMap((o) => Array(o.qty || 1).fill(o.variant_id)),
          comment: it.comment,
        })),
      };

      await createPosOrder(payload);
      handleClearCart();
      setMobileTab("menu");
      loadOrders(false);
      loadShift();
      setActiveTab("orders");
    } catch (err: any) {
      alert(err.message || "Не вдалося відправити замовлення");
    }
  };

  // Append items to existing open table order
  const handleAppendConfirm = async () => {
    if (!appendingOrderId || cartItems.length === 0) return;
    try {
      await addItemsToOrder(
        appendingOrderId,
        cartItems.map((it) => ({
          variant_id: it.variant_id,
          qty: it.qty,
          option_variant_ids: it.options.flatMap((o) => Array(o.qty || 1).fill(o.variant_id)),
          comment: it.comment,
        }))
      );
      handleClearCart();
      setAppendingOrderId(null);
      setMobileTab("menu");
      loadOrders(false);
      setActiveTab("orders");
    } catch (err: any) {
      alert(err.message || "Не вдалося додати позиції");
    }
  };

  const handleStartAppend = (order: PosOrder) => {
    setAppendingOrderId(order.id);
    setTableNumber(order.table_number || "1");
    setFulfillmentType("dine_in");
    setCartItems([]);
    setActiveTab("terminal");
    setMobileTab("menu");
  };

  // Payment confirmation (Takeaway)
  const handleConfirmOrder = async () => {
    if (!paymentMethod) return;

    const payload = {
      location_id: locationId,
      fulfillment_type: fulfillmentType,
      table_number: fulfillmentType === "dine_in" ? tableNumber : undefined,
      staff_id: currentStaff?.id,
      staff_name: currentStaff?.staff_name || "Персонал",
      customer_phone: customer?.phone || (customerQuery ? customerQuery : undefined),
      customer_name: customer?.first_name || undefined,
      payment_method: paymentMethod,
      bonus_spent: bonusSpent,
      comment: orderComment || undefined,
      items: cartItems.map((it) => ({
        variant_id: it.variant_id,
        qty: it.qty,
        option_variant_ids: it.options.flatMap((o) => Array(o.qty || 1).fill(o.variant_id)),
        comment: it.comment,
      })),
    };

    await createPosOrder(payload);
    handleClearCart();
    setMobileTab("menu");
    loadOrders(false);
    loadShift();
  };

  const handleStatusChange = async (orderId: number, statusVal: string) => {
    await updateOrderStatus(orderId, statusVal);
    loadOrders(false);
  };

  const cartTotalCount = cartItems.reduce((acc, it) => acc + it.qty, 0);
  const cartTotalSum = cartItems.reduce((acc, it) => acc + it.unit_price * it.qty, 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0D11] text-[#F1F5F9] overflow-hidden select-none">
      {/* PIN Lockscreen overlay if locked */}
      {isLocked && (
        <PinLockScreen
          staffList={staffList}
          onSuccess={handlePinSuccess}
          onAuth={authByPin}
        />
      )}

      {/* POS Top Header */}
      {currentStaff && (
        <PosHeader
          currentLocationId={locationId}
          onLocationChange={(id) => {
            setLocationId(id);
            setCartItems([]);
          }}
          staff={currentStaff}
          activeOrdersCount={orders.filter((o) => o.status === "in_progress" || o.status === "ready").length}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLock={() => setIsLocked(true)}
          shiftData={shiftData}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "terminal" ? (
          <>
            {/* Left Menu Area: visible on desktop, or on mobile when mobileTab === 'menu' */}
            <main
              className={`flex-1 flex-col p-3 sm:p-5 overflow-hidden ${
                mobileTab === "cart" ? "hidden lg:flex" : "flex"
              }`}
            >
              <CategoryTabs
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              {loadingMenu ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mr-3" />
                  <span>Завантаження меню...</span>
                </div>
              ) : (
                <ProductGrid
                  products={displayedProducts}
                  onSelectProduct={handleSelectProduct}
                />
              )}

              {/* Mobile sticky bottom cart bar */}
              <div className="lg:hidden pt-2 shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,20px))]">
                <button
                  type="button"
                  onClick={() => setMobileTab("cart")}
                  className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm shadow-xl flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
                    cartTotalCount > 0
                      ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                      : "bg-[#1A1F2B] text-zinc-400 border border-white/5"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{appendingOrderId ? "➕" : "🛒"}</span>
                    <span>
                      {appendingOrderId
                        ? `Дозамовлення #${appendingOrderId} (${cartTotalCount})`
                        : cartTotalCount > 0
                        ? `Чек (${cartTotalCount} ${cartTotalCount === 1 ? "страва" : "страви"})`
                        : "Чек порожній"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-base font-bold">
                      {cartTotalSum} ₴
                    </span>
                    <span>➔</span>
                  </div>
                </button>
              </div>
            </main>

            {/* Right Cart Drawer: visible on desktop, or on mobile when mobileTab === 'cart' */}
            <div
              className={`h-full ${
                mobileTab === "menu" ? "hidden lg:flex" : "flex w-full lg:w-auto"
              }`}
            >
              <OrderCart
                items={cartItems}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onClearCart={() => {
                  handleClearCart();
                  setAppendingOrderId(null);
                  setMobileTab("menu");
                }}
                fulfillmentType={fulfillmentType}
                onFulfillmentTypeChange={setFulfillmentType}
                tableNumber={tableNumber}
                onTableNumberChange={setTableNumber}
                customer={customer}
                customerQuery={customerQuery}
                onCustomerQueryChange={setCustomerQuery}
                onLookupCustomer={handleLookupCustomer}
                bonusSpent={bonusSpent}
                onToggleBonus={handleToggleBonus}
                orderComment={orderComment}
                onOrderCommentChange={setOrderComment}
                onStartPayment={(m) => setPaymentMethod(m)}
                onSendToKitchen={handleSendDineInToKitchen}
                appendingOrderId={appendingOrderId}
                onAppendConfirm={handleAppendConfirm}
                onCancelAppend={() => {
                  setAppendingOrderId(null);
                  handleClearCart();
                }}
                onBackToMenu={() => setMobileTab("menu")}
              />
            </div>
          </>
        ) : (
          /* Active Orders & KDS Board */
          <ActiveOrdersView
            orders={orders}
            staffName={currentStaff?.staff_name}
            onRefresh={() => loadOrders(false)}
            onUpdateStatus={handleStatusChange}
            onAppendToOrder={handleStartAppend}
          />
        )}
      </div>

      {/* Product Customization Modal */}
      {modalProduct && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Payment Confirmation Modal */}
      {paymentMethod && (
        <PaymentModal
          method={paymentMethod}
          totalAmount={Math.max(
            0,
            cartItems.reduce((acc, curr) => acc + curr.unit_price * curr.qty, 0) - bonusSpent
          )}
          tableNumber={tableNumber}
          fulfillmentType={fulfillmentType}
          onClose={() => setPaymentMethod(null)}
          onConfirm={handleConfirmOrder}
        />
      )}

      {/* Shift Management Modal */}
      {isShiftModalOpen && currentStaff && (
        <ShiftModal
          locationId={locationId}
          currentStaff={currentStaff}
          shiftData={shiftData}
          onClose={() => setIsShiftModalOpen(false)}
          onRefreshShift={() => {
            loadShift();
            loadOrders(false);
          }}
        />
      )}
    </div>
  );
}
