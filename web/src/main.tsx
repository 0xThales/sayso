import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import App from "./App";
import { FormView } from "./pages/FormView";
import { Dashboard } from "./pages/Dashboard";
import { FormEditor } from "./pages/FormEditor";
import { FormDetail } from "./pages/FormDetail";
import { VoiceFormCreator } from "./pages/VoiceFormCreator";
import { AgentSelect } from "./pages/AgentSelect";
import { AuthPage } from "./pages/AuthPage";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      <BrowserRouter>
        <Routes>
          <Route path="sign-in/*" element={<AuthPage mode="sign-in" />} />
          <Route path="sign-up/*" element={<AuthPage mode="sign-up" />} />
          <Route element={<App />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="f/:slug" element={<FormView />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="dashboard/new" element={<FormEditor />} />
              <Route path="dashboard/new/voice" element={<AgentSelect />} />
              <Route
                path="dashboard/new/voice/create"
                element={<VoiceFormCreator />}
              />
              <Route path="dashboard/:slug" element={<FormDetail />} />
              <Route path="dashboard/:slug/edit" element={<FormEditor />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
