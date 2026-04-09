import { useEffect } from "react";
import { Outlet } from "react-router";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "@/lib/api";

export default function App() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return (
    <div className="min-h-screen bg-cream text-stone-900 antialiased">
      <Outlet />
    </div>
  );
}
