import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import Index from "../Index";
import ContentCalendar from "../ContentCalendar";
import "./styles.css";

const isContentCalendar =
  window.location.pathname === "/insta" ||
  window.location.pathname.startsWith("/insta/");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
  {isContentCalendar ? <ContentCalendar /> : <Index />}
    <Toaster richColors position="top-right" theme="dark" />
  </React.StrictMode>
);
