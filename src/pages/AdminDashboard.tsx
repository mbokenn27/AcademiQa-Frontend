// src/pages/AdminDashboard.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
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

const Toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
  const bg = variant === 'destructive' ? 'bg-red-500' : 'bg-green-600';
  return (
    <div className={`fixed top-4 right-4 ${bg} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm`}>
      <div className="font-bold">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  );
};

/* ==============
   WebSocket Hook
   ============== */
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

/* =========
   Types
   ========= */
interface User { id: number; username: string; email: string; first_name: string; last_name: string; profile: UserProfile; full_name: string }
interface UserProfile {
  role: 'client' | 'admin'; phone?: string; education_level?: string; is_suspended: boolean; avatar?: string;
  expertise?: string; rating?: number; completed_tasks: number; earnings: number; is_verified: boolean; full_name: string
}
interface Task {
  id: number; task_id: string; title: string; description: string; subject: string; education_level: string; deadline: string;
  status: 'submitted' | 'budget_negotiation' | 'in_progress' | 'awaiting_review' | 'revision_requested' | 'completed' | 'withdrawn' | 'rejected' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent'; progress: number; budget?: number; proposed_budget: number; admin_counter_budget?: number;
  negotiation_status: 'pending_admin_review' | 'pending_student_response' | 'pending_admin_response' | 'accepted' | 'rejected';
  negotiation_reason?: string; estimated_hours: number; actual_hours?: number; timezone_str?: string;
  client: User; assigned_admin?: User; category?: any; timezone_obj?: any; files: TaskFile[]; revisions: Revision[];
  chat: ChatMessage[]; unread_messages: number; days_until_deadline: number; is_overdue: boolean; created_at: string; updated_at: string;
  accepted_at?: string; completed_at?: string; withdrawal_deadline?: string; withdrawal_fee: number; can_withdraw_free: boolean; reject_reason?: string
}
interface TaskFile { id: number; name: string; file_type: string; size: string; uploaded_by: number; uploaded_by_name: string; uploaded_at: string; description: string; file_url: string }
interface Revision { id: number; requested_by: number; requested_by_name: string; requested_at: string; feedback: string; status: 'requested'|'in_progress'|'completed'|'cancelled'; completed_at?: string; admin_notes: string }
interface ChatMessage { id: number; message: string; file?: string; file_name?: string; file_url?: string; is_read: boolean; created_at: string; sender: string; sender_role: 'admin' | 'client' }
interface TaskStats { total: number; new_requests: number; active: number; under_review: number; completed: number; recent: number }
interface AdminStats { assigned_tasks: number; completed_tasks: number; total_earnings: number; rating: number }

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

