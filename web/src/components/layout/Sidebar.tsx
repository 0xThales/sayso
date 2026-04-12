import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useClerk, useUser } from "@clerk/clerk-react";
import {
  ChevronsUpDown,
  FileText,
  LogOut,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof FileText;
  matchPrefix?: string;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Forms", icon: FileText, matchPrefix: "/dashboard" },
  { to: "/dashboard/new/voice", label: "Create by voice", icon: Mic },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.to === "/dashboard") {
    return pathname === "/dashboard" || /^\/dashboard\/[^/]+$/.test(pathname);
  }
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  return pathname === item.to;
}

type SidebarProps = {
  open: boolean;
  onToggle: () => void;
};

export function Sidebar({ open, onToggle }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <>
      {/* Floating open button when sidebar is hidden */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={onToggle}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed left-4 top-4 z-50 hidden h-8 w-8 items-center justify-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black md:inline-flex"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={16} strokeWidth={1.75} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="sidebar"
            initial={{ x: -272 }}
            animate={{ x: 0 }}
            exit={{ x: -272 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-black/10 bg-white md:flex"
          >
            {/* Logo + collapse */}
            <div className="flex h-20 items-center justify-between border-b border-black/10 px-6">
              <Link to="/dashboard" className="flex items-center gap-2.5">
                <motion.span
                  className="inline-block h-2 w-2 rounded-full bg-black"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <span className="font-display text-2xl font-semibold tracking-tight">
                  sayso
                </span>
              </Link>
              <button
                type="button"
                onClick={onToggle}
                className="flex h-8 w-8 items-center justify-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black"
                aria-label="Close sidebar"
              >
                <PanelLeftClose size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-8">
              <p className="px-3 pb-4 text-[10px] uppercase tracking-[0.28em] text-black/40">
                § Workspace
              </p>
              <ul className="flex flex-col gap-1">
                {NAV.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${
                          active
                            ? "bg-black text-white"
                            : "text-black/70 hover:bg-black/5 hover:text-black"
                        }`}
                      >
                        <Icon
                          size={16}
                          strokeWidth={1.75}
                          className={active ? "text-white" : "text-black/50"}
                        />
                        <span className="font-body">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* User badge */}
            <UserBadge />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function UserBadge() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const name =
    user.fullName ||
    user.firstName ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") ||
    name[0]?.toUpperCase() ||
    "?";

  return (
    <div ref={ref} className="relative border-t border-black/10 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-full px-2 py-2 text-left transition hover:bg-black/5"
        aria-expanded={open}
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={name}
            className="h-9 w-9 rounded-full border border-black/10 object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black font-display text-sm font-semibold text-white">
            {initials}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-black">
            {name}
          </span>
          {email && (
            <span className="block truncate text-[11px] text-black/50">
              {email}
            </span>
          )}
        </span>
        <ChevronsUpDown
          size={14}
          strokeWidth={1.75}
          className="shrink-0 text-black/40"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-4 left-[calc(100%+0.75rem)] z-50 w-64 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg"
          >
            <div className="border-b border-black/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                § Signed in
              </p>
              <p className="mt-2 truncate font-display text-lg font-semibold leading-tight">
                {name}
              </p>
              {email && (
                <p className="mt-1 truncate text-xs text-black/50">{email}</p>
              )}
            </div>
            <ul className="flex flex-col py-2">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openUserProfile();
                  }}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-black/80 transition hover:bg-black/5 hover:text-black"
                >
                  <UserRound size={15} strokeWidth={1.75} />
                  <span>Profile</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void signOut({ redirectUrl: "/sign-in" });
                  }}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-black/80 transition hover:bg-black/5 hover:text-black"
                >
                  <LogOut size={15} strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
