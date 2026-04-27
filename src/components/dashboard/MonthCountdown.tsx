import { useEffect, useRef, useState } from "react";
import { Hourglass } from "lucide-react";

function getEndOfMonth(now: Date) {
  // Local time end-of-month — alinhado ao timezone do navegador.
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function diff(target: Date) {
  const now = Date.now();
  let ms = Math.max(0, target.getTime() - now);
  const days = Math.floor(ms / 86_400_000); ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000); ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000); ms -= minutes * 60_000;
  const seconds = Math.floor(ms / 1000);
  return { days, hours, minutes, seconds };
}

export function MonthCountdown() {
  const targetRef = useRef<Date>(getEndOfMonth(new Date()));
  const [t, setT] = useState(() => diff(targetRef.current));

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      // Reset automático quando vira o mês.
      if (now > targetRef.current) {
        targetRef.current = getEndOfMonth(now);
      }
      setT(diff(targetRef.current));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const cells = [
    { label: "dias", value: t.days },
    { label: "h", value: t.hours },
    { label: "min", value: t.minutes },
    { label: "seg", value: t.seconds },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <Hourglass className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
        encerra em
      </span>
      <div className="flex items-center gap-1">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="flex items-baseline gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-400/20"
          >
            <span className="text-sm font-bold text-yellow-300 tabular-nums leading-none">
              {String(c.value).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase text-yellow-400/70 leading-none">
              {c.label}
            </span>
            {i < cells.length - 1 && <span className="sr-only">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
