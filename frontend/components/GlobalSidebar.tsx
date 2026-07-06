"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const Icons: Record<string, React.FC> = {
  hub: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <rect x="3" y="3" width="7" height="9" rx="1"></rect>
       <rect x="14" y="3" width="7" height="5" rx="1"></rect>
       <rect x="14" y="12" width="7" height="9" rx="1"></rect>
       <rect x="3" y="16" width="7" height="5" rx="1"></rect>
    </svg>
  ),
  twins: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  insights: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <path d="M12 2v20"></path>
       <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  records: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
       <polyline points="14 2 14 8 20 8"></polyline>
       <line x1="16" y1="13" x2="8" y2="13"></line>
       <line x1="16" y1="17" x2="8" y2="17"></line>
       <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "hub", label: "Dashboard", icon: "hub", path: "/" },
  { id: "twins", label: "Family Profiles", icon: "twins", path: "/twins" },
  { id: "insights", label: "Analytics", icon: "insights", path: "/insights" },
  { id: "records", label: "Documents", icon: "records", path: "/records" },
];

export default function GlobalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] h-full bg-slate-900 flex flex-col shrink-0 border-r border-slate-800 shadow-xl hidden md:flex">
      {/* Brand */}
      <div className="h-20 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            HT
          </div>
          <span className="font-bold text-lg text-white tracking-tight">HealthTwin</span>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
        <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Main Menu</p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
          const Icon = Icons[item.icon];
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className={isActive ? "text-white" : "text-slate-400"}>
                <Icon />
              </div>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer / User */}
      <div className="p-4 border-t border-slate-800">
         <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs border border-slate-600">
               U
            </div>
            <div>
               <p className="text-sm font-semibold text-slate-200">Admin User</p>
               <p className="text-xs text-slate-500">Premium Account</p>
            </div>
         </div>
      </div>
    </aside>
  );
}
