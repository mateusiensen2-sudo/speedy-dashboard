export interface StorageAdapter<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
  clear(): Promise<void>;
}

export function createLocalStorageAdapter<T>(key: string): StorageAdapter<T> {
  return {
    async load() {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async save(value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    async clear() {
      window.localStorage.removeItem(key);
    },
  };
}

export function createSupabaseAdapterPlaceholder<T>(): StorageAdapter<T> {
  return {
    async load() {
      throw new Error("Supabase ainda não foi configurado.");
    },
    async save() {
      throw new Error("Supabase ainda não foi configurado.");
    },
    async clear() {
      throw new Error("Supabase ainda não foi configurado.");
    },
  };
}


type SupabaseLike = {
  from(table: string): any;
};

export function createSupabaseStateAdapter<T extends Record<string, any>>(
  supabase: SupabaseLike,
  userId: string,
): StorageAdapter<T> {
  return {
    async load() {
      const { data, error } = await supabase
        .from("dashboard_settings")
        .select("extra_state")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data?.extra_state as T | null) || null;
    },
    async save(value) {
      const { error } = await supabase
        .from("dashboard_settings")
        .upsert({
          user_id: userId,
          revenue_goal: value.revenueGoal ?? 40000,
          revenue_now: value.revenueNow ?? 0,
          safe_meetings_goal: value.commercial?.safeMeetings ?? 12,
          meetings_goal: value.meetings?.goal ?? 10,
          budget_br: value.budgetBR ?? 2000,
          budget_us: value.budgetUS ?? 2000,
          extra_state: value,
        });

      if (error) throw error;
    },
    async clear() {
      const { error } = await supabase
        .from("dashboard_settings")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
  };
}
