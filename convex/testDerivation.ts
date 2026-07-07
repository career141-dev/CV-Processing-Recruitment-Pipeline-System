import { deriveTotalExperienceYears } from "./candidates/derivations";

const jobHistory = [
  {
    "company": "Career141",
    "description": "Redesigned...",
    "endDate": "Present",
    "startDate": "Jan 2025",
    "title": "Web Developer Intern"
  },
  {
    "company": "Softwareplus Pvt Ltd",
    "description": "Developed Android...",
    "startDate": "2024",
    "title": "Mobile Application Development Trainee"
  },
  {
    "company": "Unknown Company",
    "description": "Delivered 5+ custom websites...",
    "endDate": "Present",
    "startDate": "2022",
    "title": "Freelance Full-Stack Developer"
  }
];

const total = deriveTotalExperienceYears(jobHistory, undefined);
console.log("Total years computed:", total);
