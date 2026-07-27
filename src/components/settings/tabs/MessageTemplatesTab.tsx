import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { SmartTemplateEditor } from '@/components/ui/SmartTemplateEditor';
import { Plus, Edit2, Trash2, Globe, Lock, Save, X } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

export function MessageTemplatesTab() {
  const templates = useQuery(api.templates.messageTemplates.getTemplates, {});
  const createTemplate = useMutation(api.templates.messageTemplates.createTemplate);
  const updateTemplate = useMutation(api.templates.messageTemplates.updateTemplate);
  const deleteTemplate = useMutation(api.templates.messageTemplates.deleteTemplate);
  const { isAdmin } = useRole();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    type: 'initial_outreach' as 'initial_outreach' | 'sample_follow_up' | 'general',
    content: '',
    isGlobal: false,
  });

  const handleEdit = (t: any) => {
    setForm({ name: t.name, type: t.type, content: t.content, isGlobal: t.isGlobal });
    setEditingId(t._id);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setForm({ name: '', type: 'initial_outreach', content: '', isGlobal: false });
    setEditingId(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.content) return alert('Name and Content are required.');
    try {
      if (editingId) {
        await updateTemplate({ id: editingId as any, ...form });
      } else {
        await createTemplate(form);
      }
      setIsEditing(false);
      setEditingId(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate({ id: id as any });
    }
  };

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-text-primary text-[14px] font-bold">Message Templates</h2>
          <p className="text-text-secondary text-[13px]">Manage templates for AI Follow-ups and outreach.</p>
        </div>
        {!isEditing && (
          <button onClick={handleCreateNew} className="px-4 py-2 bg-primary-container text-white rounded-lg text-xs font-bold hover:bg-primary transition flex items-center gap-2">
            <Plus size={14} /> New Template
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4 bg-surface p-4 rounded-xl border border-border">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm text-text-primary">{editingId ? 'Edit Template' : 'Create Template'}</h3>
            <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-surface-container rounded-full text-text-secondary">
              <X size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Template Name</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-surface-container-low border border-border rounded-md px-3 py-2 text-sm text-text-primary"
                placeholder="e.g. Aggressive Developer Follow-up"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-text-secondary block mb-1">Type</label>
              <select 
                value={form.type}
                onChange={e => setForm({...form, type: e.target.value as any})}
                className="w-full bg-surface-container-low border border-border rounded-md px-3 py-2 text-sm text-text-primary"
              >
                <option value="initial_outreach">Initial Outreach</option>
                <option value="sample_follow_up">Sample Follow-Up</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer mt-2">
              <input type="checkbox" checked={form.isGlobal} onChange={e => setForm({...form, isGlobal: e.target.checked})} className="rounded text-primary-container focus:ring-primary-container border-border" />
              Make Global (Visible to all TAs)
            </label>
          )}

          <div className="pt-2">
            <SmartTemplateEditor 
              label="Template Content"
              value={form.content}
              onChange={val => setForm({...form, content: val})}
              requiredVariables={form.type === 'initial_outreach' ? ['{missing_fields}'] : []}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-border rounded-lg text-xs font-bold hover:bg-surface-container text-text-primary">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary-container text-white rounded-lg text-xs font-bold hover:bg-primary flex items-center gap-2">
              <Save size={14} /> Save Template
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates === undefined ? (
            <p className="text-xs text-text-secondary">Loading templates...</p>
          ) : templates.length === 0 ? (
            <div className="col-span-full py-10 text-center border border-dashed border-border rounded-xl">
              <p className="text-text-secondary text-sm">No templates found.</p>
              <button onClick={handleCreateNew} className="mt-2 text-primary-container font-bold text-xs hover:underline">Create your first template</button>
            </div>
          ) : (
            templates.map(t => (
              <div key={t._id} className="border border-border bg-surface-container-low rounded-xl p-4 flex flex-col group relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {t.isGlobal ? <Globe size={14} className="text-blue-500" /> : <Lock size={14} className="text-amber-500" />}
                    <h4 className="font-bold text-sm text-text-primary line-clamp-1">{t.name}</h4>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <button onClick={() => handleEdit(t)} className="p-1.5 bg-surface border border-border rounded hover:bg-surface-container text-text-primary">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(t._id)} className="p-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded hover:bg-red-100 text-red-600 dark:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary w-max mb-3">
                  {t.type === 'initial_outreach' ? 'Initial Outreach' : t.type === 'sample_follow_up' ? 'Sample Follow-Up' : 'General'}
                </span>
                <p className="text-xs text-text-secondary line-clamp-3 bg-surface p-2 rounded border border-border/50 font-mono flex-1">
                  {t.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
