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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      held_sales: {
        Row: {
          cart: Json
          cashier_id: string
          created_at: string
          id: string
          label: string | null
        }
        Insert: {
          cart: Json
          cashier_id: string
          created_at?: string
          id?: string
          label?: string | null
        }
        Update: {
          cart?: Json
          cashier_id?: string
          created_at?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "held_sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_cashier_id_profiles_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          category_id: string | null
          cost_price_kobo: number
          created_at: string
          id: string
          image_url: string | null
          name: string
          reorder_level: number
          sell_price_kobo: number
          sku: string
          stock_qty: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          category_id?: string | null
          cost_price_kobo?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          reorder_level?: number
          sell_price_kobo?: number
          sku: string
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          category_id?: string | null
          cost_price_kobo?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          reorder_level?: number
          sell_price_kobo?: number
          sku?: string
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_discount_kobo: number
          line_total_kobo: number
          product_id: string
          product_name: string
          quantity: number
          refunded_qty: number
          sale_id: string
          sku: string
          unit_price_kobo: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_discount_kobo?: number
          line_total_kobo: number
          product_id: string
          product_name: string
          quantity: number
          refunded_qty?: number
          sale_id: string
          sku: string
          unit_price_kobo: number
        }
        Update: {
          created_at?: string
          id?: string
          line_discount_kobo?: number
          line_total_kobo?: number
          product_id?: string
          product_name?: string
          quantity?: number
          refunded_qty?: number
          sale_id?: string
          sku?: string
          unit_price_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_tendered_kobo: number
          cashier_id: string
          change_kobo: number
          created_at: string
          discount_kobo: number
          id: string
          note: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: number
          shift_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_kobo: number
          total_kobo: number
        }
        Insert: {
          amount_tendered_kobo?: number
          cashier_id: string
          change_kobo?: number
          created_at?: string
          discount_kobo?: number
          id?: string
          note?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          shift_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_kobo?: number
          total_kobo?: number
        }
        Update: {
          amount_tendered_kobo?: number
          cashier_id?: string
          change_kobo?: number
          created_at?: string
          discount_kobo?: number
          id?: string
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          shift_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_kobo?: number
          total_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_profiles_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          cashier_id: string
          closed_at: string | null
          counted_cash_breakdown: Json | null
          counted_cash_kobo: number | null
          expected_cash_breakdown: Json | null
          expected_cash_kobo: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_float_kobo: number
          status: Database["public"]["Enums"]["shift_status"]
          totals_by_method: Json | null
          variance_kobo: number | null
        }
        Insert: {
          cashier_id: string
          closed_at?: string | null
          counted_cash_breakdown?: Json | null
          counted_cash_kobo?: number | null
          expected_cash_breakdown?: Json | null
          expected_cash_kobo?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_kobo?: number
          status?: Database["public"]["Enums"]["shift_status"]
          totals_by_method?: Json | null
          variance_kobo?: number | null
        }
        Update: {
          cashier_id?: string
          closed_at?: string | null
          counted_cash_breakdown?: Json | null
          counted_cash_kobo?: number | null
          expected_cash_breakdown?: Json | null
          expected_cash_kobo?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_kobo?: number
          status?: Database["public"]["Enums"]["shift_status"]
          totals_by_method?: Json | null
          variance_kobo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_cashier_id_profiles_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          change_qty: number
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          performed_by: string | null
          product_id: string
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          change_qty: number
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          performed_by?: string | null
          product_id: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          change_qty?: number
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          performed_by?: string | null
          product_id?: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_performed_by_profiles_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          id: number
          logo_url: string | null
          phone: string | null
          receipt_footer: string | null
          store_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          store_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          store_name?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          _change_qty: number
          _performed_by: string
          _product_id: string
          _reason: string
        }
        Returns: undefined
      }
      close_shift:
        | {
            Args: {
              _counted_cash_kobo: number
              _notes: string
              _shift_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _counted_breakdown?: Json
              _counted_cash_kobo: number
              _notes: string
              _shift_id: string
            }
            Returns: undefined
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_sku: { Args: { _prefix: string }; Returns: string }
      process_checkout: {
        Args: {
          _amount_tendered_kobo: number
          _cashier: string
          _items: Json
          _payment_method: Database["public"]["Enums"]["payment_method"]
          _sale_discount_kobo: number
          _shift_id: string
        }
        Returns: string
      }
      process_refund: {
        Args: {
          _items: Json
          _performed_by: string
          _reason: string
          _sale_id: string
        }
        Returns: undefined
      }
      process_void: {
        Args: { _performed_by: string; _reason: string; _sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier"
      payment_method: "cash" | "transfer" | "pos_card"
      sale_status: "completed" | "refunded" | "partially_refunded" | "voided"
      shift_status: "open" | "closed"
      stock_movement_type:
        | "sale"
        | "refund"
        | "adjustment_in"
        | "adjustment_out"
        | "restock"
        | "damage"
        | "correction"
        | "void"
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
      app_role: ["admin", "manager", "cashier"],
      payment_method: ["cash", "transfer", "pos_card"],
      sale_status: ["completed", "refunded", "partially_refunded", "voided"],
      shift_status: ["open", "closed"],
      stock_movement_type: [
        "sale",
        "refund",
        "adjustment_in",
        "adjustment_out",
        "restock",
        "damage",
        "correction",
        "void",
      ],
    },
  },
} as const
