export interface ClientCandidate {
  id: string;
  name: string;
  rank: string;
  isApplicant: boolean;
  role: string;
  location: string;
  industry: string;
  overviewExperiences: string[];
  educationOrLinkedIn: string;
  currentStep: number;
}

export const CLIENT_DESIGNATIONS: string[] = [
  'GROUP CHIEF - SUPPLY CHAIN',
  'Data Entry Specialist - Documentation',
  'Graphic Design Intern',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
  'GROUP CHIEF - SUPPLY CHAIN',
];

export const INITIAL_CLIENT_CANDIDATES: ClientCandidate[] = [
  {
    id: 'client-cand-1',
    name: 'Nethma Tharindi',
    rank: '2nd',
    isApplicant: true,
    role: 'HR Associate',
    location: 'Colombo, Western Province, Sri Lanka',
    industry: 'Food and Beverage Manufacturing',
    overviewExperiences: [
      'Human Resources Associate at Outdesk. · 2025 – Present',
      'Human Resources Intern at Outdesk. · 2025 – 2025',
    ],
    educationOrLinkedIn:
      'University of Colombo, Bachelor of Business Administration - BBA · 2022 – 2026',
    currentStep: 1,
  },
  {
    id: 'client-cand-2',
    name: 'Kavindu Perera',
    rank: '1st',
    isApplicant: true,
    role: 'Senior Talent Acquisition Specialist',
    location: 'Colombo, Western Province, Sri Lanka',
    industry: 'Information Technology and Services',
    overviewExperiences: [
      'Senior Talent Acquisition Specialist at Virtusa · 2023 – Present',
      'Technical Recruiter at Sysco LABS Sri Lanka · 2021 – 2023',
    ],
    educationOrLinkedIn:
      'University of Kelaniya, B.Sc. in Human Resource Management · 2017 – 2021',
    currentStep: 1,
  },
];
