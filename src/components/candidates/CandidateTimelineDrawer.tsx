import React, { useEffect, useState } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from '../../../convex/_generated/dataModel';
import { format } from 'date-fns';
import { X, MessageSquare, ArrowRightLeft, UserPlus, Info, CheckCircle2, Clock, Mail, MessageCircle, AlertCircle } from 'lucide-react';

interface CandidateTimelineDrawerProps {
  applicationId: Id<"applications"> | null;
  onClose: () => void;
}

export function CandidateTimelineDrawer({ applicationId, onClose }: CandidateTimelineDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (applicationId) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [applicationId]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => onClose(), 300); // Wait for transition
  };

  // Fetch timeline events
  const events = useQuery(api.candidates.timeline.getTimeline, 
    applicationId ? { applicationId } : "skip"
  );

  if (!applicationId) return null;

  const renderIcon = (event: any) => {
    if (event.type === 'application_created') {
      return <UserPlus className="w-4 h-4 text-white" />;
    }
    if (event.type === 'stage_change') {
      return <ArrowRightLeft className="w-4 h-4 text-white" />;
    }
    if (event.type === 'communication') {
      if (event.metadata?.channel === 'whatsapp') return <MessageCircle className="w-4 h-4 text-white" />;
      if (event.metadata?.channel === 'email') return <Mail className="w-4 h-4 text-white" />;
      return <MessageSquare className="w-4 h-4 text-white" />;
    }
    return <Info className="w-4 h-4 text-white" />;
  };

  const getIconColor = (event: any) => {
    if (event.type === 'application_created') return 'bg-purple-500';
    if (event.type === 'stage_change') return 'bg-blue-500';
    if (event.type === 'communication') {
      if (event.metadata?.direction === 'inbound') return 'bg-green-500'; // Received reply
      return 'bg-blue-400'; // Sent message
    }
    return 'bg-gray-400';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={handleClose} 
      />
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-bright">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Candidate Timeline</h2>
            <p className="text-sm text-text-secondary">Complete history and activity log</p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-surface-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          {events === undefined ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-disabled text-sm">
              <Clock className="w-10 h-10 mb-2 opacity-50" />
              <p>No timeline events found.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-border ml-3 mt-2">
              {events.map((event: any, index: number) => (
                <div key={event.id} className="mb-8 relative pl-6">
                  {/* Timeline Dot/Icon */}
                  <div className={`absolute -left-[17px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full border-4 border-surface ${getIconColor(event)} shadow-sm`}>
                    {renderIcon(event)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-text-secondary mb-0.5">
                      {format(new Date(event.timestamp), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary">{event.title}</h3>
                    
                    {event.description && (
                      <div className="mt-2 text-[13px] text-text-secondary bg-surface-container/50 p-3 rounded-lg border border-border whitespace-pre-wrap">
                        {event.description}
                      </div>
                    )}

                    {/* Metadata tags */}
                    {event.type === 'communication' && event.metadata?.status && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ['delivered', 'read', 'replied'].includes(event.metadata.status) 
                            ? 'bg-green-500/10 text-green-600'
                            : event.metadata.status === 'failed'
                            ? 'bg-red-500/10 text-red-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {event.metadata.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
