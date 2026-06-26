const fs = require('fs');
const step4_code = `  const renderStep4 = () => {
    // Advanced validation logic
    const mustFix = [];
    const recommended = [];
    const ready = [];

    if (!formData.jobTitle) mustFix.push({ msg: "Job Title: Enter the position name", action: "Fix Now", step: 1 });
    else ready.push("Job Title added");

    if (!formData.requiredSkills) mustFix.push({ msg: "Required Skills: Add at least 1 skill", action: "Fix Now", step: 1 });
    else ready.push("Matching Criteria configured");

    if (formData.channels.metaCampaign && !formData.metaCampaignId) {
      mustFix.push({ msg: "Meta Campaign: Ad Campaign ID is required", action: "Fix Now", step: 2 });
    }

    if (formData.channels.whatsapp) {
      recommended.push({ msg: "WhatsApp: Common number configured but QR not downloaded yet", action: "Download QR", step: 2 });
    }
    
    if (formData.jobDescription) ready.push("Job Description added");
    if (formData.channels.emailCampaign && formData.emailInbox) ready.push("Email Campaign inbox ready");
    else if (formData.channels.emailCampaign && !formData.emailInbox) mustFix.push({ msg: "Email Campaign: Inbox address is missing", action: "Fix Now", step: 2 });
    if (formData.enableMatching) ready.push("Agent 2 Matching enabled");
    
    const keyword = formData.jobKeyword || 'BRAND24';
    const commonWhatsAppNumber = "+94770000001";

    const enabledChannels = Object.entries(formData.channels).filter(([_, enabled]) => enabled).map(([key]) => key);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Review & Publish</h2>
          <p className="text-sm text-text-secondary">Review your job configuration before publishing.</p>
        </div>

        {/* Keyword Badge */}
        <div className="flex items-center gap-3 bg-primary-container/10 border border-primary-container/20 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-primary-container">work</span>
          </div>
          <div>
            <p className="font-semibold text-text-primary">{formData.jobTitle || "Untitled Job"}</p>
            <p className="text-xs text-text-secondary">Keyword: <span className="font-mono font-bold text-primary-container">{keyword}</span></p>
          </div>
        </div>

        {/* Validation Status Panels */}
        <div className="space-y-4">
          {mustFix.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">error</span>
                MUST FIX BEFORE PUBLISHING ({mustFix.length})
              </div>
              <ul className="space-y-2 ml-7">
                {mustFix.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-red-600">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">close</span> {item.msg}</span>
                    <button className="bg-white border border-red-200 text-red-700 px-3 py-1 rounded shadow-sm hover:bg-red-50 font-medium transition-colors text-xs" onClick={() => setCurrentStep(item.step)}>{item.action}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommended.length > 0 && mustFix.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                RECOMMENDED ({recommended.length})
              </div>
              <ul className="space-y-2 ml-7">
                {recommended.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-amber-700">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">info</span> {item.msg}</span>
                    <div className="flex gap-2">
                      <button className="bg-white border border-amber-200 text-amber-700 px-3 py-1 rounded shadow-sm hover:bg-amber-50 font-medium transition-colors text-xs">{item.action}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mustFix.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-4 font-medium">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              Ready to publish! All required fields are filled.
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Details</p>
            <div className="space-y-1.5 text-xs">
              <p><span className="text-text-secondary inline-block w-20">Client:</span> <span className="text-text-primary font-medium">{formData.clientCompany || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Location:</span> <span className="text-text-primary font-medium">{formData.location || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Seniority:</span> <span className="text-text-primary font-medium">{formData.seniorityLevel || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Type:</span> <span className="text-text-primary font-medium">{formData.recruitmentType || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Recruiter:</span> <span className="text-text-primary font-medium">{formData.primaryRecruiter || "—"}</span></p>
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Channels ({enabledChannels.length})</p>
            <div className="flex flex-wrap gap-2">
              {enabledChannels.length > 0 ? enabledChannels.map((ch) => (
                <span key={ch} className="text-xs bg-surface-variant text-text-primary border border-border px-2.5 py-1 rounded-md capitalize">
                  {ch.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              )) : (
                <span className="text-xs text-text-secondary italic">None enabled</span>
              )}
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Requirements</p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {formData.requiredSkills ? formData.requiredSkills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} className="text-[10px] bg-primary-container/10 text-primary-container border border-primary-container/20 px-2 py-0.5 rounded-full">{s}</span>
                )) : <span className="text-xs text-text-secondary italic">No skills added</span>}
              </div>
              <p className="text-xs"><span className="text-text-secondary inline-block w-20">Experience:</span> <span className="text-text-primary font-medium">{formData.experienceMin}-{formData.experienceMax} years</span></p>
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">AI Config</p>
            <div className="space-y-1.5 text-xs">
              <p><span className="text-text-secondary inline-block w-28">Matching:</span> <span className="text-text-primary font-medium">{formData.enableMatching ? \`Score Min \${formData.minMatchScore}\` : 'Disabled'}</span></p>
              <p><span className="text-text-secondary inline-block w-28">Phone Screen:</span> <span className="text-text-primary font-medium">{formData.enablePhoneScreening ? 'Active' : 'Disabled'}</span></p>
              <p><span className="text-text-secondary inline-block w-28">Follow-Ups:</span> <span className="text-text-primary font-medium">{formData.enableFollowUp ? 'Active' : 'Disabled'}</span></p>
              <p><span className="text-text-secondary inline-block w-28">Pipeline Health:</span> <span className="text-text-primary font-medium">{formData.enablePipelineHealth ? 'Active' : 'Disabled'}</span></p>
            </div>
          </div>
        </div>
      </div>
    );
  }`;

const content = fs.readFileSync('c:/Users/user/Downloads/WORK/Recruitment/career141/src/app/dashboard/jobs/new/page.tsx', 'utf-8');

const startMarker = '  const renderStep4 = () => {';
const endMarker = '  return (\n    <div className="flex-1 w-full bg-background';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const prefix = content.substring(0, startIndex);
    const suffix = content.substring(endIndex);
    fs.writeFileSync('c:/Users/user/Downloads/WORK/Recruitment/career141/src/app/dashboard/jobs/new/page.tsx', prefix + step4_code + '\n\n' + suffix);
    console.log('Successfully replaced renderStep4');
} else {
    console.log('Failed to find bounds. start:', startIndex, 'end:', endIndex);
}
