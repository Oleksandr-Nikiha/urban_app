import { useState } from "react";

export interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
  accentColor?: string;
}

export function UserAvatar({
  avatarUrl,
  name,
  size = "md",
  className = "",
  alt = "Користувач",
  accentColor,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Витягуємо ініціали з імені
  const getInitials = (userName?: string | null): string => {
    if (!userName || !userName.trim()) return "";
    const parts = userName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  }[size];

  const primaryColor = accentColor || "var(--brand-primary, #D34528)";

  // Якщо є URL фотографії і вона не видала помилки
  if (avatarUrl && !imgError) {
    return (
      <div
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden border-2 shadow-xs bg-[#181B22] ${sizeClasses} ${className}`}
        style={{ borderColor: primaryColor }}
      >
        <img
          src={avatarUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Якщо фото немає або помилка завантаження -> дизайнерська заглушка з монограмою або іконкою
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full select-none font-bold tracking-tight shadow-xs border-2 border-white/10 text-white ${sizeClasses} ${className}`}
      style={{
        background: `linear-gradient(135deg, #1E232B 0%, #2A2520 50%, ${primaryColor} 100%)`,
      }}
      title={name || "Профіль користувача"}
    >
      {initials ? (
        <span>{initials}</span>
      ) : (
        <svg
          className="w-1/2 h-1/2 text-[#FDF8F0]"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}
