export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      commander_games: {
        Row: {
          id: string
          tournament_id: string
          game_number: number
          winner_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          game_number: number
          winner_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          game_number?: number
          winner_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      deck_lists: {
        Row: {
          deck_list: string | null
          deck_name: string | null
          id: string
          submitted_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          deck_list?: string | null
          deck_name?: string | null
          id?: string
          submitted_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          deck_list?: string | null
          deck_name?: string | null
          id?: string
          submitted_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      elo_history: {
        Row: {
          created_at: string
          elo_after: number
          elo_before: number
          id: string
          pairing_id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elo_after: number
          elo_before: number
          id?: string
          pairing_id: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          elo_after?: number
          elo_before?: number
          id?: string
          pairing_id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pairings: {
        Row: {
          admin_override: boolean
          created_at: string
          games_drawn: number
          id: string
          is_bye: boolean
          is_draw: boolean
          player1_confirmed: boolean
          player1_games_won: number
          player1_id: string
          player2_confirmed: boolean
          player2_games_won: number
          player2_id: string | null
          round_id: string
          status: string
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          admin_override?: boolean
          created_at?: string
          games_drawn?: number
          id?: string
          is_bye?: boolean
          is_draw?: boolean
          player1_confirmed?: boolean
          player1_games_won?: number
          player1_id: string
          player2_confirmed?: boolean
          player2_games_won?: number
          player2_id?: string | null
          round_id: string
          status?: string
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          admin_override?: boolean
          created_at?: string
          games_drawn?: number
          id?: string
          is_bye?: boolean
          is_draw?: boolean
          player1_confirmed?: boolean
          player1_games_won?: number
          player1_id?: string
          player2_confirmed?: boolean
          player2_games_won?: number
          player2_id?: string | null
          round_id?: string
          status?: string
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          elo_rating: number
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          total_draws: number
          total_losses: number
          total_wins: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          elo_rating?: number
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          total_draws?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          elo_rating?: number
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          total_draws?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_top_cut: boolean
          round_number: number
          started_at: string | null
          status: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_top_cut?: boolean
          round_number: number
          started_at?: string | null
          status?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_top_cut?: boolean
          round_number?: number
          started_at?: string | null
          status?: string
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_admins: {
        Row: {
          created_at: string
          id: string
          role: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          created_at: string
          final_standing: number | null
          id: string
          seed_elo: number
          status: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          final_standing?: number | null
          id?: string
          seed_elo?: number
          status?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          final_standing?: number | null
          id?: string
          seed_elo?: number
          status?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          access_key: string | null
          created_at: string
          created_by: string
          current_round: number
          description: string | null
          format: string
          games_per_round: number
          id: string
          invite_link: string | null
          is_public: boolean
          name: string
          round_time_limit_minutes: number
          rounds_count: number
          scheduled_at: string | null
          status: string
          top_cut: number | null
          updated_at: string
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          created_by: string
          current_round?: number
          description?: string | null
          format: string
          games_per_round?: number
          id?: string
          invite_link?: string | null
          is_public?: boolean
          name: string
          round_time_limit_minutes?: number
          rounds_count: number
          scheduled_at?: string | null
          status?: string
          top_cut?: number | null
          updated_at?: string
        }
        Update: {
          access_key?: string | null
          created_at?: string
          created_by?: string
          current_round?: number
          description?: string | null
          format?: string
          games_per_round?: number
          id?: string
          invite_link?: string | null
          is_public?: boolean
          name?: string
          round_time_limit_minutes?: number
          rounds_count?: number
          scheduled_at?: string | null
          status?: string
          top_cut?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      calculate_standings: {
        Args: { t_id: string }
        Returns: {
          game_losses: number
          game_win_pct: number
          game_wins: number
          games_drawn: number
          match_draws: number
          match_losses: number
          match_points: number
          match_win_pct: number
          match_wins: number
          opp_game_win_pct: number
          opp_match_win_pct: number
          first_name: string | null
          last_name: string | null
          rank: number
          user_id: string
          username: string
        }[]
      }
      create_tournament: {
        Args: {
          p_description?: string
          p_format: string
          p_games_per_round?: number
          p_is_public?: boolean
          p_name: string
          p_round_time_limit?: number
          p_rounds_count: number
          p_top_cut?: number
        }
        Returns: string
      }
      submit_match_score: {
        Args: {
          p_games_drawn?: number
          p_my_games_won: number
          p_opp_games_won: number
          p_pairing_id: string
        }
        Returns: undefined
      }
      confirm_match_score: {
        Args: { p_pairing_id: string }
        Returns: undefined
      }
      admin_override_score: {
        Args: {
          p_games_drawn?: number
          p_pairing_id: string
          p_player1_games: number
          p_player2_games: number
        }
        Returns: undefined
      }
      join_tournament_by_key: {
        Args: { p_access_key: string }
        Returns: string
      }
      join_tournament_by_link: {
        Args: { p_invite_link: string }
        Returns: string
      }
      drop_from_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
