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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action_type: string
          created_at: string
          data: Json | null
          id: string
          target_id: string | null
          target_type: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          data?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          data?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          cnpj_cpf: string | null
          created_at: string
          dividir_contrato: boolean | null
          email: string | null
          endereco: string | null
          historico: boolean | null
          id: string
          lead_id: string | null
          mensalidades_pagas: number | null
          nome: string
          parceiro_id: string | null
          responsavel_id: string | null
          updated_at: string
          valor_ate_vencimento: number | null
          valor_custo: number | null
          valor_negociado: number | null
          valor_pago: number | null
          whatsapp: string | null
        }
        Insert: {
          cnpj_cpf?: string | null
          created_at?: string
          dividir_contrato?: boolean | null
          email?: string | null
          endereco?: string | null
          historico?: boolean | null
          id?: string
          lead_id?: string | null
          mensalidades_pagas?: number | null
          nome: string
          parceiro_id?: string | null
          responsavel_id?: string | null
          updated_at?: string
          valor_ate_vencimento?: number | null
          valor_custo?: number | null
          valor_negociado?: number | null
          valor_pago?: number | null
          whatsapp?: string | null
        }
        Update: {
          cnpj_cpf?: string | null
          created_at?: string
          dividir_contrato?: boolean | null
          email?: string | null
          endereco?: string | null
          historico?: boolean | null
          id?: string
          lead_id?: string | null
          mensalidades_pagas?: number | null
          nome?: string
          parceiro_id?: string | null
          responsavel_id?: string | null
          updated_at?: string
          valor_ate_vencimento?: number | null
          valor_custo?: number | null
          valor_negociado?: number | null
          valor_pago?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          cargo: string | null
          created_at: string
          email: string | null
          empresa: string | null
          endereco: string | null
          equipamento: string | null
          id: string
          interesse: string | null
          nome: string
          notas: string | null
          origem: string | null
          responsible_id: string | null
          status: string
          updated_at: string
          valor_contrato: number | null
          whatsapp: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          equipamento?: string | null
          id?: string
          interesse?: string | null
          nome: string
          notas?: string | null
          origem?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
          valor_contrato?: number | null
          whatsapp?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          equipamento?: string | null
          id?: string
          interesse?: string | null
          nome?: string
          notas?: string | null
          origem?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
          valor_contrato?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      mensalidades: {
        Row: {
          client_id: string
          created_at: string
          data_pagamento: string
          id: string
          numero_mensalidade: number
          valor: number
        }
        Insert: {
          client_id: string
          created_at?: string
          data_pagamento?: string
          id?: string
          numero_mensalidade: number
          valor?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          data_pagamento?: string
          id?: string
          numero_mensalidade?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          meta_bonus_descricao: string | null
          meta_bonus_quantidade: number | null
          meta_bonus_valor: number | null
          quantidade_meta: number
          updated_at: string
          valor_contrato: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          meta_bonus_descricao?: string | null
          meta_bonus_quantidade?: number | null
          meta_bonus_valor?: number | null
          quantidade_meta?: number
          updated_at?: string
          valor_contrato?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          meta_bonus_descricao?: string | null
          meta_bonus_quantidade?: number | null
          meta_bonus_valor?: number | null
          quantidade_meta?: number
          updated_at?: string
          valor_contrato?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cor: string | null
          created_at: string
          custom_role_id: string | null
          id: string
          nome: string
          participa_comissao: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cor?: string | null
          created_at?: string
          custom_role_id?: string | null
          id: string
          nome?: string
          participa_comissao?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cor?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          nome?: string
          participa_comissao?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          descricao: string | null
          due_date: string | null
          id: string
          nome: string
          prioridade: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          nome: string
          prioridade?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          nome?: string
          prioridade?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          project_id: string | null
          status: string
          time_estimate: number | null
          time_spent: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          time_estimate?: number | null
          time_spent?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          time_estimate?: number | null
          time_spent?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      visits: {
        Row: {
          client_id: string | null
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          lead_id: string | null
          member_id: string | null
          status: string
          titulo: string
          updated_at: string
          visit_date: string
          visit_end: string | null
        }
        Insert: {
          client_id?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
          member_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          visit_date: string
          visit_end?: string | null
        }
        Update: {
          client_id?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
          member_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          visit_date?: string
          visit_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_gestor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "gestor" | "suporte" | "desenvolvedor" | "vendas"
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
      app_role: ["admin", "gestor", "suporte", "desenvolvedor", "vendas"],
    },
  },
} as const
