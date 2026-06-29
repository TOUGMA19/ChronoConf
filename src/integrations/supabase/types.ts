export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conference_data: {
        Row: {
          id: string
          owner_id: string
          slug: string
          name: string
          data: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          slug: string
          name: string
          data: Json
          updated_at?: string
          created_at?: string
        }
        Update: {
          slug?: string
          name?: string
          data?: Json
          updated_at?: string
        }
      }
      speakers: {
        Row: {
          id: string
          conference_id: string
          code: string
          nom: string
          prenom: string
          email: string
          institution: string
          titre: string
          resume: string
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conference_id: string
          code: string
          nom?: string
          prenom?: string
          email?: string
          institution?: string
          titre?: string
          resume?: string
          verified_at?: string | null
        }
        Update: {
          nom?: string
          prenom?: string
          email?: string
          institution?: string
          titre?: string
          resume?: string
          verified_at?: string | null
          updated_at?: string
        }
      }
      speaker_edits: {
        Row: {
          id: string
          speaker_code: string
          conference_id: string
          field: string
          old_value: string | null
          new_value: string | null
          edited_at: string
        }
        Insert: {
          speaker_code: string
          conference_id: string
          field: string
          old_value?: string | null
          new_value?: string | null
        }
      }
      verify_config: {
        Row: {
          id: string
          conference_id: string
          token: string
          note: string
          contact: string
          deadline: string | null
          editable_cols: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          conference_id: string
          token?: string
          note?: string
          contact?: string
          deadline?: string | null
          editable_cols?: string[]
        }
        Update: {
          note?: string
          contact?: string
          deadline?: string | null
          editable_cols?: string[]
          updated_at?: string
        }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export const Constants = {
  public: { Enums: {} },
} as const
