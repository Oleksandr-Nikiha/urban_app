/**
 * Утиліти форматування та валідації номерів телефонів України
 */

export function extractSignificantDigits(val: string): string {
  const digits = val.replace(/\D/g, "");
  let rest = digits;
  if (digits.startsWith("380")) {
    rest = digits.slice(3);
  } else if (digits.startsWith("0")) {
    rest = digits.slice(1);
  } else if (digits.startsWith("38")) {
    rest = digits.slice(2);
  }
  return rest.slice(0, 9);
}

export function formatPhoneNumber(val: string): string {
  if (!val) return "";

  const rest = extractSignificantDigits(val);

  // Якщо користувач видалив усі цифри або залишився лише префікс
  if (rest.length === 0) return "";

  let formatted = "+380";
  if (rest.length > 0) {
    formatted += ` (${rest.slice(0, 2)}`;
  }
  if (rest.length >= 2) {
    formatted += `) ${rest.slice(2, 5)}`;
  }
  if (rest.length >= 5) {
    formatted += `-${rest.slice(5, 7)}`;
  }
  if (rest.length >= 7) {
    formatted += `-${rest.slice(7, 9)}`;
  }

  return formatted;
}

/**
 * Розумний обробник введення з клавіатури, який автоматично
 * видаляє цифру перед роздільником ('-', ' ', ')') при натисканні Backspace.
 */
export function formatPhoneOnInput(currentVal: string, prevVal: string): string {
  if (!currentVal || currentVal === "+" || currentVal === "+3" || currentVal === "+38" || currentVal === "+380") {
    return "";
  }

  const currentDigits = currentVal.replace(/\D/g, "");
  const prevDigits = prevVal ? prevVal.replace(/\D/g, "") : "";

  // Якщо рядок став коротшим (Backspace), але кількість цифр не змінилася
  // (тобто був видалений лише роздільник '-', ')' або пробіл)
  if (currentVal.length < prevVal.length && currentDigits === prevDigits && currentDigits.length > 0) {
    // Видаляємо цифру, що передувала роздільнику
    const shortenedDigits = currentDigits.slice(0, -1);
    return formatPhoneNumber(shortenedDigits);
  }

  return formatPhoneNumber(currentVal);
}

/**
 * Перехоплює Backspace на клавіатурі для переходу через дефіси та дужки без застрягання курсору
 */
export function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Backspace") {
    const input = e.currentTarget;
    const { selectionStart, selectionEnd, value } = input;
    if (selectionStart !== null && selectionStart === selectionEnd && selectionStart > 0) {
      const charBefore = value[selectionStart - 1];
      // Якщо безпосередньо перед курсором роздільник (дефіс, дужка, пробіл)
      if (/\D/.test(charBefore)) {
        e.preventDefault();
        // Шукаємо найближчу цифру перед роздільником
        let idx = selectionStart - 1;
        while (idx >= 0 && /\D/.test(value[idx])) {
          idx--;
        }
        if (idx >= 0) {
          const updated = value.slice(0, idx) + value.slice(idx + 1);
          const formatted = formatPhoneNumber(updated);
          input.value = formatted;

          const newPos = Math.max(0, idx);
          input.setSelectionRange(newPos, newPos);

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, formatted);
          }
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }
  }
}

export function normalizeE164Phone(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+38${digits}`;
  }
  if (digits.length === 9) {
    return `+380${digits}`;
  }
  if (digits.length === 12) {
    return `+${digits}`;
  }
  return val.trim();
}

export function isValidUkrainianPhone(val: string): boolean {
  const digits = val.replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length === 12) {
    return true;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return true;
  }
  if (digits.length === 9) {
    return true;
  }
  return false;
}
