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
  candidateId?: string | null;
  candidateIds?: string[];
  onSuccess?: () => void;
}

export function DeleteCandidateModal({ isOpen, onClose, candidateId, candidateIds, onSuccess }: DeleteCandidateModalProps) {
  const deleteCandidate = useMutation(api.candidates.candidates.deleteCandidate);
  const bulkDeleteCandidates = useMutation(api.candidates.candidates.bulkDeleteCandidates);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (candidateIds && candidateIds.length > 0) {
        await bulkDeleteCandidates({ candidateIds: candidateIds as any[] });
        toast.success(`Successfully deleted ${candidateIds.length} candidate(s)`);
      } else if (candidateId) {
        await deleteCandidate({ candidateId: candidateId as any });
        toast.success("Candidate successfully deleted");
      } else {
        setIsDeleting(false);
        return;
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast.error("Failed to delete candidate(s): " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title="Delete Candidate(s)"
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
          This action cannot be undone. This will permanently delete the candidate profile(s), CVs, match scores, applications, and all communication logs.
        </p>
      </div>
    </Modal>
  );
}
