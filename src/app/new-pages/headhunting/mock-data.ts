import { ResearchFormData } from './types';

export const INITIAL_RESEARCH_DATA: ResearchFormData = {
  similarDesignation: '',
  similarDesignations: [],
  websiteLink: '',
  servicesProviders: [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero at velit interdum, ac aliquet odio mattis.',
  ],
  serviceProviderInput: '',
  country: '',
  location: '',
  competitors: [],
  competitorInput: '',
  socialMediaPlatforms: [],
  socialMediaInput: '',
  companyOverview:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis diam sit amet lacinia. Aliquam in elementum tellus.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis diam sit amet lacinia. Aliquam in elementum tellus.',
  benchmarkLink: '',
  benchmarkPositions: [],
  benchmarkPositionInput: '',
};

export const COUNTRIES = [
  'Choose Country',
  'United States',
  'United Kingdom',
  'Sri Lanka',
  'Singapore',
  'Australia',
  'Canada',
  'Germany',
  'United Arab Emirates',
  'India',
];

export const LOCATIONS = [
  'Choose Location',
  'New York, USA',
  'London, UK',
  'Colombo, Sri Lanka',
  'Singapore City',
  'Sydney, Australia',
  'Toronto, Canada',
  'Berlin, Germany',
  'Dubai, UAE',
  'Bangalore, India',
];

export const INITIAL_BOOLEAN_CANDIDATES = [
  {
    id: 'bool-1',
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
    stageStatus: 'In contacted',
    stageChangedDate: 'April 28, 2025',
    stageChangedBy: 'Nipuni Senanayake',
  },
  {
    id: 'bool-2',
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
    stageStatus: 'In contacted',
    stageChangedDate: 'April 27, 2025',
    stageChangedBy: 'Nipuni Senanayake',
  },
];

export const INITIAL_EXCEL_CANDIDATES = [
  {
    id: 'excel-1',
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
    initialEducations: [
      'University of Colombo, Bachelor of Business Administration - BBA · 2022 – 2026',
      'AAT Sri Lanka · 2022',
      'Institute of Certified Management Accountants of Sri Lanka (CMA) · 2023',
    ],
    extraEducations: [
      'Chartered Institute of Personnel Management (CIPM) · 2021',
      'G.C.E. Advanced Level - Commerce Stream · 2020',
    ],
    totalEducationsCount: 5,
    stageStatus: 'In contacted',
    stageChangedDate: 'April 28, 2025',
    stageChangedBy: 'Nipuni Senanayake',
  },
];
