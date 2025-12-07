// src/pages/AdminDashboard.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'

// === HTTP BASES (env-aware, slash-safe) ===
const API_ROOT = (import.meta.env.VITE_API_BASE || window.location.origin).replace(/\/+$/, '');
const API_BASE = /\/api\/?$/.test(API_ROOT) ? API_ROOT : `${API_ROOT}/api`;

// API service
const apiService = {
  url(endpoint: string) {
    const clean = endpoint.replace(/^\/+/, '');          // trim leading /
    const withoutApi = clean.replace(/^api\/?/, '');     // avoid double /api
    return `${API_BASE}/${withoutApi}`;
  },
  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(this.url(endpoint), {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(this.url(endpoint), {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: data == null ? undefined : JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(this.url(endpoint), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
};

// Simple toast component
const Toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
  const bgColor = variant === 'destructive' ? 'bg-red-500' : 'bg-green-500'
  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm`}>
      <div className="font-bold">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  )
}

// WebSocket Hook with JWT Token Authentication (env-aware + robust reconnect)
const useWebSocketWithReconnect = (
  url: string | null,
  onMessage: (data: any) => void,
  deps: any[] = []
) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      setWs(null);
      return;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let attempt = 0;
    let socket: WebSocket | null = null;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No access token — cannot connect to WebSocket');
        return;
      }

      const ENV_WS_BASE =
        (import.meta as any).env?.VITE_WS_BASE ||
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

      const base = ENV_WS_BASE.replace(/\/$/, '');
      const path = url.startsWith('/') ? url : `/${url}`;
      const wsUrl = `${base}${path}?token=${encodeURIComponent(token)}`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWs(socket!);
        attempt = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      socket.onclose = () => {
        setWs(null);
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimeout = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        console.error('WebSocket error');
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      try { socket?.close(); } catch {}
    };
  }, [url, ...deps]);

  const sendMessage = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  return { sendMessage };
};

// Types based on your Django models
interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  profile: UserProfile
  full_name: string
}

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

interface TaskFile {
  id: number
  name: string
  file_type: string
  size: string
  uploaded_by: number
  uploaded_by_name: string
  uploaded_at: string
  description: string
  file_url: string
}

interface Revision {
  id: number
  requested_by: number
  requested_by_name: string
  requested_at: string
  feedback: string
  status: 'requested' | 'in_progress' | 'completed' | 'cancelled'
  completed_at?: string
  admin_notes: string
}

interface ChatMessage {
  id: number
  message: string
  file?: string
  file_name?: string
  file_url?: string
  is_read: boolean
  created_at: string
  sender: string
  sender_role: 'admin' | 'client'
}

interface TaskStats {
  total: number
  new_requests: number
  active: number
  under_review: number
  completed: number
  recent: number
}

interface AdminStats {
  assigned_tasks: number
  completed_tasks: number
  total_earnings: number
  rating: number
}

// Timezone options
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

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [currentToast, setCurrentToast] = useState<{ title: string; description: string; variant?: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
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
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0, new_requests: 0, active: 0, under_review: 0, completed: 0, recent: 0
  })
  const [adminStats, setAdminStats] = useState<AdminStats>({
    assigned_tasks: 0, completed_tasks: 0, total_earnings: 0, rating: 0
  })
  const [loading, setLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Toast helper
  const showToast = (title: string, description: string, variant?: string) => {
    setCurrentToast({ title, description, variant })
    setTimeout(() => setCurrentToast(null), 3000)
  }

  // Admin-level WS (updates, new tasks, etc.)
  const { sendMessage: _sendAdminMessage } = useWebSocketWithReconnect('/ws/admin/', (data) => {
    if (data.type === 'task_updated' && data.task) {
      const updatedTask: Task = data.task;
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      setSelectedTask(prev => (prev && prev.id === updatedTask.id ? { ...updatedTask } : prev));
      loadStats();

      if (updatedTask.status === 'awaiting_review') {
        const isRevision = updatedTask.revisions && updatedTask.revisions.length > 0;
        showToast(
          "Submitted Successfully",
          isRevision ? "Revised work is now awaiting student approval" : "Final assignment submitted",
          "success"
        );
      }
      if (updatedTask.negotiation_status === 'pending_admin_response') {
        showToast("New Counter-Offer", `Student countered with $${updatedTask.proposed_budget}`, "default");
      } else if (updatedTask.negotiation_status === 'accepted') {
        showToast("Budget Accepted", "Student accepted your offer!", "success");
      }
    }
    if (data.type === "task_created") {
      const newTask: Task = data.task;
      setTasks(current => (current.some(t => t.id === newTask.id) ? current : [newTask, ...current]));
      showToast("New Task", `Task #${newTask.id} created`, "default");
    }
  });

  // Task-specific WS (chat + typing)
  const { sendMessage: sendTaskMessage } = useWebSocketWithReconnect(
    selectedTask ? `/ws/task/${selectedTask.id}/` : null,
    (data) => {
      if (data.type === 'chat_message' && data.message) {
        setChatMessages(prev => {
          const filtered = prev.filter(msg => !(msg.id > 1000000 && msg.message === data.message.message));
          return [...filtered, data.message];
        });
        setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
      }
      if (data.type === 'user_typing') {
        if (data.username !== currentUser?.username) setIsTyping(data.is_typing);
      }
    },
    [selectedTask?.id]
  );

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load chat when task changes
  useEffect(() => {
    if (selectedTask) loadChatMessages(selectedTask.id);
  }, [selectedTask?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const loadInitialData = async () => {
    try {
      setLoading(true)

      const userData = await apiService.get<User>('/auth/user/')
      setCurrentUser(userData)

      const tasksData = await apiService.get<Task[]>('/tasks/')
      setTasks(tasksData)
      if (tasksData.length > 0) setSelectedTask(tasksData[0])

      await loadStats()
      showToast("Dashboard Loaded", "Your dashboard has been loaded successfully")
    } catch (error) {
      console.error('Failed to load data:', error)
      showToast("Error", "Failed to load dashboard data", "destructive")
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await apiService.get<{ task_stats: TaskStats; admin_stats: AdminStats }>('/admin/stats/')
      setTaskStats(statsData.task_stats)
      setAdminStats(statsData.admin_stats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadChatMessages = async (taskId: number) => {
    try {
      const messages = await apiService.get<ChatMessage[]>(`/tasks/${taskId}/chat/`)
      setChatMessages(messages)
      setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100)
      try { await apiService.post(`/tasks/${taskId}/mark-read/`); } catch {}
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      showToast("Error", "Failed to load chat messages", "destructive")
    }
  }

  const handleTyping = (typing: boolean) => {
    if (selectedTask) {
      sendTaskMessage({ type: 'typing', is_typing: typing });
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      handleTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      handleTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    if (!selectedTask) return;

    let optimisticId: number | null = null;

    try {
      setIsTyping(false);
      handleTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

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
      optimisticId = optimisticMessage.id;
      setChatMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        if (newMessage.trim()) formData.append('message', newMessage.trim());
        uploadedFiles.forEach(file => formData.append('file', file));
        await apiService.postFormData(`/tasks/${selectedTask.id}/chat/`, formData);
      } else {
        await apiService.post(`/tasks/${selectedTask.id}/chat/`, { message: newMessage.trim() });
      }

      setNewMessage('');
      setUploadedFiles([]);
      setTimeout(() => { loadChatMessages(selectedTask.id); }, 500);
    } catch (error) {
      console.error('Failed to send message:', error);
      if (optimisticId !== null) {
        setChatMessages(prev => prev.filter(msg => msg.id !== optimisticId!));
      }
      showToast("Error", "Failed to send message", "destructive");
    }
  };

  const refreshChat = () => {
    if (selectedTask) {
      loadChatMessages(selectedTask.id);
      showToast("Chat Refreshed", "Chat messages have been refreshed");
    }
  };

  const acceptTask = async (taskId: number) => {
    try {
      await apiService.post(`/admin/tasks/${taskId}/accept/`)
      showToast("Task Accepted", "Student has been notified via email.")
    } catch (error) {
      console.error('Failed to accept task:', error)
      showToast("Error", "Failed to accept task", "destructive")
    }
  }

  const acceptBudget = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const agreedBudget = task.proposed_budget || task.admin_counter_budget || task.budget;

    const optimisticTask: Task = {
      ...task,
      budget: agreedBudget,
      negotiation_status: 'accepted',
      status: 'in_progress',
    };

    setTasks(prev => prev.map(t => t.id === taskId ? optimisticTask : t));
    setSelectedTask(prev => (prev && prev.id === taskId ? optimisticTask : prev));

    try {
      await apiService.post(`/admin/tasks/${taskId}/accept-budget/`);
      showToast("Budget Accepted", "Work will begin shortly. Student has been notified via email.");
    } catch (error) {
      console.error('Failed to accept budget:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      setSelectedTask(prev => (prev && prev.id === taskId ? task : prev));
      showToast("Error", "Failed to accept budget", "destructive");
    }
  }

  const proposeBudget = async () => {
    if (!selectedTask || !counterBudget || !negotiationReason.trim()) return;

    const newBudget = parseFloat(counterBudget);

    const updatedTask: Task = {
      ...selectedTask,
      status: 'budget_negotiation',
      negotiation_status: 'pending_student_response',
      admin_counter_budget: newBudget,
      negotiation_reason: negotiationReason.trim(),
    };

    setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);

    try {
      await apiService.post(`/admin/tasks/${selectedTask.id}/propose-budget/`, {
        amount: newBudget,
        reason: negotiationReason.trim()
      });
      setShowBudgetNegotiation(false);
      setCounterBudget('');
      setNegotiationReason('');
      showToast("Counter-Offer Sent", "Student has been notified.", "default");
    } catch (error) {
      console.error('Failed to propose budget:', error);
      showToast("Error", "Failed to send counter-offer", "destructive");
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? selectedTask : t));
      setSelectedTask(selectedTask);
    }
  };

  const rejectTask = async () => {
    if (!selectedTask || !rejectReason.trim()) return
    try {
      await apiService.post(`/admin/tasks/${selectedTask.id}/reject/`, { reason: rejectReason })
      setShowRejectModal(false)
      setRejectReason('')
      showToast("Task Rejected", "Student has been notified.")
    } catch (error) {
      console.error('Failed to reject task:', error)
      showToast("Error", "Failed to reject task", "destructive")
    }
  }

  const submitForReview = async (taskId: number) => {
    try {
      await apiService.post(`/admin/tasks/${taskId}/submit-review/`)
      showToast("Submitted for Review", "Task has been submitted for student review.")
    } catch (error) {
      console.error('Failed to submit for review:', error)
      showToast("Error", "Failed to submit task for review", "destructive")
    }
  }

  const markComplete = async (taskId: number) => {
    try {
      await apiService.post(`/admin/tasks/${taskId}/mark-complete/`)
      await loadStats();
      showToast("Task Completed", "Task has been marked as completed.")
    } catch (error) {
      console.error('Failed to mark task complete:', error)
      showToast("Error", "Failed to mark task as complete", "destructive")
    }
  }

  const backToProgress = async (taskId: number) => {
    try {
      await apiService.post(`/admin/tasks/${taskId}/update-progress/`, { progress: 80 })
    } catch (error) {
      console.error('Failed to update task progress:', error)
      showToast("Error", "Failed to update task progress", "destructive")
    }
  }

  const updateProgress = async () => {
    if (!selectedTask || !progressUpdate.trim()) return
    try {
      const newProgress = Math.min(selectedTask.progress + 20, 95)
      await apiService.post(`/admin/tasks/${selectedTask.id}/update-progress/`, {
        progress: newProgress, message: progressUpdate
      })
      setShowProgressModal(false)
      setProgressUpdate('')
      showToast("Progress Updated", "Task progress has been updated.")
    } catch (error) {
      console.error('Failed to update progress:', error)
      showToast("Error", "Failed to update progress", "destructive")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
  }
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // --- Authenticated download helper ---
const downloadFile = async (file: TaskFile) => {
  try {
    const token = localStorage.getItem('access_token');

    // Prefer a backend download endpoint; fall back to serializer URL
    const fallback = file.file_url || `/files/${file.id}/download/`;
    const url = fallback.startsWith('http')
      ? fallback
      : `${API_BASE}${fallback.startsWith('/') ? '' : '/'}${fallback}`;

    const isSameOrigin =
      url.startsWith(window.location.origin) || url.startsWith(API_BASE);

    if (isSameOrigin) {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } else {
      // Public URL (e.g., S3)
      window.open(url, '_blank');
    }
  } catch (err) {
    console.error('Download error:', err);
    setCurrentToast({
      title: 'Error',
      description: 'Failed to download file.',
      variant: 'destructive',
    });
    setTimeout(() => setCurrentToast(null), 3000);
  }
};


  const handleLogout = () => {
    logout()
    navigate('/')
    showToast("Logged out", "You have been successfully logged out.")
  }

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
  const formatStatus = (status: string) =>
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
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

  const getActionButtons = (task: Task) => {
    if (task.status === 'awaiting_review') {
      return (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl text-center">
          <i className="ri-time-line text-5xl text-purple-700 mb-3 block animate-pulse"></i>
          <p className="text-xl font-bold text-purple-900">Waiting for Student Approval</p>
          <p className="text-sm text-purple-700 mt-2">
            {task.revisions.length > 0 ? "Your revised work has been submitted." : "Your final assignment has been submitted."}
          </p>
        </div>
      )
    }
    if (task.status === 'revision_requested') {
      return (
        <div className="space-y-4">
          <Button
            onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]) }}
            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-medium text-base rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <i className="ri-upload-2-line text-lg"></i>
            Re-Submit Revised Assignment
          </Button>
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm">
            <p className="font-bold text-red-800 mb-1">Student Feedback:</p>
            <p className="text-red-700 leading-snug">{task.revisions?.[0]?.feedback || "No feedback provided"}</p>
          </div>
        </div>
      )
    }
    if (task.status === 'budget_negotiation' && task.negotiation_status === 'pending_student_response') {
      return (
        <div className="mb-8 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-2xl text-center">
          <i className="ri-hourglass-line text-5xl text-yellow-700 mb-3 block"></i>
          <p className="text-xl font-bold text-yellow-900">Awaiting Student Response</p>
          <p className="text-sm text-yellow-800 mt-2">Your counter-offer of <strong>${task.admin_counter_budget}</strong> is pending</p>
        </div>
      )
    }
    if (task.status === 'budget_negotiation' && task.negotiation_status === 'pending_admin_response') {
      return (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => acceptBudget(task.id)} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base">
            Accept Student Offer (${task.proposed_budget})
          </Button>
          <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="flex-1 h-12 border-orange-500 text-orange-600 hover:bg-orange-50 font-medium">
            Counter Offer
          </Button>
        </div>
      )
    }
    if (task.status === 'in_progress') {
      return (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]) }}
            className="flex-1 h-14 bg-purple-600 hover:bg-purple-700 text-white font-medium text-base rounded-xl shadow-md"
          >
            <i className="ri-upload-cloud-2-line mr-2"></i>
            Submit Final Assignment
          </Button>
          <Button
            onClick={() => { setSelectedTask(task); setShowProgressModal(true) }}
            variant="outline"
            className="flex-1 h-14 border-blue-500 text-blue-700 hover:bg-blue-50 font-medium"
          >
            <i className="ri-bar-chart-line mr-2"></i>
            Update Progress
          </Button>
        </div>
      )
    }
    if (task.status === 'submitted') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={() => acceptTask(task.id)} className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base">
            <i className="ri-check-line mr-2"></i>
            Accept & Start
          </Button>
          <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="h-12 border-orange-500 text-orange-600 hover:bg-orange-50">
            <i className="ri-money-dollar-circle-line mr-2"></i>
            Propose Budget
          </Button>
          <Button onClick={() => setShowRejectModal(true)} variant="outline" className="h-12 border-red-500 text-red-600 hover:bg-red-50">
            <i className="ri-close-line mr-2"></i>
            Reject
          </Button>
        </div>
      )
    }
    if (['completed', 'rejected', 'withdrawn', 'cancelled'].includes(task.status)) {
      const isCompleted = task.status === 'completed'
      return (
        <div className={`p-6 rounded-2xl text-center font-bold text-lg border-2 ${isCompleted ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-gray-50 text-gray-600 border-gray-300'}`}>
          <i className={isCompleted ? 'ri-checkbox-circle-fill text-5xl block mb-3' : 'ri-forbid-line text-5xl block mb-3'}></i>
          {isCompleted ? 'Task Completed' : 'Task Inactive'}
        </div>
      )
    }
    return null
  }

  const submitFinalAssignment = async () => {
    if (!selectedTask || uploadedFiles.length === 0) return;
    try {
      const formData = new FormData();
      uploadedFiles.forEach(f => formData.append("solution", f));
      await apiService.postFormData(`/admin/tasks/${selectedTask.id}/upload-solution/`, formData)
      setShowSubmitFinalModal(false);
      setUploadedFiles([]);
      setCurrentToast({ title: "Success", description: "Final assignment submitted! Waiting for student approval." });
      setTimeout(() => setCurrentToast(null), 4000);
    } catch (error) {
      console.error("Upload failed:", error);
      setCurrentToast({ title: "Upload Failed", description: "Please try again.", variant: "destructive" });
      setTimeout(() => setCurrentToast(null), 4000);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

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

      <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-xl">
                <i className="ri-admin-line text-3xl text-white"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-transparent bg-clip-text">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome back, {currentUser?.first_name || 'Admin'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleLogout} variant="outline" className="whitespace-nowrap">
                <i className="ri-logout-box-r-line mr-2"></i>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <i className="ri-file-list-3-line text-emerald-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">Total Tasks</p><p className="text-2xl font-bold text-gray-900">{taskStats.total}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <i className="ri-file-add-line text-amber-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">New Requests</p><p className="text-2xl font-bold text-gray-900">{taskStats.new_requests}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="ri-loader-4-line text-blue-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-gray-900">{taskStats.active}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <i className="ri-eye-line text-purple-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">Under Review</p><p className="text-2xl font-bold text-gray-900">{taskStats.under_review}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <i className="ri-checkbox-circle-line text-emerald-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-gray-900">{taskStats.completed}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <i className="ri-time-line text-orange-600"></i>
                </div>
                <div><p className="text-sm text-gray-500">Recent</p><p className="text-2xl font-bold text-gray-900">{taskStats.recent}</p></div>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Task Requests</h2>
                <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-4" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="budget_negotiation">Budget Negotiation</option>
                  <option value="in_progress">In Progress</option>
                  <option value="awaiting_review">Awaiting Review</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="overflow-y-auto h-[calc(100vh-400px)]">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <i className="ri-file-list-3-line text-6xl mb-4 text-gray-300"></i>
                    <p>No tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-6 border-b border-gray-100 hover:bg-emerald-50 cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'bg-emerald-50' : ''} ${task.status === 'withdrawn' ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-gray-900 text-lg line-clamp-2">{task.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}>
                          <i className={getStatusIcon(task.status)}></i>
                          {formatStatus(task.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><i className="ri-user-line"></i>{task.client.full_name}</span>
                        <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-2">
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                          <i className="ri-flag-line"></i>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                        {task.budget ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>${task.budget}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>Proposed: ${task.proposed_budget}</span>
                        )}
                      </div>
                      {task.revisions.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                          <i className="ri-edit-line"></i>
                          {task.revisions.length} revision{task.revisions.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Task Details + Chat */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold text-gray-900 mb-3">{selectedTask.title}</h2>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg"><i className="ri-book-line"></i>{selectedTask.subject}</span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg"><i className="ri-graduation-cap-line"></i>{selectedTask.education_level}</span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg"><i className="ri-calendar-line"></i>Due: {new Date(selectedTask.deadline).toLocaleDateString()}</span>
                        {selectedTask.timezone_str && (
                          <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg"><i className="ri-time-zone-line"></i>{timezones.find(tz => tz.value === selectedTask.timezone_str)?.label || selectedTask.timezone_str}</span>
                        )}
                        <span className={`flex items-center gap-2 px-3 py-1 rounded-lg font-semibold ${getPriorityColor(selectedTask.priority)}`}><i className="ri-flag-line"></i>{selectedTask.priority} priority</span>
                        {selectedTask.budget && (
                          <span className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-semibold"><i className="ri-money-dollar-circle-line"></i>${selectedTask.budget}</span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border ${getStatusColor(selectedTask.status)}`}>
                      <i className={getStatusIcon(selectedTask.status)}></i>
                      {formatStatus(selectedTask.status)}
                    </span>
                  </div>

                  {selectedTask.status === 'submitted' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-6">
                      <h3 className="font-bold text-orange-900 mb-3 text-lg flex items-center gap-2"><i className="ri-money-dollar-circle-line"></i>Budget Review</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">Student's Proposed Budget</p>
                          <p className="text-2xl font-bold text-blue-600">${selectedTask.proposed_budget}</p>
                        </div>
                        {selectedTask.admin_counter_budget && (
                          <div className="bg-white rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Your Counter-Offer</p>
                            <p className="text-2xl font-bold text-orange-600">${selectedTask.admin_counter_budget}</p>
                          </div>
                        )}
                      </div>
                      {selectedTask.negotiation_reason && (
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-600 mb-2">Your Explanation:</p>
                          <p className="text-gray-800">{selectedTask.negotiation_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTask.budget && selectedTask.negotiation_status === 'accepted' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
                      <h3 className="font-bold text-emerald-900 mb-3 text-lg flex items-center gap-2"><i className="ri-checkbox-circle-line"></i>Budget Agreed</h3>
                      <p className="text-2xl font-bold text-emerald-600">${selectedTask.budget}</p>
                    </div>
                  )}

                  {selectedTask.status === 'budget_negotiation' && selectedTask.negotiation_status === 'pending_student_response' && (
                    <div className="mb-6 p-6 bg-yellow-50 border-2 border-yellow-300 rounded-2xl text-yellow-900 text-center">
                      <i className="ri-time-line text-3xl mb-2 block"></i>
                      <p className="text-xl font-bold">Awaiting Student to approve offer</p>
                      <p className="text-sm mt-2">Your counter-offer of <strong>${selectedTask.admin_counter_budget}</strong> has been sent.</p>
                    </div>
                  )}

                  <div className="mb-6">
                    {getActionButtons(selectedTask)}
                  </div>

                  {selectedTask.status === 'in_progress' && (
                    <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-900 text-lg">Task Progress</h3>
                        <span className="text-2xl font-bold text-emerald-600">{selectedTask.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-4 rounded-full transition-all duration-500" style={{ width: `${selectedTask.progress}%` }}></div>
                      </div>
                      <p className="text-sm text-gray-600">Estimated: {selectedTask.estimated_hours} hours</p>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3 text-lg">Task Description</h3>
                    <p className="text-gray-700 leading-relaxed">{selectedTask.description}</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3 text-lg">Student Information</h3>
                    <div className="flex items-center gap-4">
                      {selectedTask.client.profile?.avatar && (
                        <img src={selectedTask.client.profile.avatar} alt={selectedTask.client.full_name} className="w-16 h-16 rounded-full object-cover object-top border-3 border-emerald-200 shadow-lg" />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-lg">{selectedTask.client.full_name}</p>
                        <p className="text-sm text-gray-600 mb-1">{selectedTask.client.email}</p>
                        {selectedTask.client.profile?.education_level && (
                          <p className="text-sm text-gray-600">{selectedTask.client.profile.education_level}</p>
                        )}
                      </div>
                      <Button variant="outline" className="whitespace-nowrap">
                        <i className="ri-mail-line mr-2"></i>
                        Contact
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                      <i className="ri-folder-line"></i>
                      Project Files ({selectedTask.files.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedTask.files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <i className={`${getFileIcon(file.file_type)} text-emerald-600`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.size} • {file.uploaded_by_name}</p>
                          </div>
                         <Button
                          size="sm"
                          variant="outline"
                          className="whitespace-nowrap"
                          onClick={() => downloadFile(file)}
                        >
                          <i className="ri-download-line"></i>
                        </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedTask.revisions.length > 0 && (
                  <div className="p-6 border-b border-gray-100 bg-orange-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-edit-line"></i>
                      Revision History ({selectedTask.revisions.length})
                    </h3>
                    <div className="space-y-4">
                      {selectedTask.revisions.map((revision) => (
                        <div key={revision.id} className="bg-white rounded-xl p-4 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm text-gray-500">
                              {new Date(revision.requested_at).toLocaleDateString()} at {new Date(revision.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${revision.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                              {revision.status === 'completed' ? 'Completed' : 'In Progress'}
                            </span>
                          </div>
                          <p className="text-gray-700">{revision.feedback}</p>
                          {revision.completed_at && (
                            <p className="text-xs text-green-600 mt-2">Completed on {new Date(revision.completed_at).toLocaleDateString()}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <i className="ri-chat-3-line"></i>
                      Communication with {selectedTask.client.full_name}
                    </h3>
                    <Button onClick={refreshChat} variant="outline" size="sm" className="whitespace-nowrap">
                      <i className="ri-refresh-line mr-2"></i>
                      Refresh
                    </Button>
                  </div>

                  <div className="bg-gray-50 rounded-2xl border border-gray-200 h-96 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">
                          <i className="ri-chat-off-line text-6xl mb-4 text-gray-300"></i>
                          <p className="text-lg">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        <>
                          {chatMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${message.sender_role === 'admin'
                                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white'
                                : 'bg-white text-gray-900 border border-gray-200'
                                }`}>
                                <p className="text-sm leading-relaxed mb-2">{message.message}</p>
                                {message.file_url && (
                                  <div className="mb-2">
                                    <div className={`text-xs p-2 rounded-lg ${message.sender_role === 'admin' ? 'bg-white/20' : 'bg-gray-100'}`}>
                                      <button
                                        className="flex items-center gap-1 hover:underline"
                                        onClick={() =>
                                          downloadFile({
                                            id: 0, // if you have a real id on the message, use it instead of 0
                                            name: message.file_name || 'file',
                                            file_type: '',
                                            size: '',
                                            uploaded_by: 0,
                                            uploaded_by_name: '',
                                            uploaded_at: '',
                                            description: '',
                                            file_url: message.file_url || '',
                                          })
                                        }
                                      >
                                        <i className="ri-attachment-line"></i>
                                        {message.file_name || 'Download file'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                <p className={`text-xs flex items-center gap-1 ${message.sender_role === 'admin' ? 'text-emerald-100' : 'text-gray-500'}`}>
                                  <i className="ri-user-line"></i>
                                  {message.sender_role === 'admin' ? 'You' : selectedTask.client.full_name} • {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                          {isTyping && (
                            <div className="flex justify-start">
                              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  <span className="text-xs ml-2">Student is typing...</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </>
                      )}
                    </div>

                    <div className="border-t border-gray-200 p-4 bg-white rounded-b-2xl">
                      {selectedTask.status === 'withdrawn' ? (
                        <p className="text-center text-gray-500 py-3">Chat disabled for inactive task</p>
                      ) : (
                        <>
                          {uploadedFiles.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {uploadedFiles.map((file, index) => (
                                <div key={index} className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-lg text-sm">
                                  <i className="ri-file-line text-emerald-600"></i>
                                  <span className="text-emerald-800">{file.name}</span>
                                  <button onClick={() => removeFile(index)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
                                    <i className="ri-close-line"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input
                              value={newMessage}
                              onChange={handleMessageInputChange}
                              onKeyPress={handleKeyPress}
                              placeholder="Type your message..."
                              className="flex-1"
                            />
                            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="whitespace-nowrap">
                              <i className="ri-attachment-line"></i>
                            </Button>
                            <Button
                              onClick={sendMessage}
                              disabled={!newMessage.trim() && uploadedFiles.length === 0}
                              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 text-white whitespace-nowrap px-6"
                            >
                              <i className="ri-send-plane-fill"></i>
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl p-16 text-center border border-gray-100">
                <i className="ri-file-list-3-line text-8xl text-gray-300 mb-6"></i>
                <p className="text-gray-500 text-xl">Select a task to view details and communicate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget Negotiation Modal */}
      {showBudgetNegotiation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Propose Budget</h3>
              <button onClick={() => setShowBudgetNegotiation(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Student's Proposed Budget:</span>
                  <span className="font-bold text-lg">${selectedTask?.proposed_budget}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Counter-Offer (USD)</label>
                <Input
                  type="number"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  placeholder="Enter your proposed budget"
                  min="0"
                  step="10"
                  className="text-lg py-3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Explanation for Budget Adjustment</label>
                <Textarea
                  value={negotiationReason}
                  onChange={(e) => setNegotiationReason(e.target.value)}
                  placeholder="Explain why you're proposing a different budget (e.g., complexity, time required, expertise needed)..."
                  rows={4}
                  className="text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowBudgetNegotiation(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={proposeBudget} disabled={!counterBudget || !negotiationReason.trim()} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap">
                Send Counter-Offer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Task Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Reject Task</h3>
              <button onClick={() => setShowRejectModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-3">Reason for Rejection</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please explain why you're rejecting this task..."
                rows={6}
                className="text-lg"
                required
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setShowRejectModal(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={rejectTask} disabled={!rejectReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white whitespace-nowrap">Reject Task</Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Update Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Update Progress</h3>
              <button onClick={() => setShowProgressModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-3">Progress Update</label>
              <Textarea
                value={progressUpdate}
                onChange={(e) => setProgressUpdate(e.target.value)}
                placeholder="Describe what you've completed and what's next..."
                rows={6}
                className="text-lg"
                required
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setShowProgressModal(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={updateProgress} disabled={!progressUpdate.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">Update Progress</Button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Final Assignment Modal */}
      {showSubmitFinalModal && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Submit Final Assignment</h3>
              <button onClick={() => { setShowSubmitFinalModal(false); setUploadedFiles([]) }} className="w-12 h-12 rounded-full hover:bg-gray-100 transition">
                Close
              </button>
            </div>

            <div className="text-center mb-8">
              <i className="ri-file-upload-line text-8xl text-purple-600 mb-4"></i>
              <p className="text-xl text-gray-700">Upload the completed assignment</p>
            </div>

            <div className="mb-6">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="block w-full text-lg text-gray-700 file:mr-6 file:py-4 file:px-8 file:rounded-full file:border-0 file:text-lg file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="bg-purple-50 rounded-2xl p-6 mb-6">
                <p className="font-semibold text-purple-900 mb-3">Ready to submit:</p>
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-purple-800 font-medium">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-600 hover:text-red-800">Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={() => { setShowSubmitFinalModal(false); setUploadedFiles([]) }} variant="outline" className="flex-1 text-lg py-6">Cancel</Button>
              <Button onClick={submitFinalAssignment} disabled={uploadedFiles.length === 0} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-6">
                Submit for Student Review
              </Button>
            </div>
          </div>
        </div>
      )}

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
