import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import Index from "../Index";
import ContentCalendar from "../ContentCalendar";
import GBPCRM from "../GBPCRM";
import "./styles.css";

const isContentCalendar =
  window.location.pathname === "/insta" ||
  window.location.pathname.startsWith("/insta/");

const isGBP =
  window.location.hostname.startsWith("gbp.") ||
  window.location.pathname === "/gbp" ||
  window.location.pathname.startsWith("/gbp/");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
  {isGBP ? <GBPCRM /> : isContentCalendar ? <ContentCalendar /> : <Index />}
    <Toaster richColors position="top-right" theme="dark" />
  </React.StrictMode>
);
