import { useEffect, useState } from "react";
import { fetchWebProfile } from "./api/client.ts";
import { GroupHeader } from "./components/GroupHeader.tsx";
import { GroupHero } from "./components/GroupHero.tsx";
import { ProjectsSection } from "./components/ProjectsSection.tsx";
import { UrbanClubSection } from "./components/UrbanClubSection.tsx";
import { PromotionsSection } from "./components/PromotionsSection.tsx";
import { PartnershipSection } from "./components/PartnershipSection.tsx";
import { CareersSection } from "./components/CareersSection.tsx";
import { GroupFooter } from "./components/GroupFooter.tsx";
import { UserCabinetModal } from "./components/cabinet/UserCabinetModal.tsx";
import {
  getSharedCookie,
  isUserAuthenticated,
  loadSavedProfile,
  saveSharedProfile,
  type UserProfile,
} from "./types/user.ts";

export function App() {
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = loadSavedProfile();
      if (saved && isUserAuthenticated(saved)) return saved;
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      let savedUser = loadSavedProfile();
      if (!savedUser) {
        const cookiePhone = getSharedCookie("urban_auth_phone");
        const cookieTg = getSharedCookie("urban_auth_tg");
        if (cookiePhone || cookieTg) {
          savedUser = {
            name: "Клієнт",
            phone: cookiePhone || "",
            telegram_id: cookieTg ? Number(cookieTg) : null,
            street: "",
            house: "",
            apartment: "",
            bonuses: 50,
            isAuthenticated: true,
          };
        }
      }

      if (savedUser && isUserAuthenticated(savedUser)) {
        const isVerified = Boolean(savedUser.is_phone_verified || savedUser.telegram_id);
        const initialUser: UserProfile = {
          ...savedUser,
          is_phone_verified: isVerified,
          bonuses: savedUser.bonuses ?? 50,
        };
        setUserProfile(initialUser);

        if (savedUser.telegram_id || savedUser.phone) {
          void fetchWebProfile({
            telegram_id: savedUser.telegram_id,
            phone: savedUser.phone,
          }).then((serverUser) => {
            if (serverUser) {
              const synced: UserProfile = {
                ...initialUser,
                name: serverUser.full_name || initialUser.name,
                first_name: serverUser.first_name || initialUser.first_name,
                last_name: serverUser.last_name || initialUser.last_name,
                phone: serverUser.phone || initialUser.phone,
                telegram_id: serverUser.telegram_id || initialUser.telegram_id,
                is_phone_verified:
                  serverUser.is_phone_verified ||
                  Boolean(serverUser.telegram_id) ||
                  Boolean(initialUser.telegram_id),
                street: initialUser.street || serverUser.delivery_address || "",
                additional_address: initialUser.additional_address || serverUser.additional_address || "",
                client_code: serverUser.client_code || initialUser.client_code,
                bonuses: serverUser.bonus_balance ?? initialUser.bonuses ?? 50,
                auth_token: serverUser.auth_token || initialUser.auth_token,
              };
              saveSharedProfile(synced);
              setUserProfile(synced);
            }
          });
        }
      }
    } catch {}
  }, []);

  return (
    <div id="top" className="min-h-screen bg-transparent text-[#F1F5F9] flex flex-col font-sans selection:bg-[#F59E0B]/30">
      <GroupHeader
        onOpenCabinet={() => setCabinetOpen(true)}
        userProfile={userProfile}
      />
      <main className="flex-1">
        <GroupHero />
        <ProjectsSection />
        <UrbanClubSection onOpenCabinet={() => setCabinetOpen(true)} />
        <PromotionsSection />
        <PartnershipSection />
        <CareersSection />
      </main>
      <GroupFooter />

      <UserCabinetModal
        isOpen={cabinetOpen}
        onClose={() => setCabinetOpen(false)}
        isAuthenticated={Boolean(userProfile && isUserAuthenticated(userProfile))}
        onProfileUpdated={(p) => setUserProfile(isUserAuthenticated(p) ? p : null)}
        onAuthSuccess={(p) => setUserProfile(p)}
      />
    </div>
  );
}
