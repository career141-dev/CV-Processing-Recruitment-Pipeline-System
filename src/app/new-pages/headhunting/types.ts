export interface ResearchFormData {
  similarDesignation: string;
  similarDesignations: string[];
  websiteLink: string;
  servicesProviders: string[];
  serviceProviderInput: string;
  country: string;
  location: string;
  competitors: string[];
  competitorInput: string;
  socialMediaPlatforms: string[];
  socialMediaInput: string;
  companyOverview: string;
  benchmarkLink: string;
  benchmarkPositions: string[];
  benchmarkPositionInput: string;
}

export type HeadHuntingTab = 'overview' | 'research' | 'boolean_search' | 'excel_tables';
