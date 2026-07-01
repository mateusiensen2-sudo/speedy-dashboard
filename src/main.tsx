import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import Index from "../Index";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Index />
    <Toaster richColors position="top-right" theme="dark" />
  </React.StrictMode>
);
