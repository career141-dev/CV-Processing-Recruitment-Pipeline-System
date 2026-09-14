"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import {
  Building2,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  MapPin,
  ChevronDown,
  X,
  Mail,
  MessageSquare,
  Search,
  FileText,
  RotateCw,
  Edit3,
  Zap,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Copy,
} from 'lucide-react';

interface Recruiter {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatarColor: string;
}

const AVAILABLE_TAS: Recruiter[] = [
  { id: '1', name: 'Sarah Jenkins', role: 'Senior TA Specialist', initials: 'SJ', avatarColor: 'bg-indigo-600' },
  { id: '2', name: 'Alex Rivera', role: 'Technical Recruiter', initials: 'AR', avatarColor: 'bg-teal-600' },
  { id: '3', name: 'Priya Sharma', role: 'Talent Acquisition Lead', initials: 'PS', avatarColor: 'bg-amber-600' },
  { id: '4', name: 'David Kim', role: 'Full-Lifecycle Recruiter', initials: 'DK', avatarColor: 'bg-blue-600' },
  { id: '5', name: 'Elena Rostova', role: 'Sourcing Specialist', initials: 'ER', avatarColor: 'bg-rose-600' },
];

export default function CreateOpeningWizard() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [client, setClient] = useState('');
  const [openingName, setOpeningName] = useState('');
  const registeredClients = useQuery(api.clients.clients.list) || [];
  const dbUsers = useQuery(api.users.users.getAllUsers);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLDivElement>(null);

  const availableRecruiters: Recruiter[] = React.useMemo(() => {
    if (dbUsers && dbUsers.length > 0) {
      const colors = ['bg-indigo-600', 'bg-teal-600', 'bg-amber-600', 'bg-blue-600', 'bg-rose-600', 'bg-purple-600'];
      return dbUsers.map((u, idx) => {
        const name = u.fullName || u.email || 'Recruiter';
        const parts = name.split(' ');
        const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
        return {
          id: u._id,
          name,
          role: u.role ? u.role.replace('_', ' ').toUpperCase() : 'Recruiter',
          initials,
          avatarColor: colors[idx % colors.length],
        };
      });
    }
    return AVAILABLE_TAS;
  }, [dbUsers]);

  // Step 2: TA Lead fields
  const [taLeadNotes, setTaLeadNotes] = useState('');
  const [taNotes, setTaNotes] = useState('');
  const [assignedTas, setAssignedTas] = useState<Recruiter[]>([]);
  const [isTaDropdownOpen, setIsTaDropdownOpen] = useState(false);
  const [taSearchQuery, setTaSearchQuery] = useState('');
  const [previewRole, setPreviewRole] = useState<'ta_lead' | 'ta'>('ta_lead');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Job Description (JD) state
  const [jobDescription, setJobDescription] = useState('');
  const [isGeneratingJd, setIsGeneratingJd] = useState(false);
  const [isJdGenerated, setIsJdGenerated] = useState(false);

  const handleCopyJd = () => {
    if (!jobDescription) return;
    navigator.clipboard.writeText(jobDescription);
    toast.success('Job description copied to clipboard');
  };

  // Step 3: AI & Pipeline Config
  const [scoreWeights, setScoreWeights] = useState({
    skills: 35,
    experience: 25,
    jobTitle: 20,
    industry: 15,
    location: 5,
  });
  const [minMatchScore, setMinMatchScore] = useState(60);
  const [reverseMatchOnPublish, setReverseMatchOnPublish] = useState(true);

  // Step 3: Follow-Up Sequence & Outreach
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [enableWhatsAppFollowUp, setEnableWhatsAppFollowUp] = useState(true);
  const [enableEmailFollowUp, setEnableEmailFollowUp] = useState(true);
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [enableCustomEmailTemplate, setEnableCustomEmailTemplate] = useState(false);
  const [maxFollowUpAttempts, setMaxFollowUpAttempts] = useState(3);
  const [maxFollowUpDays, setMaxFollowUpDays] = useState(7);

  const weightSum =
    scoreWeights.skills +
    scoreWeights.experience +
    scoreWeights.jobTitle +
    scoreWeights.industry +
    scoreWeights.location;

  const handleAddQuestion = () => {
    const q = newQuestionInput.trim();
    if (!q) return;
    if (customQuestions.includes(q)) {
      toast.info('Question already in list');
      return;
    }
    setCustomQuestions([...customQuestions, q]);
    setNewQuestionInput('');
  };

  const handleRemoveQuestion = (index: number) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index));
  };

  const createOpening = useMutation(api.openings.openings.createOpening);
  const launchOpening = useAction(api.openings.actions.launchOpeningAction);
  const generateJdFromNotes = useAction(api.openings.actions.generateJdFromNotesAction);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTaDropdownOpen(false);
      }
      if (clientInputRef.current && !clientInputRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown actions
  const toggleTa = (ta: Recruiter) => {
    if (assignedTas.some((t) => t.id === ta.id)) {
      setAssignedTas(assignedTas.filter((t) => t.id !== ta.id));
    } else {
      setAssignedTas([...assignedTas, ta]);
    }
  };

  const handleSelectAllTas = () => {
    if (assignedTas.length === availableRecruiters.length) {
      setAssignedTas([]);
    } else {
      setAssignedTas([...availableRecruiters]);
    }
  };

  // Generate customized Job Description combining TA Lead Notes & TA Notes via OpenRouter AI
  const handleGenerateJd = async () => {
    setIsGeneratingJd(true);
    const title = openingName.trim() || 'Role Title';
    const comp = client.trim() || 'Client Organization';
    const leadNotes = taLeadNotes.trim();
    const recruiterNotes = taNotes.trim();

    try {
      if (generateJdFromNotes) {
        const jd = await generateJdFromNotes({
          openingName: title,
          clientName: comp,
          taLeadNotes: leadNotes || undefined,
          taNotes: recruiterNotes || undefined,
        });

        if (jd && jd.length > 100) {
          setJobDescription(jd);
          setIsJdGenerated(true);
          toast.success(
            leadNotes && recruiterNotes
              ? 'AI generated comprehensive JD by synthesizing TA Lead and TA notes'
              : 'AI generated comprehensive Job Description'
          );
          setIsGeneratingJd(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI JD generation call encountered an issue, falling back to structured engine:', err);
    } finally {
      setIsGeneratingJd(false);
    }

    // Fallback if AI provider is unreachable
    const extractBullets = (text: string) =>
      text
        .split(/[\n;]+/)
        .map((s) => s.replace(/^[-•*]\s*/, '').trim())
        .filter((s) => s.length > 2);

    const leadDirectives = leadNotes ? extractBullets(leadNotes) : [];
    const taDirectives = recruiterNotes ? extractBullets(recruiterNotes) : [];

    const responsibilities = [
      `Manage day-to-day ${title} and operational workflows, ensuring deliverables are handled efficiently and within agreed timelines.`,
      `Coordinate workflows, schedules, space/resource allocation, and execution planning with relevant stakeholders.`,
      `Prepare, verify, and process all required documentation, operational instructions, compliance records, and reports.`,
      `Coordinate with clients, partners, overseas agents, and internal teams regarding requirements and operational matters.`,
      `Monitor operational progress and proactively follow up on schedules, documentation, milestones, and status movements.`,
      `Ensure accurate and timely submission of operational documentation and reporting to relevant parties.`,
      `Resolve operational issues, documentation discrepancies, and project queries in a timely and professional manner.`,
      `Maintain accurate records of operations, bookings, documentation, and transactions.`,
      `Liaise with internal commercial, customer service, finance, and operations teams to ensure smooth end-to-end execution.`,
      `Ensure compliance with company procedures, statutory requirements, and industry standards.`,
      `Support the team in improving operational efficiency, service quality, and stakeholder satisfaction.`,
      ...leadDirectives.map((d) => `Execute lead directive: ${d}`),
      ...taDirectives.map((d) => `Focus priority: ${d}`),
    ];

    const preRequisites = [
      `Bachelor’s Degree in a related field or equivalent practical experience.`,
      `3–6 years of relevant hands-on experience in ${title} or related operational capacity.`,
      `Strong operational expertise, domain processes, and documentation handling.`,
      `Experience coordinating with clients, vendors, external partners, and cross-functional teams.`,
      `Strong understanding of core operational workflows and quality standards.`,
      `Excellent communication, coordination, negotiation, and problem-solving skills.`,
      `Ability to work independently while managing multiple deliverables and deadlines.`,
      `Proficiency in enterprise productivity systems and relevant domain platforms.`,
      `Relevant professional certifications or qualifications will be an added advantage.`,
    ];

    const generated = [
      `Roles & Responsibilities`,
      ``,
      `OVERVIEW`,
      ``,
      `We are seeking a ${title} at ${comp} to manage and coordinate core operations, ensuring the smooth execution of workflows from initiation through final delivery. The role will involve close coordination with clients, partners, and internal teams while ensuring accuracy and timely completion of all operational activities.`,
      ``,
      `Key Responsibilities`,
      ``,
      responsibilities.map((r) => `• ${r}`).join('\n'),
      ``,
      `PRE-REQUISITES`,
      ``,
      preRequisites.map((p) => `• ${p}`).join('\n'),
    ].join('\n');

    setJobDescription(generated);
    setIsJdGenerated(true);
    toast.success('Job description generated from notes');
  };

  const handleStep1Next = () => {
    if (!client.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    if (!openingName.trim()) {
      toast.error('Please enter an opening name');
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = async () => {
    if (!jobDescription.trim()) {
      if (taLeadNotes.trim() || taNotes.trim()) {
        toast.info('Generating Job Description from your notes before continuing...');
        await handleGenerateJd();
      } else {
        toast.error('Please generate or provide a Job Description before proceeding to AI & Pipeline Config');
        return;
      }
    }
    setCurrentStep(3);
  };

  const handleFinalPublish = async () => {
    if (weightSum !== 100) {
      toast.error(`AI match weights must total exactly 100% (currently ${weightSum}%)`);
      return;
    }
    setIsSubmitting(true);
    toast.loading('Analyzing approved JD & provisioning pipeline...', { id: 'launch-opening' });

    try {
      if (launchOpening) {
        const result = await launchOpening({
          openingName: openingName.trim(),
          clientName: client.trim(),
          jobDescription: jobDescription.trim() || `Position: ${openingName.trim()} at ${client.trim()}`,
          assignedTaUserIds: assignedTas.map((t) => t.id),
          taLeadNotes: taLeadNotes.trim() || undefined,
          taNotes: taNotes.trim() || undefined,
          scoreWeights,
          minMatchScore,
          reverseMatchOnPublish,
          followUpConfig: {
            enableWhatsAppFollowUp,
            enableEmailFollowUp,
            maxFollowUpAttempts,
            maxFollowUpDays,
            customQuestions,
          },
        });

        toast.success(
          `Opening "${openingName.trim()}" launched successfully with ${result?.extractedSkillsCount ?? 0} AI-extracted skills!`,
          { id: 'launch-opening' }
        );
      } else if (createOpening) {
        await createOpening({
          title: openingName.trim(),
          clientName: client.trim(),
          description: jobDescription.trim() || undefined,
          status: 'active',
        });
        toast.success(`Opening "${openingName.trim()}" created successfully!`, { id: 'launch-opening' });
      }
      router.push('/dashboard/jobs');
    } catch (err: any) {
      console.error('Launch opening error:', err);
      toast.error(err?.message || 'Failed to launch opening. Please try again.', { id: 'launch-opening' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%';

  return (
    <div
      className="w-full max-w-3xl mx-auto py-6 space-y-6"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Stepper Header */}
      <div className="bg-white rounded-lg border border-[#e0e0e0] shadow-xs p-5">
        <div className="relative">
          <div className="absolute top-4 left-6 right-6 h-[2px] bg-[#e0e0e0] -z-0" />
          <div
            className="absolute top-4 left-6 h-[2px] bg-[#0a66c2] transition-all duration-500 ease-in-out -z-0"
            style={{ width: `calc(${progressPercent} * 0.88)` }}
          />

          <div className="flex items-center justify-between relative z-10">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex flex-col items-center cursor-pointer bg-white px-2"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                  currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 1
                    ? 'bg-[#0a66c2] text-white'
                    : 'bg-[#f3f2ef] border border-[#d0d0d0] text-[#00000066]'
                }`}
              >
                {currentStep > 1 ? <Check className="w-4 h-4" /> : 1}
              </div>
              <span className="text-xs font-semibold text-[#000000e6] mt-1.5">Opening Details</span>
            </button>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => {
                if (client.trim() && openingName.trim()) {
                  setCurrentStep(2);
                } else {
                  toast.error('Please enter Client and Opening Name in Step 1 first');
                }
              }}
              className="flex flex-col items-center cursor-pointer bg-white px-2"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                  currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 2
                    ? 'bg-[#0a66c2] text-white'
                    : 'bg-[#f3f2ef] border border-[#d0d0d0] text-[#00000066]'
                }`}
              >
                {currentStep > 2 ? <Check className="w-4 h-4" /> : 2}
              </div>
              <span className="text-xs font-semibold text-[#000000e6] mt-1.5">TA Assignment</span>
            </button>

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => {
                if (!client.trim() || !openingName.trim()) {
                  toast.error('Please complete Step 1 (Client and Opening Name) first');
                  return;
                }
                if (!jobDescription.trim() && !taLeadNotes.trim() && !taNotes.trim()) {
                  toast.error('Please generate or provide a Job Description in Step 2 first');
                  return;
                }
                setCurrentStep(3);
              }}
              className="flex flex-col items-center cursor-pointer bg-white px-2"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                  currentStep === 3
                    ? 'bg-[#0a66c2] text-white'
                    : 'bg-[#f3f2ef] border border-[#d0d0d0] text-[#00000066]'
                }`}
              >
                3
              </div>
              <span className="text-xs font-semibold text-[#000000e6] mt-1.5">AI & Pipeline Config</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 1: OPENING DETAILS */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg border border-[#e0e0e0] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e0e0e0]">
            <h1 className="text-base font-semibold text-[#000000e6]">Fill in your opening details</h1>
            <p className="text-xs text-[#00000099] mt-0.5">
              Enter the client and opening name to create this requisition.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="relative" ref={clientInputRef}>
              <label className="block text-xs font-semibold text-[#000000e6] mb-1">
                Client <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={client}
                onFocus={() => setShowClientSuggestions(true)}
                onChange={(e) => {
                  setClient(e.target.value);
                  setShowClientSuggestions(true);
                }}
                placeholder="e.g. ABC Technologies, Global Finance Ltd"
                className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-[#0a66c2] rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
              />

              {/* Minimal Client Auto-suggest Dropdown */}
              {showClientSuggestions && client.trim().length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {registeredClients
                    .filter((c: any) => c.name?.toLowerCase().includes(client.toLowerCase().trim()))
                    .slice(0, 5)
                    .map((c: any) => (
                      <div
                        key={c._id}
                        onClick={() => {
                          setClient(c.name);
                          setShowClientSuggestions(false);
                        }}
                        className="px-3.5 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-0"
                      >
                        <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                        {c.industry && (
                          <span className="text-[11px] text-slate-400">{c.industry}</span>
                        )}
                      </div>
                    ))}
                  <div
                    onClick={() => setShowClientSuggestions(false)}
                    className="px-3.5 py-1.5 bg-slate-50 text-[11px] text-slate-500 font-medium cursor-pointer hover:text-slate-800"
                  >
                    Using client &quot;{client}&quot;
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#000000e6] mb-1">
                Opening name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={openingName}
                onChange={(e) => setOpeningName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleStep1Next();
                  }
                }}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-[#0a66c2] rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
              />
            </div>
          </div>

          <div className="px-6 py-3.5 bg-[#fafafa] border-t border-[#e0e0e0] flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#00000099] hover:text-[#000000e6] hover:bg-[#e0e0e0] cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toast.success('Draft saved')}
                className="px-4 py-1.5 rounded-full border border-[#0a66c2] text-xs font-semibold text-[#0a66c2] bg-white hover:bg-[#eef3fb] cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handleStep1Next}
                className="px-5 py-1.5 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5"
              >
                <span>Next: TA Assignment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ROLE SPECIFICATIONS + TA LEAD OPTIONS */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-[#e0e0e0] shadow-xs overflow-visible">
          <div className="px-6 py-4 border-b border-[#e0e0e0] rounded-t-lg flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-[#000000e6]">TA Assignment & Notes</h1>
              <p className="text-xs text-[#00000099] mt-0.5">
                Add TA lead notes and assign recruiters for this opening.
              </p>
            </div>

            {/* Clean Dev Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setPreviewRole('ta_lead')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  previewRole === 'ta_lead'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                TA Lead View
              </button>
              <button
                type="button"
                onClick={() => setPreviewRole('ta')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  previewRole === 'ta'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                TA View
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {previewRole === 'ta_lead' ? (
              <>
                {/* TA Lead Notes Box */}
                <div>
                  <label className="block text-xs font-semibold text-[#000000e6] mb-1">
                    TA Lead Notes
                  </label>
                  <textarea
                    rows={3}
                    value={taLeadNotes}
                    onChange={(e) => setTaLeadNotes(e.target.value)}
                    placeholder="Add briefing notes, instructions, or specific criteria for the assigned TA team..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-[#0a66c2] rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
                  />
                </div>

                {/* Assign TAs Multi-Select Dropdown */}
                <div className="space-y-1.5 relative z-30" ref={dropdownRef}>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800">
                      Assign Talent Acquisition Team (TAs)
                    </label>
                    {assignedTas.length > 0 && (
                      <span className="text-[11px] font-medium text-slate-500">
                        {assignedTas.length} of {availableRecruiters.length} assigned
                      </span>
                    )}
                  </div>

                  {/* Dropdown Trigger */}
                  <div
                    onClick={() => setIsTaDropdownOpen(!isTaDropdownOpen)}
                    className="min-h-[42px] w-full px-3 py-1.5 border border-slate-300 hover:border-slate-400 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/15 rounded-lg bg-white flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-2">
                      {assignedTas.length === 0 ? (
                        <span className="text-sm text-slate-400">Select recruiters for this opening...</span>
                      ) : (
                        assignedTas.map((ta) => (
                          <span
                            key={ta.id}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800"
                          >
                            <span className={`w-4 h-4 rounded-full ${ta.avatarColor} text-white flex items-center justify-center text-[9px] font-bold`}>
                              {ta.initials}
                            </span>
                            <span>{ta.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTa(ta);
                              }}
                              className="hover:text-red-600 text-slate-400 ml-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isTaDropdownOpen ? 'rotate-180 text-slate-700' : ''}`} />
                  </div>

                  {/* Dropdown Menu */}
                  {isTaDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
                      {/* Search and Select All Bar */}
                      <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={taSearchQuery}
                          onChange={(e) => setTaSearchQuery(e.target.value)}
                          placeholder="Filter recruiters..."
                          className="w-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllTas();
                          }}
                          className="text-[11px] font-semibold text-[#0a66c2] hover:text-[#004182] hover:underline whitespace-nowrap px-2 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
                        >
                          {assignedTas.length === availableRecruiters.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {/* List of TAs */}
                      <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                        {availableRecruiters.filter((ta) =>
                          ta.name.toLowerCase().includes(taSearchQuery.toLowerCase()) ||
                          ta.role.toLowerCase().includes(taSearchQuery.toLowerCase())
                        ).map((ta) => {
                          const isSelected = assignedTas.some((t) => t.id === ta.id);
                          return (
                            <div
                              key={ta.id}
                              onClick={() => toggleTa(ta)}
                              className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/70 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-full ${ta.avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0`}
                                >
                                  {ta.initials}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-900 leading-tight">{ta.name}</p>
                                  <p className="text-[11px] text-slate-500 leading-tight">{ta.role}</p>
                                </div>
                              </div>

                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-[#0a66c2] border-[#0a66c2] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Regular TA View: Instructions + TA Notes + JD Generation Workspace */
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Notes from TA Lead
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed min-h-[60px]">
                    {taLeadNotes.trim() ? (
                      taLeadNotes
                    ) : (
                      <span className="text-slate-400 italic">No instructions provided by the TA Lead yet.</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Assigned Recruitment Team
                  </label>
                  {assignedTas.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 italic">
                      No recruiters assigned yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedTas.map((ta) => (
                        <span
                          key={ta.id}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <span className={`w-4 h-4 rounded-full ${ta.avatarColor} text-white flex items-center justify-center text-[9px] font-bold`}>
                            {ta.initials}
                          </span>
                          <span>{ta.name}</span>
                          <span className="text-[10px] text-slate-400">({ta.role})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* TA Recruiter Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    TA Notes (Recruiter Criteria & Sourcing Focus)
                  </label>
                  <textarea
                    rows={3}
                    value={taNotes}
                    onChange={(e) => setTaNotes(e.target.value)}
                    placeholder="Add recruiter-level sourcing criteria, client verbal requirements, or focus areas. When both TA Lead and TA notes are provided, they are combined to generate the JD..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-[#0a66c2] rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {taLeadNotes.trim() && taNotes.trim()
                      ? 'Combined generation active: Both TA Lead Notes and TA Notes will be merged into the JD draft.'
                      : taLeadNotes.trim()
                      ? 'JD will be generated using the TA Lead Notes above.'
                      : taNotes.trim()
                      ? 'JD will be generated using your TA Notes.'
                      : 'Add notes to customize the generated Job Description.'}
                  </p>
                </div>

                {/* Job Description (JD) Generation & Verification */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800">
                        Job Description (JD) <span className="text-red-600">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Generate and verify the customized job description for this opening.
                      </p>
                    </div>

                    {isJdGenerated && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyJd}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={handleGenerateJd}
                          disabled={isGeneratingJd}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0a66c2] hover:text-[#004182] hover:underline cursor-pointer"
                        >
                          <RotateCw className={`w-3 h-3 ${isGeneratingJd ? 'animate-spin' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setJobDescription('');
                            setIsJdGenerated(false);
                          }}
                          className="text-[11px] font-medium text-slate-400 hover:text-red-600 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {!isJdGenerated ? (
                    <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[#0a66c2] shrink-0 shadow-2xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Draft Job Description</p>
                          <p className="text-[11px] text-slate-500">
                            Builds a tailored JD from client, title, TA Lead notes & TA recruiter notes.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateJd}
                        disabled={isGeneratingJd}
                        className="px-3.5 py-1.5 bg-[#0a66c2] hover:bg-[#004182] text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                      >
                        {isGeneratingJd ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating JD...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            <span>Generate Job Description</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <textarea
                        rows={13}
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Job description details..."
                        className="w-full p-3 bg-white border border-slate-300 hover:border-slate-400 focus:border-[#0a66c2] rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] leading-relaxed font-mono resize-y shadow-2xs transition-colors"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Edit3 className="w-3 h-3 text-slate-400" />
                          <span>Directly editable — review and verify before proceeding</span>
                        </span>
                        <span>
                          {jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0} words • {jobDescription.length} characters
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-3.5 bg-[#fafafa] border-t border-[#e0e0e0] rounded-b-lg flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#00000099] hover:text-[#000000e6] hover:bg-[#e0e0e0] cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Step 1</span>
            </button>

            <button
              type="button"
              onClick={handleStep2Next}
              className="px-5 py-1.5 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5"
            >
              <span>Next: AI & Pipeline Config</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: AI & PIPELINE CONFIG */}
      {currentStep === 3 && (
        <div className="bg-white rounded-lg border border-[#e0e0e0] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e0e0e0]">
            <h1 className="text-base font-semibold text-[#000000e6]">AI & Pipeline Config</h1>
            <p className="text-xs text-[#00000099] mt-0.5">
              Configure how AI matches candidates and the pipeline gates.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* AI Match Weights Card */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-700 fill-emerald-700" />
                  <h3 className="text-sm font-semibold text-slate-900">AI Match Weights</h3>
                </div>
                <div className="flex items-center gap-2">
                  {weightSum !== 100 && (
                    <button
                      type="button"
                      onClick={() =>
                        setScoreWeights({ skills: 35, experience: 25, jobTitle: 20, industry: 15, location: 5 })
                      }
                      className="text-[11px] font-semibold text-[#0a66c2] hover:text-[#004182] hover:underline cursor-pointer"
                    >
                      Reset to 100%
                    </button>
                  )}
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                      weightSum === 100
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {weightSum}/100{weightSum < 100 ? ` (+${100 - weightSum}%)` : weightSum > 100 ? ` (-${weightSum - 100}%)` : ''}
                  </span>
                </div>
              </div>

                {/* Sliders */}
                <div className="space-y-3">
                  {[
                    { key: 'skills', label: 'Skills', value: scoreWeights.skills },
                    { key: 'experience', label: 'Experience', value: scoreWeights.experience },
                    { key: 'jobTitle', label: 'Job Title', value: scoreWeights.jobTitle },
                    { key: 'industry', label: 'Industry', value: scoreWeights.industry },
                    { key: 'location', label: 'Location', value: scoreWeights.location },
                  ].map((w) => (
                    <div key={w.key} className="flex items-center gap-3">
                      <span className="text-xs w-24 shrink-0 text-slate-700 font-medium">{w.label}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={w.value}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setScoreWeights((prev) => ({
                            ...prev,
                            [w.key]: val,
                          }));
                        }}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                      />
                      <span className="text-xs font-semibold text-slate-700 w-8 text-right font-mono">
                        {w.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0 text-slate-700 font-medium">Min Score</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={minMatchScore}
                      onChange={(e) => setMinMatchScore(parseInt(e.target.value) || 0)}
                      className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                    <span className="text-xs font-semibold text-slate-700 w-8 text-right font-mono">
                      {minMatchScore}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setReverseMatchOnPublish(!reverseMatchOnPublish)}
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        reverseMatchOnPublish ? 'bg-emerald-700' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          reverseMatchOnPublish ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-800">
                      Run reverse match on publish (scan existing CVs)
                    </span>
                  </label>
                </div>
              </div>

            {/* Follow-Up Sequence & Outreach */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
              {/* Header with Edit Follow-Up Button */}
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Follow-Up Sequence & Outreach</h3>
                    <p className="text-xs text-slate-500">
                      Automated outreach enabled with standard 7-day schedule (WhatsApp & Email).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingFollowUp(!isEditingFollowUp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isEditingFollowUp
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                      : 'border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  {isEditingFollowUp ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Done Editing</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Follow-Up</span>
                    </>
                  )}
                </button>
              </div>

              {/* Default Active Summary View */}
              {!isEditingFollowUp ? (
                <div className="p-4 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${enableWhatsAppFollowUp ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">WhatsApp Follow-ups</p>
                          <p className="text-[11px] text-slate-500">Meta Cloud API (Verified)</p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${enableWhatsAppFollowUp ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                        {enableWhatsAppFollowUp ? 'Active' : 'Off'}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${enableEmailFollowUp ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Email Follow-ups</p>
                          <p className="text-[11px] text-slate-500">Microsoft Graph</p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${enableEmailFollowUp ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                        {enableEmailFollowUp ? 'Active' : 'Off'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">Checked Candidate Information</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {maxFollowUpAttempts} attempts • {maxFollowUpDays} days timeout
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['CV Document', 'Current Salary', 'Expected Salary', 'Notice Period', ...customQuestions].map((item) => (
                        <span
                          key={item}
                          className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 space-y-6 bg-slate-50/40 animate-in fade-in-50 duration-200">
                  {/* 1. Outreach Channels */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      1. Outreach Channels
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* WhatsApp Card */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                        <div className="pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                            <span className="text-xs font-semibold text-slate-900">WhatsApp Follow-ups</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Initial reach-out via Meta Cloud API & dynamic AI chat.
                          </p>
                        </div>
                        <div
                          onClick={() => setEnableWhatsAppFollowUp(!enableWhatsAppFollowUp)}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                            enableWhatsAppFollowUp ? 'bg-emerald-700' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              enableWhatsAppFollowUp ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Email Card */}
                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                        <div className="pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                            <span className="text-xs font-semibold text-slate-900">Email Follow-ups</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Automated outreach via Microsoft Graph email.
                          </p>
                        </div>
                        <div
                          onClick={() => setEnableEmailFollowUp(!enableEmailFollowUp)}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                            enableEmailFollowUp ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              enableEmailFollowUp ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* 2. Required Candidate Information & Custom Questions */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        2. Required Candidate Information & Custom Questions
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        The system checks for standard application details and any job-specific custom questions you add below.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        STANDARD REQUIREMENTS (ALWAYS CHECKED)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['CV Document', 'Current Salary', 'Expected Salary', 'Notice Period'].map((req) => (
                          <div
                            key={req}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Questions */}
                    <div className="space-y-2 pt-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Job-Specific Custom Questions (Optional)</p>
                        <p className="text-[11px] text-slate-500">
                          Add extra questions specific to this role (e.g. Portfolio Link, Driver's License, GitHub URL). These are automatically added to the missing details list.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newQuestionInput}
                          onChange={(e) => setNewQuestionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddQuestion();
                            }
                          }}
                          placeholder="e.g. Portfolio Link / Showreel (Google Drive, YouTube, Behance)"
                          className="flex-1 px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddQuestion}
                          className="px-3.5 py-2 bg-[#0c4a2a] hover:bg-[#08351e] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Question</span>
                        </button>
                      </div>

                      {customQuestions.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {customQuestions.map((q, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <span className="font-medium text-slate-800">{q}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* 3. WhatsApp Initial Outreach Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          3. WhatsApp Initial Outreach Preview
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          This initial outreach is sent using the verified Meta Business Template.
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Meta Approved
                      </span>
                    </div>

                    {/* WhatsApp Chat Bubble */}
                    <div className="bg-[#f7f6f2] border border-[#e8e6df] rounded-xl p-4 text-xs text-slate-800 space-y-2.5">
                      <p>Hi <span className="text-emerald-700 font-semibold">&#123;Candidate Name&#125;</span>,</p>
                      <p>
                        Thank you for your interest in the <span className="font-semibold">*{openingName || 'role'}*</span> role.
                      </p>
                      <p className="text-slate-600">
                        To complete your application, we still require the following information:
                      </p>
                      <div className="border border-slate-300 bg-white/80 rounded-md p-2 text-xs font-medium text-slate-800">
                        • Current Salary | • Expected Salary | • Notice Period
                        {customQuestions.length > 0 &&
                          customQuestions.map((q) => ` | • ${q}`)}
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Please reply directly to this chat with the requested details. Once we receive them, we'll continue with the next step of the recruitment process. Thank you!
                      </p>

                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                        <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>The missing details variable automatically updates per candidate and includes your custom questions above.</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* 5. Email Outreach Template & Limits */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          5. Email Outreach Template (Customizable)
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Customize the email subject line and body sent to candidates.
                        </p>
                      </div>
                      <div
                        onClick={() => setEnableCustomEmailTemplate(!enableCustomEmailTemplate)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                          enableCustomEmailTemplate ? 'bg-[#0a66c2]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            enableCustomEmailTemplate ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Max Follow-up Attempts
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={maxFollowUpAttempts}
                          onChange={(e) => setMaxFollowUpAttempts(parseInt(e.target.value) || 3)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Max Days (Timeout)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={maxFollowUpDays}
                          onChange={(e) => setMaxFollowUpDays(parseInt(e.target.value) || 7)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-3.5 bg-[#fafafa] border-t border-[#e0e0e0] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#00000099] hover:text-[#000000e6] hover:bg-[#e0e0e0] cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Step 2</span>
            </button>

            <div className="flex items-center gap-3">
              {weightSum !== 100 && (
                <span className="text-xs text-rose-600 font-medium">
                  Weights must equal 100% (currently {weightSum}%)
                </span>
              )}
              <button
                type="button"
                onClick={handleFinalPublish}
                disabled={isSubmitting || weightSum !== 100}
                className={`px-5 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 transition-all ${
                  isSubmitting || weightSum !== 100
                    ? 'bg-slate-400 cursor-not-allowed opacity-80'
                    : 'bg-[#0a66c2] hover:bg-[#004182] cursor-pointer shadow-xs'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Launching Opening...</span>
                  </>
                ) : (
                  <span>Launch Opening</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
