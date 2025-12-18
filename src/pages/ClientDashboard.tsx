// src/pages/ClientDashboard.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'

/* =========================
   Env-aware HTTP & WS bases
   ========================= */
const API_ROOT = (import.meta.env.VITE_API_BASE || window.location.origin).replace(/\/+$/, '');
const API_BASE = /\/api\/?$/.test(API_ROOT) ? API_ROOT : `${API_ROOT}/api`;

const apiService = {
  url(endpoint: string) {
    const clean = endpoint.replace(/^\/+/, '');
    const noApiDup = clean.replace(/^api\/?/, '');
    return `${API_BASE}/${noApiDup}`;
  },
  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('access_token');
    const res = await fetch(this.url(endpoint), {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const token = localStorage.getItem('access_token');
    const res = await fetch(this.url(endpoint), {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: data == null ? undefined : JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('access_token');
    const res = await fetch(this.url(endpoint), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};

/* ======================
   Toast (same pattern)
   ====================== */
const Toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
  const bg = variant === 'destructive' ? 'bg-red-500' : 'bg-purple-600';
  return (
    <div className={`fixed top-4 right-4 ${bg} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm`}>
      <div className="font-bold">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  );
};

/* ============== Types & helpers ============== */
interface UserProfile { avatar?: string; full_name?: string; role?: 'client'|'admin' }
interface User { id: number; username: string; email: string; full_name?: string; profile?: UserProfile; timezone?: string }

interface TaskFile { id: number; name: string; file_type?: string; size?: string; uploaded_by?: any; uploaded_by_name?: string; uploaded_by_role?: 'client'|'admin'; file_url?: string }
interface Revision { id: number; requested_at: string; feedback: string; status: 'requested'|'in_progress'|'completed'|'cancelled'; completed_at?: string }
interface ChatMessage { id: number; message: string; file_url?: string; file_name?: string; created_at: string; is_read: boolean; sender?: any; sender_role?: 'client'|'admin'; sender_username?: string }

type NegotiationStatus = 'pending_admin_review' | 'pending_student_response' | 'accepted' | 'rejected'
type TaskStatus =
  | 'submitted' | 'budget_negotiation' | 'in_progress'
  | 'awaiting_review' | 'revision_requested'
  | 'completed' | 'withdrawn' | 'rejected' | 'cancelled' | 'budget_rejected'

interface Task {
  id: number;
  task_id?: string;
  title: string;
  description: string;
  subject: string;
  education_level: string;
  deadline: string;
  timezone_str?: string;
  status: TaskStatus;
  priority?: 'low'|'medium'|'high'|'urgent';
  progress?: number;
  proposed_budget?: number;
  admin_counter_budget?: number;
  budget?: number;
  negotiation_status?: NegotiationStatus;
  negotiation_reason?: string;
  files: TaskFile[];
  revisions: Revision[];
  chat?: ChatMessage[];
  assigned_admin?: { full_name?: string };
  can_withdraw_free?: boolean;
  withdrawal_fee?: number;
  withdrawal_deadline?: string;
}

const normalizeTask = (t: Partial<Task>): Task => ({
  id: t.id as number,
  task_id: t.task_id ?? '',
  title: t.title ?? '',
  description: t.description ?? '',
  subject: t.subject ?? '',
  education_level: t.education_level ?? '',
  deadline: t.deadline ?? new Date().toISOString(),
  timezone_str: t.timezone_str ?? '',
  status: (t.status as TaskStatus) ?? 'submitted',
  priority: (t.priority as Task['priority']) ?? 'medium',
  progress: typeof t.progress === 'number' ? t.progress : 0,
  proposed_budget: typeof t.proposed_budget === 'number' ? t.proposed_budget : 0,
  admin_counter_budget: t.admin_counter_budget,
  budget: t.budget,
  negotiation_status: (t.negotiation_status as NegotiationStatus) ?? 'pending_admin_review',
  negotiation_reason: t.negotiation_reason ?? '',
  files: Array.isArray(t.files) ? t.files : [],
  revisions: Array.isArray(t.revisions) ? t.revisions : [],
  chat: Array.isArray(t.chat) ? t.chat : [],
  assigned_admin: t.assigned_admin ?? {},
  can_withdraw_free: !!t.can_withdraw_free,
  withdrawal_fee: typeof t.withdrawal_fee === 'number' ? t.withdrawal_fee : 0,
  withdrawal_deadline: t.withdrawal_deadline
});

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/* ============== WebSocket Hook ============== */
const useWebSocketWithReconnect = (url: string | null, onMessage: (data: any) => void, deps: any[] = []) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  useEffect(() => {
    if (!url) { setWs(null); return; }
    let reconnect: ReturnType<typeof setTimeout>;
    let attempt = 0;
    let socket: WebSocket | null = null;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) { console.warn('No token for WS'); return; }
      const ENV_WS_BASE =
        (import.meta as any).env?.VITE_WS_BASE ||
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
      const base = ENV_WS_BASE.replace(/\/$/, '');
      const path = url.startsWith('/') ? url : `/${url}`;
      const wsUrl = `${base}${path}?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => { setWs(socket!); attempt = 0; };
      socket.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error('WS parse', err); } };
      socket.onclose = () => {
        setWs(null);
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnect = setTimeout(connect, delay);
      };
      socket.onerror = () => console.error('WS error');
    };

    connect();
    return () => { clearTimeout(reconnect); try { socket?.close(); } catch {} };
  }, [url, ...deps]);

  const sendMessage = (data: any) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
  return { sendMessage };
};

/* ==========
   Utilities
   ========== */
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
];

const getFileIcon = (type?: string) => {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'pdf': return 'ri-file-pdf-line';
    case 'word': case 'docx': case 'doc': return 'ri-file-word-line';
    case 'excel': case 'xlsx': case 'xls': return 'ri-file-excel-line';
    case 'powerpoint': case 'pptx': case 'ppt': return 'ri-file-ppt-line';
    case 'python': case 'py': case 'js': case 'ts': case 'json': case 'html': case 'css': return 'ri-file-code-line';
    case 'csv': return 'ri-file-chart-line';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'bmp': case 'webp': return 'ri-image-line';
    case 'zip': case 'rar': case '7z': return 'ri-file-zip-line';
    default: return 'ri-file-line';
  }
};

const formatStatus = (s: TaskStatus) => {
  const map: Record<string, string> = {
    budget_negotiation: 'Budget Negotiation',
    revision_requested: 'Revision Requested',
    budget_rejected: 'Budget Rejected'
  };
  return map[s] || s.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
};
const getStatusIcon = (s: TaskStatus) => {
  switch (s) {
    case 'submitted': return 'ri-file-text-line';
    case 'budget_negotiation': return 'ri-money-dollar-circle-line';
    case 'in_progress': return 'ri-loader-4-line';
    case 'awaiting_review': return 'ri-eye-line';
    case 'revision_requested': return 'ri-edit-line';
    case 'completed': return 'ri-checkbox-circle-line';
    case 'withdrawn': return 'ri-close-circle-line';
    case 'budget_rejected': return 'ri-close-circle-line';
    default: return 'ri-file-line';
  }
};
const getStatusColor = (s: TaskStatus) => {
  switch (s) {
    case 'submitted': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'budget_negotiation': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'awaiting_review': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'revision_requested': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'withdrawn': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'budget_rejected': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const openGmailCompose = (toEmail: string, subject?: string, body?: string) => {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toEmail)}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/* =======================
   Component starts here
   ======================= */
export default function ClientDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [currentToast, setCurrentToast] = useState<{ title: string; description: string; variant?: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showBudgetNegotiation, setShowBudgetNegotiation] = useState(false);

  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [counterBudget, setCounterBudget] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');

  // chat (floating window)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [loading, setLoading] = useState(true);

  // floating chat position/size
  const chatRef = useRef<HTMLDivElement>(null);
  const [chatPos, setChatPos] = useState<{ x: number, y: number }>({ x: 16, y: 100 });
  const [chatSize] = useState<{ w: number, h: number }>({ w: 360, h: 520 });
  const draggingRef = useRef<{ startX: number, startY: number, origX: number, origY: number } | null>(null);

  // create task form (with dropdowns restored)
  const SUBJECT_OPTIONS = [
    'Mathematics','Physics','Chemistry','Biology','Computer Science','English Literature','History','Economics','Psychology','Environmental Science','Other'
  ];
  const LEVEL_OPTIONS = ['High School','Undergraduate','Graduate','PhD'];

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    subject: '',
    education_level: '',
    deadline: '',
    timezone: 'America/New_York',
    budget: ''
  });

  const showToast = (title: string, description: string, variant?: string) => {
    setCurrentToast({ title, description, variant });
    setTimeout(() => setCurrentToast(null), 3000);
  };

  /* ======= WebSockets ======= */
  useWebSocketWithReconnect('/ws/client/', (data) => {
    if (data.type === 'task_updated' && data.task) {
      const partial = stripUndefined(normalizeTask(data.task));
      setTasks(prev => prev.map(t => (t.id === partial.id ? normalizeTask({ ...t, ...partial }) : t)));
      setSelectedTask(prev => (prev && prev.id === partial.id ? normalizeTask({ ...prev, ...partial }) : prev));
      showToast('Task Updated', 'Updates received in real-time');
    }
    if (data.type === 'task_created' && data.task) {
      const newTask = normalizeTask(data.task);
      setTasks(cur => cur.some(t => t.id === newTask.id) ? cur : [newTask, ...cur]);
      showToast('New Task', 'Your assignment was created successfully');
    }
  }, []);

  const { sendMessage: sendTaskMessage } = useWebSocketWithReconnect(
    selectedTask ? `/ws/task/${selectedTask.id}/` : null,
    (data) => {
      if (data.type === 'chat_message' && data.message) {
        setChatMessages(prev => {
          const filtered = prev.filter(msg => !(msg.id > 1000000 && msg.message === data.message.message));
          return [...filtered, data.message];
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
      if (data.type === 'user_typing') setIsTyping(!!data.is_typing);
      if (data.type === 'task_updated' && data.task) {
        const partial = stripUndefined(normalizeTask(data.task));
        setTasks(prev => prev.map(t => (t.id === partial.id ? normalizeTask({ ...t, ...partial }) : t)));
        setSelectedTask(prev => (prev && prev.id === partial.id ? normalizeTask({ ...prev, ...partial }) : prev));
      }
    },
    [selectedTask?.id]
  );

  /* ======= Data ======= */
  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedTask) loadChat(selectedTask.id); }, [selectedTask?.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages]);
  useEffect(() => {
    const h = chatSize.h;
    setChatPos({ x: 16, y: Math.max(16, window.innerHeight - h - 16) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const user = await apiService.get<User>('/auth/user/');
      setCurrentUser(user);
      const rawList = await apiService.get<Partial<Task>[]>('/tasks/');
      const list = rawList.map(normalizeTask);
      setTasks(list);
      if (list.length) setSelectedTask(list[0]);
      showToast('Dashboard Loaded', 'Welcome back!');
    } catch (e) {
      console.error(e);
      showToast('Error', 'Failed to load dashboard data', 'destructive');
    } finally { setLoading(false); }
  };

  const loadChat = async (taskId: number) => {
    try {
      const msgs = await apiService.get<ChatMessage[]>(`/tasks/${taskId}/chat/`);
      setChatMessages(Array.isArray(msgs) ? msgs : []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (e) {
      console.error(e); showToast('Error', 'Failed to load chat messages', 'destructive');
    }
  };

  /* ======= Chat behaviors ======= */
  const onDragStart = (e: React.MouseEvent) => {
    draggingRef.current = { startX: e.clientX, startY: e.clientY, origX: chatPos.x, origY: chatPos.y };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };
  const onDragMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setChatPos({ x: Math.max(8, draggingRef.current.origX + dx), y: Math.max(8, draggingRef.current.origY + dy) });
  };
  const onDragEnd = () => {
    draggingRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  };

  const openChatWindow = () => { if (selectedTask) { setShowChatWindow(true); setChatMinimized(false); } };
  const closeChatWindow = () => { setShowChatWindow(false); setChatMinimized(false); };

  const handleTyping = (typing: boolean) => { if (selectedTask) sendTaskMessage({ type: 'typing', is_typing: typing }); };
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) { setIsTyping(true); handleTyping(true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); handleTyping(false); }, 1000);
  };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_FILES = 10;
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => {
      const remaining = MAX_FILES - prev.length;
      const accepted: File[] = [];
      let tooMany = false, tooLarge: string[] = [];
      for (const f of files) {
        if (accepted.length >= remaining) { tooMany = true; break; }
        if (f.size > MAX_FILE_SIZE) { tooLarge.push(f.name); continue; }
        accepted.push(f);
      }
      if (tooLarge.length) showToast('File too large', `${tooLarge.join(', ')} exceed(s) 10 MB.`, 'destructive');
      if (tooMany) showToast('File limit reached', `Max ${MAX_FILES} files.`, 'destructive');
      return [...prev, ...accepted];
    });
    e.target.value = '';
  };
  const removeFile = (i: number) => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i));

  const makeAbsoluteFileUrl = (u?: string) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${API_ROOT}${path}`;
  };
  const downloadFile = async (file: { id: number; name?: string; file_url?: string; file_type?: string }) => {
    try {
      if (file.file_url) { window.open(makeAbsoluteFileUrl(file.file_url), '_blank'); return; }
      const token = localStorage.getItem('access_token');
      const res = await fetch(apiService.url(`/files/${file.id}/download/`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file.name || 'download';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); showToast('Error', 'Failed to download file', 'destructive'); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    if (!selectedTask) return;

    const optimistic: ChatMessage = {
      id: Date.now(),
      message: newMessage.trim(),
      sender_role: 'client',
      created_at: new Date().toISOString(),
      is_read: false,
      file_url: uploadedFiles.length ? 'pending' : undefined,
      file_name: uploadedFiles.length ? uploadedFiles[0]?.name : undefined
    };

    try {
      setIsTyping(false); handleTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setChatMessages(prev => [...prev, optimistic]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);

      if (uploadedFiles.length) {
        const form = new FormData();
        if (newMessage.trim()) form.append('message', newMessage.trim());
        uploadedFiles.forEach(f => form.append('file', f));
        await apiService.postFormData(`/tasks/${selectedTask.id}/chat/`, form);
      } else {
        await apiService.post(`/tasks/${selectedTask.id}/chat/`, { message: newMessage.trim() });
      }

      setNewMessage(''); setUploadedFiles([]);
      setTimeout(() => loadChat(selectedTask.id), 350);
    } catch (e) {
      console.error('send fail', e);
      setChatMessages(prev => prev.filter(m => m.id !== optimistic.id));
      showToast('Error', 'Failed to send message', 'destructive');
    }
  };

  /* ======= Task actions ======= */
  const respondToBudgetNegotiation = async (action: 'accept' | 'counter' | 'reject') => {
    if (!selectedTask) return;
    try {
      if (action === 'accept') {
        const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/accept-budget/`);
        const upd = normalizeTask(result.task);
        setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
        setSelectedTask(upd); showToast('Success', result.message);
      } else if (action === 'counter') {
        const n = parseFloat(counterBudget);
        if (isNaN(n) || n <= 0) { showToast('Error', 'Enter a valid amount', 'destructive'); return; }
        const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/counter-budget/`, { amount: n });
        const upd = normalizeTask(result.task);
        setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
        setSelectedTask(upd); setShowBudgetNegotiation(false); setCounterBudget(''); showToast('Success', result.message);
      } else {
        const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/reject-budget/`);
        const upd = normalizeTask(result.task);
        setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
        setSelectedTask(upd); showToast('Info', result.message);
      }
    } catch (e: any) {
      console.error(e); showToast('Error', 'Failed to process your request', 'destructive');
    }
  };

  const withdrawTask = async () => {
    if (!selectedTask) return;
    try {
      const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/withdraw/`, { reason: withdrawalReason });
      const upd = normalizeTask(result.task);
      setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
      setSelectedTask(upd); setShowWithdrawModal(false); setWithdrawalReason(''); showToast('Success', result.message);
    } catch (e: any) {
      console.error(e); showToast('Error', 'Failed to withdraw task', 'destructive');
    }
  };

  const approveTask = async () => {
    if (!selectedTask) return;
    try {
      setLoading(true);
      const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/approve/`);
      const upd = normalizeTask(result.task);
      setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
      setSelectedTask(upd); showToast('Success', result.message);
    } catch (e: any) {
      console.error(e); showToast('Error', 'Failed to approve task', 'destructive');
    } finally { setLoading(false); }
  };

  const requestRevision = async () => {
    if (!selectedTask) return;
    if (!revisionFeedback.trim()) { showToast('Required', 'Please add feedback', 'destructive'); return; }
    try {
      setLoading(true);
      const result = await apiService.post<{task: Task; message: string}>(`/tasks/${selectedTask.id}/request-revision/`, { feedback: revisionFeedback.trim() });
      const upd = normalizeTask(result.task);
      setTasks(prev => prev.map(t => t.id === upd.id ? upd : t));
      setSelectedTask(upd); setShowRevisionModal(false); setRevisionFeedback(''); showToast('Success', result.message);
    } catch (e: any) { console.error(e); showToast('Error', 'Failed to request revision', 'destructive'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); showToast('Logged out', 'You have been successfully logged out.'); };

  /* ======= Derivations ======= */
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const title = (task.title ?? '').toLowerCase();
    const subject = (task.subject ?? '').toLowerCase();
    return matchesStatus && (title.includes(q) || subject.includes(q));
  });

  const taskStats = useMemo(() => ({
    total: tasks.length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    awaiting_review: tasks.filter(t => t.status === 'awaiting_review').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    budget_negotiation: tasks.filter(t => t.status === 'budget_negotiation').length
  }), [tasks]);

  const canApprove = (t: Task) => t.status === 'awaiting_review';
  const canWithdraw = (t: Task) =>
    t.status === 'submitted' ||
    t.status === 'budget_negotiation' ||
    (t.status === 'in_progress' && t.withdrawal_deadline && new Date() < new Date(t.withdrawal_deadline));

  /* ======= Loading ======= */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  /* ======= Render ======= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {currentToast && <Toast title={currentToast.title} description={currentToast.description} variant={currentToast.variant} />}

      {/* Header — purplish theme */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-xl shrink-0">
                <i className="ri-graduation-cap-line text-2xl text-white"></i>
              </div>
              <div className="truncate">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-transparent bg-clip-text truncate">Student Portal</h1>
                <p className="text-xs text-gray-500 truncate">Welcome back, {currentUser?.full_name || currentUser?.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                <i className="ri-time-zone-line text-purple-700"></i>
                <span className="text-sm text-purple-900">
                  {timezones.find(tz => tz.value === (currentUser?.timezone || 'America/New_York'))?.label}
                </span>
              </div>
              {currentUser?.profile?.avatar && (
                <img src={currentUser.profile.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-purple-200" />
              )}
              <Button onClick={handleLogout} variant="outline" className="whitespace-nowrap">
                <i className="ri-logout-box-r-line mr-2"></i> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Shell layout: left nav / middle details / right list */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="
          h-[calc(100vh-7.5rem)]
          grid gap-6
          grid-cols-1
          md:grid-cols-[220px_1fr_300px]
          lg:grid-cols-[220px_1fr_340px]
        ">
          {/* Left nav */}
          <aside className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-gray-500 px-2 mb-1">Navigation</div>
            {[
              { label: 'Dashboard', icon: 'ri-dashboard-line' },
              { label: 'My Assignments', icon: 'ri-file-list-3-line' },
              { label: 'Messages', icon: 'ri-chat-3-line' },
              { label: 'Account', icon: 'ri-user-3-line' },
              { label: 'Support', icon: 'ri-customer-service-2-line' },
            ].map(({ label, icon }) => (
              <button key={label} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
                <i className={`${icon} text-purple-600`}></i>
                <span className="text-sm">{label}</span>
              </button>
            ))}

            {/* Snapshot */}
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="text-xs text-purple-800 font-semibold mb-2">Snapshot</div>
              <div className="space-y-1 text-xs text-purple-900">
                <div className="flex justify-between"><span>Total</span><span className="font-semibold">{taskStats.total}</span></div>
                <div className="flex justify-between"><span>In Progress</span><span className="font-semibold">{taskStats.in_progress}</span></div>
                <div className="flex justify-between"><span>Review</span><span className="font-semibold">{taskStats.awaiting_review}</span></div>
                <div className="flex justify-between"><span>Done</span><span className="font-semibold">{taskStats.completed}</span></div>
              </div>
            </div>

            <Button onClick={() => setShowCreateTask(true)} className="w-full mt-4 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
              <i className="ri-add-line mr-2"></i>New Assignment
            </Button>
          </aside>

          {/* Middle: details */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden flex flex-col min-h-0">
            {!selectedTask ? (
              <div className="flex-1 grid place-items-center text-gray-500">Select an assignment from the right list</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2">
                {/* Header row */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1 truncate">{selectedTask.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><i className="ri-book-line"></i>{selectedTask.subject}</span>
                      <span className="flex items-center gap-1"><i className="ri-graduation-cap-line"></i>{selectedTask.education_level}</span>
                      <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>Due: {new Date(selectedTask.deadline).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><i className="ri-time-zone-line"></i>{timezones.find(tz => tz.value === selectedTask.timezone_str)?.label || selectedTask.timezone_str}</span>
                      {selectedTask.budget ? (
                        <span className="flex items-center gap-1 text-purple-700 font-semibold"><i className="ri-money-dollar-circle-line"></i>${selectedTask.budget}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-700 font-semibold"><i className="ri-money-dollar-circle-line"></i>Proposed: ${selectedTask.proposed_budget}</span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedTask.status)}`}>
                    <i className={getStatusIcon(selectedTask.status)}></i>{formatStatus(selectedTask.status)}
                  </span>
                </div>

                {/* Budget blocks */}
                {(selectedTask.status === 'submitted' || selectedTask.status === 'budget_negotiation') && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                    <h3 className="font-semibold text-purple-900 mb-3">Budget</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Your Proposed</p>
                        <p className="text-xl font-bold text-purple-700">${selectedTask.proposed_budget}</p>
                      </div>
                      {selectedTask.admin_counter_budget && (
                        <div className="bg-white rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">Expert Counter</p>
                          <p className="text-xl font-bold text-orange-600">${selectedTask.admin_counter_budget}</p>
                        </div>
                      )}
                    </div>
                    {selectedTask.negotiation_reason && (
                      <div className="bg-white rounded-lg p-4 mt-3">
                        <p className="text-sm text-gray-600 mb-1">Expert’s explanation</p>
                        <p className="text-gray-800">{selectedTask.negotiation_reason}</p>
                      </div>
                    )}

                    {selectedTask.status === 'submitted' && (
                      <div className="mt-3 text-sm text-purple-900 bg-white rounded-lg p-3 border border-purple-200">
                        <i className="ri-time-line mr-2"></i>Waiting for expert to review your budget…
                      </div>
                    )}

                    {selectedTask.status === 'budget_negotiation' && selectedTask.negotiation_status === 'pending_student_response' && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Button onClick={() => respondToBudgetNegotiation('accept')} className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <i className="ri-check-line mr-2"></i>Accept ${selectedTask.admin_counter_budget}
                        </Button>
                        <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="h-11 border-orange-500 text-orange-600 hover:bg-orange-50">
                          <i className="ri-money-dollar-circle-line mr-2"></i>Counter Again
                        </Button>
                        <Button onClick={() => setShowWithdrawModal(true)} variant="outline" className="h-11 border-red-500 text-red-600 hover:bg-red-50">
                          <i className="ri-close-line mr-2"></i>Withdraw
                        </Button>
                      </div>
                    )}

                    {selectedTask.status === 'budget_negotiation' && selectedTask.negotiation_status === 'pending_admin_review' && (
                      <div className="mt-3 text-sm text-purple-900 bg-white rounded-lg p-3 border border-purple-200">
                        <i className="ri-time-line mr-2"></i>Waiting for expert to review your counter…
                      </div>
                    )}
                  </div>
                )}

                {/* Status cards */}
                {selectedTask.status === 'in_progress' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <i className="ri-loader-4-line text-3xl text-blue-600"></i>
                      <div>
                        <h3 className="font-bold text-blue-900 text-lg">Work In Progress</h3>
                        <p className="text-sm text-blue-700">Progress: {selectedTask.progress || 0}%</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 h-2.5 rounded-full" style={{ width: `${selectedTask.progress || 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTask.status === 'awaiting_review' && (
                  <div className="bg-purple-50 border border-purple-300 rounded-2xl p-5 mb-4">
                    <div className="text-center mb-4">
                      <i className="ri-file-check-line text-5xl text-purple-600"></i>
                      <h3 className="text-xl font-bold text-purple-900 mt-2">Assignment Ready!</h3>
                      <p className="text-xs text-purple-700 mt-1">Expert has submitted final work</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={approveTask} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <i className="ri-check-line mr-2"></i>Approve
                      </Button>
                      <Button onClick={() => setShowRevisionModal(true)} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                        <i className="ri-edit-line mr-2"></i>Request Revision
                      </Button>
                    </div>
                    <p className="text-center text-xs text-purple-700 mt-3">Approve = task completed & payment released</p>
                  </div>
                )}

                {/* Description */}
                <div className="bg-white rounded-xl p-4 mb-4 border">
                  <h3 className="font-semibold mb-2">Assignment Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedTask.description || 'No description provided.'}</p>
                </div>

                {/* Files */}
                <div className="bg-white rounded-xl p-4 mb-6 border">
                  <h3 className="font-semibold mb-3">Files ({selectedTask.files?.length ?? 0})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(selectedTask.files ?? []).map((file) => (
                      <div key={file.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                          <i className={`${getFileIcon(file.file_type || file.name?.split('.').pop())} text-purple-600`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.size} • {file.uploaded_by_name}</p>
                        </div>
                        <div className="ml-auto shrink-0 w-full sm:w-auto">
                          <Button size="sm" variant="outline" className="h-9 px-2 w-full sm:w-auto" onClick={() => downloadFile(file)}>
                            <i className="ri-download-line"></i>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messaging quick action */}
                <div className="bg-white rounded-xl p-4 border flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold flex items-center gap-2">
                    <i className="ri-chat-3-line"></i><span>Messaging</span>
                  </div>
                  <div className="relative">
                    <Button variant="outline" onClick={openChatWindow} className="h-10 px-3 text-sm w-full sm:w-auto">
                      <i className="ri-window-2-line mr-2"></i>Open Chat Window
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right: tasks list */}
          <aside className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">My Assignments</h2>
              <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-3" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                <option value="all">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="budget_negotiation">Budget Negotiation</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_review">Awaiting Review</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div className="overflow-y-auto p-2 h-full">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-file-list-3-line text-6xl mb-4 text-gray-300"></i>
                  <p>No assignments found</p>
                  <Button onClick={() => setShowCreateTask(true)} className="mt-4 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">Create New</Button>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 mb-2 rounded-xl border transition-colors cursor-pointer ${
                      selectedTask?.id === task.id ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${task.status === 'withdrawn' ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{task.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusColor(task.status)}`}>
                        <i className={getStatusIcon(task.status)}></i>{formatStatus(task.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.subject} • {task.education_level}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{new Date(task.deadline).toLocaleDateString()}</span>
                      {task.budget ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>${task.budget}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-600 font-semibold"><i className="ri-money-dollar-circle-line"></i>Proposed: ${task.proposed_budget}</span>
                      )}
                    </div>
                    {(task.revisions?.length ?? 0) > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600">
                        <i className="ri-edit-line"></i>{(task.revisions?.length ?? 0)} revision{(task.revisions?.length ?? 0) > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))
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
              style={{ left: chatPos.x, top: chatPos.y, width: chatSize.w, height: chatSize.h, resize: 'both' }}
              className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Drag handle */}
              <div onMouseDown={onDragStart} className="px-3 py-2 border-b cursor-move select-none bg-gray-50 flex items-center justify-between">
                <div className="font-semibold text-sm truncate">
                  <i className="ri-chat-3-line mr-2"></i>Chat • {selectedTask.title}
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={() => loadChat(selectedTask.id)} variant="outline" size="sm" className="h-8 px-2"><i className="ri-refresh-line"></i></Button>
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
                    {chatMessages.map((message) => {
                      const isMine =
                        message.sender_role === 'client' ||
                        message.sender_username === currentUser?.username;
                      return (
                        <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                            isMine
                              ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}>
                            <p className="text-sm leading-relaxed mb-1">{message.message}</p>
                            {message.file_url && (
                              <div className={`text-xs p-2 rounded-lg ${isMine ? 'bg-white/20' : 'bg-gray-100'}`}>
                                <a href={makeAbsoluteFileUrl(message.file_url)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                                  <i className="ri-attachment-line"></i>{message.file_name || 'Download file'}
                                </a>
                              </div>
                            )}
                            <p className={`text-[10px] flex items-center gap-1 ${isMine ? 'text-indigo-100' : 'text-gray-500'}`}>
                              <i className="ri-user-line"></i>{isMine ? 'You' : (selectedTask.assigned_admin?.full_name || 'Expert')} • {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-2xl text-xs flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="ml-2">Expert is typing…</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-gray-200 p-2 bg-white">
                {uploadedFiles.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded-lg text-xs">
                        <i className="ri-file-line text-purple-600"></i>
                        <span className="text-purple-800">{file.name}</span>
                        <button onClick={() => removeFile(index)} className="text-purple-600 hover:text-purple-800"><i className="ri-close-line"></i></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={newMessage} onChange={handleMessageInputChange} onKeyPress={handleKeyPress} placeholder="Type your message..." className="flex-1 h-9" />
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 px-2"><i className="ri-attachment-line"></i></Button>
                  <Button onClick={sendMessage} disabled={!newMessage.trim() && uploadedFiles.length === 0} className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white px-4 h-9">
                    <i className="ri-send-plane-fill"></i>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Task Modal — dropdowns restored */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Submit New Assignment</h2>
              <button onClick={() => setShowCreateTask(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600"></i>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                showToast('Submitting…', 'We\'re creating your assignment now.');
                const form = new FormData();
                form.append('title', taskForm.title);
                form.append('description', taskForm.description);
                form.append('subject', taskForm.subject);
                form.append('education_level', taskForm.education_level);
                form.append('deadline', taskForm.deadline);
                form.append('timezone_str', taskForm.timezone);
                form.append('proposed_budget', taskForm.budget);
                uploadedFiles.forEach(f => form.append('file', f));

                const tempId = Date.now();
                const optimistic = normalizeTask({
                  id: tempId,
                  title: taskForm.title,
                  description: taskForm.description,
                  subject: taskForm.subject,
                  education_level: taskForm.education_level,
                  deadline: taskForm.deadline,
                  timezone_str: taskForm.timezone,
                  proposed_budget: parseFloat(taskForm.budget || '0'),
                  status: 'submitted',
                  negotiation_status: 'pending_admin_review'
                });

                setTasks(prev => [optimistic, ...prev]);
                setSelectedTask(optimistic);
                setShowCreateTask(false);

                try {
                  const created = await apiService.postFormData<Partial<Task>>('/tasks/', form);
                  const real = normalizeTask(created);
                  setTasks(prev => prev.map(t => t.id === tempId ? real : t));
                  setSelectedTask(real);
                  showToast('Success', 'Task submitted successfully!');
                } catch (err: any) {
                  setTasks(prev => prev.filter(t => t.id !== tempId));
                  if (selectedTask?.id === tempId) setSelectedTask(null);
                  showToast('Error', 'Failed to create task', 'destructive');
                  setShowCreateTask(true);
                } finally {
                  setTaskForm({ title: '', description: '', subject: '', education_level: '', deadline: '', timezone: 'America/New_York', budget: '' });
                  setUploadedFiles([]);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Title</label>
                <Input
                  value={taskForm.title}
                  onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Research Paper on Climate Change"
                  className="py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <select
                    value={taskForm.subject}
                    onChange={(e) => setTaskForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    required
                  >
                    <option value="">Select subject</option>
                    {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
                  <select
                    value={taskForm.education_level}
                    onChange={(e) => setTaskForm(p => ({ ...p, education_level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    required
                  >
                    <option value="">Select level</option>
                    {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                  <Input
                    type="datetime-local"
                    value={taskForm.deadline}
                    onChange={e => setTaskForm(p => ({ ...p, deadline: e.target.value }))}
                    className="py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><i className="ri-time-zone-line mr-1"></i>Your Timezone</label>
                  <select
                    value={taskForm.timezone}
                    onChange={(e) => setTaskForm(p => ({ ...p, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    required
                  >
                    {timezones.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proposed Budget (USD)</label>
                <Input
                  type="number"
                  value={taskForm.budget}
                  onChange={e => setTaskForm(p => ({ ...p, budget: e.target.value }))}
                  placeholder="e.g., 150"
                  min="0"
                  step="10"
                  className="py-2"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Expert may propose a different budget</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Description</label>
                <Textarea
                  value={taskForm.description}
                  onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your assignment requirements in detail..."
                  rows={4}
                  className="text-sm"
                  required
                />
              </div>

              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Assignment Files</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" id="task-files" />
                  <label htmlFor="task-files" className="cursor-pointer">
                    <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-3"></i>
                    <p className="text-sm text-gray-600 mb-1">Click to upload files or drag and drop</p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images, and more</p>
                  </label>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <i className="ri-file-line text-purple-600 text-sm"></i>
                          <span className="text-purple-800 text-sm">{file.name}</span>
                          <span className="text-xs text-purple-700">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} className="text-red-600 hover:text-red-800 cursor-pointer text-sm">
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <i className="ri-information-line text-purple-700 text-sm mt-0.5"></i>
                  <div>
                    <h4 className="font-bold text-purple-900 text-sm mb-1">What happens next?</h4>
                    <ul className="text-xs text-purple-800 space-y-0.5">
                      <li>• Expert will be notified via email immediately</li>
                      <li>• You'll receive a budget confirmation or counter-offer</li>
                      <li>• Free withdrawal window may apply</li>
                      <li>• Real-time updates and notifications throughout the process</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateTask(false)} className="flex-1 py-2 text-sm whitespace-nowrap">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white py-2 text-sm whitespace-nowrap">
                  <i className="ri-send-plane-fill mr-1"></i>
                  Submit Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Negotiation Modal */}
      {showBudgetNegotiation && selectedTask && (
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Counter-Offer (USD)</label>
                <Input type="number" value={counterBudget} onChange={(e) => setCounterBudget(e.target.value)} min="0" step="10" className="text-lg py-3" required />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1"><span>Expert's Offer:</span><span className="font-bold">${selectedTask.admin_counter_budget}</span></div>
                <div className="flex justify-between text-sm text-gray-600"><span>Your Original Budget:</span><span className="font-bold">${selectedTask.proposed_budget}</span></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowBudgetNegotiation(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={() => respondToBudgetNegotiation('counter')} disabled={!counterBudget} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">Send Counter-Offer</Button>
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
              <p className="text-sm text-gray-700 mb-2"><strong>Assignment:</strong> {selectedTask.title}</p>
              <p className="text-sm text-gray-700 mb-2"><strong>Status:</strong> {formatStatus(selectedTask.status)}</p>
              <p className="text-sm text-gray-700"><strong>Withdrawal Fee:</strong> {selectedTask.can_withdraw_free ? 'Free' : `$${selectedTask.withdrawal_fee}`}</p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Withdrawal (Optional)</label>
              <Textarea value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value)} rows={3} className="text-sm" />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowWithdrawModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={withdrawTask} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Withdraw Assignment</Button>
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
              <label className="block text-lg font-bold text-gray-700 mb-3">Revision Feedback</label>
              <Textarea value={revisionFeedback} onChange={(e) => setRevisionFeedback(e.target.value)} placeholder="Please describe what changes you'd like to see..." rows={6} className="text-lg" required />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-information-line text-blue-600 text-xl mt-1"></i>
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">Revision Process</h4>
                  <p className="text-sm text-blue-800">Your expert will be notified immediately and will work on your requested changes.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowRevisionModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={requestRevision} disabled={!revisionFeedback.trim()} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
                <i className="ri-send-plane-fill mr-2"></i>Request Revision
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
  );
}
