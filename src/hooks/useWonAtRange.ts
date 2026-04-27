/**
 * Helpers centralizados para garantir que todo cálculo de
 * faturamento, conversão e meta utilize o campo `won_at`.
 *
 * NÃO altera lógica de backend. Apenas padroniza no frontend
 * a construção dos intervalos e a leitura do campo correto.
 */

export type DateRangePreset = "today" | "7d" | "30d" | "month";

export interface DateRange {
  start: Date;
  end: Date;
  /** ISO string para uso direto em filtros Supabase (.gte/.lte) */
  startISO: string;
  endISO: string;
  /** Apenas a parte YYYY-MM-DD, útil para colunas `date` (ex.: data_pagamento) */
  startDate: string;
  endDate: string;
  preset: DateRangePreset;
  label: string;
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Mês atual",
};

export function getDateRange(preset: DateRangePreset, ref: Date = new Date()): DateRange {
  let start: Date;
  let end: Date;

  switch (preset) {
    case "today": {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0);
      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
      break;
    }
    case "7d": {
      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "30d": {
      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
    default: {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
      break;
    }
  }

  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    preset,
    label: PRESET_LABELS[preset],
  };
}

/** Coluna canônica usada em todo o sistema para "ganho". */
export const WON_AT_COLUMN = "won_at" as const;

/** Filtra um array de leads por won_at dentro de um intervalo. */
export function filterWonInRange<T extends { won_at?: string | null; status?: string | null }>(
  leads: T[],
  range: DateRange,
): T[] {
  const s = range.start.getTime();
  const e = range.end.getTime();
  return leads.filter((l) => {
    if (l.status !== "fechado_ganho") return false;
    if (!l.won_at) return false;
    const t = new Date(l.won_at).getTime();
    return t >= s && t <= e;
  });
}
