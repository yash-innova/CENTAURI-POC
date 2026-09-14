import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './index.css'

type Task = {
  id: string
  title: string
  description: string
  completed: boolean
}

type Filter = 'all' | 'open' | 'completed'

const API_URL = 'http://localhost:3000'
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
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<Task[]>('/tasks')
      .then(setTasks)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  const visibleTasks = useMemo(() => tasks.filter((task) => (
    filter === 'all' || (filter === 'open' && !task.completed) || (filter === 'completed' && task.completed)
  )), [filter, tasks])

  async function createTask(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError('')
    try {
      const newTask = await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      setTasks((current) => [newTask, ...current])
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
      const updated = await apiRequest<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      })
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
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
      const updated = await apiRequest<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
      })
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
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
      setTasks((current) => current.filter((task) => task.id !== id))
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
        <p>Keep the next important thing visible.</p>
        <div className="summary-stats"><span><strong>{tasks.length}</strong> total</span><span><strong>{completedCount}</strong> completed</span><span><strong>{tasks.length - completedCount}</strong> open</span></div>
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

        <section className="panel task-panel">
          <div className="task-heading"><div className="panel-heading"><span className="step">02</span><h2>Your tasks</h2></div><div className="filters">{(['all', 'open', 'completed'] as Filter[]).map((option) => <button type="button" className={filter === option ? 'selected' : ''} key={option} onClick={() => setFilter(option)}>{option}</button>)}</div></div>
          {loading ? <p className="empty-state">Loading tasks...</p> : visibleTasks.length === 0 ? <div className="empty-state"><span className="empty-icon">--</span><p>{tasks.length === 0 ? 'Your task list is empty.' : 'No tasks match this filter.'}</p><small>{tasks.length === 0 ? 'Add your first task to get started.' : 'Try another view above.'}</small></div> : <div className="task-list">{visibleTasks.map((task) => <article className={`task-item ${task.completed ? 'completed' : ''}`} key={task.id}>
            {editingId === task.id ? <div className="edit-form"><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={160} autoFocus /><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} maxLength={2000} /><div className="item-actions"><button type="button" className="small-primary" disabled={busyId === task.id || !editTitle.trim()} onClick={() => void saveEdit(task.id)}>Save</button><button type="button" className="text-button" onClick={() => setEditingId(null)}>Cancel</button></div></div> : <><button type="button" className="status-button" aria-label={task.completed ? 'Mark task open' : 'Mark task completed'} onClick={() => void toggleTask(task)} disabled={busyId === task.id}>{task.completed ? '✓' : ''}</button><div className="task-details"><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<span className="task-status">{task.completed ? 'Completed' : 'Open'}</span></div><div className="item-actions"><button type="button" className="text-button" onClick={() => beginEdit(task)}>Edit</button><button type="button" className="delete-button" aria-label={`Delete ${task.title}`} onClick={() => void deleteTask(task.id)} disabled={busyId === task.id}>Delete</button></div></>}
+          </article>)}</div>}
        </section>
      </div>
      <footer>Tasks reset when the in-memory API restarts.</footer>
    </main>
  )
}

export default App
