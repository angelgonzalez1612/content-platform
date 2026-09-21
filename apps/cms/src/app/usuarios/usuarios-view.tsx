"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import type { AuthUser, UserRole } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

const ROLE_LABELS: Record<UserRole, string> = { admin: "Administrador", editor: "Editor" };

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
        role === "admin" ? "bg-ink text-white" : "bg-[#F3F0EC] text-[#5C564F]"
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function UsuariosView({ initialUsers, currentUser }: { initialUsers: AuthUser[]; currentUser: AuthUser }) {
  const [users, setUsers] = useState(initialUsers);
  const isAdmin = currentUser.role === "admin";

  const [creating, setCreating] = useState(false);
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const admins = users.filter((u) => u.role === "admin").length;

  async function updateRole(user: AuthUser, role: UserRole) {
    if (role === user.role) return;
    setRoleSaving(user.id);
    setRowError(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        setRowError({ id: user.id, message: await parseError(res, "No se pudo actualizar el rol.") });
        return;
      }
      const updated: AuthUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setRowError({ id: user.id, message: "No se pudo conectar con el servidor." });
    } finally {
      setRoleSaving(null);
    }
  }

  async function deleteUser(id: string) {
    setDeleting(id);
    setRowError(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        setRowError({ id, message: await parseError(res, "No se pudo eliminar el usuario.") });
        setConfirmDeleteId(null);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setRowError({ id, message: "No se pudo conectar con el servidor." });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-[18px] flex flex-wrap items-end gap-4">
        <div>
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">Usuarios</h1>
          <p className="text-[13.5px] text-ink-soft">Quién tiene acceso al CMS y qué puede hacer.</p>
        </div>
        <div className="flex-1" />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-[10px] bg-brand px-[15px] py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            <Icon d="M12 5v14M5 12h14" size={14} strokeWidth={2} />
            Nuevo usuario
          </button>
        )}
      </div>

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-border">
        {[
          { label: "Total", value: users.length },
          { label: "Administradores", value: admins },
          { label: "Editores", value: users.length - admins },
        ].map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col gap-2 bg-card px-4 pt-[15px] pb-3.5">
            <span className="text-[11.5px] text-[#8A837B]">{k.label}</span>
            <span className="text-[23px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[1fr_180px_140px_120px] items-center gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
            <span>Usuario</span>
            <span>Rol</span>
            <span>Miembro desde</span>
            <span className="text-right">Acciones</span>
          </div>

          {users.map((u) => {
            const isSelf = u.id === currentUser.id;
            const error = rowError?.id === u.id ? rowError.message : null;
            return (
              <div key={u.id} className="grid min-w-[640px] grid-cols-[1fr_180px_140px_120px] items-center gap-0 border-b border-border-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[#FEFCFA]">
                <div className="flex min-w-0 items-center gap-2.5 pr-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{initials(u.name)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
                      {u.name}
                      {isSelf && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-brand">Tú</span>}
                    </span>
                    <span className="truncate text-[12px] text-ink-faint">{u.email}</span>
                  </div>
                </div>

                <div>
                  {isAdmin && !isSelf ? (
                    <select
                      value={u.role}
                      disabled={roleSaving === u.id}
                      onChange={(e) => updateRole(u, e.target.value as UserRole)}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-[12px] font-medium text-ink outline-none transition-colors focus:border-brand disabled:opacity-50"
                    >
                      <option value="editor">Editor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  ) : (
                    <RoleBadge role={u.role} />
                  )}
                  {error && <p className="mt-1 max-w-[220px] text-[11px] text-negative">{error}</p>}
                </div>

                <span className="font-mono text-[11px] text-ink-faint">{formatDate(u.createdAt)}</span>

                <div className="flex justify-end">
                  {!isAdmin || isSelf ? (
                    <span className="text-[11px] text-ink-faint">—</span>
                  ) : confirmDeleteId === u.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        className="rounded-md bg-negative px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#B03A30] disabled:opacity-60"
                      >
                        {deleting === u.id ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-faint hover:bg-[#F5F3F0]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="inline-flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-[#FDECEA] hover:text-negative"
                    >
                      <Icon d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" size={14} strokeWidth={1.6} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, user]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: AuthUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        setError(await parseError(res, "No se pudo crear el usuario."));
        return;
      }
      onCreated(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[16px] border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(23,20,17,.28)]"
      >
        <h2 className="mb-1 text-[17px] font-semibold tracking-tight">Nuevo usuario</h2>
        <p className="mb-4 text-[12.5px] text-ink-soft">Se crea con esta contraseña — compártesela para que inicie sesión y la cambie después.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="new-user-name">Nombre</label>
            <input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="new-user-email">Correo</label>
            <input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="new-user-password">Contraseña temporal</label>
            <input
              id="new-user-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={fieldClass}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="new-user-role">Rol</label>
            <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={fieldClass}>
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {error && <p className="text-[12.5px] text-negative">{error}</p>}

          <div className="mt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-ink-soft hover:bg-[#F5F3F0]">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {submitting ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
