"use client";

import { useTwinStore } from "@/lib/store";
import MemberTwin from "@/components/MemberTwin";

export default function TwinsHub() {
  const { household, activeMember, setActiveMember } = useTwinStore();
  const members = household?.members ?? [];

  // Default to first member if none selected
  const displayMember = activeMember ?? (members.length > 0 ? members[0].role_label : null);
  const displayMemberId = members.find((m) => m.role_label === displayMember)?.id;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6 bg-slate-50">
      {/* Top tabs for members */}
      <div className="flex gap-2 z-10 shrink-0">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMember(m.role_label)}
            className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm ${
              displayMember === m.role_label
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {m.role_label}
          </button>
        ))}
      </div>

      {/* Main Bento Profile */}
      <div className="flex-1 overflow-hidden z-10 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        {displayMemberId ? (
          <MemberTwin memberId={displayMemberId} onBack={() => setActiveMember(null)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium animate-pulse">
            Loading profile data...
          </div>
        )}
      </div>
    </div>
  );
}
