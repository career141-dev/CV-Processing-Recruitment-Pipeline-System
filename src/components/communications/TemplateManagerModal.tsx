"use client";

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export interface Template {
  id: string;
  name: string;
  content: string;
}

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
}

export function TemplateManagerModal({ isOpen, onClose, templates, setTemplates }: TemplateManagerModalProps) {

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  const handleEdit = (t: Template) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditContent(t.content);
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('Template name cannot be empty');
      return;
    }
    
    if (editingId === 'new') {
      setTemplates(prev => [...prev, { id: Math.random().toString(), name: editName, content: editContent }]);
      toast.success('Template created');
    } else {
      setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, name: editName, content: editContent } : t));
      toast.success('Template updated');
    }
    setEditingId(null);
  };

  const handleCreate = () => {
    setEditingId('new');
    setEditName('');
    setEditContent('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Templates"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {editingId ? (
          <div className="bg-surface-container-low p-4 rounded-lg border border-border">
            <h4 className="font-semibold text-sm mb-3">{editingId === 'new' ? 'Create Template' : 'Edit Template'}</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1 block">TEMPLATE NAME</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  placeholder="e.g. Initial Outreach"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1 block">MESSAGE CONTENT</label>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm h-32 resize-none focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  placeholder="Type your message here..."
                />
                <p className="text-[11px] text-text-disabled mt-1">
                  Use [Name], [Job Title], [Company], or [Recruiter] as placeholders.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save Template</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreate} className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-start justify-between p-3 border border-border rounded-lg bg-surface hover:border-secondary transition-colors group">
              <div className="flex flex-col gap-1 pr-4">
                <span className="font-medium text-sm text-text-primary">{t.name}</span>
                <span className="text-xs text-text-secondary line-clamp-1">{t.content}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(t)}
                  className="p-1.5 text-text-secondary hover:text-secondary hover:bg-surface-container-low rounded-md transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 text-text-secondary hover:text-error hover:bg-error-container rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && !editingId && (
            <div className="text-center py-8 text-text-secondary text-sm bg-surface-container-low rounded-lg border border-dashed border-border">
              No templates found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
