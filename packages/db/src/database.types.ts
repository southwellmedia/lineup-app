export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointment_services: {
        Row: {
          appointment_id: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          is_addon: boolean;
          name: string;
          price_cents: number;
          service_id: string | null;
          shop_id: string;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          duration_minutes: number;
          id?: string;
          is_addon?: boolean;
          name: string;
          price_cents: number;
          service_id?: string | null;
          shop_id: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          is_addon?: boolean;
          name?: string;
          price_cents?: number;
          service_id?: string | null;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_services_shop_id_appointment_id_fkey";
            columns: ["shop_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment_balances";
            referencedColumns: ["shop_id", "appointment_id"];
          },
          {
            foreignKeyName: "appointment_services_shop_id_appointment_id_fkey";
            columns: ["shop_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["shop_id", "id"];
          },
          {
            foreignKeyName: "appointment_services_shop_id_service_id_fkey";
            columns: ["shop_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      appointments: {
        Row: {
          blocked_until: string;
          checked_in_at: string | null;
          completed_at: string | null;
          booked_by: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id: string | null;
          client_note: string | null;
          created_at: string;
          deposit_cents: number;
          ends_at: string;
          hold_expires_at: string | null;
          id: string;
          shop_id: string;
          source: Database["public"]["Enums"]["booking_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_price_cents: number;
          updated_at: string;
        };
        Insert: {
          blocked_until: string;
          checked_in_at?: string | null;
          completed_at?: string | null;
          booked_by: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id?: string | null;
          client_note?: string | null;
          created_at?: string;
          deposit_cents?: number;
          ends_at: string;
          hold_expires_at?: string | null;
          id?: string;
          shop_id: string;
          source: Database["public"]["Enums"]["booking_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_price_cents: number;
          updated_at?: string;
        };
        Update: {
          blocked_until?: string;
          checked_in_at?: string | null;
          completed_at?: string | null;
          booked_by?: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id?: string | null;
          client_note?: string | null;
          created_at?: string;
          deposit_cents?: number;
          ends_at?: string;
          hold_expires_at?: string | null;
          id?: string;
          shop_id?: string;
          source?: Database["public"]["Enums"]["booking_source"];
          staff_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          total_price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_shop_id_client_id_fkey";
            columns: ["shop_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["shop_id", "id"];
          },
          {
            foreignKeyName: "appointments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      clients: {
        Row: {
          created_at: string;
          email: string | null;
          email_consent_at: string | null;
          id: string;
          marketing_consent_at: string | null;
          name: string;
          notes: string | null;
          phone: string;
          preferred_staff_id: string | null;
          shop_id: string;
          sms_consent_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          email_consent_at?: string | null;
          id?: string;
          marketing_consent_at?: string | null;
          name: string;
          notes?: string | null;
          phone: string;
          preferred_staff_id?: string | null;
          shop_id: string;
          sms_consent_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          email_consent_at?: string | null;
          id?: string;
          marketing_consent_at?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string;
          preferred_staff_id?: string | null;
          shop_id?: string;
          sms_consent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_shop_id_preferred_staff_id_fkey";
            columns: ["shop_id", "preferred_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      payment_accounts: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          external_account_id: string;
          id: string;
          payouts_enabled: boolean;
          provider: Database["public"]["Enums"]["payment_provider"];
          shop_id: string;
          staff_id: string | null;
          updated_at: string;
        };
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          external_account_id: string;
          id?: string;
          payouts_enabled?: boolean;
          provider?: Database["public"]["Enums"]["payment_provider"];
          shop_id: string;
          staff_id?: string | null;
          updated_at?: string;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          external_account_id?: string;
          id?: string;
          payouts_enabled?: boolean;
          provider?: Database["public"]["Enums"]["payment_provider"];
          shop_id?: string;
          staff_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_accounts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_accounts_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          appointment_id: string | null;
          client_id: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          note: string | null;
          payment_account_id: string | null;
          platform_fee_cents: number;
          processing_fee_cents: number;
          recorded_by: string | null;
          refunds_payment_id: string | null;
          shop_id: string;
          staff_id: string | null;
          stripe_charge_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string | null;
          tip_cents: number;
        };
        Insert: {
          amount_cents: number;
          appointment_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          note?: string | null;
          payment_account_id?: string | null;
          platform_fee_cents?: number;
          processing_fee_cents?: number;
          recorded_by?: string | null;
          refunds_payment_id?: string | null;
          shop_id: string;
          staff_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          tip_cents?: number;
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          method?: Database["public"]["Enums"]["payment_method"];
          note?: string | null;
          payment_account_id?: string | null;
          platform_fee_cents?: number;
          processing_fee_cents?: number;
          recorded_by?: string | null;
          refunds_payment_id?: string | null;
          shop_id?: string;
          staff_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          tip_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payments_payment_account_id_fkey";
            columns: ["payment_account_id"];
            isOneToOne: false;
            referencedRelation: "payment_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_refunds_payment_id_fkey";
            columns: ["refunds_payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_shop_id_appointment_id_fkey";
            columns: ["shop_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment_balances";
            referencedColumns: ["shop_id", "appointment_id"];
          },
          {
            foreignKeyName: "payments_shop_id_appointment_id_fkey";
            columns: ["shop_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["shop_id", "id"];
          },
          {
            foreignKeyName: "payments_shop_id_client_id_fkey";
            columns: ["shop_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["shop_id", "id"];
          },
          {
            foreignKeyName: "payments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      services: {
        Row: {
          buffer_after_minutes: number;
          created_at: string;
          deposit_cents: number;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          is_addon: boolean;
          name: string;
          price_cents: number;
          shop_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          buffer_after_minutes?: number;
          created_at?: string;
          deposit_cents?: number;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          is_active?: boolean;
          is_addon?: boolean;
          name: string;
          price_cents: number;
          shop_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          buffer_after_minutes?: number;
          created_at?: string;
          deposit_cents?: number;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          is_addon?: boolean;
          name?: string;
          price_cents?: number;
          shop_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          about: string | null;
          address_line: string | null;
          city: string | null;
          email: string | null;
          instagram: string | null;
          neighborhood: string | null;
          phone: string | null;
          postal_code: string | null;
          region: string | null;
          tagline: string | null;
          brand_color: string | null;
          cancellation_window_minutes: number;
          created_at: string;
          custom_domain: string | null;
          id: string;
          late_cancel_fee_cents: number;
          max_booking_advance_days: number;
          min_booking_notice_minutes: number;
          name: string;
          no_show_fee_cents: number;
          plan: Database["public"]["Enums"]["shop_plan"];
          share_clients_between_staff: boolean;
          slot_interval_minutes: number;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          about?: string | null;
          address_line?: string | null;
          city?: string | null;
          email?: string | null;
          instagram?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          tagline?: string | null;
          brand_color?: string | null;
          cancellation_window_minutes?: number;
          created_at?: string;
          custom_domain?: string | null;
          id?: string;
          late_cancel_fee_cents?: number;
          max_booking_advance_days?: number;
          min_booking_notice_minutes?: number;
          name: string;
          no_show_fee_cents?: number;
          plan?: Database["public"]["Enums"]["shop_plan"];
          share_clients_between_staff?: boolean;
          slot_interval_minutes?: number;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          about?: string | null;
          address_line?: string | null;
          city?: string | null;
          email?: string | null;
          instagram?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          tagline?: string | null;
          brand_color?: string | null;
          cancellation_window_minutes?: number;
          created_at?: string;
          custom_domain?: string | null;
          id?: string;
          late_cancel_fee_cents?: number;
          max_booking_advance_days?: number;
          min_booking_notice_minutes?: number;
          name?: string;
          no_show_fee_cents?: number;
          plan?: Database["public"]["Enums"]["shop_plan"];
          share_clients_between_staff?: boolean;
          slot_interval_minutes?: number;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          bio: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          is_active: boolean;
          is_bookable: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["staff_role"];
          shop_id: string;
          slug: string;
          sort_order: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          display_name: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_bookable?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["staff_role"];
          shop_id: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_bookable?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["staff_role"];
          shop_id?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: {
          created_at: string;
          duration_minutes: number | null;
          id: string;
          price_cents: number | null;
          service_id: string;
          shop_id: string;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          price_cents?: number | null;
          service_id: string;
          shop_id: string;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          price_cents?: number | null;
          service_id?: string;
          shop_id?: string;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_services_shop_id_service_id_fkey";
            columns: ["shop_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["shop_id", "id"];
          },
          {
            foreignKeyName: "staff_services_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      time_off: {
        Row: {
          created_at: string;
          during: unknown;
          id: string;
          reason: string | null;
          shop_id: string;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          during: unknown;
          id?: string;
          reason?: string | null;
          shop_id: string;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          during?: unknown;
          id?: string;
          reason?: string | null;
          shop_id?: string;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_off_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
      working_hours: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          shop_id: string;
          staff_id: string;
          start_time: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          shop_id: string;
          staff_id: string;
          start_time: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          shop_id?: string;
          staff_id?: string;
          start_time?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "working_hours_shop_id_staff_id_fkey";
            columns: ["shop_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["shop_id", "id"];
          },
        ];
      };
    };
    Views: {
      client_stats: {
        Row: {
          client_id: string | null;
          last_visit_at: string | null;
          next_visit_at: string | null;
          no_shows: number | null;
          shop_id: string | null;
          spent_cents: number | null;
          visits: number | null;
        };
        Relationships: [];
      };
      appointment_balances: {
        Row: {
          appointment_id: string | null;
          balance_due_cents: number | null;
          fees_cents: number | null;
          paid_cents: number | null;
          shop_id: string | null;
          tip_cents: number | null;
          total_price_cents: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      cancel_appointment: {
        Args: {
          p_appointment_id: string;
          p_cancelled_by: Database["public"]["Enums"]["cancellation_party"];
          p_reason?: string;
        };
        Returns: {
          blocked_until: string;
          booked_by: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id: string | null;
          client_note: string | null;
          created_at: string;
          deposit_cents: number;
          ends_at: string;
          hold_expires_at: string | null;
          id: string;
          shop_id: string;
          source: Database["public"]["Enums"]["booking_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_price_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_staff_invites: { Args: never; Returns: number };
      confirm_hold: {
        Args: { p_appointment_id: string; p_client_id: string };
        Returns: {
          blocked_until: string;
          booked_by: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id: string | null;
          client_note: string | null;
          created_at: string;
          deposit_cents: number;
          ends_at: string;
          hold_expires_at: string | null;
          id: string;
          shop_id: string;
          source: Database["public"]["Enums"]["booking_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_price_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_appointment: {
        Args: {
          p_booked_by: Database["public"]["Enums"]["booking_actor"];
          p_client_id?: string;
          p_client_note?: string;
          p_hold_minutes?: number;
          p_service_ids: string[];
          p_shop_id: string;
          p_source: Database["public"]["Enums"]["booking_source"];
          p_staff_id: string;
          p_starts_at: string;
        };
        Returns: {
          blocked_until: string;
          booked_by: Database["public"]["Enums"]["booking_actor"];
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancellation_party"] | null;
          client_id: string | null;
          client_note: string | null;
          created_at: string;
          deposit_cents: number;
          ends_at: string;
          hold_expires_at: string | null;
          id: string;
          shop_id: string;
          source: Database["public"]["Enums"]["booking_source"];
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          total_price_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      expire_stale_holds: { Args: never; Returns: number };
      is_valid_timezone: { Args: { tz: string }; Returns: boolean };
      set_working_hours: {
        Args: { p_hours: Json; p_staff_id: string };
        Returns: {
          created_at: string;
          end_time: string;
          id: string;
          shop_id: string;
          staff_id: string;
          start_time: string;
          updated_at: string;
          weekday: number;
        }[];
      };
      record_manual_payment: {
        Args: {
          p_amount_cents?: number;
          p_appointment_id: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_note?: string;
          p_tip_cents?: number;
        };
        Returns: {
          amount_cents: number;
          appointment_id: string | null;
          client_id: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          note: string | null;
          payment_account_id: string | null;
          platform_fee_cents: number;
          processing_fee_cents: number;
          recorded_by: string | null;
          refunds_payment_id: string | null;
          shop_id: string;
          staff_id: string | null;
          stripe_charge_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string | null;
          tip_cents: number;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      appointment_status:
        "held" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show" | "expired";
      booking_actor: "client" | "staff" | "chat_agent" | "voice_agent" | "import";
      booking_source:
        | "booking_link"
        | "website"
        | "instagram"
        | "google"
        | "phone"
        | "walk_in"
        | "referral"
        | "import"
        | "other";
      cancellation_party: "client" | "shop";
      payment_kind: "deposit" | "service" | "no_show_fee" | "late_cancel_fee" | "refund";
      payment_method: "cash" | "external" | "card";
      payment_provider: "stripe";
      shop_plan: "solo" | "shop";
      staff_role: "owner" | "manager" | "barber";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "held",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
        "expired",
      ],
      booking_actor: ["client", "staff", "chat_agent", "voice_agent", "import"],
      booking_source: [
        "booking_link",
        "website",
        "instagram",
        "google",
        "phone",
        "walk_in",
        "referral",
        "import",
        "other",
      ],
      cancellation_party: ["client", "shop"],
      payment_kind: ["deposit", "service", "no_show_fee", "late_cancel_fee", "refund"],
      payment_method: ["cash", "external", "card"],
      payment_provider: ["stripe"],
      shop_plan: ["solo", "shop"],
      staff_role: ["owner", "manager", "barber"],
    },
  },
} as const;
