export interface FootMatch {
  id: string;
  league: string;
  leagueName: string;
  country: string;
  home: string;
  away: string;
  date: string;
  kickoffAt: string;
  odds: { "1": number; "X": number; "2": number };
}
