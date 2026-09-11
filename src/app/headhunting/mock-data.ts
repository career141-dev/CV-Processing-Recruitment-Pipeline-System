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
