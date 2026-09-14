export type WorkplaceType = 'On-site' | 'Hybrid' | 'Remote';
export type PositionStatus = 'Open' | 'Draft' | 'Closed' | 'In review';

export interface PositionItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceType: WorkplaceType;
  recruiterName: string;
  postedDate: string;
  expiryDays: number;
  postType: string;
  projectTitle: string;
  status: PositionStatus;
  viewsCount: number;
  applicantsCount: number;
  newApplicantsCount: number;
}

export interface PositionFilterState {
  searchQuery: string;
  locationSearch: string;
  selectedLocations: string[];
  selectedWorkplaceTypes: WorkplaceType[];
  selectedStatuses: PositionStatus[];
}
