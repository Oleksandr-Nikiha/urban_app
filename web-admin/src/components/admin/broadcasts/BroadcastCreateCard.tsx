import { useRef, useState } from "react";
import { api } from "@/api/client";
import type { BroadcastSegment } from "@/api/types";
import { haptic } from "@/telegram/sdk";
import { compressImageFile } from "@/utils/imageCompression";
import { SEGMENT_OPTIONS } from "./constants";

interface BroadcastCreateCardProps {
  segment: BroadcastSegment;
  setSegment: (s: BroadcastSegment) => void;
  title: string;
  setTitle: (t: string) => void;
  text: string;
  setText: (t: string) => void;
  imageUrl: string;
  setImageUrl: (u: string) => void;
  buttonText: string;
  setButtonText: (bt: string) => void;
  buttonUrl: string;
  setButtonUrl: (bu: string) => void;
  recipientCount: number;
  isCountPending: boolean;
  isSubmitting: boolean;
  onOpenConfirm: () => void;
}

export function BroadcastCreateCard({
  segment,
  setSegment,
  title,
  setTitle,
  text,
  setText,
  imageUrl,
  setImageUrl,
  buttonText,
  setButtonText,
  buttonUrl,
  setButtonUrl,
  recipientCount,
  isCountPending,
  isSubmitting,
  onOpenConfirm,
}: BroadcastCreateCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("Розмір файлу не повинен перевищувати 25 МБ");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const optimizedFile = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", optimizedFile);
      const res = await api.upload<{ url: string }>("/admin/upload", formData);
      setImageUrl(res.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Помилка завантаження файлу");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSegmentChange = (s: BroadcastSegment) => {
    haptic("light");
    setSegment(s);
  };

  return (
    <div className="app-card rounded-2xl p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📢</span>
          <div>
            <h3 className="text-base font-bold tracking-tight">Нова розсилка клієнтам</h3>
            <p className="text-xs opacity-60">
              Повідомлення буде надіслано від імені Telegram-бота
            </p>
          </div>
        </div>
      </div>

      {/* Вибір сегмента аудиторії */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider opacity-60">
          1. Сегмент аудиторії
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {SEGMENT_OPTIONS.map((opt) => {
            const isSelected = segment === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSegmentChange(opt.id)}
                className={`app-press flex flex-col justify-between p-3 rounded-xl text-left transition-all border ${
                  isSelected
                    ? "border-emerald-500 shadow-sm"
                    : "border-[var(--app-border)] opacity-70 hover:opacity-100"
                }`}
                style={{
                  background: isSelected ? "var(--app-surface-2)" : "transparent",
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg">{opt.icon}</span>
                  {isSelected && (
                    <span className="text-emerald-500 text-xs font-black">✓ Обрано</span>
                  )}
                </div>
                <div className="mt-2">
                  <p className="font-bold text-xs">{opt.label}</p>
                  <p className="text-[10px] opacity-60 leading-tight mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Плашка розміру аудиторії */}
        <div
          className="flex items-center justify-between p-3 rounded-xl text-xs"
          style={{ background: "var(--app-surface-2)" }}
        >
          <span className="opacity-75">Потенційна аудиторія вибраного сегмента:</span>
          <span className="font-bold text-emerald-500 flex items-center gap-1.5">
            {isCountPending ? (
              <span className="opacity-50">Підрахунок...</span>
            ) : (
              <span>👥 {recipientCount} клієнтів</span>
            )}
          </span>
        </div>
      </div>

      {/* Форма контенту розсилки та Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
        {/* Ліва колонка: поля вводу (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          <label className="block text-xs font-bold uppercase tracking-wider opacity-60">
            2. Вміст повідомлення
          </label>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              Назва кампанії (внутрішня для адмінів)
            </label>
            <input
              type="text"
              placeholder="наприклад: Знижка -20% на всі піци у п'ятницю"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold opacity-80">
                Текст повідомлення
              </label>
              <span className="text-[10px] opacity-50">Підтримує HTML (&lt;b&gt;, &lt;i&gt;)</span>
            </div>
            <textarea
              rows={5}
              placeholder="Привіт! 🔥 Тільки цього вікенду замовляй улюблені страви зі знижкою..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl p-3 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              Зображення / банер (опціонально)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="/api/uploads/... або https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="app-press shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
              >
                {isUploading ? "⏳..." : "📁 Фото"}
              </button>
            </div>
            {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                Текст інлайн-кнопки
              </label>
              <input
                type="text"
                placeholder="🍕 Відкрити меню"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                Посилання кнопки (URL)
              </label>
              <input
                type="url"
                placeholder="https://t.me/..."
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs border border-[var(--app-border)] bg-[var(--app-surface-2)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenConfirm}
              disabled={isSubmitting || !title.trim() || !text.trim()}
              className="app-press w-full py-3 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>🚀</span>
              <span>Надіслати розсилку ({recipientCount} клієнтам)</span>
            </button>
          </div>
        </div>

        {/* Права колонка: Інтерактивний Telegram Live Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider opacity-60">
            Попередній перегляд (Preview)
          </label>
          <div
            className="rounded-2xl p-4 border border-[var(--app-border)] flex flex-col justify-between min-h-[300px]"
            style={{ background: "var(--app-surface-2)" }}
          >
            <div>
              <div className="flex items-center gap-2 mb-3 opacity-60 text-[11px]">
                <span>🤖 Urban Bites Bot</span>
                <span>•</span>
                <span>сьогодні</span>
              </div>

              {/* Бульбашка повідомлення в стилі Telegram */}
              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] overflow-hidden shadow-sm">
                {imageUrl.trim() && (
                  <div className="w-full aspect-video bg-black/5 overflow-hidden">
                    <img
                      src={imageUrl.trim()}
                      alt="Прев'ю банера"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="p-3.5 space-y-2">
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {text.trim() || (
                      <span className="opacity-40 italic">
                        Тут з'явиться текст вашого повідомлення...
                      </span>
                    )}
                  </p>
                  <div className="text-[10px] text-right opacity-40">12:00</div>
                </div>
              </div>

              {/* Інлайн-кнопка */}
              {buttonText.trim() && (
                <div className="mt-1.5">
                  <div className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-center text-sky-500 bg-sky-500/10 border border-sky-500/20 flex items-center justify-center gap-1.5">
                    <span>{buttonText.trim()}</span>
                    <span className="text-[10px] opacity-60">↗</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 text-center">
              <span className="text-[10px] opacity-40">
                Так повідомлення виглядатиме у чаті користувача
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
