import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface DeleteCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string | null;
}

export function DeleteCandidateModal({ isOpen, onClose, candidateId }: DeleteCandidateModalProps) {
  const deleteCandidate = useMutation(api.candidates.candidates.deleteCandidate);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!candidateId) return;
    setIsDeleting(true);
    try {
      await deleteCandidate({ candidateId: candidateId as any });
      toast.success("Candidate successfully deleted");
      onClose();
    } catch (e: any) {
      toast.error("Failed to delete candidate: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title="Delete Candidate"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleDelete} 
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Are you sure?</h3>
        <p className="text-sm text-gray-500">
          This action cannot be undone. This will permanently delete the candidate's profile, CVs, match scores, applications, and all communication logs.
        </p>
      </div>
    </Modal>
  );
}
