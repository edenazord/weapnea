// Supabase types removed. API-only migration complete.
export {};

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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      blog_articles: {
        Row: {
          author_id: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          gallery_images: string[] | null
          hashtags: string[] | null
          id: string
          published: boolean
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gallery_images?: string[] | null
          hashtags?: string[] | null
          id?: string
          published?: boolean
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gallery_images?: string[] | null
          hashtags?: string[] | null
          id?: string
          published?: boolean
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
        }
        Relationships: []
      }
      email_confirmation_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
          token_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
          token_type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          token_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          subject: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_participations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          registered_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          registered_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          registered_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          event_id: string
          id: string
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_wishlist: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_wishlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          about_us: string | null
          activity_description: string | null
          activity_details: string | null
          category_id: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          date: string | null
          description: string | null
          discipline: string | null
          end_date: string | null
          event_type: string | null
          fixed_appointment: boolean | null
          gallery_images: string[] | null
          id: string
          image_url: string | null
          included_in_activity: string | null
          instructor_certificates: string[] | null
          instructors: Json | null
          language: string | null
          level: string | null
          location: string | null
          max_participants_per_instructor: number | null
          nation: string | null
          not_included_in_activity: string | null
          notes: string | null
          objectives: string | null
          participants: number | null
          privacy_accepted: boolean | null
          responsibility_waiver_accepted: boolean | null
          schedule_logistics: string | null
          schedule_meeting_point: string | null
          slug: string
          title: string
          who_we_are: string | null
        }
        Insert: {
          about_us?: string | null
          activity_description?: string | null
          activity_details?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          discipline?: string | null
          end_date?: string | null
          event_type?: string | null
          fixed_appointment?: boolean | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string | null
          included_in_activity?: string | null
          instructor_certificates?: string[] | null
          instructors?: Json | null
          language?: string | null
          level?: string | null
          location?: string | null
          max_participants_per_instructor?: number | null
          nation?: string | null
          not_included_in_activity?: string | null
          notes?: string | null
          objectives?: string | null
          participants?: number | null
          privacy_accepted?: boolean | null
          responsibility_waiver_accepted?: boolean | null
          schedule_logistics?: string | null
          schedule_meeting_point?: string | null
          slug: string
          title: string
          who_we_are?: string | null
        }
        Update: {
          about_us?: string | null
          activity_description?: string | null
          activity_details?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          discipline?: string | null
          end_date?: string | null
          event_type?: string | null
          fixed_appointment?: boolean | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string | null
          included_in_activity?: string | null
          instructor_certificates?: string[] | null
          instructors?: Json | null
          language?: string | null
          level?: string | null
          location?: string | null
          max_participants_per_instructor?: number | null
          nation?: string | null
          not_included_in_activity?: string | null
          notes?: string | null
          objectives?: string | null
          participants?: number | null
          privacy_accepted?: boolean | null
          responsibility_waiver_accepted?: boolean | null
          schedule_logistics?: string | null
          schedule_meeting_point?: string | null
          slug?: string
          title?: string
          who_we_are?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          author_id: string
          category_id: string
          content: string
          created_at: string
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          last_reply_at: string | null
          last_reply_by: string | null
          replies_count: number | null
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          author_id: string
          category_id: string
          content: string
          created_at?: string
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_reply_at?: string | null
          last_reply_by?: string | null
          replies_count?: number | null
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_reply_at?: string | null
          last_reply_by?: string | null
          replies_count?: number | null
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_topics_last_reply_by_fkey"
            columns: ["last_reply_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          native_name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          native_name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          native_name?: string
        }
        Relationships: []
      }
      password_recovery_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assicurazione: string | null
          avatar_url: string | null
          bio: string | null
          brevetto: string | null
          company_address: string | null
          company_name: string | null
          full_name: string | null
          id: string
          instagram_contact: string | null
          is_active: boolean | null
          personal_best: Json | null
          role: Database["public"]["Enums"]["user_role"]
          scadenza_assicurazione: string | null
          scadenza_brevetto: string | null
          scadenza_certificato_medico: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          assicurazione?: string | null
          avatar_url?: string | null
          bio?: string | null
          brevetto?: string | null
          company_address?: string | null
          company_name?: string | null
          full_name?: string | null
          id: string
          instagram_contact?: string | null
          is_active?: boolean | null
          personal_best?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          scadenza_assicurazione?: string | null
          scadenza_brevetto?: string | null
          scadenza_certificato_medico?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          assicurazione?: string | null
          avatar_url?: string | null
          bio?: string | null
          brevetto?: string | null
          company_address?: string | null
          company_name?: string | null
          full_name?: string | null
          id?: string
          instagram_contact?: string | null
          is_active?: boolean | null
          personal_best?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          scadenza_assicurazione?: string | null
          scadenza_brevetto?: string | null
          scadenza_certificato_medico?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key: string
          language_code: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          language_code: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          language_code?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      user_packages: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          package_id: string
          package_name: string
          package_type: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id: string
          package_name: string
          package_type: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string
          package_name?: string
          package_type?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_account: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      verify_email_confirmation_token: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
      verify_email_token: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "company" | "instructor" | "final_user" | "admin" | "blogger"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      user_role: ["company", "instructor", "final_user", "admin", "blogger"],
    },
  },
} as const
