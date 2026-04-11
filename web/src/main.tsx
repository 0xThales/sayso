import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import {
  ClerkProvider,
  SignIn,
  SignUp,
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
      afterSignOutUrl="/"
    >
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="f/:slug" element={<FormView />} />
            <Route
              path="sign-in/*"
              element={
                <div className="flex min-h-screen items-center justify-center">
                  <SignIn routing="path" path="/sign-in" />
                </div>
              }
            />
            <Route
              path="sign-up/*"
              element={
                <div className="flex min-h-screen items-center justify-center">
                  <SignUp routing="path" path="/sign-up" />
                </div>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/new"
              element={
                <ProtectedRoute>
                  <FormEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/new/voice"
              element={
                <ProtectedRoute>
                  <AgentSelect />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/new/voice/create"
              element={
                <ProtectedRoute>
                  <VoiceFormCreator />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/:slug"
              element={
                <ProtectedRoute>
                  <FormDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/:slug/edit"
              element={
                <ProtectedRoute>
                  <FormEditor />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
