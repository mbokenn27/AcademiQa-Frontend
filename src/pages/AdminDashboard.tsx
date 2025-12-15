// src/pages/AdminDashboard.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'

const useToast = () => {
  const [toast, setToast] = useState<{ title: string; description: string; variant?: string } | null>(null)
  const showToast = (title: string, description: string, variant?: string) => {
    setToast({ title, description, variant })
    setTimeout(() => setToast(null), 3000)
  }
  return { toast: showToast }
}

/* ----------------------------- Types (unchanged) ----------------------------- */
interface User { id: number; username: string; email: string; first_name: string; last_name: string; profile: UserProfile; full_name: string }
interface UserProfile {
  role: 'client' | 'admin'
  phone?: string
  education_level?: string
  is_suspended: boolean
  avatar?: string
  expertise?: string
  rating?: number
  completed_tasks: number
  earnings: number
  is_verified: boolean
  full_name: string
}
interface Task {
  id: number
  task_id: string
  title: string
  description: string
  subject: string
  education_level: string
  deadline: string
  status: 'submitted' | 'budget_negotiation' | 'in_progress' | 'awaiting_review' | 'revision_requested' | 'completed' | 'withdrawn' | 'rejected' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  progress: number
  budget?: number
  proposed_budget: number
  admin_counter_budget?: number
  negotiation_status: 'pending_admin_review' | 'pending_student_response' | 'pending_admin_response' | 'accepted' | 'rejected'
  negotiation_reason?: string
  estimated_hours: number
  actual_hours?: number
  timezone_str?: string
  client: User
  assigned_admin?: User
  category?: any
  timezone_obj?: any
  files: TaskFile[]
  revisions: Revision[]
  chat: ChatMessage[]
  unread_messages: number
  days_until_deadline: number
  is_overdue: boolean
  created_at: string
  updated_at: string
  accepted_at?: string
  completed_at?: string
  withdrawal_deadline?: string
  withdrawal_fee: number
  can_withdraw_free: boolean
  reject_reason?: string
}
interface TaskFile { id: number; name: string; file_type: string; size: string; uploaded_by: number; uploaded_by_name: string; uploaded_at: string; description: string; file_url: string }
interface Revision { id: number; requested_by: number; requested_by_name: string; requested_at: string; feedback: string; status: 'requested' | 'in_progress' | 'completed' | 'cancelled'; completed_at?: string; admin_notes: string }
interface ChatMessage { id: number; message: string; file?: string; file_name?: string; file_url?: string; is_read: boolean; created_at: string; sender: string; sender_role: 'admin' | 'client' }
interface TaskStats { total: number; new_requests: number; active: number; under_review: number; completed: number; recent: number }
interface AdminStats { assigned_tasks: number; completed_tasks: number; total_earnings: number; rating: number }

/* ---------------------------- API service (same) ---------------------------- */
const apiService = {
  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!response.ok) { throw new Error(`API error: ${response.status}`) }
    return response.json()
  },
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) { throw new Error(`API error: ${response.status}`) }
    return response.json()
  },
  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
    if (!response.ok) { throw new Error(`API error: ${response.status}`) }
    return response.json()
  },
}

/* --------------------------------- Misc UI -------------------------------- */
const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' }
]

const Toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
  const bgColor = variant === 'destructive' ? 'bg-red-500' : 'bg-green-500'
  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm`}>
      <div className="font-bold">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  )
}

/* ---------------------- click-outside helper for dropdown ------------------- */
function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

/* ------------------------- WebSocket (unchanged) -------------------------- */
const useWebSocketWithReconnect = (url: string | null, onMessage: (data: any) => void, deps: any[] = []) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  useEffect(() => {
    if (!url) { setWs(null); return; }
    let reconnectTimeout: NodeJS.Timeout;
    let attempt = 0;
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) { console.warn('No access token — cannot connect to WebSocket'); return; }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${url}?token=${encodeURIComponent(token)}`;
      const websocket = new WebSocket(wsUrl);
      websocket.onopen = () => { setWs(websocket); attempt = 0; };
      websocket.onmessage = (event) => {
        try { onMessage(JSON.parse(event.data)); } catch (error) { console.error('WebSocket parse error:', error); }
      };
      websocket.onclose = () => {
        setWs(null);
        const delay = Math.min(1000 * (2 ** attempt), 30000);
        attempt++;
        reconnectTimeout = setTimeout(connect, delay);
      };
      websocket.onerror = () => { console.error('WebSocket error'); };
    };
    connect();
    return () => { clearTimeout(reconnectTimeout); if (ws?.readyState === WebSocket.OPEN) ws.close(); };
  }, [url, ...deps]);
  const sendMessage = (data: any) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
  return { sendMessage };
};

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { toast } = useToast()
  const [currentToast, setCurrentToast] = useState<{ title: string; description: string; variant?: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // keyboard nav
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressUpdate, setProgressUpdate] = useState('')
  const [showBudgetNegotiation, setShowBudgetNegotiation] = useState(false)
  const [counterBudget, setCounterBudget] = useState('')
  const [negotiationReason, setNegotiationReason] = useState('')
  const [showSubmitFinalModal, setShowSubmitFinalModal] = useState(false)
  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, new_requests: 0, active: 0, under_review: 0, completed: 0, recent: 0 })
  const [adminStats, setAdminStats] = useState<AdminStats>({ assigned_tasks: 0, completed_tasks: 0, total_earnings: 0, rating: 0 })
  const [loading, setLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  /* -------- Floating chat window state -------- */
  const [showChatWindow, setShowChatWindow] = useState(false)
  const [chatMinimized, setChatMinimized] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const [chatPos, setChatPos] = useState<{ x: number, y: number }>({ x: 16, y: 100 })
  const [chatSize, setChatSize] = useState<{ w: number, h: number }>({ w: 360, h: 520 })
  const draggingRef = useRef<{ startX: number, startY: number, origX: number, origY: number } | null>(null)

  // notifications dropdown state
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  useOnClickOutside(notifRef, () => setShowNotifPanel(false))

  useEffect(() => {
    const h = 520
    setChatPos({ x: 16, y: Math.max(16, window.innerHeight - h - 16) })
  }, [])

  const onDragStart = (e: React.MouseEvent) => {
    draggingRef.current = { startX: e.clientX, startY: e.clientY, origX: chatPos.x, origY: chatPos.y }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }
  const onDragMove = (e: MouseEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - draggingRef.current.startX
    const dy = e.clientY - draggingRef.current.startY
    setChatPos({ x: Math.max(8, draggingRef.current.origX + dx), y: Math.max(8, draggingRef.current.origY + dy) })
  }
  const onDragEnd = () => {
    draggingRef.current = null
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
  }

  const openChatWindow = async (t?: Task) => {
    const task = t || selectedTask
    if (!task) return
    setShowNotifPanel(false) // close bell dropdown when opening chat
    setShowChatWindow(true)
    setChatMinimized(false)
    try {
      await apiService.post(`/api/tasks/${task.id}/mark-read/`)
    } catch {}
    // clear locally right away
    setTasks(prev => prev.map(x => x.id === task.id ? { ...x, unread_messages: 0 } : x))
    loadChatMessages(task.id)
  }
  const closeChatWindow = () => {
    setShowChatWindow(false)
    setChatMinimized(false)
  }

  /* ----------------------------- WebSockets ----------------------------- */
  const { sendMessage: sendAdminMessage } = useWebSocketWithReconnect('/ws/admin/', (data) => {
    if (data.type === 'task_updated' && data.task) {
      const updatedTask: Task = data.task;
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      setSelectedTask(prev => (prev && prev.id === updatedTask.id) ? { ...updatedTask } : prev);
      loadStats();
    }
    if (data.type === "task_created" && data.task) {
      const newTask: Task = data.task;
      setTasks(current => current.some(t => t.id === newTask.id) ? current : [newTask, ...current]);
    }
    // admin channel chat ping (should include task_id)
    if (data.type === 'chat_message' && data.task_id) {
      const forOpenChat = showChatWindow && selectedTask?.id === data.task_id
      const fromClient = data.message?.sender_role === 'client'
      if (!fromClient) return
      if (forOpenChat) {
        // keep it at 0 for that task
        setTasks(prev => prev.map(t => t.id === data.task_id ? { ...t, unread_messages: 0 } : t))
      } else {
        setTasks(prev => prev.map(t => t.id === data.task_id ? { ...t, unread_messages: (t.unread_messages || 0) + 1 } : t))
      }
    }
  });

  const { sendMessage: sendTaskMessage } = useWebSocketWithReconnect(
    selectedTask ? `/ws/task/${selectedTask.id}/` : null,
    (data) => {
      if (data.type === 'chat_message' && data.message) {
        setChatMessages(prev => {
          const filtered = prev.filter(msg => !(msg.id > 1000000 && msg.message === data.message.message));
          return [...filtered, data.message];
        });
        setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
        const fromClient = data.message?.sender_role === 'client'
        if (!fromClient) return
        // IMPORTANT: task-channel messages don't carry task_id; it's the selectedTask
        if (showChatWindow && selectedTask) {
          // chat is open for this task -> keep unread at 0
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, unread_messages: 0 } : t))
          // also tell server (best-effort)
          apiService.post(`/api/tasks/${selectedTask.id}/mark-read/`).catch(() => {})
        } else if (selectedTask) {
          // chat window closed -> bump unread
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, unread_messages: (t.unread_messages || 0) + 1 } : t))
        }
      }
      if (data.type === 'user_typing') {
        if (data.username !== currentUser?.username) { setIsTyping(data.is_typing); }
      }
    },
    [selectedTask?.id, showChatWindow]
  );

  /* ----------------------------- Data loading ----------------------------- */
  useEffect(() => { loadInitialData() }, [])
  useEffect(() => {
    if (selectedTask) {
      loadChatMessages(selectedTask.id);
      setChatMessages([]);
    }
  }, [selectedTask?.id])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const userData = await apiService.get<User>('/api/auth/user/')
      setCurrentUser(userData)
      const tasksData = await apiService.get<Task[]>('/api/tasks/')
      setTasks(tasksData)
      if (tasksData.length > 0) {
        setSelectedTask(tasksData[0])
        setSelectedIndex(0)
      }
      await loadStats();
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally { setLoading(false) }
  }

  const loadStats = async () => {
    try {
      const statsData = await apiService.get<{ task_stats: TaskStats; admin_stats: AdminStats }>('/api/admin/stats/')
      setTaskStats(statsData.task_stats)
      setAdminStats(statsData.admin_stats)
    } catch (error) { console.error('Failed to load stats:', error) }
  }

  const loadChatMessages = async (taskId: number) => {
    try {
      const messages = await apiService.get<ChatMessage[]>(`/api/tasks/${taskId}/chat/`)
      setChatMessages(messages)
      setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100)
      // best-effort clear
      try { await apiService.post(`/api/tasks/${taskId}/mark-read/`); } catch {}
    } catch (error) {
      console.error('Failed to load chat messages:', error)
    }
  }

  /* ----------------------------- Derived: smart bell total ----------------------------- */
  const totalUnread = useMemo(() => {
    return tasks.reduce((sum, t) => {
      if (showChatWindow && selectedTask?.id === t.id) return sum // exclude open chat
      return sum + (t.unread_messages || 0)
    }, 0)
  }, [tasks, showChatWindow, selectedTask?.id])

  const unreadTasks = useMemo(
    () => tasks.filter(t => (t.unread_messages || 0) > 0 && (!showChatWindow || t.id !== selectedTask?.id)),
    [tasks, showChatWindow, selectedTask?.id]
  )

  /* ----------------------------- Keyboard UX ----------------------------- */
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      task.title.toLowerCase().includes(q) ||
      task.subject.toLowerCase().includes(q) ||
      task.client.full_name.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })
  useEffect(() => {
    if (!selectedTask) { setSelectedIndex(0); return }
    const idx = filteredTasks.findIndex(t => t.id === selectedTask.id)
    if (idx >= 0) setSelectedIndex(idx)
  }, [selectedTask?.id, filterStatus, searchQuery, tasks.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (e.key === '/' && !inInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (inInput) return
      if (!filteredTasks.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredTasks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const t = filteredTasks[selectedIndex]
        if (t) setSelectedTask(t)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredTasks, selectedIndex])

  /* ----------------------------- Chat handlers ----------------------------- */
  const showToast = (title: string, description: string, variant?: string) => {
    setCurrentToast({ title, description, variant })
    setTimeout(() => setCurrentToast(null), 3000)
  }
  const handleTyping = (typing: boolean) => { if (selectedTask) { sendTaskMessage({ type: 'typing', is_typing: typing }); } }
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) { setIsTyping(true); handleTyping(true); }
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); }
    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); handleTyping(false); }, 1000);
  }
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
  }

  const sendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    if (!selectedTask) return;
    const optimisticMessage: ChatMessage = {
      id: Date.now(),
      message: newMessage.trim(),
      sender: currentUser?.username || 'Admin',
      sender_role: 'admin',
      created_at: new Date().toISOString(),
      is_read: false,
      file_url: uploadedFiles.length > 0 ? 'pending' : undefined,
      file_name: uploadedFiles.length > 0 ? uploadedFiles[0]?.name : undefined,
      file: undefined,
    };
    try {
      setIsTyping(false); handleTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setChatMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        if (newMessage.trim()) formData.append('message', newMessage.trim());
        uploadedFiles.forEach(file => { formData.append('file', file); });
        await apiService.postFormData(`/api/tasks/${selectedTask.id}/chat/`, formData);
      } else {
        await apiService.post(`/api/tasks/${selectedTask.id}/chat/`, { message: newMessage.trim() });
      }
      setNewMessage(''); setUploadedFiles([]);
      setTimeout(() => { loadChatMessages(selectedTask.id); }, 400);
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      showToast("Error", "Failed to send message", "destructive");
    }
  };

  const removeFile = (index: number) => { setUploadedFiles(prev => prev.filter((_, i) => i !== index)) }
  const handleLogout = () => { logout(); navigate('/'); showToast("Logged out", "You have been successfully logged out.") }

  /* ----------------------------- UI helpers ----------------------------- */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'awaiting_review': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  const formatStatus = (status: string) => status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return 'ri-file-text-line'
      case 'in_progress': return 'ri-loader-4-line'
      case 'awaiting_review': return 'ri-eye-line'
      case 'completed': return 'ri-checkbox-circle-line'
      case 'rejected': return 'ri-close-circle-line'
      default: return 'ri-file-line'
    }
  }
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return 'ri-file-pdf-line'
      case 'word':
      case 'docx':
      case 'doc': return 'ri-file-word-line'
      case 'excel':
      case 'xlsx':
      case 'xls': return 'ri-file-excel-line'
      case 'powerpoint':
      case 'pptx':
      case 'ppt': return 'ri-file-ppt-line'
      case 'python':
      case 'py': return 'ri-file-code-line'
      case 'csv': return 'ri-file-chart-line'
      default: return 'ri-file-line'
    }
  }

  const openGmailCompose = (toEmail: string, subject?: string, body?: string) => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toEmail)}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getActionButtons = (task: Task) => {
    if (task.status === 'awaiting_review') {
      return (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl text-center">
          <i className="ri-time-line text-4xl text-purple-700 mb-2 block animate-pulse"></i>
          <p className="text-lg font-bold text-purple-900">Waiting for Student Approval</p>
          <p className="text-sm text-purple-700 mt-1">
            {task.revisions.length > 0 ? "Your revised work has been submitted." : "Your final assignment has been submitted."}
          </p>
        </div>
      )
    }
    if (task.status === 'revision_requested') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]) }} className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl shadow-md">
            <i className="ri-upload-2-line mr-2"></i>Re-Submit Revised Assignment
          </Button>
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm flex-1 min-w-[220px]">
            <p className="font-bold text-red-800 mb-1">Student Feedback:</p>
            <p className="text-red-700 leading-snug">{task.revisions?.[0]?.feedback || "No feedback provided"}</p>
          </div>
        </div>
      )
    }
    if (task.status === 'budget_negotiation' && task.negotiation_status === 'pending_student_response') {
      return (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-2xl text-center">
          <i className="ri-hourglass-line text-4xl text-yellow-700 mb-2 block"></i>
          <p className="text-lg font-bold text-yellow-900">Awaiting Student Response</p>
          <p className="text-sm text-yellow-800 mt-1">Your counter-offer of <strong>${task.admin_counter_budget}</strong> is pending</p>
        </div>
      )
    }
    if (task.status === 'budget_negotiation' && task.negotiation_status === 'pending_admin_response') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => acceptTask(task.id)} className="w-full sm:w-auto h-11 text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white"><i className="ri-check-line mr-2"></i>Accept & Start</Button>
          <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="w-full sm:w-auto h-11 text-sm sm:text-base border-orange-500 text-orange-600 hover:bg-orange-50"><i className="ri-money-dollar-circle-line mr-2"></i>Propose Budget</Button>
          <Button onClick={() => setShowRejectModal(true)} variant="outline" className="w-full sm:w-auto h-11 text-sm sm:text-base border-red-500 text-red-600 hover:bg-red-50"><i className="ri-close-line mr-2"></i>Reject</Button>
        </div>
      )
    }
    if (task.status === 'in_progress') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]) }} className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-md">
            <i className="ri-upload-cloud-2-line mr-2"></i>Submit Final Assignment
          </Button>
          <Button onClick={() => { setSelectedTask(task); setShowProgressModal(true) }} variant="outline" className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base border-blue-500 text-blue-700 hover:bg-blue-50 font-medium">
            <i className="ri-bar-chart-line mr-2"></i>Update Progress
          </Button>
        </div>
      )
    }
    if (['completed', 'rejected', 'withdrawn', 'cancelled'].includes(task.status)) {
      const isCompleted = task.status === 'completed'
      return (
        <div className={`p-4 rounded-2xl text-center font-bold border-2 ${isCompleted ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-gray-50 text-gray-600 border-gray-300'}`}>
          <i className={isCompleted ? 'ri-checkbox-circle-fill text-4xl block mb-2' : 'ri-forbid-line text-4xl block mb-2'}></i>
          {isCompleted ? 'Task Completed' : 'Task Inactive'}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
      {currentToast && <Toast title={currentToast.title} description={currentToast.description} variant={currentToast.variant} />}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-xl shrink-0">
                <i className="ri-admin-line text-2xl text-white"></i>
              </div>
              <div className="truncate">
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-transparent bg-clip-text truncate">Admin Dashboard</h1>
                <p className="text-xs text-gray-500 truncate">Welcome back, {currentUser?.first_name || 'Admin'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Bell with dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setShowNotifPanel(v => !v)}
                  className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center hover:bg-gray-50"
                  title="Notifications"
                >
                  <i className="ri-notification-3-line text-[18px]"></i>
                </button>
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center">
                    {totalUnread}
                  </span>
                )}

                {showNotifPanel && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Notifications</span>
                        {totalUnread > 0 ? (
                          <button
                            className="text-xs text-emerald-700 hover:underline"
                            onClick={async () => {
                              // optimistic clear all visible unread (excluding open chat)
                              const ids = unreadTasks.map(t => t.id)
                              setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, unread_messages: 0 } : t))
                              // best effort mark-read
                              for (const id of ids) {
                                try { await apiService.post(`/api/tasks/${id}/mark-read/`) } catch {}
                              }
                            }}
                          >
                            Mark all as read
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      {unreadTasks.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 flex items-center gap-2">
                          <i className="ri-check-line"></i> No new messages
                        </div>
                      ) : (
                        unreadTasks
                          .sort((a, b) => (b.unread_messages || 0) - (a.unread_messages || 0))
                          .map(task => (
                            <button
                              key={task.id}
                              onClick={() => {
                                setSelectedTask(task)
                                openChatWindow(task) // clears unread + opens chat
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                            >
                              <div className="mt-0.5">
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px]">
                                  {task.unread_messages}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">{task.title}</div>
                                <div className="text-xs text-gray-600 truncate">New message from {task.client.full_name}</div>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={handleLogout} variant="outline" className="whitespace-nowrap">
                <i className="ri-logout-box-r-line mr-2"></i> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="
          h-[calc(100vh-7.5rem)]
          grid gap-6
          grid-cols-1
          md:grid-cols-[220px_1fr_280px]
          lg:grid-cols-[220px_1fr_320px]
        ">
          {/* Left Sidebar */}
          <aside className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-gray-500 px-2 mb-1">Navigation</div>
            {[
              { label: 'Dashboard', icon: 'ri-dashboard-line', to: '/admin' },
              { label: 'Tasks', icon: 'ri-file-list-3-line', to: '/admin/tasks' },
              { label: 'Experts', icon: 'ri-team-line', to: '/admin/experts' },
              { label: 'Messages', icon: 'ri-chat-3-line', to: '/admin/messages' },
              { label: 'Settings', icon: 'ri-settings-3-line', to: '/admin/settings' },
            ].map(({ label, icon, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <i className={`${icon} text-emerald-600`}></i>
                <span className="text-sm">{label}</span>
              </button>
            ))}

            {/* Snapshot */}
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-xs text-emerald-800 font-semibold mb-2">Snapshot</div>
              <div className="space-y-1 text-xs text-emerald-900">
                <div className="flex justify-between"><span>Total</span><span className="font-semibold">{taskStats.total}</span></div>
                <div className="flex justify-between"><span>Active</span><span className="font-semibold">{taskStats.active}</span></div>
                <div className="flex justify-between"><span>Review</span><span className="font-semibold">{taskStats.under_review}</span></div>
                <div className="flex justify-between"><span>Done</span><span className="font-semibold">{taskStats.completed}</span></div>
              </div>
            </div>
          </aside>

          {/* Middle Pane */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden flex flex-col min-h-0">
            {!selectedTask ? (
              <div className="flex-1 grid place-items-center text-gray-500">Select a task from the right list</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1 truncate">{selectedTask.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><i className="ri-book-line"></i>{selectedTask.subject}</span>
                      <span className="flex items-center gap-1"><i className="ri-graduation-cap-line"></i>{selectedTask.education_level}</span>
                      <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>Due: {new Date(selectedTask.deadline).toLocaleDateString()}</span>
                      {selectedTask.timezone_str && (
                        <span className="flex items-center gap-1"><i className="ri-time-zone-line"></i>{timezones.find(tz => tz.value === selectedTask.timezone_str)?.label || selectedTask.timezone_str}</span>
                      )}
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${getPriorityColor(selectedTask.priority)}`}>
                        <i className="ri-flag-line"></i>{selectedTask.priority}
                      </span>
                      {selectedTask.budget && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold"><i className="ri-money-dollar-circle-line"></i>${selectedTask.budget}</span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedTask.status)}`}>
                    <i className={getStatusIcon(selectedTask.status)}></i>{formatStatus(selectedTask.status)}
                  </span>
                </div>

                {/* Negotiation banners */}
                {selectedTask.status === 'submitted' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Student's Proposed</p>
                        <p className="text-xl font-bold text-blue-600">${selectedTask.proposed_budget}</p>
                      </div>
                      {selectedTask.admin_counter_budget && (
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">Your Counter</p>
                          <p className="text-xl font-bold text-orange-600">${selectedTask.admin_counter_budget}</p>
                        </div>
                      )}
                    </div>
                    {selectedTask.negotiation_reason && (
                      <div className="bg-white rounded-lg p-4 mt-3">
                        <p className="text-sm text-gray-600 mb-1">Explanation</p>
                        <p className="text-gray-800">{selectedTask.negotiation_reason}</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedTask.budget && selectedTask.negotiation_status === 'accepted' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-emerald-900 mb-1 font-semibold">Budget Agreed</p>
                    <p className="text-xl font-bold text-emerald-700">${selectedTask.budget}</p>
                  </div>
                )}
                {selectedTask.status === 'budget_negotiation' && selectedTask.negotiation_status === 'pending_student_response' && (
                  <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-yellow-900 text-sm text-center">
                    <i className="ri-time-line text-xl mr-2"></i> Awaiting student to approve your offer (${selectedTask.admin_counter_budget})
                  </div>
                )}

                {/* Actions */}
                <div className="mb-4">{getActionButtons(selectedTask)}</div>

                {/* Progress */}
                {selectedTask.status === 'in_progress' && (
                  <div className="bg-white rounded-xl p-4 mb-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Task Progress</h3>
                      <span className="text-lg font-bold text-emerald-600">{selectedTask.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full" style={{ width: `${selectedTask.progress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Estimated: {selectedTask.estimated_hours} hours</p>
                  </div>
                )}

                {/* Description */}
                <div className="bg-white rounded-xl p-4 mb-4 border">
                  <h3 className="font-semibold mb-2">Task Description</h3>
                  <p className="text-gray-700">{selectedTask.description}</p>
                </div>

                {/* Student Info */}
                <div className="bg-white rounded-xl p-4 mb-4 border">
                  <h3 className="font-semibold mb-3">Student Information</h3>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {selectedTask.client.profile?.avatar && (
                      <img src={selectedTask.client.profile.avatar} alt={selectedTask.client.full_name} className="w-12 h-12 rounded-full object-cover object-top border-2 border-emerald-200" />
                    )}
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-semibold">{selectedTask.client.full_name}</p>
                      <p className="text-sm text-gray-600 break-all">{selectedTask.client.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => openGmailCompose(selectedTask.client.email, `Regarding your task: ${selectedTask.title}`)}
                      className="h-10 px-3 text-sm whitespace-nowrap w-full sm:w-auto"
                    >
                      <i className="ri-mail-line mr-2"></i>Contact
                    </Button>
                  </div>
                </div>

                {/* Files */}
                <div className="bg-white rounded-xl p-4 mb-6 border">
                  <h3 className="font-semibold mb-3">Project Files ({selectedTask.files.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedTask.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <i className={`${getFileIcon(file.file_type)} text-emerald-600`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.size} • {file.uploaded_by_name}</p>
                        </div>
                        <a href={file.file_url} download><Button size="sm" variant="outline" className="h-9 px-2"><i className="ri-download-line"></i></Button></a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messaging quick action */}
                <div className="bg-white rounded-xl p-4 border flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold flex items-center gap-2">
                    <i className="ri-chat-3-line"></i>
                    <span>Messaging</span>
                  </div>
                  <div className="relative">
                    <Button variant="outline" onClick={() => openChatWindow()} className="h-10 px-3 text-sm w-full sm:w-auto">
                      <i className="ri-window-2-line mr-2"></i>Open Chat Window
                    </Button>
                    {selectedTask?.unread_messages ? (
                      <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center">
                        {selectedTask.unread_messages}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right: Task List */}
          <aside className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Task Requests</h2>
              <Input
                ref={searchInputRef}
                placeholder="Search tasks… (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                <option value="all">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="budget_negotiation">Budget Negotiation</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_review">Awaiting Review</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="overflow-y-auto p-2 h-full">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-file-list-3-line text-6xl mb-4 text-gray-300"></i>
                  <p>No tasks found</p>
                </div>
              ) : (
                filteredTasks.map((task, idx) => {
                  const isSelected = selectedTask?.id === task.id
                  const isHighlighted = idx === selectedIndex
                  return (
                    <div
                      key={task.id}
                      onClick={() => { setSelectedTask(task); setSelectedIndex(idx) }}
                      className={`p-4 mb-2 rounded-xl border transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50 border-emerald-200' : isHighlighted ? 'bg-slate-50 border-slate-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                      } ${task.status === 'withdrawn' ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{task.title}</h3>
                        <div className="flex items-center gap-2">
                          {task.unread_messages > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px]">
                              {task.unread_messages}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusColor(task.status)}`}>
                            <i className={getStatusIcon(task.status)}></i>{formatStatus(task.status)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><i className="ri-user-line"></i>{task.client.full_name}</span>
                        <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                          <i className="ri-flag-line"></i>{task.priority}
                        </span>
                        {task.budget ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>${task.budget}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>Proposed: ${task.proposed_budget}</span>
                        )}
                      </div>
                      {task.revisions.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600">
                          <i className="ri-edit-line"></i>{task.revisions.length} revision{task.revisions.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Floating Chat Window */}
      {showChatWindow && selectedTask && (
        <>
          {chatMinimized ? (
            <button
              onClick={() => setChatMinimized(false)}
              className="fixed bottom-4 left-4 z-50 bg-white border border-gray-200 shadow-lg rounded-full px-4 h-11 flex items-center gap-2"
            >
              <i className="ri-message-3-line"></i>
              <span className="text-sm font-medium truncate max-w-[200px]">{selectedTask.title}</span>
            </button>
          ) : (
            <div
              ref={chatRef}
              style={{
                left: chatPos.x,
                top: chatPos.y,
                width: chatSize.w,
                height: chatSize.h,
                resize: 'both',
              }}
              className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Drag handle */}
              <div
                onMouseDown={onDragStart}
                className="px-3 py-2 border-b cursor-move select-none bg-gray-50 flex items-center justify-between"
              >
                <div className="font-semibold text-sm truncate">
                  <i className="ri-chat-3-line mr-2"></i>Chat • {selectedTask.title}
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={() => loadChatMessages(selectedTask.id)} variant="outline" size="sm" className="h-8 px-2"><i className="ri-refresh-line"></i></Button>
                  <button onClick={() => setChatMinimized(true)} className="w-8 h-8 rounded-lg hover:bg-gray-200 grid place-items-center" title="Minimize">
                    <i className="ri-subtract-line text-lg"></i>
                  </button>
                  <button onClick={closeChatWindow} className="w-8 h-8 rounded-lg hover:bg-gray-200 grid place-items-center" title="Close">
                    <i className="ri-close-line text-lg"></i>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    <i className="ri-chat-off-line text-5xl mb-3 text-gray-300"></i>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                          message.sender_role === 'admin'
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}>
                          <p className="text-sm leading-relaxed mb-1">{message.message}</p>
                          {message.file_url && (
                            <div className={`text-xs p-2 rounded-lg ${message.sender_role === 'admin' ? 'bg-white/20' : 'bg-gray-100'}`}>
                              <a href={message.file_url} download className="flex items-center gap-1 hover:underline">
                                <i className="ri-attachment-line"></i>{message.file_name || 'Download file'}
                              </a>
                            </div>
                          )}
                          <p className={`text-[10px] flex items-center gap-1 ${message.sender_role === 'admin' ? 'text-emerald-100' : 'text-gray-500'}`}>
                            <i className="ri-user-line"></i>{message.sender_role === 'admin' ? 'You' : selectedTask.client.full_name} • {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-2xl text-xs flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="ml-2">Student is typing…</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-gray-200 p-2 bg-white">
                {selectedTask.status === 'withdrawn' ? (
                  <p className="text-center text-gray-500 py-2 text-sm">Chat disabled for inactive task</p>
                ) : (
                  <>
                    {uploadedFiles.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-lg text-xs">
                            <i className="ri-file-line text-emerald-600"></i>
                            <span className="text-emerald-800">{file.name}</span>
                            <button onClick={() => removeFile(index)} className="text-emerald-600 hover:text-emerald-800"><i className="ri-close-line"></i></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input value={newMessage} onChange={handleMessageInputChange} onKeyPress={handleKeyPress} placeholder="Type your message..." className="flex-1 h-9" />
                      <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 px-2"><i className="ri-attachment-line"></i></Button>
                      <Button onClick={sendMessage} disabled={!newMessage.trim() && uploadedFiles.length === 0} className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 h-9">
                        <i className="ri-send-plane-fill"></i>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals (same as previous) ... */}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  )
}
