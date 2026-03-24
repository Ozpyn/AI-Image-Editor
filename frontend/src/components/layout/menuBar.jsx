{/*Lets import our icons from lucide*/}
import { FileImage,Download, Sparkles, Undo2, Redo2 } from "lucide-react";

export default function MenuBar({ onExport }) {
  return (
    <header className="h-14 w-full border-b border-white/10 bg-panel/90 backdrop-blur supports-backdrop-filter:bg-panel/0 relative" style={{ zIndex: 1000 }}>
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
                  "flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors",
                  "hover:bg-white/10",
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
                    style={{ zIndex: 10 }}
                    onClick={() => setIsAiDropdownOpen(false)}
                  />
                  
                  {/* Actual Dropdown */}
                  <div 
                    ref={dropdownRef}
                    className="absolute left-0 top-full mt-1 mb-2 w-60 rounded-2xl border border-white/10  shadow-xl"
                    style={{ 
                      zIndex: 10,
                      maxHeight: 'min(600px, calc(100vh - 100px))', 
                      overflowY: 'auto'
                    }}
                  >
                    {/* Prompt Input - Only show for actions that need it */}
                    <div className="p-3 border-b border-white/10">
                      <input
                        ref={inputRef}
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            // Find first prompt-requiring item
                            const firstPromptItem = aiMenuItems.find(item => item.requiresPrompt);
                            if (firstPromptItem) {
                              handleAiAction(firstPromptItem.id, firstPromptItem.defaultPrompt);
                            }
                          }
                        }}
                        placeholder="Enter prompt (optional)..."
                        className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                      
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      {aiMenuItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleAiAction(item.id, item.defaultPrompt)}
                          className={[
                            "w-full text-left px-3 py-3 mb-2 rounded-lg text-sm transition-colors",
                            "hover:bg-gray-800",
                            aiLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                            item.id === 'outpaint' ? "border-l-2 border-accent" : "" // Highlight extend as special
                          ].join(" ")}
                          disabled={aiLoading}
                          title={item.tooltip}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">{item.label}</span>
                            {item.requiresPrompt && aiPrompt && (
                              <span className="text-xs text-gray-400 ml-2" title={aiPrompt}>
                                "{aiPrompt.substring(0, 15)}{aiPrompt.length > 15 ? '…' : ''}"
                              </span>
                            )}
                            {item.id === 'outpaint' && (
                              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                                Opens panel
                              </span>
                            )}
                          </div>
                         
                        </button>
                      ))}
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