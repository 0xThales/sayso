import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

const STORAGE_KEY = "sayso:sidebar-open";

export function DashboardLayout() {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar open={open} onToggle={() => setOpen((v) => !v)} />
      <div className={open ? "md:pl-64 transition-[padding] duration-300" : "transition-[padding] duration-300"}>
        <Outlet />
      </div>
    </div>
  );
}
