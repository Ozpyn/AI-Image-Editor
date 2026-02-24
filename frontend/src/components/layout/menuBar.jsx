{/*Lets import our icons from lucide*/}
import { FileImage, Download, Sparkles, Undo2, Redo2, User } from "lucide-react";

export default function MenuBar() {
  return (
    <header className="h-14 w-full border-b border-white/10 bg-panel/70 backdrop-blur supports-backdrop-filter:bg-panel/50">
      <div className="mx-auto flex h-full max-w-400 items-center justify-between px-3 md:px-4">
        {/* Left: App + Menus */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold tracking-wide">Big AI Photo Editor</span>
          </div>

          <nav className="hidden  items-center gap-1 md:flex">
            <MenuItem label="File" />
            <MenuItem label="Edit" />
            <MenuItem label="Image" />
            <MenuItem label="AI Tools" badge="Beta" />
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <IconPill icon={<Undo2 className="h-4 w-4" />} label="Undo" />
          <IconPill icon={<Redo2 className="h-4 w-4" />} label="Redo" />

          <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />

          <IconPill icon={<FileImage className="h-4 w-4" />} label="Import" />
          <button className="hidden items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 md:flex">
            <Download className="h-4 w-4" />
            Export
          </button>

        </div>
      </div>
    </header>
  );
}

function MenuItem({ label, badge }) {
  return (
    <button className="relative rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
      {label}
      {badge ? (
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function IconPill({ icon, label }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-sm hover:bg-white/10">
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
