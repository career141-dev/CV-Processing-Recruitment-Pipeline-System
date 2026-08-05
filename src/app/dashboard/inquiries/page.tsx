"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  HelpCircle,
  MessageSquare,
  Mail,
  AlertTriangle,
  CheckCircle,
  Filter,
  Search,
  Send,
  X,
  Clock,
  Briefcase,
  User,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export default function CandidateInquiriesPage() {
  const [selectedChannel, setSelectedChannel] = useState<"all" | "whatsapp" | "email">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "unresolved" | "answered_by_ai" | "resolved_by_ta">("all");
  const [selectedImportance, setSelectedImportance] = useState<"all" | "high" | "medium" | "low">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [displayLimit, setDisplayLimit] = useState<number>(30);

  // Modal State
  const [activeInquiry, setActiveInquiry] = useState<any | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Queries & Mutations
  const inquiries = useQuery(api.communications.inquiries.listInquiries, {
    channel: selectedChannel,
    status: selectedStatus,
    importanceLevel: selectedImportance,
  });

  const stats = useQuery(api.communications.inquiries.getInquirySummaryStats);

  const resolveViaWhatsApp = useMutation(api.communications.inquiries.resolveInquiryViaWhatsApp);
  const resolveViaEmail = useMutation(api.communications.inquiries.resolveInquiryViaEmail);
  const dismissInquiry = useMutation(api.communications.inquiries.dismissInquiry);

  const filteredInquiries = (inquiries || []).filter((inq: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inq.candidateName.toLowerCase().includes(q) ||
      inq.questionText.toLowerCase().includes(q) ||
      inq.jobTitle.toLowerCase().includes(q)
    );
  });

  const handleOpenReplyModal = (inquiry: any) => {
    setActiveInquiry(inquiry);
    setReplyText(inquiry.aiAutoReplyText ? `Hi ${inquiry.candidateName.split(" ")[0]},\n\n` : `Hi ${inquiry.candidateName.split(" ")[0]},\n\n`);
    setEmailSubject(`Re: Application inquiry for ${inquiry.jobTitle}`);
  };

  const handleSendReply = async () => {
    if (!activeInquiry || !replyText.trim()) {
      toast.error("Please enter a reply message.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeInquiry.channel === "whatsapp") {
        await resolveViaWhatsApp({
          inquiryId: activeInquiry._id,
          responseText: replyText.trim(),
        });
        toast.success(`WhatsApp reply sent to ${activeInquiry.candidateName}!`);
      } else {
        await resolveViaEmail({
          inquiryId: activeInquiry._id,
          subject: emailSubject || `Re: Application inquiry for ${activeInquiry.jobTitle}`,
          responseText: replyText.trim(),
        });
        toast.success(`Email reply sent to ${activeInquiry.candidateName}!`);
      }

      setActiveInquiry(null);
      setReplyText("");
    } catch (err: any) {
      console.error("Failed to send reply:", err);
      toast.error(err.message || "Failed to dispatch reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async (inquiryId: Id<"candidateInquiries">) => {
    try {
      await dismissInquiry({ inquiryId });
      toast.success("Inquiry marked as resolved.");
    } catch (err: any) {
      toast.error("Failed to dismiss inquiry.");
    }
  };

  const categoryLabels: Record<string, { label: string; color: string }> = {
    salary_compensation: { label: "Salary / Compensation", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200" },
    visa_sponsorship: { label: "Visa / Sponsorship", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200" },
    location_remote: { label: "Location / Remote Work", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200" },
    notice_start_date: { label: "Notice Period / Start Date", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200" },
    tech_stack: { label: "Tech Stack", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200" },
    client_details: { label: "Client Details", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200" },
    general_inquiry: { label: "General Question", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200" },
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                  <HelpCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  Candidate Inquiries & Questions
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Manage and respond to candidate questions captured from WhatsApp and Email conversations.
                </p>
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unresolved Inquiries</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats?.unresolvedCount ?? "..."}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending WhatsApp</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats?.unresolvedWhatsApp ?? "..."}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Email</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats?.unresolvedEmail ?? "..."}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Mail className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">High Importance</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats?.highImportanceCount ?? "..."}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar & Controls */}
          <div className="p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Channel Tabs */}
              <div className="inline-flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">
                <button
                  onClick={() => setSelectedChannel("all")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                    selectedChannel === "all" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  All Channels
                </button>
                <button
                  onClick={() => setSelectedChannel("whatsapp")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
                    selectedChannel === "whatsapp" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => setSelectedChannel("email")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
                    selectedChannel === "email" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>

              {/* Status Select */}
              <select
                value={selectedStatus}
                onChange={(e: any) => setSelectedStatus(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="unresolved">Unresolved Only</option>
                <option value="answered_by_ai">Answered by AI</option>
                <option value="resolved_by_ta">Resolved by TA</option>
              </select>

              {/* Importance Select */}
              <select
                value={selectedImportance}
                onChange={(e: any) => setSelectedImportance(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Importance Levels</option>
                <option value="high">High Importance</option>
                <option value="medium">Medium Importance</option>
                <option value="low">Low Importance</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate, question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Inquiries Cards Grid */}
          <div className="px-8 pb-12">
            {!inquiries ? (
              <div className="text-center py-16 text-slate-400">Loading candidate inquiries...</div>
            ) : filteredInquiries.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">All Clear!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No candidate inquiries match your selected filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInquiries.map((inq: any) => {
                  const cat = categoryLabels[inq.category] || categoryLabels.general_inquiry;
                  return (
                    <div
                      key={inq._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Channel Badge */}
                          <div className={`p-2 rounded-lg text-white font-bold text-xs flex items-center gap-1 ${inq.channel === "whatsapp" ? "bg-emerald-600" : "bg-blue-600"}`}>
                            {inq.channel === "whatsapp" ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                            <span className="capitalize">{inq.channel}</span>
                          </div>

                          {/* Category Badge */}
                          <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border ${cat.color}`}>
                            {cat.label}
                          </span>

                          {/* Importance Badge */}
                          {inq.importanceLevel === "high" && (
                            <span className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-rose-200">
                              HIGH URGENCY
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(inq.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mt-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{inq.candidateName}</span>
                          <span className="text-slate-400 font-normal">for</span>
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 ml-1" />
                          <span className="text-slate-600 dark:text-slate-300">{inq.jobTitle}</span>
                        </div>

                        <p className="mt-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 font-medium">
                          "{inq.questionText}"
                        </p>

                        {inq.aiAutoReplyText && (
                          <div className="mt-2 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">AI Auto-Response:</span> {inq.aiAutoReplyText}
                            </div>
                          </div>
                        )}

                        {inq.taResponseText && (
                          <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/50">
                            <span className="font-bold">TA Resolved:</span> {inq.taResponseText}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className={`text-xs font-semibold ${inq.status === "unresolved" ? "text-amber-600" : "text-emerald-600"}`}>
                          Status: <span className="capitalize">{inq.status.replace(/_/g, " ")}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {inq.status !== "resolved_by_ta" && (
                            <button
                              onClick={() => handleOpenReplyModal(inq)}
                              className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition flex items-center gap-1.5 ${
                                inq.channel === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              Reply via {inq.channel === "whatsapp" ? "WhatsApp" : "Email"}
                            </button>
                          )}

                          {inq.status !== "resolved_by_ta" && (
                            <button
                              onClick={() => handleDismiss(inq._id)}
                              className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Load More Button */}
                {inquiries && inquiries.length >= displayLimit && (
                  <div className="text-center pt-6">
                    <button
                      onClick={() => setDisplayLimit((prev) => prev + 30)}
                      className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold rounded-xl transition shadow-sm"
                    >
                      Load More Inquiries (+30)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply Modal */}
          {activeInquiry && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    {activeInquiry.channel === "whatsapp" ? (
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Mail className="w-5 h-5 text-blue-600" />
                    )}
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      Reply to Candidate Inquiry
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveInquiry(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Candidate:</span> {activeInquiry.candidateName}
                  </div>
                  <div className="text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-bold">Question:</span> "{activeInquiry.questionText}"
                  </div>

                  {activeInquiry.channel === "email" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Response Message ({activeInquiry.channel === "whatsapp" ? "WhatsApp Text" : "Email Body"})
                    </label>
                    <textarea
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response to the candidate..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveInquiry(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={handleSendReply}
                    className={`px-5 py-2 text-xs font-bold rounded-lg text-white transition flex items-center gap-1.5 ${
                      activeInquiry.channel === "whatsapp"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSubmitting ? "Sending..." : `Send ${activeInquiry.channel === "whatsapp" ? "WhatsApp" : "Email"}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
  );
}
