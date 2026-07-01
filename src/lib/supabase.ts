import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;

export const supabaseUrl =
  env.VITE_SUPABASE_URL || "https://idxmsbfwhypzlgrjfait.supabase.co";

export const supabasePublishableKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_69I3-9Gzy2CoUdmsv23qUw_tvvT6xRh";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
