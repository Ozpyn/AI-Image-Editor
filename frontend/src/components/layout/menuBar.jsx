import { Download, Sparkles, Undo2, Redo2, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function MenuBar({
  activeTool,
  onToolSelect,
  onExport,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) {
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false);
  const aiMenuRef = useRef(null);

  useEffect(() => {
    if (!aiDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target)) {
        setAiDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aiDropdownOpen]);

  return (
    <header className="relative z-[1200] h-14 w-full border-b border-white/10 bg-panel/70 backdrop-blur supports-backdrop-filter:bg-panel/50">
      <div className="mx-auto flex h-full max-w-400 items-center justify-between px-3 md:px-4">
        {/* Left: App + Menus */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold tracking-wide">Big AI Photo Editor</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <MenuItem label="File" />
            <MenuItem label="Edit" />
            <MenuItem label="Image" />

            <div ref={aiMenuRef} className="relative">
              <MenuItem
                label="AI Tools"
                active={aiDropdownOpen || activeTool?.startsWith("ai.")}
                onClick={() => setAiDropdownOpen((prev) => !prev)}
                icon={
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      aiDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                }
              />

              {aiDropdownOpen && (
                <div className="absolute left-0 top-full z-[1300] mt-1 w-48 rounded-lg border border-white/10 bg-panel/90 shadow-lg backdrop-blur">
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.inpaint");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Inpaint
                  </button>

                  <button
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.outpaint");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Outpaint
                  </button>

                  <button
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      onToolSelect("ai.deblur");
                      setAiDropdownOpen(false);
                    }}
                  >
                    Deblur
                  </button>

                  <button
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5"
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
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <IconPill
            icon={<Undo2 className="h-4 w-4" />}
            label="Undo"
            onClick={onUndo}
            disabled={!canUndo}
          />

          <IconPill
            icon={<Redo2 className="h-4 w-4" />}
            label="Redo"
            onClick={onRedo}
            disabled={!canRedo}
          />

          <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />

          <button
            type="button"
            onClick={onExport}
            className="hidden items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 md:flex"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ label, badge, onClick, active, icon }) {
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
        {icon ? <span className="inline-flex">{icon}</span> : null}
      </span>

      {badge ? (
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

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
          : "bg-white/5 hover:bg-white/10 text-gray-200",
      ].join(" ")}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}