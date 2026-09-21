import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsUsers } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { UsuariosView } from "./usuarios-view";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const users = await getCmsUsers();

  return (
    <CmsShell user={session} title="Usuarios">
      <UsuariosView initialUsers={users} currentUser={session} />
    </CmsShell>
  );
}
