"use client";

import React, { useState, KeyboardEvent, ClipboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface SkillsInputProps {
  skills: string[] | string;
  onChange: (skills: string[]) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  maxSkills?: number;
  className?: string;
  disabled?: boolean;
}

export function SkillsInput({
  skills,
  onChange,
  label,
  placeholder = "Type a skill and press Enter, comma, or click Add...",
  required = false,
  maxSkills,
  className = "",
  disabled = false,
}: SkillsInputProps) {
  const [inputValue, setInputValue] = useState("");

  // Normalize skills prop to string array
  const skillList: string[] = Array.isArray(skills)
    ? skills
    : typeof skills === 'string' && skills.trim()
    ? skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const addSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;

    // Check if comma-separated values were typed/added
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      const newSkills = [...skillList];
      parts.forEach(part => {
        if (part && !newSkills.some(s => s.toLowerCase() === part.toLowerCase())) {
          newSkills.push(part);
        }
      });
      onChange(newSkills);
    } else {
      // Single skill
      if (!skillList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
        if (!maxSkills || skillList.length < maxSkills) {
          onChange([...skillList, trimmed]);
        }
      }
    }
    setInputValue("");
  };

  const removeSkill = (indexToRemove: number) => {
    onChange(skillList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(inputValue);
    } else if (e.key === 'Backspace' && inputValue === "" && skillList.length > 0) {
      removeSkill(skillList.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      addSkill(pastedText);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    addSkill(inputValue);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex flex-col gap-2 p-2.5 bg-surface border border-border rounded-lg focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container transition-all">
        {/* Active Skill Tags Display */}
        {skillList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-border/50">
            {skillList.map((skill, idx) => (
              <span
                key={`${skill}-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF5EC] text-[#1B5E20] border border-[#CDE5D2] transition-all hover:bg-[#D6EBD9]"
              >
                <span>{skill}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeSkill(idx)}
                    className="text-[#1B5E20] hover:text-red-600 rounded-full p-0.5 transition-colors focus:outline-none"
                    title={`Remove ${skill}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Input Bar with inline Add Button */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={skillList.length === 0 ? placeholder : "Add another skill..."}
            disabled={disabled || (maxSkills ? skillList.length >= maxSkills : false)}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled outline-none border-none px-1 py-0.5"
          />
          <button
            type="button"
            onClick={handleAddClick}
            disabled={!inputValue.trim() || disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary-container/10 text-primary-container hover:bg-primary-container hover:text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>
      <p className="text-[11px] text-text-disabled">
        Type a skill and press Enter, comma, or click Add. Pasted comma-separated skills will auto-split.
      </p>
    </div>
  );
}