function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => { if (!ref.current || ref.current.contains(e.target as Node)) return; handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

const openGmailCompose = (toEmail: string, subject?: string, body?: string) => {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toEmail)}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/* =======================
   Component starts here
   ======================= */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [currentToast, setCurrentToast] = useState<{ title: string; description: string; variant?: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // list/search/filter
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // stats
  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, new_requests: 0, active: 0, under_review: 0, completed: 0, recent: 0 });
  const [adminStats, setAdminStats] = useState<AdminStats>({ assigned_tasks: 0, completed_tasks: 0, total_earnings: 0, rating: 0 });

  // chat state (floating window)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [chatPos, setChatPos] = useState<{ x: number, y: number }>({ x: 16, y: 100 });
  const [chatSize, setChatSize] = useState<{ w: number, h: number }>({ w: 360, h: 520 });
  const draggingRef = useRef<{ startX: number, startY: number, origX: number, origY: number } | null>(null);

  // modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressUpdate, setProgressUpdate] = useState('');
  const [showBudgetNegotiation, setShowBudgetNegotiation] = useState(false);
  const [counterBudget, setCounterBudget] = useState('');
  const [negotiationReason, setNegotiationReason] = useState('');
  const [showSubmitFinalModal, setShowSubmitFinalModal] = useState(false);

  // UI & loading
  const [loading, setLoading] = useState(true);

  // notifications dropdown
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(notifRef, () => setShowNotifPanel(false));

  const showToast = (title: string, description: string, variant?: string) => {
    setCurrentToast({ title, description, variant });
    setTimeout(() => setCurrentToast(null), 3000);
  };

  /* ======= WebSockets ======= */
  const { sendMessage: _sendAdminMessage } = useWebSocketWithReconnect('/ws/admin/', (data) => {
    if (data.type === 'task_updated' && data.task) {
      const updated: Task = data.task;
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      setSelectedTask(prev => (prev && prev.id === updated.id) ? { ...updated } : prev);
      loadStats();
    }
    if (data.type === 'task_created' && data.task) {
      const newTask: Task = data.task;
      setTasks(cur => cur.some(t => t.id === newTask.id) ? cur : [newTask, ...cur]);
      showToast('New Task', `Task #${newTask.id} created`);
    }
    // incoming message ping with task_id (from client)
    if (data.type === 'chat_message' && data.task_id && data.message?.sender_role === 'client') {
      const forOpenChat = showChatWindow && selectedTask?.id === data.task_id;
      setTasks(prev => prev.map(t => {
        if (t.id !== data.task_id) return t;
        return { ...t, unread_messages: forOpenChat ? 0 : (t.unread_messages || 0) + 1 };
      }));
    }
  }, [showChatWindow, selectedTask?.id]);

  const { sendMessage: sendTaskMessage } = useWebSocketWithReconnect(
    selectedTask ? `/ws/task/${selectedTask.id}/` : null,
    (data) => {
      if (data.type === 'chat_message' && data.message) {
        setChatMessages(prev => {
          const filtered = prev.filter(msg => !(msg.id > 1000000 && msg.message === data.message.message));
          return [...filtered, data.message];
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

        // if client message and this chat is open -> keep unread at 0 + mark-read best-effort
        if (data.message?.sender_role === 'client' && selectedTask && showChatWindow) {
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, unread_messages: 0 } : t));
          apiService.post(`/tasks/${selectedTask.id}/mark-read/`).catch(() => {});
        }
      }
      if (data.type === 'user_typing') {
        if (data.username !== currentUser?.username) setIsTyping(data.is_typing);
      }
    },
    [selectedTask?.id, showChatWindow, currentUser?.username]
  );

  /* ======= Data ======= */
  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedTask) { loadChat(selectedTask.id); } }, [selectedTask?.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const user = await apiService.get<User>('/auth/user/');
      setCurrentUser(user);
      const list = await apiService.get<Task[]>('/tasks/');
      setTasks(list);
      if (list.length) setSelectedTask(list[0]);
      await loadStats();
      showToast('Dashboard Loaded', 'Your dashboard has been loaded successfully');
    } catch (e) {
      console.error(e);
      showToast('Error', 'Failed to load dashboard data', 'destructive');
    } finally { setLoading(false); }
  };

  const loadStats = async () => {
    try {
      const s = await apiService.get<{ task_stats: TaskStats; admin_stats: AdminStats }>('/admin/stats/');
      setTaskStats(s.task_stats); setAdminStats(s.admin_stats);
    } catch (e) { console.error(e); }
  };

  const loadChat = async (taskId: number) => {
    try {
      const msgs = await apiService.get<ChatMessage[]>(`/tasks/${taskId}/chat/`);
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      // on load, mark-read
      try { await apiService.post(`/tasks/${taskId}/mark-read/`); } catch {}
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, unread_messages: 0 } : t));
    } catch (e) {
      console.error('Failed to load chat', e);
      showToast('Error', 'Failed to load chat messages', 'destructive');
    }
  };

  /* ======= Floating chat behaviors ======= */
  useEffect(() => {
    const h = chatSize.h;
    setChatPos({ x: 16, y: Math.max(16, window.innerHeight - h - 16) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const openChatWindow = async (t?: Task) => {
    const task = t || selectedTask;
    if (!task) return;
    setShowNotifPanel(false);
    setShowChatWindow(true);
    setChatMinimized(false);
    // clear unread immediately (UI + API)
    setTasks(prev => prev.map(x => x.id === task.id ? { ...x, unread_messages: 0 } : x));
    try { await apiService.post(`/tasks/${task.id}/mark-read/`); } catch {}
    loadChat(task.id);
  };

  const closeChatWindow = () => { setShowChatWindow(false); setChatMinimized(false); };

  /* ======= Chat send / typing ======= */
  const handleTyping = (typing: boolean) => { if (selectedTask) sendTaskMessage({ type: 'typing', is_typing: typing }); };
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) { setIsTyping(true); handleTyping(true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); handleTyping(false); }, 1000);
  };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };
  const removeFile = (i: number) => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i));

  const sendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    if (!selectedTask) return;

    const optimistic: ChatMessage = {
      id: Date.now(),
      message: newMessage.trim(),
      sender: currentUser?.username || 'Admin',
      sender_role: 'admin',
      created_at: new Date().toISOString(),
      is_read: false,
      file_url: uploadedFiles.length ? 'pending' : undefined,
      file_name: uploadedFiles.length ? uploadedFiles[0]?.name : undefined,
    };

    try {
      setIsTyping(false); handleTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setChatMessages(prev => [...prev, optimistic]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      if (uploadedFiles.length) {
        const form = new FormData();
        if (newMessage.trim()) form.append('message', newMessage.trim());
        uploadedFiles.forEach(f => form.append('file', f));
        await apiService.postFormData(`/tasks/${selectedTask.id}/chat/`, form);
      } else {
        await apiService.post(`/tasks/${selectedTask.id}/chat/`, { message: newMessage.trim() });
      }

      setNewMessage(''); setUploadedFiles([]);
      setTimeout(() => loadChat(selectedTask.id), 400);
    } catch (e) {
      console.error('send fail', e);
      setChatMessages(prev => prev.filter(m => m.id !== optimistic.id));
      showToast('Error', 'Failed to send message', 'destructive');
    }
  };

  /* ======= Task actions ======= */
  const acceptTask = async (taskId: number) => {
    try { await apiService.post(`/admin/tasks/${taskId}/accept/`); showToast('Task Accepted', 'Student has been notified via email.'); }
    catch (e) { console.error(e); showToast('Error', 'Failed to accept task', 'destructive'); }
  };
  const acceptBudget = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId); if (!task) return;
    const agreed = task.proposed_budget || task.admin_counter_budget || task.budget;
    const optimistic: Task = { ...task, budget: agreed, negotiation_status: 'accepted', status: 'in_progress' };
    setTasks(prev => prev.map(t => t.id === taskId ? optimistic : t));
    setSelectedTask(prev => (prev && prev.id === taskId ? optimistic : prev));
    try { await apiService.post(`/admin/tasks/${taskId}/accept-budget/`); showToast('Budget Accepted', 'Work will begin shortly. Student has been notified via email.'); }
    catch (e) { console.error(e); setTasks(prev => prev.map(t => t.id === taskId ? task : t)); setSelectedTask(prev => (prev && prev.id === taskId ? task : prev)); showToast('Error', 'Failed to accept budget', 'destructive'); }
  };
  const proposeBudget = async () => {
    if (!selectedTask || !counterBudget || !negotiationReason.trim()) return;
    const newAmt = parseFloat(counterBudget);
    const optimistic: Task = { ...selectedTask, status: 'budget_negotiation', negotiation_status: 'pending_student_response', admin_counter_budget: newAmt, negotiation_reason: negotiationReason.trim() };
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? optimistic : t));
    setSelectedTask(optimistic);
    try {
      await apiService.post(`/admin/tasks/${selectedTask.id}/propose-budget/`, { amount: newAmt, reason: negotiationReason.trim() });
      setShowBudgetNegotiation(false); setCounterBudget(''); setNegotiationReason(''); showToast('Counter-Offer Sent', 'Student has been notified.');
    } catch (e) {
      console.error(e); showToast('Error', 'Failed to send counter-offer', 'destructive');
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? selectedTask : t)); setSelectedTask(selectedTask);
    }
  };
  const rejectTask = async () => {
    if (!selectedTask || !rejectReason.trim()) return;
    try { await apiService.post(`/admin/tasks/${selectedTask.id}/reject/`, { reason: rejectReason }); setShowRejectModal(false); setRejectReason(''); showToast('Task Rejected', 'Student has been notified.'); }
    catch (e) { console.error(e); showToast('Error', 'Failed to reject task', 'destructive'); }
  };
  const submitForReview = async (taskId: number) => {
    try { await apiService.post(`/admin/tasks/${taskId}/submit-review/`); showToast('Submitted for Review', 'Task has been submitted for student review.'); }
    catch (e) { console.error(e); showToast('Error', 'Failed to submit task for review', 'destructive'); }
  };
  const markComplete = async (taskId: number) => {
    try { await apiService.post(`/admin/tasks/${taskId}/mark-complete/`); await loadStats(); showToast('Task Completed', 'Task has been marked as completed.'); }
    catch (e) { console.error(e); showToast('Error', 'Failed to mark task as complete', 'destructive'); }
  };
  const backToProgress = async (taskId: number) => {
    try { await apiService.post(`/admin/tasks/${taskId}/update-progress/`, { progress: 80 }); }
    catch (e) { console.error(e); showToast('Error', 'Failed to update task progress', 'destructive'); }
  };
  const updateProgress = async () => {
    if (!selectedTask || !progressUpdate.trim()) return;
    try {
      const newP = Math.min(selectedTask.progress + 20, 95);
      await apiService.post(`/admin/tasks/${selectedTask.id}/update-progress/`, { progress: newP, message: progressUpdate });
      setShowProgressModal(false); setProgressUpdate(''); showToast('Progress Updated', 'Task progress has been updated.');
    } catch (e) { console.error(e); showToast('Error', 'Failed to update progress', 'destructive'); }
  };

  // Authenticated file download (kept from your version)
  const downloadFile = async (file: TaskFile) => {
    try {
      const token = localStorage.getItem('access_token');
      const fallback = file.file_url || `/files/${file.id}/download/`;
      const url = fallback.startsWith('http') ? fallback : `${API_BASE}${fallback.startsWith('/') ? '' : '/'}${fallback}`;
      const sameOrigin = url.startsWith(window.location.origin) || url.startsWith(API_BASE);
      if (sameOrigin) {
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = blobUrl; a.download = file.name || 'download';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(blobUrl);
      } else { window.open(url, '_blank'); }
    } catch (err) {
      console.error('Download error:', err);
      setCurrentToast({ title: 'Error', description: 'Failed to download file.', variant: 'destructive' });
      setTimeout(() => setCurrentToast(null), 3000);
    }
  };

  /* ======= Derivations ======= */
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = task.title.toLowerCase().includes(q) || task.subject.toLowerCase().includes(q) || task.client.full_name.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // total unread, excluding the task whose chat is open
  const totalUnread = useMemo(() =>
    tasks.reduce((sum, t) => {
      if (showChatWindow && selectedTask?.id === t.id) return sum;
      return sum + (t.unread_messages || 0);
    }, 0),
    [tasks, showChatWindow, selectedTask?.id]
  );

  const unreadTasks = useMemo(
    () => tasks.filter(t => (t.unread_messages || 0) > 0 && (!showChatWindow || t.id !== selectedTask?.id)),
    [tasks, showChatWindow, selectedTask?.id]
  );

  /* ======= UI helpers ======= */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'awaiting_review': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  const formatStatus = (s: string) => s.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'submitted': return 'ri-file-text-line';
      case 'in_progress': return 'ri-loader-4-line';
      case 'awaiting_review': return 'ri-eye-line';
      case 'completed': return 'ri-checkbox-circle-line';
      case 'rejected': return 'ri-close-circle-line';
      default: return 'ri-file-line';
    }
  };
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return 'ri-file-pdf-line';
      case 'word': case 'docx': case 'doc': return 'ri-file-word-line';
      case 'excel': case 'xlsx': case 'xls': return 'ri-file-excel-line';
      case 'powerpoint': case 'pptx': case 'ppt': return 'ri-file-ppt-line';
      case 'python': case 'py': return 'ri-file-code-line';
      case 'csv': return 'ri-file-chart-line';
      default: return 'ri-file-line';
    }
  };

  /* ======= Action buttons builder (kept responsive) ======= */
  const getActionButtons = (task: Task) => {
    if (task.status === 'awaiting_review') {
      return (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl text-center">
          <i className="ri-time-line text-4xl text-purple-700 mb-2 block animate-pulse"></i>
          <p className="text-lg font-bold text-purple-900">Waiting for Student Approval</p>
          <p className="text-sm text-purple-700 mt-1">{task.revisions.length > 0 ? "Your revised work has been submitted." : "Your final assignment has been submitted."}</p>
        </div>
      );
    }
    if (task.status === 'revision_requested') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]); }} className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl shadow-md">
            <i className="ri-upload-2-line mr-2"></i>Re-Submit Revised Assignment
          </Button>
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm flex-1 min-w-[220px]">
            <p className="font-bold text-red-800 mb-1">Student Feedback:</p>
            <p className="text-red-700 leading-snug">{task.revisions?.[0]?.feedback || "No feedback provided"}</p>
          </div>
        </div>
      );
    }
    if (task.status === 'budget_negotiation' && task.negotiation_status === 'pending_admin_response') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => acceptBudget(task.id)} className="w-full sm:w-auto h-11 text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white">
            <i className="ri-check-line mr-2"></i>Accept Student Offer (${task.proposed_budget})
          </Button>
          <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="w-full sm:w-auto h-11 text-sm sm:text-base border-orange-500 text-orange-600 hover:bg-orange-50">
            <i className="ri-money-dollar-circle-line mr-2"></i>Counter Offer
          </Button>
        </div>
      );
    }
    if (task.status === 'in_progress') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setSelectedTask(task); setShowSubmitFinalModal(true); setUploadedFiles([]); }} className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-md">
            <i className="ri-upload-cloud-2-line mr-2"></i>Submit Final Assignment
          </Button>
          <Button onClick={() => { setSelectedTask(task); setShowProgressModal(true); }} variant="outline" className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base border-blue-500 text-blue-700 hover:bg-blue-50 font-medium">
            <i className="ri-bar-chart-line mr-2"></i>Update Progress
          </Button>
        </div>
      );
    }
    if (task.status === 'submitted') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => acceptTask(task.id)} className="w-full sm:w-auto h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base">
            <i className="ri-check-line mr-2"></i>Accept & Start
          </Button>
          <Button onClick={() => setShowBudgetNegotiation(true)} variant="outline" className="w-full sm:w-auto h-11 border-orange-500 text-orange-600 hover:bg-orange-50 text-sm sm:text-base">
            <i className="ri-money-dollar-circle-line mr-2"></i>Propose Budget
          </Button>
          <Button onClick={() => setShowRejectModal(true)} variant="outline" className="w-full sm:w-auto h-11 border-red-500 text-red-600 hover:bg-red-50 text-sm sm:text-base">
            <i className="ri-close-line mr-2"></i>Reject
          </Button>
        </div>
      );
    }
    if (['completed', 'rejected', 'withdrawn', 'cancelled'].includes(task.status)) {
      const done = task.status === 'completed';
      return (
        <div className={`p-4 rounded-2xl text-center font-bold border-2 ${done ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-gray-50 text-gray-600 border-gray-300'}`}>
          <i className={done ? 'ri-checkbox-circle-fill text-4xl block mb-2' : 'ri-forbid-line text-4xl block mb-2'}></i>
          {done ? 'Task Completed' : 'Task Inactive'}
        </div>
      );
    }
    return null;
  };

  /* ======= Loading ======= */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  /* ======= Render ======= */
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
              {/* Bell dropdown */}
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
                              const ids = unreadTasks.map(t => t.id);
                              setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, unread_messages: 0 } : t));
                              for (const id of ids) { apiService.post(`/tasks/${id}/mark-read/`).catch(() => {}); }
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
                              onClick={() => { setSelectedTask(task); openChatWindow(task); }}
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

              <Button onClick={() => { logout(); navigate('/'); showToast('Logged out', 'You have been successfully logged out.'); }} variant="outline" className="whitespace-nowrap">
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
          {/* Left nav (lightweight) */}
          <aside className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-gray-500 px-2 mb-1">Navigation</div>
            {[
              { label: 'Dashboard', icon: 'ri-dashboard-line' },
              { label: 'Tasks', icon: 'ri-file-list-3-line' },
              { label: 'Experts', icon: 'ri-team-line' },
              { label: 'Messages', icon: 'ri-chat-3-line' },
              { label: 'Settings', icon: 'ri-settings-3-line' },
            ].map(({ label, icon }) => (
              <button key={label} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
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

          {/* Middle: details (no static chat; button opens floating window) */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden flex flex-col min-h-0">
            {!selectedTask ? (
              <div className="flex-1 grid place-items-center text-gray-500">Select a task from the right list</div>
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

                {/* Negotiation blocks */}
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

                {/* Student info */}
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
                        <Button size="sm" variant="outline" className="h-9 px-2" onClick={() => downloadFile(file)}>
                          <i className="ri-download-line"></i>
                        </Button>
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

          {/* Right: tasks list */}
          <aside className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Task Requests</h2>
              <Input ref={searchInputRef} placeholder="Search tasks…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-3" />
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
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 mb-2 rounded-xl border transition-colors cursor-pointer ${
                      selectedTask?.id === task.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:bg-gray-50'
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
                              <a href={message.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
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

      {/* Modals (same patterns as before) */}
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
                <div className="flex justify-between text-sm text-gray-600"><span>Student's Proposed Budget:</span><span className="font-bold text-lg">${selectedTask?.proposed_budget}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Counter-Offer (USD)</label>
                <Input type="number" value={counterBudget} onChange={(e) => setCounterBudget(e.target.value)} placeholder="Enter your proposed budget" min="0" step="10" className="text-lg py-3" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Explanation for Budget Adjustment</label>
                <Textarea value={negotiationReason} onChange={(e) => setNegotiationReason(e.target.value)} placeholder="Explain why you're proposing a different budget..." rows={4} className="text-sm" required />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowBudgetNegotiation(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={proposeBudget} disabled={!counterBudget || !negotiationReason.trim()} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap">Send Counter-Offer</Button>
            </div>
          </div>
        </div>
      )}

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
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Please explain why you're rejecting this task..." rows={6} className="text-lg" required />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowRejectModal(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={rejectTask} disabled={!rejectReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white whitespace-nowrap">Reject Task</Button>
            </div>
          </div>
        </div>
      )}

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
              <Textarea value={progressUpdate} onChange={(e) => setProgressUpdate(e.target.value)} placeholder="Describe what you've completed and what's next..." rows={6} className="text-lg" required />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowProgressModal(false)} variant="outline" className="flex-1 whitespace-nowrap">Cancel</Button>
              <Button onClick={updateProgress} disabled={!progressUpdate.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">Update Progress</Button>
            </div>
          </div>
        </div>
      )}

      {showSubmitFinalModal && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Submit Final Assignment</h3>
              <button onClick={() => { setShowSubmitFinalModal(false); setUploadedFiles([]); }} className="w-12 h-12 rounded-full hover:bg-gray-100 transition">
                Close
              </button>
            </div>
            <div className="text-center mb-8">
              <i className="ri-file-upload-line text-7xl text-purple-600 mb-3"></i>
              <p className="text-lg text-gray-700">Upload the completed assignment</p>
            </div>
            <div className="mb-6">
              <input type="file" multiple onChange={handleFileUpload} className="block w-full text-base text-gray-700 file:mr-6 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-base file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer" />
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
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { setShowSubmitFinalModal(false); setUploadedFiles([]); }} variant="outline" className="w-full sm:w-auto flex-1 text-base py-5">Cancel</Button>
              <Button
                onClick={async () => {
                  if (!selectedTask || uploadedFiles.length === 0) return;
                  try {
                    const form = new FormData();
                    uploadedFiles.forEach(f => form.append('solution', f));
                    await apiService.postFormData(`/admin/tasks/${selectedTask.id}/upload-solution/`, form);
                    setShowSubmitFinalModal(false); setUploadedFiles([]);
                    setCurrentToast({ title: 'Success', description: 'Final assignment submitted! Waiting for student approval.' });
                    setTimeout(() => setCurrentToast(null), 4000);
                  } catch (err) {
                    console.error('Upload failed:', err);
                    setCurrentToast({ title: 'Upload Failed', description: 'Please try again.', variant: 'destructive' });
                    setTimeout(() => setCurrentToast(null), 4000);
                  }
                }}
                disabled={uploadedFiles.length === 0}
                className="w-full sm:w-auto flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-base py-5"
              >
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
  );
}
