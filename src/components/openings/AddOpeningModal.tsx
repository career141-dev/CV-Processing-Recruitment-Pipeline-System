"use client";

import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { Loader2, Briefcase, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AddOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientId?: string;
  onSuccess?: (openingId: string) => void;
}

export function AddOpeningModal({
  isOpen,
  onClose,
  clientName: initialClientName = '',
  clientId,
  onSuccess,
}: AddOpeningModalProps) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initialClientName);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialClientName) {
      setClientName(initialClientName);
    }
  }, [initialClientName]);

  const createOpening = useMutation(api.openings.openings.createOpening);

  const handleCreate = async (action: 'save' | 'next') => {
    if (!clientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter an opening title');
      return;
    }

    setIsSubmitting(true);
    try {
      const openingId = await createOpening({
        title: title.trim(),
        clientName: clientName.trim(),
        clientId: clientId as any,
        description: description.trim() || undefined,
        status: 'active',
      });

      toast.success(`Opening "${title}" created successfully!`);
      const createdId = openingId;

      if (!initialClientName) setClientName('');
      setTitle('');
      setDescription('');
      onClose();

      if (onSuccess) {
        onSuccess(createdId);
      }

      if (action === 'next') {
        router.push(`/dashboard/clients/${encodeURIComponent(clientName.trim())}`);
      }
    } catch (err: any) {
      console.error('Failed to create opening:', err);
      toast.error(err.message || 'Failed to create opening');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Opening">
      <form onSubmit={(e) => { e.preventDefault(); handleCreate('save'); }} className="space-y-4 pt-2">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. ABC Technologies, Global Finance Ltd"
            className="w-full px-3 py-2 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary-container"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Opening Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Software Engineering Hiring, QA Recruitment"
            className="w-full px-3 py-2 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary-container"
          />
          <p className="mt-1 text-xs text-text-disabled">
            An Opening represents a client campaign grouping related job requisitions.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this opening..."
            className="w-full px-3 py-2 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary-container resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleCreate('save')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-surface-container-high text-text-primary border border-border rounded-lg text-xs font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Briefcase className="w-3.5 h-3.5" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={() => handleCreate('next')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-accent-teal text-white rounded-lg text-xs font-semibold hover:bg-[#00504d] transition-colors flex items-center gap-1.5 shadow-xs"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
