import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileCode, FileText } from 'lucide-react';

interface ExportDropdownProps {
  onExportJson: () => void;
  onExportPdf: () => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  className?: string;
  title?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  onExportJson,
  onExportPdf,
  label = 'EXPORT',
  variant = 'secondary',
  className = '',
  title = 'Export options (JSON or PDF)',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleJsonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onExportJson();
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onExportPdf();
  };

  if (variant === 'primary') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          title={title}
          className="flex items-center gap-1.5 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold px-3 py-1.5 rounded-sm text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-[#12141A] border border-[#22262E] rounded-sm shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn">
            <button
              onClick={handleJsonClick}
              className="w-full px-3 py-2 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2.5 transition-colors cursor-pointer group"
            >
              <FileCode className="w-4 h-4 text-[#38BDF8] shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <span className="font-bold text-xs block text-white">JSON Format</span>
                <span className="text-[10px] text-[#94A3B8] block">Machine-readable JSON data</span>
              </div>
            </button>

            <div className="border-t border-[#22262E]/60 my-0.5" />

            <button
              onClick={handlePdfClick}
              className="w-full px-3 py-2 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2.5 transition-colors cursor-pointer group"
            >
              <FileText className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <span className="font-bold text-xs block text-white">PDF Document</span>
                <span className="text-[10px] text-[#94A3B8] block">Formatted audit PDF report</span>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          title={title}
          className="p-1 px-2 text-[#94A3B8] hover:text-white bg-[#0A0B0E] hover:bg-[#22262E] rounded border border-[#22262E] transition-colors text-xs font-mono cursor-pointer flex items-center gap-1"
        >
          <Download className="w-3 h-3 text-[#38BDF8]" />
          <span className="text-[10px] font-bold">EXPORT</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-44 bg-[#12141A] border border-[#22262E] rounded-sm shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn">
            <button
              onClick={handleJsonClick}
              className="w-full px-2.5 py-1.5 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="font-bold text-[11px]">JSON Format</span>
            </button>
            <button
              onClick={handlePdfClick}
              className="w-full px-2.5 py-1.5 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[11px]">PDF Document</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const isFullWidth = className.includes('w-full');

  // Default secondary button style
  return (
    <div className={`relative ${isFullWidth ? 'block w-full' : 'inline-block'} text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={title}
        className={`flex items-center gap-1.5 p-2 px-2.5 text-[#94A3B8] hover:text-white bg-[#0A0B0E] hover:bg-[#22262E] rounded border border-[#22262E] transition-colors text-xs font-mono cursor-pointer ${
          isFullWidth ? 'w-full justify-between' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span className="text-[11px] font-bold">{label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${isFullWidth ? 'left-0 right-0 w-full' : 'right-0 w-48'} mt-1 bg-[#12141A] border border-[#22262E] rounded-sm shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn`}>
          <button
            onClick={handleJsonClick}
            className="w-full px-3 py-2 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <FileCode className="w-4 h-4 text-[#38BDF8] shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <span className="font-bold text-xs block text-white">Export as JSON</span>
              <span className="text-[10px] text-[#94A3B8] block">Download JSON data file</span>
            </div>
          </button>

          <div className="border-t border-[#22262E]/60 my-0.5" />

          <button
            onClick={handlePdfClick}
            className="w-full px-3 py-2 text-left text-[#E2E8F0] hover:bg-[#22262E] flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <FileText className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <span className="font-bold text-xs block text-white">Export as PDF</span>
              <span className="text-[10px] text-[#94A3B8] block">Download formatted PDF</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
