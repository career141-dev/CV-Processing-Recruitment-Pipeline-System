"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSuccess: () => void;
}

export function BulkMessageModal({ isOpen, onClose, selectedCount, onSuccess }: BulkMessageModalProps) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');


  const hasDuplicateWarning = selectedCount > 1;

  const handleSend = () => {
    toast.success(`Successfully queued ${selectedCount} message(s) via ${channel === 'email' ? 'Email' : 'WhatsApp'}.`);
    onSuccess();
    onClose();
    setSubject('');
    setMessage('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Message ${selectedCount} Candidate${selectedCount !== 1 ? 's' : ''}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!message || (channel === 'email' && !subject)} onClick={handleSend}>
            Send Message
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        
        {/* Warning Banner */}
        {hasDuplicateWarning && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex flex-col">
              <span className="text-sm font-bold">Recent Contact Warning</span>
              <span className="text-xs">1 of the selected candidates was contacted in the last 7 days. Are you sure you want to message them again?</span>
            </div>
          </div>
        )}

        {/* Channel Selection */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Channel</span>
          <div className="flex gap-3">
            <button
              onClick={() => setChannel('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg transition-colors ${
                channel === 'email' ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-600' : 'border-gray-200 text-gray-600 hover:bg-surface-container-high transition-colors'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={() => setChannel('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg transition-colors ${
                channel === 'whatsapp' ? 'border-green-600 bg-green-50 text-green-700 font-medium ring-1 ring-green-600' : 'border-gray-200 text-gray-600 hover:bg-surface-container-high transition-colors'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* Composer */}
        <div className="flex flex-col gap-4 mt-2">
          {channel === 'email' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Subject</label>
              <input 
                type="text" 
                placeholder="e.g. Exciting new opportunity at FinTech Global..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-[#1B5E20]"
              />
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Message</label>
              <span className="text-xs text-gray-500">Variables: {'{{first_name}}'}, {'{{job_title}}'}</span>
            </div>
            <textarea 
              rows={6}
              placeholder={`Hi {{first_name}},\n\nI came across your profile and...`}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-[#1B5E20] resize-y"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
