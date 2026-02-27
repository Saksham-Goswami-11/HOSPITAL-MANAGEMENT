
export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ServiceItem {
  title: string;
  description: string;
  image: string;
  bullets: string[];
}

export interface InsightResponse {
  insight: string;
  confidence: number;
  recommendations: string[];
}
