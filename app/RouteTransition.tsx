"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [display, setDisplay] = useState(true);

  useEffect(() => {
    setDisplay(true);
    const t = setTimeout(() => setDisplay(false), 100);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="relative min-h-full">
      {children}
      {display && <div className="route-reveal pointer-events-none fixed inset-0 z-[70] bg-white/10" />}
    </div>
  );
}
