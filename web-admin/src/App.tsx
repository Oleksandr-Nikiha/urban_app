import { Route, Routes, Navigate } from "react-router-dom";
import { AdminPage } from "@/pages/AdminPage";
import { AdminLoginPage } from "@/pages/AdminLoginPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminPage />} />
      <Route path="/login" element={<AdminLoginPage />} />
      {/* Підтримка старих посилань на випадок, якщо хтось ввів /admin/login або /admin */}
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
