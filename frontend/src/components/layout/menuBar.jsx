// Import icons used in the menu bar
import {
  Download,
  Sparkles,
  Undo2,
  Redo2,
  ChevronDown,
} from "lucide-react";

// Import React hooks used by this component
import { useState, useEffect, useRef } from "react";

// Define the top menu bar component
export default function MenuBar({
  // Current active tool
  activeTool,

  // Callback used to select tools from the menu
  onToolSelect,

  // Callback used to export the image
  onExport,

  // Callback used to undo
  onUndo,

  // Callback used to redo
  onRedo,

  // Callback used to open a selected file
  onOpenFile,

  // Whether undo is available
  canUndo = false,

  // Whether redo is available
  canRedo = false,
}) {
  // Controls whether the AI tools dropdown is visible
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false);

  // Ref for detecting clicks outside the AI menu
  const aiMenuRef = useRef(null);

  // Ref to the hidden file input used for importing images
  const fileInputRef = useRef(null);

  // Attach outside-click listener only while the AI dropdown is open
  useEffect(() => {
    // Do nothing if the AI dropdown is closed
    if (!aiDropdownOpen) return;

    // Close the AI dropdown when the user clicks outside it
    const handleClickOutside = (event) => {
      // If click target is outside the dropdown, close it
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target)) {
        setAiDropdownOpen(false);
      }
    };

    // Listen for mouse clicks anywhere in the document
    document.addEventListener("mousedown", handleClickOutside);

    // Remove the listener on cleanup
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aiDropdownOpen]);

  // Opens the system file picker when the File button is clicked
  const handleFileClick = () => {
    // Trigger hidden file input click
    fileInputRef.current?.click();
  };

  // Sends the selected image file to the parent component
  const handleFileChange = async (event) => {
    // Read the first selected file
    const file = event.target.files?.[0];

    // Stop if no file was selected
    if (!file) return;

    try {
      // Forward the selected file to the parent
      await onOpenFile?.(file);
    } finally {
      // Reset input so selecting the same file again still triggers onChange
      event.target.value = "";
    }
  };

  // Render the menu bar
  return (
    // Outer header wrapper
    <header className="relative z-[1200] h-14 w-full border-b border-white/10 bg-panel/70 backdrop-blur supports-backdrop-filter:bg-panel/50">
      {/* Content container */}
      <div className="mx-auto flex h-full max-w-400 items-center justify-between px-3 md:px-4">
        {/* Left section: app name and menu items */}
        <div className="flex items-center gap-3">
          {/* App title badge */}
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
            {/* Decorative app icon */}
            <Sparkles className="h-4 w-4 text-accent" />

            {/* App title text */}
            <span className="text-sm font-semibold tracking-wide">
              Big AI Photo Editor
            </span>
          </div>

          {/* Desktop-only navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {/* Hidden input used by File button */}
            <input
              // Attach hidden file input ref
              ref={fileInputRef}
              // File input type
              type="file"
              // Allow only images
              accept="image/*"
              // Keep hidden from UI
              className="hidden"
              // Handle file selection
              onChange={handleFileChange}
            />

            {/* File menu item */}
            <MenuItem label="File" onClick={handleFileClick} />

            {/* AI tools dropdown wrapper */}
            <div ref={aiMenuRef} className="relative">
              {/* AI tools menu button */}
              <MenuItem
                // Button text
                label="AI Tools"
                // Highlight when open or when an AI tool is active
                active={aiDropdownOpen || activeTool?.startsWith("ai.")}
                // Toggle the dropdown
                onClick={() => setAiDropdownOpen((prev) => !prev)}
                // Dropdown arrow icon
                icon={
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      aiDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                }
              />

              {/* Dropdown menu */}
              {aiDropdownOpen && (
                <div className="absolute left-0 top-full z-[1300] mt-1 w-48 rounded-lg border border-white/10 bg-panel/90 shadow-lg backdrop-blur">
                  {/* Inpaint action */}
                  <button
                    type="button"
                    className="w-full px-3 py-2 mb-1 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.inpaint");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Inpaint
                  </button>

                  {/* Outpaint action */}
                  <button
                    type="button"
                    className="w-full px-3 py-2 mb-1 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.outpaint");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Outpaint
                  </button>

                  {/* Deblur action */}
                  <button
                    type="button"
                    className="w-full px-3 py-2 mb-1 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.deblur");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Deblur
                  </button>

                  {/* Background Magic action */}
                  <button
                    type="button"
                    className="w-full px-3 py-2 mb-1 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.backgroundmagic");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Background Magic
                  </button>
                </div>
              )}
            </div>

            {/* Export item */}
            <MenuItem
              label="Export"
              onClick={onExport}
              icon={<Download className="h-3.5 w-3.5" />}
            />
          </nav>
        </div>

        {/* Right section: undo / redo */}
        <div className="flex items-center gap-1.5">
          {/* Undo button */}
          <IconPill
            icon={<Undo2 className="h-4 w-4" />}
            label="Undo"
            onClick={onUndo}
            disabled={!canUndo}
          />

          {/* Redo button */}
          <IconPill
            icon={<Redo2 className="h-4 w-4" />}
            label="Redo"
            onClick={onRedo}
            disabled={!canRedo}
          />
        </div>
      </div>
    </header>
  );
}

// Reusable top navigation item
function MenuItem({ label, onClick, active, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-lg px-3 py-2 text-sm hover:bg-white/5",
        active ? "bg-white/10 text-white" : "text-gray-200",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {icon ? <span>{icon}</span> : null}
      </span>
    </button>
  );
}

// Reusable action button used for undo and redo
function IconPill({ icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={[
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
        disabled
          ? "cursor-not-allowed bg-white/5 text-gray-500 opacity-50"
          : "bg-white/5 text-gray-200 hover:bg-white/10",
      ].join(" ")}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}