import { Outlet } from "react-router";

export default function App() {
  return (
    <div className="min-h-screen bg-cream text-stone-900 antialiased">
      <Outlet />
    </div>
  );
}
