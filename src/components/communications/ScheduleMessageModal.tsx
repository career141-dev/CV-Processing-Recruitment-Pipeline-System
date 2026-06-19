"use client";

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
}

export function ScheduleMessageModal({ isOpen, onClose, onSchedule }: ScheduleMessageModalProps) {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  const handleConfirm = () => {
    if (!dateStr || !timeStr) return;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    const scheduledDate = new Date(year, month - 1, day, hours, minutes);
    onSchedule(scheduledDate);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Message"
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!dateStr || !timeStr}>Confirm Schedule</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <p className="text-sm text-text-secondary">
          Select a date and time to send this message automatically.
        </p>
        
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1 block">DATE</label>
            <input 
              type="date" 
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1 block">TIME</label>
            <input 
              type="time" 
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
