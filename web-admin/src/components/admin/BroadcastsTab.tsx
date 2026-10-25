import { useState } from "react";
import {
  useAdminBroadcastRecipientsCount,
  useAdminBroadcasts,
  useCreateBroadcast,
} from "@/api/queries";
import type { BroadcastSegment } from "@/api/types";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { BroadcastCreateCard } from "./broadcasts/BroadcastCreateCard";
import { BroadcastHistoryList } from "./broadcasts/BroadcastHistoryList";
import { BroadcastConfirmModal } from "./broadcasts/BroadcastConfirmModal";

export function BroadcastsTab() {
  const [segment, setSegment] = useState<BroadcastSegment>("all");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [lastSentInfo, setLastSentInfo] = useState<{ title: string; count: number } | null>(null);

  // Дані отримувачів та історія
  const { data: recipientsData, isPending: isCountPending } =
    useAdminBroadcastRecipientsCount(segment);
  const { data: broadcasts = [], isPending: isListPending, error: listError } =
    useAdminBroadcasts();
  const createBroadcastMutation = useCreateBroadcast();

  const recipientCount = recipientsData?.count ?? 0;

  const handleOpenConfirm = () => {
    if (!title.trim() || !text.trim()) {
      alert("Будь ласка, вкажіть назву кампанії та текст повідомлення");
      return;
    }
    if (recipientCount === 0) {
      alert("В обраному сегменті немає отримувачів");
      return;
    }
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      alert("Для кнопки потрібно вказати і текст, і посилання URL");
      return;
    }
    haptic("medium");
    setIsConfirmOpen(true);
  };

  const handleSendBroadcast = async () => {
    try {
      const currentTitle = title.trim();
      const currentCount = recipientCount;

      await createBroadcastMutation.mutateAsync({
        title: currentTitle,
        text: text.trim(),
        image_url: imageUrl.trim() || null,
        button_text: buttonText.trim() || null,
        button_url: buttonUrl.trim() || null,
        segment,
      });

      setLastSentInfo({ title: currentTitle, count: currentCount });
      hapticNotify("success");
      setIsConfirmOpen(false);
      // Очищаємо форму після запуску
      setTitle("");
      setText("");
      setImageUrl("");
      setButtonText("");
      setButtonUrl("");
    } catch (err: unknown) {
      hapticNotify("error");
      const msg = err instanceof Error ? err.message : "Помилка при запуску розсилки";
      alert(msg);
    }
  };

  return (
    <div className="space-y-6 pb-12 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Сповіщення про успішний запуск розсилки */}
      {lastSentInfo && (
        <div
          className="rounded-2xl p-4 border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-between gap-3 shadow-md"
          style={{ color: "var(--tg-theme-text-color, #ffffff)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">✅</span>
            <div className="min-w-0">
              <p className="font-bold text-sm">
                Розсилку «{lastSentInfo.title}» успішно запущено!
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Повідомлення надсилаються у фоні для {lastSentInfo.count} клієнтів. Статус оновлюється
                в списку нижче.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastSentInfo(null)}
            className="p-1.5 rounded-xl hover:bg-emerald-500/20 text-xs shrink-0 font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Блок створення нової розсилки */}
      <BroadcastCreateCard
        segment={segment}
        setSegment={setSegment}
        title={title}
        setTitle={setTitle}
        text={text}
        setText={setText}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        buttonText={buttonText}
        setButtonText={setButtonText}
        buttonUrl={buttonUrl}
        setButtonUrl={setButtonUrl}
        recipientCount={recipientCount}
        isCountPending={isCountPending}
        isSubmitting={createBroadcastMutation.isPending}
        onOpenConfirm={handleOpenConfirm}
      />

      {/* 2. Історія проведених розсилок */}
      <div className="app-card rounded-2xl p-4 md:p-6 space-y-4">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
          <span>📋</span>
          <span>Історія маркетингових кампаній</span>
        </h3>

        <BroadcastHistoryList
          broadcasts={broadcasts}
          isPending={isListPending}
          error={listError ? (listError as Error) : null}
        />
      </div>

      {/* 3. Модальне вікно підтвердження відправки */}
      <BroadcastConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSendBroadcast}
        isPending={createBroadcastMutation.isPending}
        title={title}
        recipientCount={recipientCount}
        segment={segment}
      />
    </div>
  );
}
