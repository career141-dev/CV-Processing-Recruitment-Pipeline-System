import React from 'react';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface ErrorLogProps {
  showErrorLog: boolean;
  setShowErrorLog: (show: boolean) => void;
  errorCount: number;
}

export function ErrorLog({ showErrorLog, setShowErrorLog, errorCount }: ErrorLogProps) {
  return (
    <Card className={`mb-12 overflow-hidden flex flex-col transition-colors ${showErrorLog ? 'border-[#BA1A1A]/40' : 'border-[#BA1A1A]/20'}`} noPadding>
      <button 
        className="w-full px-6 py-4 flex justify-between items-center hover:bg-[#FFDAD6]/20 transition-colors bg-surface rounded-t-[10px]"
        onClick={() => setShowErrorLog(!showErrorLog)}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-[#BA1A1A]" size={20} />
          <h2 className="text-[14px] font-semibold text-text-primary">Parse Errors</h2>
          <span className="bg-[#BA1A1A] text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{errorCount}</span>
        </div>
        <ChevronDown 
          className={`transition-transform duration-200 text-text-secondary ${showErrorLog ? 'rotate-180' : ''}`} 
          size={20} 
        />
      </button>
      
      {showErrorLog && (
        <div className="border-t border-border bg-surface rounded-b-[10px]">
          <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[12px] text-[#BA1A1A] font-bold">11:30:22 - Image quality too low</span>
              <span className="text-[13px] text-text-secondary">Could not extract text from "cv_draft_v2.pdf". Scan is too blurry for OCR processing.</span>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-[11px] font-semibold tracking-wider border border-border rounded-lg hover:bg-background">DISMISS</button>
              <button className="px-3 py-1.5 text-[11px] font-semibold tracking-wider bg-[#00450D] text-on-primary rounded-lg hover:opacity-90">RETRY</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
