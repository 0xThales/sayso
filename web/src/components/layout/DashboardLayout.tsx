import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";

const STORAGE_KEY = "sayso:sidebar-open";
const MOBILE_QUERY = "(max-width: 767px)";

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function DashboardLayout() {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (isMobile()) return false;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });

  useEffect(() => {
    if (isMobile()) return;
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  const { pathname } = useLocation();
  useEffect(() => {
    if (isMobile()) setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar open={open} onToggle={() => setOpen((v) => !v)} onClose={() => setOpen(false)} />
      <div className={open ? "md:pl-64 transition-[padding] duration-300" : "transition-[padding] duration-300"}>
        <Outlet />
      </div>
    </div>
  );
}
