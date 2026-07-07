import { query } from "../_generated/server";
import { deriveTotalExperienceYears } from "./derivations";

export default query({
  handler: async (ctx) => {
    const jobHistory = [
      {
        "company": "Career141",
        "endDate": "Present",
        "startDate": "Jan 2025",
        "title": "Web Developer Intern"
      },
      {
        "company": "Softwareplus Pvt Ltd",
        "startDate": "2024",
        "title": "Mobile Application Development Trainee"
      },
      {
        "company": "Unknown Company",
        "endDate": "Present",
        "startDate": "2022",
        "title": "Freelance Full-Stack Developer"
      }
    ];

    const result = deriveTotalExperienceYears(jobHistory, undefined);
    return { result };
  }
});
