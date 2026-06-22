import React from 'react';
import { Card } from '@/components/ui/Card';
import { UserPlus, Edit2 } from 'lucide-react';

export function TeamTab() {
  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" noPadding>
      <div className="p-5 border-b border-border flex justify-between items-center bg-surface">
        <h2 className="text-text-primary text-[14px] font-bold">Team Members</h2>
        <button className="px-4 py-2 bg-primary-container text-on-primary rounded-md text-[13px] font-medium hover:bg-primary-container/90 transition-colors flex items-center gap-2">
          <UserPlus size={16} />
          Invite Member
        </button>
      </div>
      <div className="overflow-x-auto bg-surface rounded-b-[10px]">
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
            <tr className="hover:bg-surface-container-high transition-colors transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center font-bold text-xs">S</div>
                  <span className="text-[13px] font-medium text-text-primary">Shambra</span>
                </div>
              </td>
              <td className="px-6 py-4 text-text-secondary text-[13px]">Admin</td>
              <td className="px-6 py-4 text-text-secondary text-[13px]">All</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-text-primary text-[13px]"><span className="text-[10px]">🟢</span> Active</div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-text-secondary hover:text-accent-teal transition-colors"><Edit2 size={16} /></button>
              </td>
            </tr>
            <tr className="hover:bg-surface-container-high transition-colors transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#91F78E] text-[#00731E] flex items-center justify-center font-bold text-xs">R</div>
                  <span className="text-[13px] font-medium text-text-primary">Rayan</span>
                </div>
              </td>
              <td className="px-6 py-4 text-text-secondary text-[13px]">Recruiter</td>
              <td className="px-6 py-4 text-text-secondary text-[13px]">12</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-text-primary text-[13px]"><span className="text-[10px]">🟢</span> Active</div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-text-secondary hover:text-accent-teal transition-colors"><Edit2 size={16} /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
