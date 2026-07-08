export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse" style={{ background: "var(--canvas)" }}>
      {/* Time block skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-10 w-36 rounded-xl" style={{ background: "var(--surface-sunk)" }} />
          <div className="h-4 w-48 rounded-lg" style={{ background: "var(--surface-sunk)" }} />
        </div>
        <div className="h-8 w-14 rounded-xl" style={{ background: "var(--surface-sunk)" }} />
      </div>
      {/* Card skeleton */}
      <div className="h-28 w-full rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
      {/* Constellation skeleton */}
      <div className="h-56 w-full rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
      {/* Two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
        <div className="h-20 rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
        <div className="h-20 rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
        <div className="h-20 rounded-2xl" style={{ background: "var(--surface-sunk)" }} />
      </div>
    </div>
  );
}
