export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_model_metrics: {
        Row: {
          accuracy: number | null
          brier_score: number | null
          game_id: string
          id: string
          last_evaluated_at: string | null
          metrics: Json
          model_version: string
          sample_size: number
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          brier_score?: number | null
          game_id: string
          id?: string
          last_evaluated_at?: string | null
          metrics?: Json
          model_version: string
          sample_size?: number
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          brier_score?: number | null
          game_id?: string
          id?: string
          last_evaluated_at?: string | null
          metrics?: Json
          model_version?: string
          sample_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_predictions: {
        Row: {
          actual_result: Json | null
          correct: boolean | null
          created_at: string
          evaluated_at: string | null
          features: Json
          game_id: string
          id: string
          model_version: string
          prediction: Json
          prediction_date: string
          reference_id: string
          score: number | null
          status: string
        }
        Insert: {
          actual_result?: Json | null
          correct?: boolean | null
          created_at?: string
          evaluated_at?: string | null
          features?: Json
          game_id: string
          id?: string
          model_version: string
          prediction: Json
          prediction_date: string
          reference_id: string
          score?: number | null
          status?: string
        }
        Update: {
          actual_result?: Json | null
          correct?: boolean | null
          created_at?: string
          evaluated_at?: string | null
          features?: Json
          game_id?: string
          id?: string
          model_version?: string
          prediction?: Json
          prediction_date?: string
          reference_id?: string
          score?: number | null
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          detail: Json | null
          id: string
          ip: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_login_attempts: {
        Row: {
          created_at: string
          id: string
          phone_hash: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone_hash: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone_hash?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      draw_results: {
        Row: {
          created_at: string
          draw_date: string
          draw_name: string | null
          game_id: string
          id: string
          pmu_race_id: string | null
          published_at: string | null
          published_by: string | null
          submitted_by: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          result: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draw_date: string
          draw_name?: string | null
          game_id: string
          id?: string
          pmu_race_id?: string | null
          published_at?: string | null
          published_by?: string | null
          submitted_by?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          result: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draw_date?: string
          draw_name?: string | null
          game_id?: string
          id?: string
          pmu_race_id?: string | null
          published_at?: string | null
          published_by?: string | null
          submitted_by?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          result?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_results_pmu_race_id_fkey"
            columns: ["pmu_race_id"]
            isOneToOne: false
            referencedRelation: "pmu_races"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          amount: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          method: string | null
          payment_id: string | null
          prize: number | null
          provider_reference: string | null
          reference: string | null
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          method?: string | null
          payment_id?: string | null
          prize?: number | null
          provider_reference?: string | null
          reference?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          method?: string | null
          payment_id?: string | null
          prize?: number | null
          provider_reference?: string | null
          reference?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      foot_ai_analyses: {
        Row: {
          analysis: Json
          created_at: string
          fixture_id: string
          model_used: string
        }
        Insert: {
          analysis: Json
          created_at?: string
          fixture_id: string
          model_used: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          fixture_id?: string
          model_used?: string
        }
        Relationships: [
          {
            foreignKeyName: "foot_ai_analyses_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "foot_fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      foot_fixtures: {
        Row: {
          away_score: number | null
          away_team: string
          away_team_logo: string | null
          created_at: string
          external_id: number
          home_score: number | null
          home_team: string
          home_team_logo: string | null
          id: string
          kickoff_at: string
          league_external_id: number
          league_name: string
          odds_away: number | null
          odds_draw: number | null
          odds_home: number | null
          season: number | null
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          away_team_logo?: string | null
          created_at?: string
          external_id: number
          home_score?: number | null
          home_team: string
          home_team_logo?: string | null
          id?: string
          kickoff_at: string
          league_external_id: number
          league_name: string
          odds_away?: number | null
          odds_draw?: number | null
          odds_home?: number | null
          season?: number | null
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          away_team_logo?: string | null
          created_at?: string
          external_id?: number
          home_score?: number | null
          home_team?: string
          home_team_logo?: string | null
          id?: string
          kickoff_at?: string
          league_external_id?: number
          league_name?: string
          odds_away?: number | null
          odds_draw?: number | null
          odds_home?: number | null
          season?: number | null
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      foot_picks: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          picks: Json
          settled_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          picks: Json
          settled_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          picks?: Json
          settled_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foot_picks_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "foot_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foot_picks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rules: {
        Row: {
          active: boolean
          game_id: string
          id: string
          multiplier: number
          pick_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          game_id: string
          id?: string
          multiplier: number
          pick_count: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          game_id?: string
          id?: string
          multiplier?: number
          pick_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      game_schedules: {
        Row: {
          close_hour: number
          day_schedules: Json
          daily_stats_date: string
          draw_hour: number
          draw_minute: number
          enabled: boolean
          game_id: string
          open_hour: number
          timezone: string
          today_paid_fcfa: number | null
          today_winners_count: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          close_hour: number
          day_schedules: Json
          daily_stats_date?: string
          draw_hour: number
          draw_minute: number
          enabled?: boolean
          game_id: string
          open_hour: number
          timezone?: string
          today_paid_fcfa?: number | null
          today_winners_count?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          close_hour?: number
          day_schedules?: Json
          daily_stats_date?: string
          draw_hour?: number
          draw_minute?: number
          enabled?: boolean
          game_id?: string
          open_hour?: number
          timezone?: string
          today_paid_fcfa?: number | null
          today_winners_count?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      monitoring_alert_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          metric: string
          threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric: string
          threshold: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      monitoring_events: {
        Row: {
          app_version: string | null
          created_at: string
          device: string | null
          duration_ms: number | null
          endpoint: string | null
          environment: string
          id: string
          level: string
          message: string | null
          method: string | null
          page: string | null
          service: string
          session_hash: string | null
          source: string
          spans: Json
          status: number | null
          trace_id: string
          user_agent: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          environment?: string
          id?: string
          level?: string
          message?: string | null
          method?: string | null
          page?: string | null
          service: string
          session_hash?: string | null
          source: string
          spans?: Json
          status?: number | null
          trace_id: string
          user_agent?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          environment?: string
          id?: string
          level?: string
          message?: string | null
          method?: string | null
          page?: string | null
          service?: string
          session_hash?: string | null
          source?: string
          spans?: Json
          status?: number | null
          trace_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      monitoring_incidents: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          detail: Json
          id: string
          metric: string
          resolution: string | null
          resolved_at: string | null
          service: string
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          detail?: Json
          id?: string
          metric: string
          resolution?: string | null
          resolved_at?: string | null
          service: string
          severity: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          detail?: Json
          id?: string
          metric?: string
          resolution?: string | null
          resolved_at?: string | null
          service?: string
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          game_id: string | null
          id: string
          method: string
          payment_key: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          game_id?: string | null
          id?: string
          method: string
          payment_key?: string | null
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          game_id?: string | null
          id?: string
          method?: string
          payment_key?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      pmu_horses: {
        Row: {
          created_at: string
          external_id: string
          form: string | null
          id: string
          intl_name: string | null
          jockey: string
          name: string
          number: number
          odds: number | null
          place_rate: number | null
          race_id: string
          source: string
          source_updated_at: string | null
          status: string
          trainer: string | null
          updated_at: string
          weight: number | null
          win_rate: number | null
        }
        Insert: {
          created_at?: string
          external_id: string
          form?: string | null
          id?: string
          intl_name?: string | null
          jockey: string
          name: string
          number: number
          odds?: number | null
          place_rate?: number | null
          race_id: string
          source: string
          source_updated_at?: string | null
          status?: string
          trainer?: string | null
          updated_at?: string
          weight?: number | null
          win_rate?: number | null
        }
        Update: {
          created_at?: string
          external_id?: string
          form?: string | null
          id?: string
          intl_name?: string | null
          jockey?: string
          name?: string
          number?: number
          odds?: number | null
          place_rate?: number | null
          race_id?: string
          source?: string
          source_updated_at?: string | null
          status?: string
          trainer?: string | null
          updated_at?: string
          weight?: number | null
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pmu_horses_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "pmu_races"
            referencedColumns: ["id"]
          },
        ]
      }
      pmu_races: {
        Row: {
          created_at: string
          external_id: string
          id: string
          name: string | null
          race_date: string
          race_number: number
          source: string
          source_updated_at: string | null
          start_at: string
          status: string
          updated_at: string
          venue: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          name?: string | null
          race_date: string
          race_number: number
          source: string
          source_updated_at?: string | null
          start_at: string
          status?: string
          updated_at?: string
          venue: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          name?: string | null
          race_date?: string
          race_number?: number
          source?: string
          source_updated_at?: string | null
          start_at?: string
          status?: string
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          password_setup_required: boolean
          phone: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          password_setup_required?: boolean
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          password_setup_required?: boolean
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          code: string
          created_at: string
          draw_date: string | null
          draw_name: string | null
          game_id: string
          game_name: string
          id: string
          legs: Json | null
          loto_multiplier: number | null
          payment_method: string
          phone: string | null
          picks: Json
          picks_label: string
          pmu_race_id: string | null
          prize: number | null
          region: string | null
          stake: number
          status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          draw_date?: string | null
          draw_name?: string | null
          game_id: string
          game_name: string
          id?: string
          legs?: Json | null
          loto_multiplier?: number | null
          payment_method: string
          phone?: string | null
          picks: Json
          picks_label: string
          pmu_race_id?: string | null
          prize?: number | null
          region?: string | null
          stake: number
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          draw_date?: string | null
          draw_name?: string | null
          game_id?: string
          game_name?: string
          id?: string
          legs?: Json | null
          loto_multiplier?: number | null
          payment_method?: string
          phone?: string | null
          picks?: Json
          picks_label?: string
          pmu_race_id?: string | null
          prize?: number | null
          region?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_pmu_race_id_fkey"
            columns: ["pmu_race_id"]
            isOneToOne: false
            referencedRelation: "pmu_races"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_ticket_with_payment: {
        Args: {
          p_actor_user_id: string
          p_foot_picks?: Json
          p_payment_id: string
          p_ticket: Json
        }
        Returns: string
      }
      get_admin_player_statistics: { Args: never; Returns: Json }
      get_admin_region_statistics: { Args: never; Returns: Json }
      get_loto_ball_statistics: { Args: never; Returns: Json }
      has_admin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      monitoring_db_stats: { Args: never; Returns: Json }
      purge_legacy_auth_user: { Args: never; Returns: undefined }
      remove_legacy_bootstrap_user: { Args: never; Returns: undefined }
      remove_legacy_user_role: { Args: never; Returns: undefined }
      set_admin_permissions_atomic: {
        Args: {
          p_actor_user_id: string
          p_permissions: string[]
          p_target_user_id: string
        }
        Returns: undefined
      }
      settle_ticket_atomic: {
        Args: {
          p_leg_updates?: Json
          p_mark_all_foot_losing?: boolean
          p_prize: number
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_ticket_id: string
        }
        Returns: {
          id: string
          prize: number
          status: Database["public"]["Enums"]["ticket_status"]
        }[]
      }
      transfer_super_admin_ownership: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "player" | "super_admin"
      payment_status: "pending" | "confirmed" | "failed"
      ticket_status: "pending" | "losing" | "winning" | "paid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "player", "super_admin"],
      payment_status: ["pending", "confirmed", "failed"],
      ticket_status: ["pending", "losing", "winning", "paid"],
    },
  },
} as const
