{/*Lets import our icons from lucide*/}
import { FileImage,Download, Sparkles, Undo2, Redo2 } from "lucide-react";

export default function MenuBar({ onExport }) {
  return (
    <header className="h-14 w-full border-b border-white/10 bg-panel/70 backdrop-blur supports-backdrop-filter:bg-panel/50 relative" style={{ zIndex: 1000 }}>
      <div className="mx-auto flex h-full max-w-400 items-center justify-between px-3 md:px-4">
        {/* Left: App + Menus */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg  px-2.5 py-1.5">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold tracking-wide text-white">Big AI Photo Editor</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <MenuItem label="File" />
            <MenuItem label="Edit" />
            <MenuItem label="Image" />
            
            {/* AI Tools Dropdown */}
            <div className="relative" style={{ zIndex: 1001 }}>
              <button
                ref={buttonRef}
                onClick={() => setIsAiDropdownOpen(!isAiDropdownOpen)}
                className={[
                  "flex items-center gap-1 rounded-lg px-3 py-2 text-sm",
                  "hover:bg-white/10 transition-colors",
                  activeTool?.startsWith("ai.") || isAiDropdownOpen 
                    ? "bg-accent text-white" 
                    : "text-gray-200"
                ].join(" ")}
                type="button"
              >
                <span>AI Tools</span>
                <ChevronDown className={[
                  "h-4 w-4 transition-transform",
                  isAiDropdownOpen ? "rotate-180" : ""
                ].join(" ")} />
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300">
                  Beta
                </span>
              </button>

              {/* Dropdown Menu */}
              {isAiDropdownOpen && (
                <>
                  {/* Backdrop to block canvas interactions */}
                  <div 
                    className="fixed inset-0" 
                    style={{ zIndex: 999 }}
                    onClick={() => setIsAiDropdownOpen(false)}
                  />
                  
                  {/* Actual Dropdown */}
                  <div 
                    ref={dropdownRef}
                    className="absolute left-0 top-full mt-1 w-80 rounded-lg border border-white/10 bg-panel/95 backdrop-blur shadow-xl"
                    style={{ 
                      zIndex: 1002,
                      maxHeight: 'min(600px, calc(100vh - 100px))', 
                      overflowY: 'auto'
                    }}
                  >
                    {/* Prompt Input */}
                    <div className="p-3 border-b border-white/10">
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Enter your prompt (optional)..."
                        className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-accent"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      {aiMenuItems.map((item) => (
                        <div key={item.id} className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.requiresPrompt) {
                                if (activeAiAction === item.id) {
                                  // If already selected, execute the action
                                  handleAiAction(item.id, item.defaultPrompt);
                                } else {
                                  // First click: show prompt and select
                                  setActiveAiAction(item.id);
                                }
                              } else {
                                // No prompt needed, execute immediately
                                handleAiAction(item.id, item.defaultPrompt);
                              }
                            }}
                            onMouseEnter={() => !item.requiresPrompt && setActiveAiAction(item.id)}
                            onMouseLeave={() => !item.requiresPrompt && setActiveAiAction(null)}
                            className={[
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                              "hover:bg-white/10",
                              activeAiAction === item.id ? "bg-accent/20 border border-accent/50" : "",
                              aiLoading ? "opacity-50 cursor-not-allowed" : ""
                            ].join(" ")}
                            disabled={aiLoading}
                            title={item.tooltip}
                            type="button"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-gray-200">{item.label}</span>
                              {item.requiresPrompt && (
                                <span className="text-xs text-gray-400">
                                  {activeAiAction === item.id ? 'Click again to confirm' : 'Click to select'}
                                </span>
                              )}
                            </div>
                            {activeAiAction === item.id && item.requiresPrompt && (
                              <div className="mt-1 text-xs text-gray-400">
                                Using: "{aiPrompt || item.defaultPrompt}"
                              </div>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Info Footer */}
                    <div className="p-2 border-t border-white/10 bg-white/5">
                      <p className="text-xs text-gray-400">
                        {activeAiAction 
                          ? "Click again to confirm with current prompt" 
                          : "Select an AI tool to get started"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <IconPill icon={<Undo2 className="h-4 w-4" />} label="Undo" />
          <IconPill icon={<Redo2 className="h-4 w-4" />} label="Redo" />

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

function MenuItem({ label, badge, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-lg px-3 py-2 text-sm hover:bg-white/5",
        active ? "bg-white/10 text-white" : "text-gray-200",
      ].join(" ")}
    >
      {label}
      {badge && (
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300">
          {badge}
        </span>
      )}
    </button>
  );
}

function IconPill({ icon, label }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-sm hover:bg-white/10"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}