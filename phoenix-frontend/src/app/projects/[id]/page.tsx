"use client";

import { format } from "date-fns/format";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Project, Task, TaskPage, TaskStatus } from "@/lib/types";

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

function TaskBoard({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaskPage | null>(null);
  // A failed request is an error, not a "genuinely empty result" — the README
  // requires servers errors, expired sessions and empty results to be shown
  // differently.
  const [error, setError] = useState<string | null>(null);
  // Monotonic request counter: a late answer to an old question never wins.
  const latest = useRef(0);

  useEffect(() => {
    let stale = false;
    api<Project>(`/api/projects/${id}`)
      .then((p) => {
        if (!stale) setProject(p);
      })
      .catch((err) => {
        if (!stale) setError(describeError(err));
      });
    return () => {
      stale = true;
    };
  }, [id]);

  const fetchTasks = useCallback(
    async (q: string) => {
      const seq = ++latest.current;
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      try {
        const result = await api<TaskPage>(`/api/projects/${id}/tasks?${params}`);
        if (seq === latest.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (seq === latest.current) setError(describeError(err));
      }
    },
    [id, page, status] // status/page live in deps so filter changes actually re-fetch
  );

  // Debounce search; also fires when page/status change (fetchTasks identity).
  useEffect(() => {
    const t = setTimeout(() => fetchTasks(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchTasks]);

  return (
    <>
      {project && (
        <p>
          <Link href={`/workspaces/${project.workspace_id}`}>← Back to workspace</Link>
        </p>
      )}
      <h1>{project?.name ?? "Project"}</h1>
      <NewTaskForm
        projectId={id}
        onCreated={() => {
          // New task made the list stale: jump to page 1 and refresh.
          setPage(1);
          void fetchTasks(query);
        }}
      />
      <div className="row">
        <input
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tasks"
        />
        <select
          value={status}
          onChange={(e) => {
            // README: changing a filter returns the list to page 1.
            setStatus(e.target.value as TaskStatus | "");
            setPage(1);
          }}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {data === null && !error && <p className="muted">Loading…</p>}
      {data && !error && data.items.length === 0 && <p className="muted">No tasks match.</p>}

      {data && !error && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: Task) => (
              <tr key={t.id}>
                <td className="small">{t.id.slice(-6)}</td>
                <td>{t.title}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="small">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager page={page} data={data} onChange={(next) => setPage(next)} />
    </>
  );
}

function Pager({
  page,
  data,
  onChange,
}: {
  page: number;
  data: TaskPage | null;
  onChange: (next: number) => void;
}) {
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div className="row pager">
      <button className="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages} {data && <span className="muted">({data.total} tasks)</span>}
      </span>
      <button className="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

function NewTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    // Guard BEFORE the await — double-clicking "Create task" creates exactly
    // one task (README requirement).
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/tasks`, { method: "POST", body: { title } });
      setTitle("");
      onCreated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        placeholder="New task title (costs 1 credit)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <TaskBoard id={id} />
    </RequireAuth>
  );
}
