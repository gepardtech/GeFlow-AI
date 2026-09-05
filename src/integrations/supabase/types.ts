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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by_user_id: string
          ends_at: string | null
          id: string
          is_active: boolean
          link_label: string | null
          link_url: string | null
          position: string
          starts_at: string
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by_user_id: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          position?: string
          starts_at?: string
          title: string
          updated_at?: string
          variant?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by_user_id?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          position?: string
          starts_at?: string
          title?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      business_categories: {
        Row: {
          created_at: string
          created_by_user_id: string
          currency: string
          default_tax: number
          enabled_features: string[]
          enabled_modules: string[]
          id: string
          industry_type: string
          name: string
          status: string
          stock_alert_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          currency?: string
          default_tax?: number
          enabled_features?: string[]
          enabled_modules?: string[]
          id?: string
          industry_type: string
          name: string
          status?: string
          stock_alert_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          currency?: string
          default_tax?: number
          enabled_features?: string[]
          enabled_modules?: string[]
          id?: string
          industry_type?: string
          name?: string
          status?: string
          stock_alert_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      business_category_internal: {
        Row: {
          category_id: string
          internal_description: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          internal_description?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          internal_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_category_internal_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          base_currency: string | null
          business_address: string | null
          business_name: string
          category_id: string | null
          created_at: string
          currency: string
          default_tax: number
          id: string
          last_active: string
          listed_products: number
          owner_user_id: string
          status: string
          stock_alert_limit: number
          updated_at: string
          usage: number
        }
        Insert: {
          base_currency?: string | null
          business_address?: string | null
          business_name: string
          category_id?: string | null
          created_at?: string
          currency: string
          default_tax?: number
          id?: string
          last_active?: string
          listed_products?: number
          owner_user_id: string
          status?: string
          stock_alert_limit?: number
          updated_at?: string
          usage?: number
        }
        Update: {
          base_currency?: string | null
          business_address?: string | null
          business_name?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          default_tax?: number
          id?: string
          last_active?: string
          listed_products?: number
          owner_user_id?: string
          status?: string
          stock_alert_limit?: number
          updated_at?: string
          usage?: number
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          applies_to_plan: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_amount: number
          starts_at: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          active?: boolean
          applies_to_plan?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          active?: boolean
          applies_to_plan?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_amount?: number
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      feature_modules: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          function_group: string
          global_active: boolean
          health: string
          id: string
          latency_ms: number
          lifecycle_phase: string
          module_code: string
          name: string
          plan_free: boolean
          plan_premium: boolean
          plan_standard: boolean
          source_file_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          function_group?: string
          global_active?: boolean
          health?: string
          id?: string
          latency_ms?: number
          lifecycle_phase?: string
          module_code: string
          name: string
          plan_free?: boolean
          plan_premium?: boolean
          plan_standard?: boolean
          source_file_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          function_group?: string
          global_active?: boolean
          health?: string
          id?: string
          latency_ms?: number
          lifecycle_phase?: string
          module_code?: string
          name?: string
          plan_free?: boolean
          plan_premium?: boolean
          plan_standard?: boolean
          source_file_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          billing_email: string
          business_id: string | null
          client_name: string
          created_at: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          owner_user_id: string | null
          payment_method: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_email: string
          business_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_email?: string
          business_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_base_articles: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by_user_id: string
          id: string
          is_active: boolean
          page_assignments: string[]
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          created_by_user_id: string
          id?: string
          is_active?: boolean
          page_assignments?: string[]
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_active?: boolean
          page_assignments?: string[]
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          created_at: string
          credentials: Json
          enabled: boolean
          gateway_key: string
          id: string
          mode: string
          name: string
          public_config: Json
          sort_order: number
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          gateway_key: string
          id?: string
          mode?: string
          name: string
          public_config?: Json
          sort_order?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          gateway_key?: string
          id?: string
          mode?: string
          name?: string
          public_config?: Json
          sort_order?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          allow_partial_refunds: boolean
          auto_send_invoices: boolean
          company_address: string | null
          created_at: string
          enable_refunds: boolean
          fraud_detection: boolean
          id: string
          include_branding: boolean
          invoice_footer: string | null
          multi_gateway_failover: boolean
          notify_user_on_failure: boolean
          payout_account: string | null
          payout_currency: string
          payout_method: string
          payout_min_amount: number
          payout_schedule: string
          refund_window_days: number
          retry_count: number
          retry_failed: boolean
          retry_interval_hours: number
          sandbox_mode: boolean
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          allow_partial_refunds?: boolean
          auto_send_invoices?: boolean
          company_address?: string | null
          created_at?: string
          enable_refunds?: boolean
          fraud_detection?: boolean
          id?: string
          include_branding?: boolean
          invoice_footer?: string | null
          multi_gateway_failover?: boolean
          notify_user_on_failure?: boolean
          payout_account?: string | null
          payout_currency?: string
          payout_method?: string
          payout_min_amount?: number
          payout_schedule?: string
          refund_window_days?: number
          retry_count?: number
          retry_failed?: boolean
          retry_interval_hours?: number
          sandbox_mode?: boolean
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_partial_refunds?: boolean
          auto_send_invoices?: boolean
          company_address?: string | null
          created_at?: string
          enable_refunds?: boolean
          fraud_detection?: boolean
          id?: string
          include_branding?: boolean
          invoice_footer?: string | null
          multi_gateway_failover?: boolean
          notify_user_on_failure?: boolean
          payout_account?: string | null
          payout_currency?: string
          payout_method?: string
          payout_min_amount?: number
          payout_schedule?: string
          refund_window_days?: number
          retry_count?: number
          retry_failed?: boolean
          retry_interval_hours?: number
          sandbox_mode?: boolean
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          cycle: string
          id: string
          method: string | null
          payer_email: string | null
          plan: string
          provider: string
          provider_capture_id: string | null
          provider_order_id: string | null
          raw: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          cycle?: string
          id?: string
          method?: string | null
          payer_email?: string | null
          plan?: string
          provider?: string
          provider_capture_id?: string | null
          provider_order_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          cycle?: string
          id?: string
          method?: string | null
          payer_email?: string | null
          plan?: string
          provider?: string
          provider_capture_id?: string | null
          provider_order_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          label: string
          limit_value: number | null
          plan_key: string
          resource_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          label: string
          limit_value?: number | null
          plan_key: string
          resource_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          label?: string
          limit_value?: number | null
          plan_key?: string
          resource_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          admin_2fa: boolean
          alerts: Json
          api_maintenance: boolean
          app_name: string
          automated_tax_receipts: boolean
          base_currency: string
          default_theme: string
          favicon_url: string | null
          global_branch_sync: boolean
          global_ip_guard: boolean
          hardware_key: boolean
          id: string
          interface_language: string
          invoice_prefix: string
          logo_url: string | null
          maintenance_message: string | null
          maintenance_mode: boolean
          min_pass_length: number
          multi_business: boolean
          primary_accent: string
          secondary_accent: string
          session_ttl: number
          singleton: boolean
          system_timezone: string
          tagline: string | null
          universal_tax: number
          updated_at: string
          white_label: boolean
        }
        Insert: {
          admin_2fa?: boolean
          alerts?: Json
          api_maintenance?: boolean
          app_name?: string
          automated_tax_receipts?: boolean
          base_currency?: string
          default_theme?: string
          favicon_url?: string | null
          global_branch_sync?: boolean
          global_ip_guard?: boolean
          hardware_key?: boolean
          id?: string
          interface_language?: string
          invoice_prefix?: string
          logo_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_pass_length?: number
          multi_business?: boolean
          primary_accent?: string
          secondary_accent?: string
          session_ttl?: number
          singleton?: boolean
          system_timezone?: string
          tagline?: string | null
          universal_tax?: number
          updated_at?: string
          white_label?: boolean
        }
        Update: {
          admin_2fa?: boolean
          alerts?: Json
          api_maintenance?: boolean
          app_name?: string
          automated_tax_receipts?: boolean
          base_currency?: string
          default_theme?: string
          favicon_url?: string | null
          global_branch_sync?: boolean
          global_ip_guard?: boolean
          hardware_key?: boolean
          id?: string
          interface_language?: string
          invoice_prefix?: string
          logo_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_pass_length?: number
          multi_business?: boolean
          primary_accent?: string
          secondary_accent?: string
          session_ttl?: number
          singleton?: boolean
          system_timezone?: string
          tagline?: string | null
          universal_tax?: number
          updated_at?: string
          white_label?: boolean
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          badge_cycle: string
          badge_position: string
          badge_text: string | null
          created_at: string
          features: string[]
          id: string
          is_active: boolean
          is_popular: boolean
          lifetime_price: number
          monthly_price: number
          name: string
          payment_method_synced: boolean
          plan_key: string
          sort_order: number
          tagline: string | null
          updated_at: string
          yearly_price: number
        }
        Insert: {
          badge_cycle?: string
          badge_position?: string
          badge_text?: string | null
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          is_popular?: boolean
          lifetime_price?: number
          monthly_price?: number
          name: string
          payment_method_synced?: boolean
          plan_key: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          badge_cycle?: string
          badge_position?: string
          badge_text?: string | null
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          is_popular?: boolean
          lifetime_price?: number
          monthly_price?: number
          name?: string
          payment_method_synced?: boolean
          plan_key?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          industry_assignments: string[]
          inherit_alerts: boolean
          inherit_barcode: boolean
          inherit_batch: boolean
          inherit_expiry: boolean
          name: string
          parent_id: string | null
          slug: string
          status: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          industry_assignments?: string[]
          inherit_alerts?: boolean
          inherit_barcode?: boolean
          inherit_batch?: boolean
          inherit_expiry?: boolean
          name: string
          parent_id?: string | null
          slug: string
          status?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          industry_assignments?: string[]
          inherit_alerts?: boolean
          inherit_barcode?: boolean
          inherit_batch?: boolean
          inherit_expiry?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_unit: string | null
          batch_number: string | null
          business_id: string
          category_id: string | null
          created_at: string
          description: string | null
          discount_price: number | null
          expiry_date: string | null
          id: string
          images: string[]
          internal_sku: string | null
          min_stock_alert: number
          name: string
          owner_user_id: string
          purchase_cost: number
          retail_price: number
          status: string
          stock_units: number
          subcategory_id: string | null
          units_per_uom: number | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_unit?: string | null
          batch_number?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          expiry_date?: string | null
          id?: string
          images?: string[]
          internal_sku?: string | null
          min_stock_alert?: number
          name: string
          owner_user_id: string
          purchase_cost?: number
          retail_price?: number
          status?: string
          stock_units?: number
          subcategory_id?: string | null
          units_per_uom?: number | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_unit?: string | null
          batch_number?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          expiry_date?: string | null
          id?: string
          images?: string[]
          internal_sku?: string | null
          min_stock_alert?: number
          name?: string
          owner_user_id?: string
          purchase_cost?: number
          retail_price?: number
          status?: string
          stock_units?: number
          subcategory_id?: string | null
          units_per_uom?: number | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_active: string
          listed_products: number
          plan: string
          status: string
          usage: number
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active?: string
          listed_products?: number
          plan?: string
          status?: string
          usage?: number
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active?: string
          listed_products?: number
          plan?: string
          status?: string
          usage?: number
          user_id?: string
        }
        Relationships: []
      }
      public_feature_modules: {
        Row: {
          description: string | null
          function_group: string
          global_active: boolean
          id: string
          module_code: string
          name: string
          plan_free: boolean
          plan_premium: boolean
          plan_standard: boolean
          updated_at: string
        }
        Insert: {
          description?: string | null
          function_group: string
          global_active?: boolean
          id: string
          module_code: string
          name: string
          plan_free?: boolean
          plan_premium?: boolean
          plan_standard?: boolean
          updated_at?: string
        }
        Update: {
          description?: string | null
          function_group?: string
          global_active?: boolean
          id?: string
          module_code?: string
          name?: string
          plan_free?: boolean
          plan_premium?: boolean
          plan_standard?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      public_payment_gateways: {
        Row: {
          enabled: boolean
          gateway_key: string
          id: string
          mode: string
          name: string
          public_client_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          gateway_key: string
          id: string
          mode?: string
          name: string
          public_client_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          gateway_key?: string
          id?: string
          mode?: string
          name?: string
          public_client_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      public_settings: {
        Row: {
          app_name: string | null
          base_currency: string | null
          default_theme: string | null
          favicon_url: string | null
          id: string
          interface_language: string | null
          invoice_prefix: string | null
          logo_url: string | null
          maintenance_message: string | null
          maintenance_mode: boolean
          primary_accent: string | null
          secondary_accent: string | null
          system_timezone: string | null
          tagline: string | null
          universal_tax: number | null
          updated_at: string
        }
        Insert: {
          app_name?: string | null
          base_currency?: string | null
          default_theme?: string | null
          favicon_url?: string | null
          id: string
          interface_language?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          primary_accent?: string | null
          secondary_accent?: string | null
          system_timezone?: string | null
          tagline?: string | null
          universal_tax?: number | null
          updated_at?: string
        }
        Update: {
          app_name?: string | null
          base_currency?: string | null
          default_theme?: string | null
          favicon_url?: string | null
          id?: string
          interface_language?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          primary_accent?: string | null
          secondary_accent?: string | null
          system_timezone?: string | null
          tagline?: string | null
          universal_tax?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          owner_user_id: string
          product_id: string | null
          product_name: string
          purchase_id: string
          purchase_price: number
          quantity: number
          sale_price: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          owner_user_id: string
          product_id?: string | null
          product_name: string
          purchase_id: string
          purchase_price?: number
          quantity?: number
          sale_price?: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          purchase_id?: string
          purchase_price?: number
          quantity?: number
          sale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          business_id: string
          created_at: string
          entry_date: string
          id: string
          invoice_ref: string | null
          owner_user_id: string
          status: string
          supplier_name: string
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          entry_date?: string
          id?: string
          invoice_ref?: string | null
          owner_user_id: string
          status?: string
          supplier_name?: string
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          invoice_ref?: string | null
          owner_user_id?: string
          status?: string
          supplier_name?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          business_id: string | null
          created_at: string
          id: string
          owner_user_id: string
          reason: string
          resolved_at: string | null
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          business_id?: string | null
          created_at?: string
          id?: string
          owner_user_id: string
          reason: string
          resolved_at?: string | null
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          business_id?: string | null
          created_at?: string
          id?: string
          owner_user_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reply_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by_user_id: string
          id: string
          is_default: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by_user_id: string
          id?: string
          is_default?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_default?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
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
          business_id: string
          created_at: string
          id: string
          owner_user_id: string
          processed_by: string | null
          profit: number
          status: string
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          owner_user_id: string
          processed_by?: string | null
          profit?: number
          status?: string
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          owner_user_id?: string
          processed_by?: string | null
          profit?: number
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          business_id: string
          created_at: string
          id: string
          note: string | null
          owner_user_id: string
          product_id: string
          quantity: number
          reason: string | null
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          note?: string | null
          owner_user_id: string
          product_id: string
          quantity?: number
          reason?: string | null
          type?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          note?: string | null
          owner_user_id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      subscriptions: {
        Row: {
          amount: number
          business_id: string | null
          created_at: string
          cycle: string
          id: string
          next_billing_date: string | null
          owner_user_id: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id?: string | null
          created_at?: string
          cycle?: string
          id?: string
          next_billing_date?: string | null
          owner_user_id: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string | null
          created_at?: string
          cycle?: string
          id?: string
          next_billing_date?: string | null
          owner_user_id?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_automation_settings: {
        Row: {
          ai_auto_reply_after_hours: number
          ai_auto_reply_enabled: boolean
          auto_feedback_reply_enabled: boolean
          auto_feedback_template_ids: string[]
          auto_reply_enabled: boolean
          auto_reply_template_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ai_auto_reply_after_hours?: number
          ai_auto_reply_enabled?: boolean
          auto_feedback_reply_enabled?: boolean
          auto_feedback_template_ids?: string[]
          auto_reply_enabled?: boolean
          auto_reply_template_id?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          ai_auto_reply_after_hours?: number
          ai_auto_reply_enabled?: boolean
          auto_feedback_reply_enabled?: boolean
          auto_feedback_template_ids?: string[]
          auto_reply_enabled?: boolean
          auto_reply_template_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_automation_settings_auto_reply_template_id_fkey"
            columns: ["auto_reply_template_id"]
            isOneToOne: false
            referencedRelation: "reply_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      support_team_members: {
        Row: {
          appointed_by_user_id: string
          created_at: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointed_by_user_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointed_by_user_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to_user_id: string | null
          category: string
          contact_submission_id: string | null
          created_at: string
          id: string
          owner_user_id: string
          priority: string
          resolved_at: string | null
          source: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          category?: string
          contact_submission_id?: string | null
          created_at?: string
          id?: string
          owner_user_id: string
          priority?: string
          resolved_at?: string | null
          source?: string
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          category?: string
          contact_submission_id?: string | null
          created_at?: string
          id?: string
          owner_user_id?: string
          priority?: string
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_admin: boolean
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_business_limit: { Args: { _plan: string }; Returns: number }
      get_public_platform_settings: {
        Args: never
        Returns: {
          app_name: string
          default_theme: string
          favicon_url: string
          id: string
          interface_language: string
          logo_url: string
          primary_accent: string
          secondary_accent: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_business_ai_usage: {
        Args: { _business_id: string }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string; _plan: string; _subtotal: number }
        Returns: {
          amount: number
          discount_type: string
          discount_value: number
          label: string
          reason: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
