import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCalendarMonth } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { CalendarView } from "./calendar-view";

export default async function CalendarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const items = await getCalendarMonth(year, month);

  return (
    <CmsShell user={session} title="Calendario Editorial">
      <CalendarView initialItems={items} initialYear={year} initialMonth={month} />
    </CmsShell>
  );
}
