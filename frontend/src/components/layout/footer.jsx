import { Grid3X3, Hand, Scan, Info } from "lucide-react";

export default function Footer() {
  return (
    <footer className="h-12 w-full border-t border-white/10 bg-panel/70 backdrop-blur supports-backdrop-filter:bg-panel/50">
      <div className="mx-auto flex h-full max-w-400 items-center justify-between px-3 md:px-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="rounded-md bg-white/5 px-2 py-1">4000 × 3000 px</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">Ready</span>
        </div>

        <div className="flex items-center gap-1">
          <IconBtn label="Grid" icon={<Grid3X3 className="h-4 w-4" />} />
          <IconBtn label="Pan" icon={<Hand className="h-4 w-4" />} />
          <IconBtn label="Scan" icon={<Scan className="h-4 w-4" />} />
          <div className="mx-1 h-6 w-px bg-white/10" />
          <IconBtn label="Info" icon={<Info className="h-4 w-4" />} />
        </div>
      </div>
    </footer>
  );
}

function IconBtn({ icon, label }) {
  return (
    <button
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
