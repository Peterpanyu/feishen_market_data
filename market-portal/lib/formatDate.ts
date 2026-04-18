const TZ = "Asia/Shanghai";

/** 格式化为北京时间（东八区）日期时间字符串，如 `2026-04-17 14:30:05` */
export function formatDateTimeBeijing(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(d)
    .replace("T", " ");
}
