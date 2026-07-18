'use client';

/**
 * Users section (admin-only; the chrome hides the tab and this pane behind the
 * `admin` role). Lists CMS users and drives the whole account lifecycle over
 * {@link AuthClient}'s user-admin ops: create (temp password + forced rotation),
 * edit (name/email/role/disabled), password reset, delete.
 *
 * Every mutation presents the row's last-read `updatedAt` (ADR 0009 CAS); a
 * CONFLICT reloads the list so the next attempt starts from fresh data. The
 * server enforces the lock-out guards (no self-demote/disable/delete) — the UI
 * mirrors them by disabling those controls on your own row.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ROLES,
  ROLE_LABELS,
  type CreateUserInput,
  type Role,
  type SafeUser,
} from '@usc/zero-cms-core';
import type { AuthClient } from './auth/auth-client';
import { useZeroCms } from './context';
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, cls, cx } from './components/ui';
import { errorMessage } from './util';

const MIN_PASSWORD_LENGTH = 8; // mirrors the server's floor (auth.ts)

type OpenForm =
  | { kind: 'create' }
  | { kind: 'edit'; user: SafeUser }
  | { kind: 'reset'; user: SafeUser }
  | null;

function displayName(u: SafeUser): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

function RoleSelect({
  value,
  onChange,
  disabled,
  title,
}: {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      disabled={disabled}
      title={title}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </Select>
  );
}

function CheckboxField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function FormCard({
  title,
  children,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className={cx(cls.card, 'space-y-3 p-4')} onSubmit={onSubmit}>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </form>
  );
}

function CreateUserForm({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: CreateUserInput) => void;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [password, setPassword] = useState('');
  const [forceUpdate, setForceUpdate] = useState(true);

  return (
    <FormCard
      title="New user"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({
          email,
          password,
          role,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          forcePasswordUpdate: forceUpdate,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <RoleSelect value={role} onChange={setRole} />
        </Field>
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <Field label="Temporary password" required>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>
      <CheckboxField checked={forceUpdate} onChange={setForceUpdate}>
        Require a password change on first login
      </CheckboxField>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create user'}
        </Button>
        <Button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </FormCard>
  );
}

function EditUserForm({
  user,
  isSelf,
  busy,
  onCancel,
  onSave,
}: {
  user: SafeUser;
  isSelf: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: {
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    disabled: boolean;
  }) => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [disabled, setDisabled] = useState(user.disabled ?? false);
  const selfGuard = isSelf ? 'You cannot change your own role or disable your own account' : undefined;

  return (
    <FormCard
      title={`Edit ${displayName(user)}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ email, firstName, lastName, role, disabled });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <RoleSelect value={role} onChange={setRole} disabled={isSelf} title={selfGuard} />
        </Field>
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      {!isSelf && (
        <CheckboxField checked={disabled} onChange={setDisabled}>
          Disabled (cannot log in)
        </CheckboxField>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </FormCard>
  );
}

function ResetPasswordForm({
  user,
  busy,
  onCancel,
  onReset,
}: {
  user: SafeUser;
  busy: boolean;
  onCancel: () => void;
  onReset: (newPassword: string, forceUpdate: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [forceUpdate, setForceUpdate] = useState(true);

  return (
    <FormCard
      title={`Reset password — ${displayName(user)}`}
      onSubmit={(e) => {
        e.preventDefault();
        onReset(password, forceUpdate);
      }}
    >
      <Field label="New temporary password" required>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>
      <CheckboxField checked={forceUpdate} onChange={setForceUpdate}>
        Require a password change on next login
      </CheckboxField>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset password'}
        </Button>
        <Button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </FormCard>
  );
}

export function UsersPanel({
  client,
  currentUser,
}: {
  client: AuthClient;
  currentUser: SafeUser;
}) {
  const { notify } = useZeroCms();
  const [users, setUsers] = useState<SafeUser[] | null>(null);
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await client.listUsers();
      setUsers([...list].sort((a, b) => a.email.localeCompare(b.email)));
    } catch (err) {
      setUsers([]);
      notify('error', errorMessage(err));
    }
  }, [client, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a mutation; on success toast + close forms + reload, on error toast + reload (CAS staleness). */
  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      notify('success', successMessage);
      setOpenForm(null);
      setConfirmDeleteId(null);
    } catch (err) {
      notify('error', errorMessage(err));
    } finally {
      setBusy(false);
      void load();
    }
  };

  if (users === null)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-neutral-900">Users</h2>
        {openForm?.kind !== 'create' && (
          <Button variant="primary" onClick={() => setOpenForm({ kind: 'create' })}>
            New user
          </Button>
        )}
      </div>

      {openForm?.kind === 'create' && (
        <CreateUserForm
          busy={busy}
          onCancel={() => setOpenForm(null)}
          onCreate={(input) =>
            run(() => client.createUser(input), `User "${input.email}" created`)
          }
        />
      )}

      {users.length === 0 ? (
        <EmptyState>No users yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const isSelf = u.__id === currentUser.__id;
            return (
              <li key={u.__id} className={cx(cls.card, 'space-y-3 p-4')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-900">
                        {displayName(u)}
                      </span>
                      <Badge tone={u.role === 'admin' ? 'green' : 'neutral'}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                      {isSelf && <Badge tone="neutral">you</Badge>}
                      {u.disabled && <Badge tone="red">disabled</Badge>}
                      {u.forcePasswordUpdate && (
                        <Badge tone="amber">password change pending</Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-neutral-500">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" onClick={() => setOpenForm({ kind: 'edit', user: u })}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setOpenForm({ kind: 'reset', user: u })}>
                      Reset password
                    </Button>
                    {confirmDeleteId === u.__id ? (
                      <>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => client.deleteUser(u.__id, u.updatedAt),
                              `User "${u.email}" deleted`
                            )
                          }
                        >
                          Confirm delete
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="danger"
                        disabled={isSelf}
                        title={isSelf ? 'You cannot delete your own account' : undefined}
                        onClick={() => setConfirmDeleteId(u.__id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {openForm?.kind === 'edit' && openForm.user.__id === u.__id && (
                  <EditUserForm
                    user={u}
                    isSelf={isSelf}
                    busy={busy}
                    onCancel={() => setOpenForm(null)}
                    onSave={(next) =>
                      run(
                        () =>
                          client.updateUser(
                            u.__id,
                            {
                              email: next.email,
                              firstName: next.firstName.trim(),
                              lastName: next.lastName.trim(),
                              // Own role/disabled never sent — the server
                              // rejects the whole patch if they were.
                              ...(isSelf ? {} : { role: next.role, disabled: next.disabled }),
                            },
                            u.updatedAt
                          ),
                        `User "${next.email}" updated`
                      )
                    }
                  />
                )}

                {openForm?.kind === 'reset' && openForm.user.__id === u.__id && (
                  <ResetPasswordForm
                    user={u}
                    busy={busy}
                    onCancel={() => setOpenForm(null)}
                    onReset={(newPassword, forceUpdate) =>
                      run(
                        () => client.setPassword(u.__id, newPassword, u.updatedAt, forceUpdate),
                        `Password reset for "${u.email}"`
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
