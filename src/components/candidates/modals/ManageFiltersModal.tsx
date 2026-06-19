"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ManageFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedFilters: string[];
  onDeleteFilter: (filter: string) => void;
}

export function ManageFiltersModal({ isOpen, onClose, savedFilters, onDeleteFilter }: ManageFiltersModalProps) {
  const handleDelete = (filter: string) => {
    onDeleteFilter(filter);
    toast.success(`Filter "${filter}" deleted.`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Saved Filters"
      maxWidth="max-w-md"
      footer={
        <Button variant="primary" onClick={onClose}>Done</Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Your saved custom filters are listed below. Deleting them will remove them from your sidebar library.
        </p>

        <div className="flex flex-col gap-2">
          {savedFilters.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              You haven't saved any custom filters yet.
            </div>
          ) : (
            savedFilters.map((filter) => (
              <div 
                key={filter}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-[#1B5E20]/30 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-900">{filter}</span>
                <button
                  onClick={() => handleDelete(filter)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Delete filter"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
