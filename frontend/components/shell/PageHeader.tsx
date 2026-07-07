import { ReactNode } from "react";
import CommandPalette from "@/components/CommandPalette";
import { useTwinStore } from "@/lib/store";

export default function PageHeader({
  title,
  subtitle,
  action,
  onCommand,
  onScan,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  onCommand?: (cmd: string) => void;
  onScan?: () => void;
}) {
  const { household, setActiveMember } = useTwinStore();
  const members = household?.members ?? [];

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div>
        <h2 className="text-[22px] md:text-[28px] font-bold leading-tight" style={{ color: "var(--ink)" }}>{title}</h2>
        <p className="text-sm font-medium mt-1" style={{ color: "var(--ink-soft)" }}>{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        {action}
        <div className="flex-1 md:flex-initial flex justify-end">
          <CommandPalette
            members={members}
            onCommand={(t) => onCommand?.(t)}
            onSelectMember={setActiveMember}
            onScan={onScan || (() => {})}
          />
        </div>
      </div>
    </header>
  );
}
