export interface CandidateExperience {
  title: string;
  company: string;
  period: string;
}

export interface CandidateEducation {
  institution: string;
  degree: string;
  period: string;
}

export interface MockCandidate {
  id: string;
  name: string;
  degreeRank: string;
  isApplicant: boolean;
  role: string;
  location: string;
  industry: string;
  experiences: CandidateExperience[];
  educations: CandidateEducation[];
  moreEducationsCount?: number;
  highlight: string;
  skillsMatch: {
    matched: number;
    total: number;
    tags: string[];
  };
  interest: string;
  activity: string;
  savedBy: string;
  savedDate: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  stage:
    | 'follow_up'
    | 'director_review'
    | 'director_shortlist'
    | 'client_shortlist'
    | 'interview'
    | 'offer'
    | 'placed'
    | 'rejected'
    | 'linkedin_job'
    | 'database_cv'
    | 'reference';
  stageStatus: string;
  stageChangedDate: string;
  stageChangedBy: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phoneNumbers?: string[];
  designations?: string[];
  locations?: string[];
  headline?: string;
  companySummary?: string;
  projectContext?: string;
  cvFileName?: string;
  cvUploadedDate?: string;
  publicProfileUrl?: string;
  fitScore?: number;
  directorNotes?: string;
  clientFeedback?: string;
  interviewDate?: string;
  interviewType?: string;
  offerAmount?: string;
}

export interface LinkedInJobPost {
  id: string;
  title: string;
  company: string;
  location: string;
  workplaceType: 'On-site' | 'Hybrid' | 'Remote';
  postedDate: string;
  applicantsCount: number;
  inReviewCount: number;
  sourcedCount: number;
  status: 'Active' | 'Draft' | 'Closed';
  hiringManager: string;
}

export interface DatabaseCvItem {
  id: string;
  name: string;
  role: string;
  experienceYears: number;
  currentCompany: string;
  location: string;
  source: 'WhatsApp' | 'Email' | 'LinkedIn' | 'Bulk Upload';
  parsedDate: string;
  topSkills: string[];
  isInPipeline: boolean;
}

export interface ReferenceCheckItem {
  id: string;
  candidateName: string;
  role: string;
  refereeName: string;
  refereeTitle: string;
  refereeCompany: string;
  status: 'Verified' | 'In Progress' | 'Pending Contact' | 'Flagged';
  verifiedDate?: string;
  rating: number; // 1 to 5
  notes: string;
}

export interface MessageSnippet {
  id: string;
  title: string;
  category: 'Follow-up' | 'Director Shortlist' | 'Interview' | 'Offer' | 'General';
  subject: string;
  body: string;
  lastUsed: string;
}

export interface PipelineSubStage {
  id: string;
  label: string;
}
