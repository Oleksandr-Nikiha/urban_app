import { useState } from "react";
import {
  useAdminOptionGroups,
  useAttachProductOptionGroup,
  useUpdateProductOptionGroup,
  useDetachProductOptionGroup,
} from "@/api/queries";
import type { AdminProduct, ProductOptionGroupAdmin } from "@/api/types";
import { hapticNotify } from "@/telegram/sdk";

export function ProductOptionsModal({
  product,
  onClose,
}: {
  product: AdminProduct;
  onClose: () => void;
}) {
  const { data: allGroups = [] } = useAdminOptionGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("3");
  const [freeCount, setFreeCount] = useState("0");

  const attachGroup = useAttachProductOptionGroup();
  const updateGroup = useUpdateProductOptionGroup();
  const detachGroup = useDetachProductOptionGroup();

  const handleAttach = (e: React.FormEvent) => {
    e.preventDefault();
    const gId = parseInt(selectedGroupId, 10);
    if (!gId) return;

    attachGroup.mutate(
      {
        productId: product.id,
        payload: {
          group_id: gId,
          min_select: parseInt(minSelect, 10) || 0,
          max_select: parseInt(maxSelect, 10) || 1,
          free_count: parseInt(freeCount, 10) || 0,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          setSelectedGroupId("");
          setMinSelect("0");
          setMaxSelect("3");
          setFreeCount("0");
        },
      },
    );
  };

  const attached = product.option_groups || [];
  const attachedIds = new Set(attached.map((a) => a.group_id));
  const availableToAttach = allGroups.filter((g) => !attachedIds.has(g.id));

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Додатки до страви</h3>
            <p className="text-xs opacity-60">«{product.name}»</p>
          </div>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        {/* Список вже прив'язаних груп */}
        <div className="space-y-2">
          <span className="text-xs font-bold opacity-70">Прикріплені групи додатків:</span>
          {attached.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Ще немає прив'язаних додатків.</p>
          ) : (
            attached.map((og: ProductOptionGroupAdmin) => (
              <AttachedGroupRow
                key={og.group_id}
                item={og}
                onUpdate={(payload) => updateGroup.mutate({ productId: product.id, groupId: og.group_id, payload })}
                onDetach={() => detachGroup.mutate({ productId: product.id, groupId: og.group_id })}
              />
            ))
          )}
        </div>

        {/* Форма прив'язки нової групи */}
        {availableToAttach.length > 0 && (
          <form onSubmit={handleAttach} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--app-border)" }}>
            <span className="text-xs font-bold opacity-80">+ Прикріпити нову групу:</span>

            <label className="block text-xs">
              <span className="opacity-60">Група додатків</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Виберіть групу --</option>
                {availableToAttach.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.items_count} поз.)
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="block">
                <span className="opacity-60 text-[10px]">Мін. вибір</span>
                <input
                  type="number"
                  min="0"
                  value={minSelect}
                  onChange={(e) => setMinSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Макс. вибір</span>
                <input
                  type="number"
                  min="1"
                  value={maxSelect}
                  onChange={(e) => setMaxSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Безкоштовно</span>
                <input
                  type="number"
                  min="0"
                  value={freeCount}
                  onChange={(e) => setFreeCount(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedGroupId}
              className="app-press w-full rounded-xl py-2 text-xs font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Прикріпити до страви
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="app-press w-full rounded-xl py-2.5 text-xs font-bold"
          style={{ background: "var(--app-surface-2)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function AttachedGroupRow({
  item,
  onUpdate,
  onDetach,
}: {
  item: ProductOptionGroupAdmin;
  onUpdate: (payload: { min_select: number; max_select: number; free_count: number }) => void;
  onDetach: () => void;
}) {
  const [min, setMin] = useState(String(item.min_select));
  const [max, setMax] = useState(String(item.max_select));
  const [free, setFree] = useState(String(item.free_count));
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    onUpdate({
      min_select: parseInt(min, 10) || 0,
      max_select: parseInt(max, 10) || 1,
      free_count: parseInt(free, 10) || 0,
    });
    setDirty(false);
    hapticNotify("success");
  };

  const inputStyle = { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="rounded-xl p-2.5 space-y-2 text-xs" style={{ background: "var(--app-surface-2)" }}>
      <div className="flex items-center justify-between">
        <span className="font-bold">🧩 {item.group_name}</span>
        <button
          onClick={() => {
            if (window.confirm(`Відв'язати групу "${item.group_name}" від страви?`)) {
              onDetach();
            }
          }}
          className="opacity-50 hover:opacity-100 text-red-500 font-medium"
        >
          Відкріпити
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="opacity-50 text-[10px]">Мін (0=опц.)</span>
          <input
            type="number"
            min="0"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Макс (к-сть)</span>
          <input
            type="number"
            min="1"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Безкоштовно</span>
          <input
            type="number"
            min="0"
            value={free}
            onChange={(e) => {
              setFree(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          className="app-press w-full rounded-lg py-1 font-bold text-[11px]"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Зберегти ліміти
        </button>
      )}
    </div>
  );
}
