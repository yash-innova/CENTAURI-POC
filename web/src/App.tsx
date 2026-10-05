import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './index.css'

type Task = {
  id: string
  title: string
  description: string
  completed: boolean
}

type StatusFilter = 'all' | 'open' | 'completed'
type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status'
type SortOrder = 'asc' | 'desc'

type TaskQuery = {
  search: string
  status: StatusFilter
  sort: SortField
  order: SortOrder
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
]

const DEFAULT_SORT: SortField = 'createdAt'
const DEFAULT_ORDER: SortOrder = 'desc'
const SEARCH_DEBOUNCE_MS = 300

// Defaults are omitted so the unfiltered view still requests plain /tasks.
function buildTaskQuery({ search, status, sort, order }: TaskQuery): string {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status !== 'all') params.set('status', status)
  if (sort !== DEFAULT_SORT) params.set('sort', sort)
  if (order !== DEFAULT_ORDER) params.set('order', order)
  const query = params.toString()
  return query ? `?${query}` : ''
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN = 'task-tracker-dev-token'

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Request failed (${response.status})`)
  }

  return response.status === 204 ? (undefined as T) : response.json()
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortField>(DEFAULT_SORT)
  const [order, setOrder] = useState<SortOrder>(DEFAULT_ORDER)
  const [refreshCount, setRefreshCount] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const query = buildTaskQuery({ search: debouncedSearch, status, sort, order })
  const requestKey = `${query}#${refreshCount}`
  const loading = loadedKey !== requestKey
  const isFiltered = debouncedSearch !== '' || status !== 'all'

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    // Aborting on change stops an older, slower response from replacing newer results.
    const controller = new AbortController()
    apiRequest<Task[]>(`/tasks${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setTasks(result)
        setError('')
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted) setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey])

  // Reload with the current search/filter/sort so mutated tasks land where the server puts them.
  function refreshTasks() {
    setRefreshCount((count) => count + 1)
  }

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStatus('all')
  }

  async function createTask(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError('')
    try {
      await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      refreshTasks()
      setTitle('')
      setDescription('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create task')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task: Task) {
    setBusyId(task.id)
    setError('')
    try {
      await apiRequest<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      })
      refreshTasks()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update task')
    } finally {
      setBusyId(null)
    }
  }

  function beginEdit(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description)
    setError('')
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return

    setBusyId(id)
    setError('')
    try {
      await apiRequest<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
      })
      refreshTasks()
      setEditingId(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save task')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteTask(id: string) {
    setBusyId(id)
    setError('')
    try {
      await apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' })
      refreshTasks()
      if (editingId === id) setEditingId(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete task')
    } finally {
      setBusyId(null)
    }
  }

  const completedCount = tasks.filter((task) => task.completed).length

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="kicker">Personal workspace</p>
          <h1>Task tracker</h1>
        </div>
        <span className="connection"><span className="connection-dot" /> Local API</span>
      </header>

      <section className="summary">
        <p>{isFiltered ? 'Counts cover only the tasks matching the current search and status filter.' : 'Keep the next important thing visible.'}</p>
        <div className="summary-stats"><span><strong>{tasks.length}</strong> {isFiltered ? 'matching' : 'total'}</span><span><strong>{completedCount}</strong> completed</span><span><strong>{tasks.length - completedCount}</strong> open</span></div>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="content-grid">
        <section className="panel add-panel">
          <div className="panel-heading"><span className="step">01</span><h2>Add a task</h2></div>
          <form onSubmit={createTask}>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Review project notes" maxLength={160} required />
            <label htmlFor="description">Description <span>optional</span></label>
            <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does done look like?" rows={4} maxLength={2000} />
            <button className="primary-button" type="submit" disabled={saving || !title.trim()}>{saving ? 'Adding...' : 'Add task'} <span>+</span></button>
          </form>
        </section>

        <section className="panel task-panel" aria-busy={loading}>
          <div className="task-heading"><div className="panel-heading"><span className="step">02</span><h2>Your tasks</h2></div><div className="filters">{(['all', 'open', 'completed'] as StatusFilter[]).map((option) => <button type="button" className={status === option ? 'selected' : ''} aria-pressed={status === option} key={option} onClick={() => setStatus(option)}>{option}</button>)}</div></div>
          <div className="task-toolbar">
            <input type="search" className="search-input" aria-label="Search tasks" placeholder="Search title or description" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
            <label className="sort-control">Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as SortField)}>
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className="order-button" aria-label={`Sort direction: ${order === 'asc' ? 'ascending' : 'descending'}`} onClick={() => setOrder((current) => current === 'asc' ? 'desc' : 'asc')}>{order === 'asc' ? '↑ Asc' : '↓ Desc'}</button>
          </div>
          {loading && tasks.length === 0 ? <p className="empty-state">Loading tasks...</p> : tasks.length === 0 ? <div className="empty-state"><span className="empty-icon">--</span><p>{isFiltered ? 'No tasks match your search or filter.' : 'Your task list is empty.'}</p><small>{isFiltered ? 'Try a different search or status.' : 'Add your first task to get started.'}</small>{isFiltered && <button type="button" className="text-button clear-filters" onClick={clearFilters}>Clear search and filter</button>}</div> : <div className={`task-list ${loading ? 'refreshing' : ''}`}>{tasks.map((task) => <article className={`task-item ${task.completed ? 'completed' : ''}`} key={task.id}>
            {editingId === task.id ? <div className="edit-form"><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={160} autoFocus /><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} maxLength={2000} /><div className="item-actions"><button type="button" className="small-primary" disabled={busyId === task.id || !editTitle.trim()} onClick={() => void saveEdit(task.id)}>Save</button><button type="button" className="text-button" onClick={() => setEditingId(null)}>Cancel</button></div></div> : <><button type="button" className="status-button" aria-label={task.completed ? 'Mark task open' : 'Mark task completed'} onClick={() => void toggleTask(task)} disabled={busyId === task.id}>{task.completed ? '✓' : ''}</button><div className="task-details"><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<span className="task-status">{task.completed ? 'Completed' : 'Open'}</span></div><div className="item-actions"><button type="button" className="text-button" onClick={() => beginEdit(task)}>Edit</button><button type="button" className="delete-button" aria-label={`Delete ${task.title}`} onClick={() => void deleteTask(task.id)} disabled={busyId === task.id}>Delete</button></div></>}
          </article>)}</div>}
        </section>
      </div>
      <footer>Tasks are stored in the local PostgreSQL database.</footer>
    </main>
  )
}

export default App
