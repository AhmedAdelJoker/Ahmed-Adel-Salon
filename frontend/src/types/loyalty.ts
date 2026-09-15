/**
 * Loyalty program domain types (owner loyalty settings).
 * Stored as a free-form JSON column on business_settings.loyalty_settings.
 */
export interface LoyaltyTier {
  name: string;
  min_visits: number;
  discount_percent: number;
  color: string;
}

export interface LoyaltySettings {
  enabled: boolean;
  points_per_egp: number;
  redemption_rate: number;
  /** 0 = لا تنتهي الصلاحية أبداً */
  points_expiry_months: number;
  tiers: LoyaltyTier[];
}

export interface LoyaltySavePayload {
  loyalty_settings: LoyaltySettings;
}
