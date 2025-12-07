import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'

// Simple toast hook replacement
const useToast = () => {
  const [toast, setToast] = useState<{ title: string; description: string; variant?: string } | null>(null)
  const showToast = (title: string, description: string, variant?: string) => {
    setToast({ title, description, variant })
    setTimeout(() => setToast(null), 3000)
  }
  return {
    toast: showToast
  }
}

// Toast Component
const Toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
  const bgColor = variant === 'destructive' ? 'bg-red-500' : 'bg-green-500'
  return (
    <div
      className={`
        fixed top-4 right-4
        ${bgColor}
        text-white p-4 rounded-lg shadow-lg
        z-[9999] pointer-events-none
        max-w-sm
      `}
    >
      <div className="font-bold">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  )
}

// WebSocket Hook with JWT Token Authentication
const useWebSocketWithReconnect = (url: string | null, onMessage: (data: any) => void, deps: any[] = []) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      setWs(null);
      return;
    }

    let reconnectTimeout: NodeJS.Timeout;
    let attempt = 0;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No access token — cannot connect to WebSocket');
        return;
      }

      // Prefer env WS base (e.g. wss://academiqa-backend-production.up.railway.app)
      const ENV_WS_BASE =
        (import.meta as any).env?.VITE_WS_BASE ||
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

      const base = ENV_WS_BASE.replace(/\/$/, '');
      const path = url.startsWith('/') ? url : `/${url}`;
      const wsUrl = `${base}${path}?token=${encodeURIComponent(token)}`;
      console.log("[WS] connecting →", wsUrl);

      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('WebSocket connected:', wsUrl);
        setWs(websocket);
        attempt = 0;
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected — reconnecting...');
        setWs(null);
        const delay = Math.min(1000 * (2 ** attempt), 30000);
        attempt++;
        reconnectTimeout = setTimeout(connect, delay);
      };

      websocket.onerror = () => {
        console.error('WebSocket error');
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws?.readyState === WebSocket.OPEN) ws.close();
    };
  }, [url, ...deps]);

  const sendMessage = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  return { sendMessage };
};

// === HTTP BASES (put this just above apiService) ===
const API_ROOT = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = /\/api\/?$/.test(API_ROOT) ? API_ROOT : `${API_ROOT}/api`;

// API service functions
const apiService = {
  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: data == null ? undefined : JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined, // let browser set boundary
      body: formData,
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
};

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
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)'}
]

