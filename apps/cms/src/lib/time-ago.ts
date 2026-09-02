export function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.round(hrs / 24)} d`;
}
