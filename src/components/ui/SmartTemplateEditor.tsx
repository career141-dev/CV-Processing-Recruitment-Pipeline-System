import React, { useRef, useEffect, useCallback } from 'react';

interface SmartTemplateEditorProps {
  value: string;
  onChange: (val: string) => void;
  requiredVariables?: string[];
  rows?: number;
  placeholder?: string;
  label?: string;
}

const AVAILABLE_VARIABLES = [
  { label: 'Candidate Name', example: 'e.g. John', tag: '{candidate_name}' },
  { label: 'Job Title', example: 'e.g. Software Engineer', tag: '{job_title}' },
  { label: 'Missing Details', example: 'e.g. CV, Salary', tag: '{missing_fields}' },
  { label: 'Company Name', example: 'e.g. Career141', tag: '{company_name}' },
];

export function SmartTemplateEditor({ value, onChange, requiredVariables = [], rows = 8, placeholder, label }: SmartTemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string>(value);

  // Parse raw value (with {tags}) into HTML (with non-editable pills)
  const renderToHTML = useCallback((text: string) => {
    if (!text) return '';
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    
    AVAILABLE_VARIABLES.forEach(v => {
      const regex = new RegExp(v.tag, 'g');
      const pillHtml = `<span contenteditable="false" class="inline-flex items-center gap-1 bg-primary-container/20 text-primary-container px-1.5 py-0.5 mx-0.5 rounded font-bold text-[11px] align-middle select-all border border-primary-container/30 shadow-sm" data-tag="${v.tag}"><span class="material-symbols-outlined text-[10px]">data_object</span>${v.label}</span>`;
      html = html.replace(regex, pillHtml);
    });
    
    return html;
  }, []);

  // Sync external changes (e.g. initial load or parent state change not caused by us)
  useEffect(() => {
    if (value !== lastEmittedValue.current && editorRef.current) {
      editorRef.current.innerHTML = renderToHTML(value);
      lastEmittedValue.current = value;
    }
    // Set initial if empty
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = renderToHTML(value);
      lastEmittedValue.current = value;
    }
  }, [value, renderToHTML]);

  // Read HTML from editor and emit raw text
  const handleInput = () => {
    if (!editorRef.current) return;
    
    let rawText = '';
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        rawText += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'BR') {
          rawText += '\n';
        } else if (el.tagName === 'DIV' || el.tagName === 'P') {
          if (rawText.length > 0 && !rawText.endsWith('\n')) rawText += '\n';
          Array.from(node.childNodes).forEach(traverse);
        } else if (el.dataset && el.dataset.tag) {
          rawText += el.dataset.tag;
        } else {
          Array.from(node.childNodes).forEach(traverse);
        }
      }
    };
    
    Array.from(editorRef.current.childNodes).forEach(traverse);
    
    // Avoid emitting if it's the same, prevents React from fighting the DOM
    if (rawText !== lastEmittedValue.current) {
      lastEmittedValue.current = rawText;
      onChange(rawText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, tag: string) => {
    e.dataTransfer.setData('text/plain', tag);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const tag = e.dataTransfer.getData('text/plain');
    const variable = AVAILABLE_VARIABLES.find(v => v.tag === tag);
    
    if (variable && editorRef.current) {
      const pillHtml = `<span contenteditable="false" class="inline-flex items-center gap-1 bg-primary-container/20 text-primary-container px-1.5 py-0.5 mx-0.5 rounded font-bold text-[11px] align-middle select-all border border-primary-container/30 shadow-sm" data-tag="${variable.tag}"><span class="material-symbols-outlined text-[10px]">data_object</span>${variable.label}</span>`;
      
      editorRef.current.focus();
      
      // Attempt to place cursor exactly where dropped
      let range;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      }
      
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      
      document.execCommand('insertHTML', false, pillHtml + ' '); // add a space after for convenience
      handleInput(); // Trigger sync
    }
  };

  // Click to insert
  const insertVariableClick = (tag: string) => {
    if (!editorRef.current) return;
    const variable = AVAILABLE_VARIABLES.find(v => v.tag === tag);
    if (!variable) return;
    
    editorRef.current.focus();
    const pillHtml = `<span contenteditable="false" class="inline-flex items-center gap-1 bg-primary-container/20 text-primary-container px-1.5 py-0.5 mx-0.5 rounded font-bold text-[11px] align-middle select-all border border-primary-container/30 shadow-sm" data-tag="${variable.tag}"><span class="material-symbols-outlined text-[10px]">data_object</span>${variable.label}</span>`;
    
    document.execCommand('insertHTML', false, pillHtml + ' ');
    handleInput();
  };

  const missingRequirements = requiredVariables.filter(v => !value.includes(v));

  // Determine minimum height based on rows
  const minHeight = `${rows * 1.5}rem`;

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-semibold text-text-primary block">{label}</label>}
      
      <div className="border border-border rounded-lg overflow-hidden bg-surface focus-within:ring-1 focus-within:ring-primary-container transition-all">
        
        {/* The Visual Editor */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="w-full text-sm p-3 bg-transparent text-text-primary outline-none font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap break-words"
          style={{ minHeight, maxHeight: '300px' }}
          placeholder={placeholder}
          data-placeholder={placeholder}
        />
        
        {/* The Toolbar */}
        <div className="bg-surface-container-low border-t border-border p-2 flex flex-wrap gap-1.5 items-center select-none">
          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-bold mr-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">touch_app</span>
            Drag & Drop:
          </span>
          {AVAILABLE_VARIABLES.map((v) => (
            <button
              key={v.tag}
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, v.tag)}
              onClick={() => insertVariableClick(v.tag)}
              className="cursor-grab active:cursor-grabbing text-[10px] font-semibold px-2 py-1 rounded-md bg-surface border border-border text-text-primary hover:border-primary-container hover:text-primary-container transition-all flex items-center gap-1 shadow-sm"
              title="Drag me into the editor, or click to insert at cursor"
            >
              <span className="material-symbols-outlined text-[12px] opacity-70">drag_indicator</span>
              {v.label}
              {v.example && (
                <span className="text-[9px] text-text-secondary font-normal ml-0.5 opacity-70 border-l border-border pl-1.5 hidden sm:inline">
                  {v.example}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Warning for missing required variables */}
      {missingRequirements.length > 0 && value.trim().length > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded border border-amber-200 dark:border-amber-800/50">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          Warning: Template should include {missingRequirements.join(', ')}
        </p>
      )}

      {/* CSS for empty placeholder state */}
      <style dangerouslySetInnerHTML={{__html: `
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block;
        }
      `}} />
    </div>
  );
}