export default function ClientDashboard() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { toast } = useToast()
  const [currentToast, setCurrentToast] = useState<{ title: string; description: string; variant?: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showBudgetNegotiation, setShowBudgetNegotiation] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [counterBudget, setCounterBudget] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Create task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    subject: '',
    education_level: '',
    deadline: '',
    timezone: 'America/New_York',
    budget: ''
  })

  // Custom toast function
  const showToast = (title: string, description: string, variant?: string) => {
    setCurrentToast({ title, description, variant })
    setTimeout(() => setCurrentToast(null), 3000)
  }

  // WebSocket for client dashboard updates
  const { sendMessage: sendClientMessage } = useWebSocketWithReconnect('/ws/client/', (data) => {
    console.log('Client WebSocket message:', data);

    if (data.type === 'task_updated' && data.task) {
      setTasks(prev => prev.map(task =>
        task.id === data.task.id ? { ...task, ...data.task } : task
      ));

      if (selectedTask && selectedTask.id === data.task.id) {
        setSelectedTask(prev => ({ ...prev, ...data.task }));
      }

      showToast("Task Updated", "Task has been updated in real-time");
    }

    if (data.type === 'task_created' && data.task) {
      setTasks(prev => [data.task, ...prev]);
      showToast("New Task", "New task has been created successfully");
    }
  });

  // Task-specific WebSocket - reinitialize when selectedTask changes
  const { sendMessage: sendTaskMessage } = useWebSocketWithReconnect(
    selectedTask ? `/ws/task/${selectedTask.id}/` : null,
    (data) => {
      console.log('Task WebSocket message:', data);

      if (data.type === 'chat_message' && data.message) {
        setChatMessages(prev => {
          // Already have this exact saved message?
          if (prev.some(m => m.id === data.message.id)) return prev;

          let changed = false;
          const next = prev.map(m => {
            const matchByText =
              m.id > 1000000 &&
              !!data.message.message &&
              m.message === data.message.message;

            const matchPendingFile =
              m.id > 1000000 &&
              m.file_url === 'pending' &&
              !!data.message.file_url;

            if (matchByText || matchPendingFile) {
              changed = true;
              return data.message;
            }
            return m;
          });

          return changed ? next : [...prev, data.message];
        });

        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

      if (data.type === 'user_typing') {
        if (data.username !== currentUser?.username) {
          setIsTyping(data.is_typing);
        }
      }

      if (data.type === 'task_updated' && data.task) {
        setTasks(prev => prev.map(task =>
          task.id === data.task.id ? { ...task, ...data.task } : task
        ));
        if (selectedTask && selectedTask.id === data.task.id) {
          setSelectedTask(prev => ({ ...prev, ...data.task }));
        }
      }
    },
    [selectedTask?.id]
  );

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load chat messages when selected task changes
  useEffect(() => {
    if (selectedTask) {
      loadChatMessages(selectedTask.id);
    }
  }, [selectedTask?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const loadInitialData = async () => {
    try {
      setLoading(true)

      // Load current user
      const userData = await apiService.get<any>('/auth/user/')
      setCurrentUser(userData)

      // Load tasks
      const tasksData = await apiService.get<any[]>('/tasks/')
      setTasks(tasksData)
      if (tasksData.length > 0) {
        setSelectedTask(tasksData[0])
      }
      showToast("Dashboard Loaded", "Your dashboard has been loaded successfully")
    } catch (error) {
      console.error('Failed to load data:', error)
      showToast("Error", "Failed to load dashboard data", "destructive")
    } finally {
      setLoading(false)
    }
  }

  const loadChatMessages = async (taskId: number) => {
    try {
      const messages = await apiService.get<any[]>(`/tasks/${taskId}/chat/`)
      setChatMessages(messages)

      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      showToast("Error", "Failed to load chat messages", "destructive")
    }
  }

  const handleTyping = (typing: boolean) => {
    if (selectedTask && sendTaskMessage) {
      sendTaskMessage({
        type: 'typing',
        is_typing: typing
      });
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Handle typing indicators
    if (!isTyping) {
      setIsTyping(true);
      handleTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      handleTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newMessage.trim()) {
        sendMessage()
      }
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    if (!selectedTask) return;

    let optimisticId: number | null = null;

    try {
      // stop typing indicator
      setIsTyping(false);
      handleTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // 1) add an optimistic bubble immediately
      const optimisticMessage = {
        id: Date.now(),                                // temp id
        message: newMessage.trim(),
        sender: currentUser?.username || 'You',
        sender_role: 'client',
        created_at: new Date().toISOString(),
        is_read: false,
        ...(uploadedFiles.length > 0
          ? { file_url: 'pending', file_name: uploadedFiles[0]?.name }
          : {}),
      };
      optimisticId = optimisticMessage.id;
      setChatMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // 2) POST and capture the *saved* message from the API
      let saved: any;
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        if (newMessage.trim()) formData.append('message', newMessage.trim());
        uploadedFiles.forEach(file => formData.append('file', file));
        saved = await apiService.postFormData<any>(`/tasks/${selectedTask.id}/chat/`, formData);
      } else {
        saved = await apiService.post<any>(`/tasks/${selectedTask.id}/chat/`, {
          message: newMessage.trim(),
        });
      }

      // 3) replace the optimistic bubble with the real one
      setChatMessages(prev => prev.map(m => (m.id === optimisticId ? saved : m)));

      // 4) clear inputs
      setNewMessage('');
      setUploadedFiles([]);
    } catch (error: any) {
      // rollback optimistic on error
      if (optimisticId !== null) {
        setChatMessages(prev => prev.filter(m => m.id !== optimisticId));
      }
      console.error('Failed to send message:', error);
      showToast("Error", "Failed to send message: " + error.message, "destructive");
    }
  };

  const refreshChat = () => {
    if (selectedTask) {
      loadChatMessages(selectedTask.id);
      showToast("Chat Refreshed", "Chat messages have been refreshed");
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Optimistic toast right away (no waiting)
    showToast("Submitting…", "We're creating your assignment now.");

    // 2) Build the request payload
    const formData = new FormData();
    formData.append('title', taskForm.title);
    formData.append('description', taskForm.description);
    formData.append('subject', taskForm.subject);
    formData.append('education_level', taskForm.education_level);
    formData.append('deadline', taskForm.deadline);
    formData.append('timezone_str', taskForm.timezone);
    formData.append('proposed_budget', taskForm.budget);
    uploadedFiles.forEach((file) => formData.append('file', file));

    // 3) Optimistically add a temp task so UI feels instant
    const tempId = Date.now();
    const optimisticTask = {
      id: tempId,
      title: taskForm.title,
      description: taskForm.description,
      subject: taskForm.subject,
      education_level: taskForm.education_level,
      deadline: taskForm.deadline,
      timezone_str: taskForm.timezone,
      proposed_budget: taskForm.budget,
      status: 'submitted',
      negotiation_status: 'pending_admin_review',
      files: [],
      revisions: [],
      chat: [],
    };

    setTasks(prev => [optimisticTask, ...prev]);
    setSelectedTask(optimisticTask);
    setShowCreateTask(false); // close immediately for snappy UX

    try {
      const newTask = await apiService.postFormData<any>('/tasks/', formData);

      // 4) Reconcile optimistic task with the real one
      setTasks(prev => prev.map(t => (t.id === tempId ? newTask : t)));
      setSelectedTask(newTask);

      // Success toast
      showToast("Success", "Task submitted successfully!");
    } catch (error: any) {
      // Rollback optimistic task on error
      setTasks(prev => prev.filter(t => t.id !== tempId));
      if (selectedTask?.id === tempId) setSelectedTask(null);

      showToast("Error", "Failed: " + (error.message || "Please try again"), "destructive");

      // Reopen the modal so user can retry / edit
      setShowCreateTask(true);
    } finally {
      // Reset form regardless
      setTaskForm({
        title: '',
        description: '',
        subject: '',
        education_level: '',
        deadline: '',
        timezone: 'America/New_York',
        budget: ''
      });
      setUploadedFiles([]);
    }
  };

  const withdrawTask = async () => {
    if (!selectedTask) return

    try {
      const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask.id}/withdraw/`, {
        reason: withdrawalReason
      });

      setTasks(prev => prev.map(task =>
        task.id === selectedTask.id
          ? {
              ...task,
              status: result.task.status,
              withdrawal_reason: result.task.withdrawal_reason
            }
          : task
      ))

      setSelectedTask(prev => prev ? {
        ...prev,
        status: result.task.status,
        withdrawal_reason: result.task.withdrawal_reason
      } : null)

      setShowWithdrawModal(false)
      setWithdrawalReason('')

      showToast("Success", result.message)

    } catch (error: any) {
      console.error('Failed to withdraw task:', error)
      showToast("Error", "Failed to withdraw task: " + error.message, "destructive")
    }
  }

  const respondToBudgetNegotiation = async (action: 'accept' | 'counter' | 'reject') => {
    if (!selectedTask) return

    try {
      if (action === 'accept') {
        const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask.id}/accept-budget/`);

        setTasks(prev => prev.map(task =>
          task.id === selectedTask.id
            ? {
                ...task,
                budget: result.task.budget,
                negotiation_status: result.task.negotiation_status,
                status: result.task.status,
                admin_counter_budget: undefined,
                negotiation_reason: undefined
              }
            : task
        ))

        setSelectedTask(prev => prev ? {
          ...prev,
          budget: result.task.budget,
          negotiation_status: result.task.negotiation_status,
          status: result.task.status,
          admin_counter_budget: undefined,
          negotiation_reason: undefined
        } : null)

        setShowBudgetNegotiation(false)
        setCounterBudget('')
        showToast("Success", result.message)

      } else if (action === 'counter') {
        if (!counterBudget || counterBudget.trim() === '') {
          showToast("Error", "Please enter a counter budget amount.", "destructive");
          return;
        }

        const counterAmount = parseFloat(counterBudget);
        if (isNaN(counterAmount) || counterAmount <= 0) {
          showToast("Error", "Please enter a valid budget amount (greater than 0).", "destructive");
          return;
        }

        const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask.id}/counter-budget/`, {
          amount: counterAmount
        });

        setTasks(prev => prev.map(task =>
          task.id === selectedTask.id
            ? {
                ...task,
                proposed_budget: result.task.proposed_budget,
                negotiation_status: result.task.negotiation_status,
                status: result.task.status
              }
            : task
        ))

        setSelectedTask(prev => prev ? {
          ...prev,
          proposed_budget: result.task.proposed_budget,
          negotiation_status: result.task.negotiation_status,
          status: result.task.status
        } : null)

        setShowBudgetNegotiation(false)
        setCounterBudget('')
        showToast("Success", result.message)

      } else if (action === 'reject') {
        const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask.id}/reject-budget/`);

        setTasks(prev => prev.map(task =>
          task.id === selectedTask.id
            ? {
                ...task,
                negotiation_status: result.task.negotiation_status,
                status: result.task.status
              }
            : task
        ))

        setSelectedTask(prev => prev ? {
          ...prev,
          negotiation_status: result.task.negotiation_status,
          status: result.task.status
        } : null)

        setShowBudgetNegotiation(false)
        setCounterBudget('')
        showToast("Info", result.message)
      }

    } catch (error: any) {
      console.error('Failed to respond to budget negotiation:', error)
      showToast("Error", "Failed to process your request: " + error.message, "destructive")
    }
  }

  const approveTask = async () => {
    if (!window.confirm("Approve and complete this assignment?")) return;
    try {
      setLoading(true);
      const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask!.id}/approve/`);

      // Update state
      setTasks(prev => prev.map(task =>
        task.id === selectedTask!.id
          ? { ...task, status: result.task.status }
          : task
      ));

      setSelectedTask(prev => prev ? { ...prev, status: result.task.status } : null);

      showToast("Success", result.message);
    } catch (err: any) {
      console.error('Failed to approve task:', err);
      showToast("Error", "Failed to approve task: " + err.message, "destructive");
    } finally {
      setLoading(false);
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_FILES = 10;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    setUploadedFiles(prev => {
      const remainingSlots = MAX_FILES - prev.length;
      const accepted: File[] = [];
      let tooMany = false;
      let tooLargeFiles: string[] = [];

      for (const file of files) {
        if (accepted.length >= remainingSlots) {
          tooMany = true;
          break;
        }

        if (file.size > MAX_FILE_SIZE) {
          tooLargeFiles.push(file.name);
          continue;
        }

        accepted.push(file);
      }

      if (tooLargeFiles.length > 0) {
        showToast(
          "File too large",
          `${tooLargeFiles.join(', ')} exceed(s) 10 MB and was not added.`,
          "destructive"
        );
      }

      if (tooMany) {
        showToast(
          "File limit reached",
          `You can attach up to ${MAX_FILES} files per assignment.`,
          "destructive"
        );
      }

      return [...prev, ...accepted];
    });

    // reset input so same file can be selected again later if needed
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const makeAbsoluteFileUrl = (u: string) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;                     // already absolute
    const path = u.startsWith('/') ? u : `/${u}`;              // normalize
    return `${API_ROOT}${path}`;                               // API_ROOT already defined
  };

  const downloadFile = async (file: { id: number; name?: string; file_url?: string }) => {
    try {
      if (file.file_url) {
        // Handle absolute and relative URLs uniformly
        const href = makeAbsoluteFileUrl(file.file_url);
        window.open(href, '_blank');
        return;
      }

      // Fallback to API download route (keeps Authorization header)
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/files/${file.id}/download/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      showToast("Error", "Failed to download file. Please try again.", "destructive");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'budget_negotiation': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'awaiting_review': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'revision_requested': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'withdrawn': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'budget_rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatStatus = (status: string) => {
    const statusMap: any = {
      'budget_negotiation': 'Budget Negotiation',
      'revision_requested': 'Revision Requested',
      'budget_rejected': 'Budget Rejected'
    }
    return statusMap[status] || status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return 'ri-file-text-line'
      case 'budget_negotiation': return 'ri-money-dollar-circle-line'
      case 'in_progress': return 'ri-loader-4-line'
      case 'awaiting_review': return 'ri-eye-line'
      case 'revision_requested': return 'ri-edit-line'
      case 'completed': return 'ri-checkbox-circle-line'
      case 'withdrawn': return 'ri-close-circle-line'
      case 'budget_rejected': return 'ri-close-circle-line'
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

  // ---- FIX: helper to normalize negotiation status for "submitted" tasks ----
  const normalizedNegotiationStatus = (t: any) =>
    (t?.negotiation_status ?? (t?.status === 'submitted' ? 'pending_admin_review' : null));

  const filteredTasks = tasks.filter((task: any) => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.subject.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const taskStats = {
    total: tasks.length,
    submitted: tasks.filter((t: any) => t.status === 'submitted').length,
    in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
    awaiting_review: tasks.filter((t: any) => t.status === 'awaiting_review').length,
    completed: tasks.filter((t: any) => t.status === 'completed').length,
    budget_negotiation: tasks.filter((t: any) => t.status === 'budget_negotiation').length
  }

  const canWithdraw = (task: any) => {
    return task.status === 'submitted' || task.status === 'budget_negotiation' || (task.status === 'in_progress' && new Date() < new Date(task.withdrawal_deadline))
  }

  const requestRevision = async () => {
    if (!revisionFeedback?.trim()) {
      showToast("Required", "Add feedback", "destructive");
      return;
    }
    try {
      setLoading(true);
      const result = await apiService.post<{task: any, message: string}>(`/tasks/${selectedTask!.id}/request-revision/`, {
        feedback: revisionFeedback.trim()
      });

      // Update state
      setTasks(prev => prev.map(task =>
        task.id === selectedTask!.id
          ? { ...task, status: result.task.status }
          : task
      ));

      setSelectedTask(prev => prev ? { ...prev, status: result.task.status } : null);
      setShowRevisionModal(false);
      setRevisionFeedback('');

      showToast("Success", result.message);
    } catch (err: any) {
      console.error('Failed to request revision:', err);
      showToast("Error", "Failed to request revision: " + err.message, "destructive");
    } finally {
      setLoading(false);
    }
  };

  const canApprove = (task: any) => {
    return task.status === 'awaiting_review'
  }

  const handleLogout = () => {
    logout()
    navigate('/')
    showToast("Logged out", "You have been successfully logged out.")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Toast Notification */}
      {currentToast && (
        <Toast
          title={currentToast.title}
          description={currentToast.description}
          variant={currentToast.variant}
        />
      )}

      {/* Modern Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <i className="ri-graduation-cap-line text-3xl text-white"></i>
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Student Portal
                </h1>
                <p
                  className="text-sm text-gray-600 truncate"
                  title={`Welcome back, ${currentUser?.full_name || currentUser?.username || ''}`}
                >
                  Welcome back,{" "}
                  <span className="font-medium inline-block max-w-[50vw] sm:max-w-[240px] truncate align-bottom">
                    {currentUser?.full_name || currentUser?.username}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                <i className="ri-time-zone-line text-blue-600"></i>
                <span className="text-sm text-blue-800">{timezones.find(tz => tz.value === (currentUser?.timezone || 'America/New_York'))?.label}</span>
              </div>
              <Button
                onClick={() => setShowCreateTask(true)}
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 whitespace-nowrap"
              >
                <i className="ri-add-line mr-2 text-lg"></i>
                New Assignment
              </Button>
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                {currentUser?.profile?.avatar && (
                  <img src={currentUser.profile.avatar} alt={currentUser.full_name} className="w-12 h-12 rounded-full object-cover object-top border-3 border-blue-200 shadow-lg" />
                )}
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="whitespace-nowrap hover:bg-gray-100 border-gray-300"
                >
                  <i className="ri-logout-box-line mr-2"></i>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Tasks</p>
                <p className="text-3xl font-bold text-gray-900">{taskStats.total}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
                <i className="ri-file-list-3-line text-2xl text-slate-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Submitted</p>
                <p className="text-3xl font-bold text-amber-600">{taskStats.submitted}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
                <i className="ri-time-line text-2xl text-amber-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{taskStats.in_progress}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                <i className="ri-loader-4-line text-2xl text-blue-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Under Review</p>
                <p className="text-3xl font-bold text-purple-600">{taskStats.awaiting_review}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                <i className="ri-eye-line text-2xl text-purple-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Negotiating</p>
                <p className="text-3xl font-bold text-orange-600">{taskStats.budget_negotiation}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
                <i className="ri-money-dollar-circle-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-emerald-600">{taskStats.completed}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-2xl text-emerald-600"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Tasks List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">My Assignments</h2>

                {/* Search */}
                <div className="relative mb-4">
                  <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <Input
                    placeholder="Search assignments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-gray-200 rounded-xl"
                  />
                </div>

                {/* Enhanced Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['all', 'submitted', 'budget_negotiation', 'in_progress', 'awaiting_review', 'completed'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                        filterStatus === status
                          ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {status === 'all' ? 'All' : formatStatus(status)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <i className="ri-inbox-line text-6xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500 text-lg">No assignments found</p>
                    <Button
                      onClick={() => setShowCreateTask(true)}
                      className="mt-4 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white"
                    >
                      Create Your First Assignment
                    </Button>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-6 cursor-pointer transition-all duration-200 ${
                        selectedTask?.id === task.id
                          ? 'bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 border-r-4 border-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-gray-900 flex-1 pr-2 line-clamp-2 text-lg">{task.title}</h3>
                        <i className={`${getStatusIcon(task.status)} text-2xl flex-shrink-0`}></i>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{task.subject} • {task.education_level}</p>

                      {/* Budget Negotiation Alert */}
                      {task.status === 'budget_negotiation' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 text-orange-800 mb-1">
                            <i className="ri-money-dollar-circle-line"></i>
                            <span className="font-medium text-sm">Budget Negotiation</span>
                          </div>
                          <p className="text-xs text-orange-700">
                            Expert proposed: ${task.admin_counter_budget} (Your budget: ${task.proposed_budget})
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-3">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}>
                          {formatStatus(task.status)}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <i className="ri-calendar-line"></i>
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="ri-attachment-line text-gray-400"></i>
                          <span className="text-xs text-gray-500">{task.files?.length || 0} files</span>
                          <i className="ri-time-zone-line text-gray-400 ml-2"></i>
                          <span className="text-xs text-gray-500">{timezones.find(tz => tz.value === task.timezone_str)?.label.split(' ')[0]}</span>
                        </div>
                        {task.budget && (
                          <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                            <i className="ri-money-dollar-circle-line"></i>
                            ${task.budget}
                          </div>
                        )}
                      </div>

                      {task.revisions && task.revisions.length > 0 && (
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

          {/* Enhanced Task Details & Communication */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Enhanced Task Header */}
                <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold text-gray-900 mb-3">{selectedTask.title}</h2>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg">
                          <i className="ri-book-line"></i>
                          {selectedTask.subject}
                        </span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg">
                          <i className="ri-graduation-cap-line"></i>
                          {selectedTask.education_level}
                        </span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg">
                          <i className="ri-calendar-line"></i>
                          Due: {new Date(selectedTask.deadline).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg">
                          <i className="ri-time-zone-line"></i>
                          {timezones.find(tz => tz.value === selectedTask.timezone_str)?.label}
                        </span>
                        {selectedTask.budget && (
                          <span className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-lg font-semibold">
                            <i className="ri-money-dollar-circle-line"></i>
                            ${selectedTask.budget}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border ${getStatusColor(selectedTask.status)}`}>
                      <i className={getStatusIcon(selectedTask.status)}></i>
                      {formatStatus(selectedTask.status)}
                    </span>
                  </div>

                  {/* Budget Negotiation Section */}
                  {normalizedNegotiationStatus(selectedTask) !== 'accepted' &&
                   (selectedTask.status === 'submitted' || selectedTask.status === 'budget_negotiation') && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
                      <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center gap-2">
                        <i className="ri-money-dollar-circle-line"></i>
                        Budget Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">Proposed Budget</p>
                          <p className="text-2xl font-bold text-blue-600">${selectedTask.proposed_budget}</p>
                        </div>
                        {selectedTask.admin_counter_budget && (
                          <div className="bg-white rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Expert Counter-Offer</p>
                            <p className="text-2xl font-bold text-orange-600">${selectedTask.admin_counter_budget}</p>
                          </div>
                        )}
                      </div>
                      {selectedTask.negotiation_reason && (
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-600 mb-2">Expert's Explanation:</p>
                          <p className="text-gray-800">{selectedTask.negotiation_reason}</p>
                        </div>
                      )}
                      {normalizedNegotiationStatus(selectedTask) === 'pending_student_response' && (
                        <div className="flex gap-3">
                          <Button
                            onClick={() => respondToBudgetNegotiation('accept')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                          >
                            <i className="ri-check-line mr-1"></i>
                            Accept ${selectedTask.admin_counter_budget}
                          </Button>
                          <Button
                            onClick={() => setShowBudgetNegotiation(true)}
                            variant="outline"
                            className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 whitespace-nowrap"
                          >
                            <i className="ri-money-dollar-circle-line mr-1"></i>
                            Counter Again
                          </Button>
                          <Button
                            onClick={() => setShowWithdrawModal(true)}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 whitespace-nowrap"
                          >
                            <i className="ri-close-line mr-1"></i>
                            Withdraw
                          </Button>
                        </div>
                      )}
                      {normalizedNegotiationStatus(selectedTask) === 'pending_admin_review' && (
                        <div className="flex items-center gap-2 text-orange-600 bg-white rounded-lg p-4">
                          <i className="ri-time-line text-xl"></i>
                          <span className="font-medium">Waiting for expert to review your budget...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Information */}
                  {selectedTask.status === 'submitted' &&
                   normalizedNegotiationStatus(selectedTask) === 'pending_admin_review' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
                      <div className="flex items-center gap-3">
                        <i className="ri-time-line text-3xl text-amber-600"></i>
                        <div>
                          <h3 className="font-bold text-amber-900 text-lg">Pending Review</h3>
                          <p className="text-amber-700">Your assignment is being reviewed. You'll be notified once it's accepted.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* IN PROGRESS – Compact */}
                  {selectedTask.status === 'in_progress' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <i className="ri-loader-4-line text-3xl text-blue-600"></i>
                        <div>
                          <h3 className="font-bold text-blue-900 text-lg">Work In Progress</h3>
                          <p className="text-sm text-blue-700">Progress: {selectedTask.progress || 0}%</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${selectedTask.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AWAITING REVIEW – FINAL MOBILE-PERFECT VERSION */}
                  {selectedTask.status === 'awaiting_review' && (
                    <div className="bg-purple-50 border border-purple-300 rounded-2xl p-5 shadow-md">
                      <div className="text-center mb-5">
                        <i className="ri-file-check-line text-5xl text-purple-600"></i>
                        <h3 className="text-xl font-bold text-purple-900 mt-2">Assignment Ready!</h3>
                        <p className="text-xs text-purple-700 mt-1">Expert has submitted final work</p>
                      </div>

                      {/* Expert Files Only – Top Card */}
                      <div className="bg-white rounded-xl p-4 mb-5 border border-purple-100">
                        <h4 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                          <i className="ri-download-cloud-2-line text-purple-600"></i>
                          Final Files ({selectedTask.files?.filter((f: any) => f.uploaded_by_role === 'admin' || f.uploaded_by === 'admin').length || 0})
                        </h4>

                        {selectedTask.files?.filter((f: any) => f.uploaded_by_role === 'admin' || f.uploaded_by === 'admin').length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-4">No files submitted yet</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedTask.files
                              .filter((f: any) => f.uploaded_by_role === 'admin' || f.uploaded_by === 'admin')
                              .map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <i className={`${getFileIcon(file.file_type || file.name.split('.').pop())} text-xl text-purple-700`} />
                                    <p className="text-sm font-medium text-purple-900 truncate">{file.name}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => downloadFile(file)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 ml-2"
                                  >
                                    <i className="ri-download-line"></i>
                                  </Button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Two Buttons Side-by-Side */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={approveTask}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-3 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <i className="ri-check-line text-lg"></i>
                          Approve
                        </Button>

                        <Button
                          onClick={() => setShowRevisionModal(true)}
                          variant="outline"
                          className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-medium text-sm py-3 rounded-xl flex items-center justify-center gap-2"
                        >
                          <i className="ri-edit-line text-lg"></i>
                          Revision
                        </Button>
                      </div>

                      <p className="text-center text-xs text-purple-700 mt-4">
                        Approve = task completed & payment released
                      </p>
                    </div>
                  )}

                  {/* TASK DESCRIPTION */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
                    <h3 className="font-bold text-gray-900 mb-3 text-lg">Assignment Description</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* ORIGINAL CLIENT FILES – Only show when NOT awaiting_review */}
                  {selectedTask.status !== 'awaiting_review' && selectedTask.files?.some((f: any) => f.uploaded_by_role === 'client' || f.uploaded_by === 'client') && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
                      <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                        <i className="ri-upload-cloud-2-line"></i>
                        Your Uploaded Files
                      </h3>
                      <div className="space-y-3">
                        {selectedTask.files
                          .filter((f: any) => f.uploaded_by_role === 'client' || f.uploaded_by === 'client')
                          .map((file: any) => (
                            <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                              <div className="flex items-center gap-3">
                                <i className={`${getFileIcon(file.file_type || file.name.split('.').pop())} text-xl text-gray-600`} />
                                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => downloadFile(file)}>
                                Download
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Files Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                      <i className="ri-folder-line"></i>
                      Assignment Files ({selectedTask.files?.length || 0})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedTask.files?.map((file: any) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i className={`${getFileIcon(file.file_type)} text-blue-600`}></i>
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

                {/* Revisions Section */}
                {selectedTask.revisions && selectedTask.revisions.length > 0 && (
                  <div className="p-6 border-b border-gray-100 bg-orange-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-edit-line"></i>
                      Revision History ({selectedTask.revisions.length})
                    </h3>
                    <div className="space-y-4">
                      {selectedTask.revisions.map((revision: any) => (
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
                            <p className="text-xs text-green-600 mt-2">
                              Completed on {new Date(revision.completed_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enhanced Chat Section */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <i className="ri-chat-3-line"></i>
                      Communication with {selectedTask.assigned_admin?.full_name || 'Expert'}
                    </h3>
                    <Button
                      onClick={refreshChat}
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <i className="ri-refresh-line mr-2"></i>
                      Refresh
                    </Button>
                  </div>

                  {/* Messages */}
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 h-[50vh] md:h-96 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">
                          <i className="ri-chat-off-line text-6xl mb-4 text-gray-300"></i>
                          <p className="text-lg">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        <>
                          {chatMessages.map((message) => {
                            const isMine =
                              message.sender === currentUser?.username ||
                              message.sender_username === currentUser?.username ||
                              message.sender?.username === currentUser?.username;

                            return (
                              <div
                                key={message.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                                    isMine
                                      ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white'
                                      : 'bg-white text-gray-900 border border-gray-200'
                                  }`}
                                >
                                  <p className="text-sm leading-relaxed mb-2">{message.message}</p>

                                  {message.file_url && (
                                    <div className="mb-2">
                                      <div
                                        className={`text-xs p-2 rounded-lg ${
                                          isMine ? 'bg-white/20' : 'bg-gray-100'
                                        }`}
                                      >
                                        <a
                                          href={makeAbsoluteFileUrl(message.file_url)}
                                          download
                                          target="_blank"
                                          rel="noopener"
                                          className="flex items-center gap-1 hover:underline"
                                        >
                                          <i className="ri-attachment-line"></i>
                                          {message.file_name || 'Download file'}
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  <p
                                    className={`text-xs flex items-center gap-1 ${
                                      isMine ? 'text-blue-100' : 'text-gray-500'
                                    }`}
                                  >
                                    <i className="ri-user-line"></i>
                                    {isMine
                                      ? 'You'
                                      : (selectedTask.assigned_admin?.full_name || 'Expert')}
                                    {' • '}
                                    {new Date(message.created_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}

                          {/* Typing Indicator */}
                          {isTyping && (
                            <div className="flex justify-start">
                              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  <span className="text-xs ml-2">Expert is typing...</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div ref={chatEndRef} />
                        </>
                      )}
                    </div>

                    {/* Enhanced Message Input */}
                    <div className="border-t border-gray-200 p-4 bg-white rounded-b-2xl">
                      {uploadedFiles.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg text-sm">
                              <i className="ri-file-line text-blue-600"></i>
                              <span className="text-blue-800">{file.name}</span>
                              <button onClick={() => removeFile(index)} className="text-blue-600 hover:text-blue-800 cursor-pointer">
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
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          <i className="ri-attachment-line"></i>
                        </Button>
                        <Button
                          onClick={sendMessage}
                          disabled={!newMessage.trim() && uploadedFiles.length === 0}
                          className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white whitespace-nowrap px-6"
                        >
                          <i className="ri-send-plane-fill"></i>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl p-16 text-center border border-gray-100">
                <i className="ri-file-list-3-line text-8xl text-gray-300 mb-6"></i>
                <p className="text-gray-500 text-xl">Select an assignment to view details and communicate</p>
                {tasks.length === 0 && (
                  <Button
                    onClick={() => setShowCreateTask(true)}
                    className="mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white"
                  >
                    Create Your First Assignment
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Create Task Modal - RESIZED */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Submit New Assignment</h2>
              <button onClick={() => setShowCreateTask(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Title
                </label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Research Paper on Climate Change"
                  className="py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <select
                    value={taskForm.subject}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="">Select subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="English Literature">English Literature</option>
                    <option value="History">History</option>
                    <option value="Economics">Economics</option>
                    <option value="Psychology">Psychology</option>
                    <option value="Environmental Science">Environmental Science</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Education Level
                  </label>
                  <select
                    value={taskForm.education_level}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, education_level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="">Select level</option>
                    <option value="High School">High School</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Graduate">Graduate</option>
                    <option value="PhD">PhD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline
                  </label>
                  <Input
                    type="datetime-local"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="ri-time-zone-line mr-1"></i>
                    Your Timezone
                  </label>
                  <select
                    value={taskForm.timezone}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    {timezones.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposed Budget (USD)
                </label>
                <Input
                  type="number"
                  value={taskForm.budget}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="e.g., 150"
                  min="0"
                  step="10"
                  className="py-2"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Expert may propose a different budget</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Description
                </label>
                <Textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your assignment requirements in detail..."
                  rows={4}
                  className="text-sm"
                  required
                />
              </div>

              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Assignment Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="task-files"
                  />
                  <label htmlFor="task-files" className="cursor-pointer">
                    <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-3"></i>
                    <p className="text-sm text-gray-600 mb-1">Click to upload files or drag and drop</p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images, and more</p>
                  </label>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <i className="ri-file-line text-blue-600 text-sm"></i>
                          <span className="text-blue-800 text-sm">{file.name}</span>
                          <span className="text-xs text-blue-600">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-800 cursor-pointer text-sm"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <i className="ri-information-line text-blue-600 text-sm mt-0.5"></i>
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm mb-1">What happens next?</h4>
                    <ul className="text-xs text-blue-800 space-y-0.5">
                      <li>• Expert will be notified via email immediately</li>
                      <li>• You'll receive budget confirmation or counter-offer within 24 hours</li>
                      <li>• Free withdrawal available for 48 hours after submission</li>
                      <li>• Real-time updates and notifications throughout the process</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateTask(false)}
                  className="flex-1 py-2 text-sm whitespace-nowrap"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white py-2 text-sm whitespace-nowrap"
                >
                  <i className="ri-send-plane-fill mr-1"></i>
                  Submit Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Negotiation Modal */}
      {showBudgetNegotiation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-money-dollar-circle-line text-3xl text-orange-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Counter Offer</h3>
              <p className="text-gray-600">Propose your budget for this assignment</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Counter-Offer (USD)
                </label>
                <Input
                  type="number"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  placeholder="Enter your budget"
                  min="0"
                  step="10"
                  className="text-lg py-3"
                  required
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Expert's Offer:</span>
                  <span className="font-bold">${selectedTask?.admin_counter_budget}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Your Original Budget:</span>
                  <span className="font-bold">${selectedTask?.proposed_budget}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowBudgetNegotiation(false)}
                variant="outline"
                className="flex-1 whitespace-nowrap"
              >
                Cancel
              </Button>
              <Button
                onClick={() => respondToBudgetNegotiation('counter')}
                disabled={!counterBudget}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap"
              >
                Send Counter-Offer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Task Modal */}
      {showWithdrawModal && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-close-circle-line text-3xl text-red-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Withdraw Assignment</h3>
              <p className="text-gray-600">Are you sure you want to withdraw this assignment?</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Assignment:</strong> {selectedTask.title}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Status:</strong> {formatStatus(selectedTask.status)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Withdrawal Fee:</strong> {selectedTask.can_withdraw_free ? 'Free' : `$${selectedTask.withdrawal_fee}`}
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Withdrawal (Optional)
              </label>
              <Textarea
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                placeholder="Please explain why you're withdrawing..."
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowWithdrawModal(false)}
                variant="outline"
                className="flex-1 whitespace-nowrap"
              >
                Cancel
              </Button>
              <Button
                onClick={withdrawTask}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
              >
                Withdraw Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Request Revision</h3>
              <button onClick={() => setShowRevisionModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-700 mb-3">
                Revision Feedback
              </label>
              <Textarea
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Please describe what changes you'd like to see..."
                rows={6}
                className="text-lg"
                required
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-information-line text-blue-600 text-xl mt-1"></i>
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">Revision Process</h4>
                  <p className="text-sm text-blue-800">The expert will be notified immediately and will work on your requested changes. You'll receive email updates on the progress.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowRevisionModal(false)}
                variant="outline"
                className="flex-1 whitespace-nowrap"
              >
                Cancel
              </Button>
              <Button
                onClick={requestRevision}
                disabled={!revisionFeedback.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap"
              >
                <i className="ri-send-plane-fill mr-2"></i>
                Request Revision
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
