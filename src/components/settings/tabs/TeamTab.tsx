"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { UserPlus, Edit2, X, Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { inviteUser } from "../../../app/actions/inviteUser";

export function TeamTab() {
  const teamMembers = useQuery(api.users.users.getTeamMembers);
  const assignRole = useMutation(api.users.users.assignRole);
  const deactivate = useMutation(api.users.users.deactivate);
  const activate = useMutation(api.users.users.activate);
  const updateUser = useMutation(api.users.users.updateUser);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Invite Modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ta");
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false });

  // Edit Name Modal state
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setMessage({ text: "", isError: false });

    try {
      const result = await inviteUser(email, role);
      if (result.success) {
        setMessage({ text: "Invitation sent successfully!", isError: false });
        setTimeout(() => {
          setIsInviteOpen(false);
          setEmail("");
          setRole("ta");
          setMessage({ text: "", isError: false });
        }, 2000);
      } else {
        setMessage({ text: result.error || "Failed to invite", isError: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An unexpected error occurred", isError: true });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: any, newRole: string) => {
    try {
      await assignRole({ targetUserId: userId, newRole, reason: "Admin role change via UI" });
    } catch (err: any) {
      alert("Failed to change role: " + err.message);
    }
  };

  const handleDeactivate = async (userId: any) => {
    if (!confirm("Are you sure you want to deactivate this user? They will lose all access immediately.")) return;
    try {
      await deactivate({ targetUserId: userId, reason: "Admin deactivation via UI" });
    } catch (err: any) {
      alert("Failed to deactivate user: " + err.message);
    }
  };

  const handleActivate = async (userId: any) => {
    if (!confirm("Are you sure you want to activate this user? They will regain access to the platform.")) return;
    try {
      await activate({ targetUserId: userId, reason: "Admin activation via UI" });
    } catch (err: any) {
      alert("Failed to activate user: " + err.message);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) return;
    setIsSavingName(true);
    try {
      await updateUser({
        targetUserId: editingMember._id,
        fullName: editName.trim(),
      });
      setEditingMember(null);
      setEditName("");
    } catch (err: any) {
      alert("Failed to update name: " + err.message);
    } finally {
      setIsSavingName(false);
    }
  };

  // Pagination Math
  const totalMembers = teamMembers ? teamMembers.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalMembers);
  const paginatedMembers = teamMembers ? teamMembers.slice(startIndex, endIndex) : [];

  return (
    <>
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 relative" noPadding>
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface">
          <h2 className="text-text-primary text-[14px] font-bold">Team Members</h2>
          <button 
            onClick={() => setIsInviteOpen(true)}
            className="px-4 py-2 bg-primary-container text-on-primary rounded-md text-[13px] font-medium hover:bg-primary-container/90 transition-colors flex items-center gap-2"
          >
            <UserPlus size={16} />
            Invite Member
          </button>
        </div>
        <div className="overflow-x-auto bg-surface">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-border">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Member</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Role</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Jobs Assigned</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {teamMembers === undefined ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary text-[13px]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin w-4 h-4" /> Loading team members...
                    </div>
                  </td>
                </tr>
              ) : teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary text-[13px]">
                    No team members found.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => {
                  const initial = member.fullName ? member.fullName.charAt(0).toUpperCase() : "?";
                  const isAdmin = member.role === "admin" || member.role === "ta_manager";
                  
                  return (
                    <tr key={member._id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isAdmin 
                                ? "bg-primary-container/10 text-primary-container" 
                                : "bg-[#91F78E] text-[#00731E]"
                            }`}
                          >
                            {initial}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-text-primary">{member.fullName}</span>
                              <button
                                title="Edit Name"
                                onClick={() => {
                                  setEditingMember(member);
                                  setEditName(member.fullName || "");
                                }}
                                className="text-text-disabled hover:text-text-primary p-0.5 rounded transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                            <span className="text-[11px] text-text-secondary">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          className="bg-transparent border border-border rounded px-2 py-1 text-[13px] text-text-secondary focus:outline-none focus:border-primary-container"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member._id, e.target.value)}
                          disabled={!member.isActive}
                        >
                          <option value="admin">Admin</option>
                          <option value="ta_manager">TA Manager</option>
                          <option value="senior_ta">Senior TA</option>
                          <option value="recruiter">Recruiter</option>
                          <option value="test_ta">Test TA (Limited Access)</option>
                          <option value="director">Director</option>
                          <option value="client">Client</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-text-secondary text-[13px]">
                        {member.role === "admin" ? "All" : member.jobCount}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-text-primary text-[13px]">
                          {!member.isActive ? (
                            <><span className="text-[10px]">🔴</span> Inactive</>
                          ) : !member.isOnboarded ? (
                            <><span className="text-[10px]">🟡</span> Pending</>
                          ) : (
                            <><span className="text-[10px]">🟢</span> Active</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingMember(member);
                            setEditName(member.fullName || "");
                          }}
                          className="text-text-secondary hover:text-text-primary transition-colors text-[12px] font-medium border border-border bg-surface-container-low px-2.5 py-1 rounded-md flex items-center gap-1"
                        >
                          <Edit2 size={13} />
                          Edit Name
                        </button>
                        {member.isActive ? (
                          <button 
                            onClick={() => handleDeactivate(member._id)}
                            className="text-red-500 hover:text-red-700 transition-colors text-[12px] font-medium border border-red-200 hover:border-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleActivate(member._id)}
                            className="text-emerald-600 hover:text-emerald-800 transition-colors text-[12px] font-medium border border-emerald-200 hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md flex items-center gap-1"
                          >
                            <CheckCircle2 size={13} />
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {teamMembers && teamMembers.length > 0 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface text-[13px] text-text-secondary rounded-b-[10px]">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="font-semibold text-text-primary">{totalMembers === 0 ? 0 : startIndex + 1}</strong> to{" "}
                <strong className="font-semibold text-text-primary">{endIndex}</strong> of{" "}
                <strong className="font-semibold text-text-primary">{totalMembers}</strong> members
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 bg-surface-container-low border border-border rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-primary-container"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage === 1}
                className="px-2.5 py-1 border border-border rounded-md hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-[12px]"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span className="px-2 text-[12px]">
                Page <strong className="font-semibold text-text-primary">{validCurrentPage}</strong> of{" "}
                <strong className="font-semibold text-text-primary">{totalPages}</strong>
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="px-2.5 py-1 border border-border rounded-md hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-[12px]"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>


      {/* Edit Name Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-container-low">
              <h3 className="text-[15px] font-bold text-text-primary">Edit Member Name</h3>
              <button 
                onClick={() => setEditingMember(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveName} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-text-secondary uppercase">Email Address</label>
                <input 
                  type="text" 
                  disabled
                  value={editingMember.email}
                  className="w-full bg-surface-container-low/50 border border-border rounded-lg px-4 py-2 text-[13px] text-text-secondary cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-text-secondary uppercase">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full bg-surface-container-low border border-border rounded-lg px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-container-low rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingName}
                  className="px-4 py-2 bg-primary-container text-on-primary rounded-lg text-[13px] font-medium hover:bg-primary-container/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingName && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-container-low">
              <h3 className="text-[15px] font-bold text-text-primary">Invite Team Member</h3>
              <button 
                onClick={() => setIsInviteOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {message.text && (
                <div className={`p-3 rounded-md text-[13px] ${message.isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-text-secondary uppercase">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@career141.com"
                  className="w-full bg-surface-container-low border border-border rounded-lg px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-text-secondary uppercase">System Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-surface-container-low border border-border rounded-lg px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all appearance-none"
                >
                  <option value="admin">System Administrator (Full Access)</option>
                  <option value="ta_manager">Talent Acquisition Manager</option>
                  <option value="senior_ta">Senior Talent Acquisition</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="test_ta">Test TA (Limited Access — Dashboard, Jobs &amp; Candidate Search)</option>
                  <option value="director">Director / Reviewer</option>
                  <option value="client">Client Contact</option>
                  <option value="viewer">Viewer / Read-Only</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-container-low rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 bg-primary-container text-on-primary rounded-lg text-[13px] font-medium hover:bg-primary-container/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isInviting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
