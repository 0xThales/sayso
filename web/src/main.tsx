import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./App";
import { Landing } from "./pages/Landing";
import { FormView } from "./pages/FormView";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Landing />} />
          <Route path="form/:id" element={<FormView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
