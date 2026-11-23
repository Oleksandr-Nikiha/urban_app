import { useEffect, useMemo, useRef, useState } from "react";
import { useDeliveryAddresses, useDeliveryCities } from "@/api/queries";
import type { DeliveryAddress } from "@/api/types";
import { haptic } from "@/telegram/sdk";

export interface AddressParts {
  city: string;
  street: string;
  house: string;
  floor: string;
  apartment: string;
}

interface AddressSelectorProps {
  value?: string | null;
  onChange: (fullAddress: string, isValid: boolean, parts: AddressParts) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Допоміжний парсер існуючого рядка адреси (для сумісності з раніше збереженими адресами)
 */
function parseAddressString(raw: string | null | undefined, knownStreets: DeliveryAddress[]): AddressParts {
  const defaultCity = "Київ";
  if (!raw || !raw.trim()) {
    return { city: defaultCity, street: "", house: "", floor: "", apartment: "" };
  }

  const trimmed = raw.trim();
  let city = defaultCity;
  if (trimmed.toLowerCase().includes("київ")) {
    city = "Київ";
  }


  // Спробуємо знайти відповідну вулицю зі списку
  let matchedStreet = "";
  for (const s of knownStreets) {
    if (trimmed.toLowerCase().includes(s.street.toLowerCase())) {
      matchedStreet = s.street;
      break;
    }
  }

  // Витяг номерів: буд., пов., кв.
  let house = "";
  let floor = "";
  let apartment = "";

  const houseMatch = trimmed.match(/(?:буд\.?|будинок|д\.?)\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
  if (houseMatch) {
    house = houseMatch[1];
  }

  const floorMatch = trimmed.match(/(?:пов\.?|поверх)\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
  if (floorMatch) {
    floor = floorMatch[1];
  }

  const aptMatch = trimmed.match(/(?:кв\.?|квартира)\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
  if (aptMatch) {
    apartment = aptMatch[1];
  }

  // Якщо будинок не розпізнано за префіксом буд., спробуємо витягти з коми
  if (!house && matchedStreet) {
    const afterStreet = trimmed.slice(trimmed.indexOf(matchedStreet) + matchedStreet.length);
    const fallbackMatch = afterStreet.match(/^[,\s]+([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/);
    if (fallbackMatch && !fallbackMatch[1].startsWith("кв") && !fallbackMatch[1].startsWith("пов")) {
      house = fallbackMatch[1];
    }
  }

  return {
    city,
    street: matchedStreet,
    house,
    floor,
    apartment,
  };
}

export function formatFullAddress(parts: AddressParts): string {
  if (!parts.street.trim() || !parts.house.trim()) {
    return "";
  }
  const cleanCity = parts.city.trim() || "Київ";
  const cleanStreet = parts.street.trim();
  const cleanHouse = parts.house.trim();
  const cleanFloor = parts.floor.trim();
  const cleanApt = parts.apartment.trim();

  let formatted = `м. ${cleanCity}, ${cleanStreet}, буд. ${cleanHouse}`;
  if (cleanFloor) {
    formatted += `, пов. ${cleanFloor}`;
  }
  if (cleanApt) {
    formatted += `, кв. ${cleanApt}`;
  }
  return formatted;
}

export function AddressSelector({
  value,
  onChange,
  disabled = false,
  required = true,
  className = "",
}: AddressSelectorProps) {
  const { data: cities = ["Київ"] } = useDeliveryCities();
  const [selectedCity, setSelectedCity] = useState("Київ");


  const { data: addresses = [], isPending: isAddressesLoading } = useDeliveryAddresses(selectedCity);

  const [selectedStreet, setSelectedStreet] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [house, setHouse] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGpsDetect = () => {
    if (!navigator.geolocation) {
      return;
    }
    haptic("light");
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=uk`
          );
          if (res.ok) {
            const data = await res.json();
            const road = data.address?.road || data.address?.street || "";
            const houseNum = data.address?.house_number || "";
            if (road) {
              setStreetQuery(road);
              const matched = addresses.find((a) => a.street.toLowerCase().includes(road.toLowerCase()));
              if (matched) {
                setSelectedStreet(matched.street);
              } else {
                setSelectedStreet(road);
              }
            }
            if (houseNum) {
              setHouse(houseNum);
            }
          }
        } catch {
          // fallback
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsLoading(false);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  const initializedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ініціалізація з вхідного значення (якщо є збережена адреса)
  useEffect(() => {
    if (!initializedRef.current && addresses.length > 0 && value) {
      initializedRef.current = true;
      const parsed = parseAddressString(value, addresses);
      if (parsed.city) setSelectedCity(parsed.city);
      if (parsed.street) {
        setSelectedStreet(parsed.street);
        setStreetQuery(parsed.street);
      }
      if (parsed.house) setHouse(parsed.house);
      if (parsed.floor) setFloor(parsed.floor);
      if (parsed.apartment) setApartment(parsed.apartment);
    }
  }, [value, addresses]);

  // Фільтрація доступних вулиць за введеним пошуковим запитом
  const filteredStreets = useMemo(() => {
    const q = streetQuery.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) => a.street.toLowerCase().includes(q));
  }, [addresses, streetQuery]);

  // Закриття випадаючого списку при кліку поза межами
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Синхронізація з батьківським компонентом при будь-якій зміні полів
  useEffect(() => {
    const parts: AddressParts = {
      city: selectedCity,
      street: selectedStreet,
      house: house.trim(),
      floor: floor.trim(),
      apartment: apartment.trim(),
    };
    const isValid = Boolean(parts.city && parts.street && parts.house);
    const full = formatFullAddress(parts);
    onChange(full, isValid, parts);
  }, [selectedCity, selectedStreet, house, floor, apartment, onChange]);

  const handleSelectStreet = (streetName: string) => {
    haptic("light");
    setSelectedStreet(streetName);
    setStreetQuery(streetName);
    setIsDropdownOpen(false);
  };

  const handleClearStreet = () => {
    haptic("light");
    setSelectedStreet("");
    setStreetQuery("");
    setIsDropdownOpen(true);
  };

  const inputStyle = {
    background: "var(--app-surface-2)",
    color: "var(--tg-theme-text-color)",
  };

  const isComplete = Boolean(selectedCity && selectedStreet && house.trim());

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* 1. Населений пункт */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
            Населений пункт *
          </label>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            Пілотна зона доставки
          </span>
        </div>
        <select
          value={selectedCity}
          disabled={disabled || cities.length <= 1}
          onChange={(e) => {
            haptic("light");
            setSelectedCity(e.target.value);
            setSelectedStreet("");
            setStreetQuery("");
          }}
          className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500"
          style={inputStyle}
        >
          {cities.map((city) => (
            <option key={city} value={city}>
              📍 м. {city}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Вулиця з довідника (пошук + селектор) */}
      <div className="relative" ref={dropdownRef}>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
            Вулиця (із довідника) {required && "*"}
          </label>
          <button
            type="button"
            onClick={handleGpsDetect}
            disabled={gpsLoading || disabled}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-50 cursor-pointer transition-opacity"
          >
            <span>{gpsLoading ? "⏳" : "📍"}</span>
            <span>{gpsLoading ? "Визначаємо..." : "Визначити GPS"}</span>
          </button>
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            value={streetQuery}
            disabled={disabled || isAddressesLoading}
            onChange={(e) => {
              setStreetQuery(e.target.value);
              if (selectedStreet && e.target.value !== selectedStreet) {
                setSelectedStreet("");
              }
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={
              isAddressesLoading
                ? "Завантаження довідника..."
                : "Почніть вводити назву вулиці (напр. Сагайдачного, Хрещатик)..."
            }

            className={`w-full rounded-xl border p-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 ${
              selectedStreet
                ? "border-emerald-500/60 font-medium"
                : "border-[var(--app-border)]"
            }`}
            style={inputStyle}
          />
          {streetQuery ? (
            <button
              type="button"
              onClick={handleClearStreet}
              disabled={disabled}
              className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          ) : (
            <span className="pointer-events-none absolute right-3.5 text-xs opacity-40">
              🔍
            </span>
          )}
        </div>

        {/* Випадаючий список вулиць */}
        {isDropdownOpen && !disabled && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-[var(--app-border)] shadow-xl"
            style={{ background: "var(--app-surface)", backdropFilter: "blur(12px)" }}
          >
            {filteredStreets.length > 0 ? (
              <ul className="py-1 text-sm divide-y divide-[var(--app-border)]">
                {filteredStreets.map((addr) => {
                  const isSelected = selectedStreet === addr.street;
                  return (
                    <li
                      key={addr.id}
                      onClick={() => handleSelectStreet(addr.street)}
                      className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition active:scale-[0.99] ${
                        isSelected
                          ? "bg-blue-500/10 font-bold text-blue-600"
                          : "hover:bg-black/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-50">📍</span>
                        <span>{addr.street}</span>
                      </div>
                      {isSelected && <span className="text-xs">✓</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-xs opacity-70">
                <p className="font-semibold">Вулицю не знайдено</p>
                <p className="mt-1 text-[11px] opacity-60">
                  Перевірте правильність або зв'яжіться з менеджером, якщо вашої адреси ще немає в пілоті.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Будинок, Поверх, Квартира */}
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Будинок *
          </label>
          <input
            type="text"
            value={house}
            disabled={disabled}
            onChange={(e) => setHouse(e.target.value)}
            placeholder="4, 12-А"
            required={required}
            className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Поверх
          </label>
          <input
            type="text"
            value={floor}
            disabled={disabled}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="5"
            className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
            Квартира
          </label>
          <input
            type="text"
            value={apartment}
            disabled={disabled}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="42"
            className="w-full rounded-xl border border-[var(--app-border)] p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Прев'ю сформованої адреси */}
      {isComplete && (
        <div
          className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border"
          style={{
            background: "color-mix(in srgb, var(--tg-theme-button-color, #3b82f6) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--tg-theme-button-color, #3b82f6) 30%, transparent)",
            color: "var(--tg-theme-text-color)",
          }}
        >
          <span>🛵</span>
          <span className="truncate">
            <b>Куди доставити:</b> {formatFullAddress({ city: selectedCity, street: selectedStreet, house, floor, apartment })}
          </span>
        </div>
      )}
    </div>
  );
}

