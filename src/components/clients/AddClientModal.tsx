"use client";

import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { X, Building2, Globe, Mail, Phone, User, FileText, Loader2 } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (clientName: string) => void;
}

const COMMON_INDUSTRIES = [
  'Apparel & Textiles',
  'Automotive',
  'Banking & Financial Services',
  'Conglomerate',
  'Construction & Real Estate',
  'Education',
  'FMCG & Retail',
  'Healthcare & Pharmaceuticals',
  'Hospitality & Tourism',
  'Information Technology & Software',
  'Logistics & Supply Chain',
  'Manufacturing & Engineering',
  'Telecommunications',
  'Other',
];

export function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
  const createClient = useMutation(api.clients.clients.createClient);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      toast.error('Client name is required');
      return;
    }

    const finalIndustry = industry === 'Other' && customIndustry.trim() 
      ? customIndustry.trim() 
      : industry.trim() || 'Other';

    setIsSubmitting(true);
    try {
      const res = await createClient({
        name: finalName,
        industry: finalIndustry,
        contactPerson: contactPerson.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.isNew) {
        toast.success(`Client "${finalName}" created successfully`);
      } else {
        toast.info(`Client "${finalName}" updated with new details`);
      }

      onSuccess?.(finalName);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary-container">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Add New Client</h2>
              <p className="text-xs text-text-secondary">Register a client company profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Client Company Name */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1">
              Client Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Delmo Group, Hemas Holdings, Brandix"
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1">
              Industry <span className="text-red-500">*</span>
            </label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-hidden focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            >
              <option value="">Select Industry</option>
              {COMMON_INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            {industry === 'Other' && (
              <input
                type="text"
                value={customIndustry}
                onChange={e => setCustomIndustry(e.target.value)}
                placeholder="Specify industry"
                className="mt-2 w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
              />
            )}
          </div>

          {/* Contact Person & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                <User size={13} /> Primary Contact Name
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="e.g. Asma Rafeek"
                className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                <Mail size={13} /> Primary Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
              />
            </div>
          </div>

          {/* Contact Phone & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                <Phone size={13} /> Contact Phone
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="+94 77 123 4567"
                className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                <Globe size={13} /> Website
              </label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
              <FileText size={13} /> Notes / Description
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Key client for leadership and engineering roles..."
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
