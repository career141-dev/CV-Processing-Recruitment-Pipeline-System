import React from 'react';
import { Card } from '@/components/ui/Card';
import { Camera } from 'lucide-react';

interface ProfileTabProps {
  fullName: string;
  email: string;
  initial: string;
  role: string | null;
}

export function ProfileTab({ fullName, email, initial, role }: ProfileTabProps) {
  // Format role for display: "ta_manager" -> "TA Manager", "senior_ta" -> "Senior TA", etc.
  const displayRole = role 
    ? role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : "Loading...";
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-text-primary text-[14px] font-bold mb-6">My Profile</h2>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-border relative group">
            <span className="text-text-secondary text-[24px] font-bold">{initial}</span>
            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
              <Camera className="text-on-primary" size={24} />
            </div>
          </div>
          <button className="text-accent-teal text-[13px] font-medium hover:underline">Change Photo</button>
        </div>

        {/* Form Fields */}
        <div className="flex-grow space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Full Name</label>
              <input className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:border-[#006763] focus:ring-1 focus:ring-[#006763] transition-colors" type="text" defaultValue={fullName} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Role <span className="text-text-disabled">(Locked)</span></label>
              <input className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-secondary cursor-not-allowed capitalize" disabled type="text" value={displayRole} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Email Address</label>
              <input className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:border-[#006763] focus:ring-1 focus:ring-[#006763] transition-colors" type="email" defaultValue={email} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Phone Number</label>
              <input className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:border-[#006763] focus:ring-1 focus:ring-[#006763] transition-colors" type="tel" defaultValue="+1 (555) 123-4567" />
            </div>
          </div>
          <div className="pt-4 border-t border-border flex justify-end">
            <button className="px-4 py-2 bg-primary-container text-on-primary rounded-md text-[13px] font-medium hover:bg-primary-container/90 transition-colors">Save Changes</button>
          </div>
        </div>
      </div>
    </Card>
  );
}
