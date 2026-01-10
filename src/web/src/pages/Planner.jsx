import { useState, useEffect, useCallback } from 'react';
import { tasks as tasksApi, timeblocks as timeblocksApi } from '../utils/api';
import './Planner.css';

// Generate 30-min time slots from 5:00 AM to 11:30 PM
const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 5; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
};

const TIME_SLOTS = generateTimeSlots();

const CATEGORIES = [
    { id: 'work', label: 'Work', color: '#6366f1' },
    { id: 'personal', label: 'Personal', color: '#8b5cf6' },
    { id: 'health', label: 'Health', color: '#10b981' },
    { id: 'learning', label: 'Learning', color: '#f59e0b' },
    { id: 'general', label: 'General', color: '#6b7280' },
];

const PRIORITIES = [
    { id: 'high', label: 'High', color: '#ef4444' },
    { id: 'medium', label: 'Medium', color: '#f59e0b' },
    { id: 'low', label: 'Low', color: '#10b981' },
];

const RECURRENCES = [
    { id: null, label: 'Once', icon: '1️⃣' },
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'weekly', label: 'Weekly', icon: '📆' },
    { id: 'monthly', label: 'Monthly', icon: '🗓️' },
];

export function PlannerPage() {
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tasks, setTasks] = useState([]);
    const [slotInputs, setSlotInputs] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('day');
    const [draggedTask, setDraggedTask] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('general');
    const [selectedPriority, setSelectedPriority] = useState('medium');
    const [selectedRecurrence, setSelectedRecurrence] = useState(null);
    const [expandedTask, setExpandedTask] = useState(null);
    const [timeBlocks, setTimeBlocks] = useState([]);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [editingBlock, setEditingBlock] = useState(null);
    const [newBlock, setNewBlock] = useState({ name: '', start_time: '09:00', end_time: '17:00', color: '#6366f1', icon: '📚' });

    useEffect(() => {
        loadTasks();
        loadTimeBlocks();
    }, [date, viewMode]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 't':
                    setDate(new Date().toISOString().split('T')[0]);
                    break;
                case 'ArrowLeft':
                    changeDate(viewMode === 'week' ? -7 : -1);
                    break;
                case 'ArrowRight':
                    changeDate(viewMode === 'week' ? 7 : 1);
                    break;
                case 'd':
                    setViewMode('day');
                    break;
                case 'w':
                    setViewMode('week');
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode]);

    const loadTasks = async () => {
        setLoading(true);
        setError('');
        try {
            if (viewMode === 'week') {
                const weekDays = getWeekDays(date);
                const allTasks = [];
                for (const day of weekDays) {
                    try {
                        const res = await tasksApi.getByDate(day);
                        if (res.tasks) allTasks.push(...res.tasks.map(t => ({ ...t, due_date: day })));
                    } catch (e) { }
                }
                setTasks(allTasks);
            } else {
                const response = await tasksApi.getByDate(date);
                setTasks(response.tasks || []);
            }
        } catch (err) {
            setError(err.message);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const getWeekDays = (dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const newDate = new Date(d);
            newDate.setDate(diff + i);
            days.push(newDate.toISOString().split('T')[0]);
        }
        return days;
    };

    const loadTimeBlocks = async () => {
        try {
            const response = await timeblocksApi.list();
            setTimeBlocks(response.timeBlocks || []);
        } catch (err) {
            console.error('Failed to load time blocks:', err);
        }
    };

    // Check if a time slot falls within any time block
    const getBlockForSlot = (slot) => {
        return timeBlocks.find(block => {
            return slot >= block.start_time && slot < block.end_time;
        });
    };

    // Time block CRUD handlers
    const handleCreateBlock = async () => {
        if (!newBlock.name || !newBlock.start_time || !newBlock.end_time) {
            setError('Please fill in all required fields');
            return;
        }
        try {
            const response = await timeblocksApi.create(newBlock);
            setTimeBlocks([...timeBlocks, response.timeBlock]);
            setNewBlock({ name: '', start_time: '09:00', end_time: '17:00', color: '#6366f1', icon: '📚' });
            setShowBlockModal(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateBlock = async () => {
        if (!editingBlock) return;
        try {
            const response = await timeblocksApi.update(editingBlock.id, editingBlock);
            setTimeBlocks(timeBlocks.map(b => b.id === editingBlock.id ? response.timeBlock : b));
            setEditingBlock(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteBlock = async (blockId) => {
        try {
            await timeblocksApi.delete(blockId);
            setTimeBlocks(timeBlocks.filter(b => b.id !== blockId));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSlotInputChange = (slot, value) => {
        setSlotInputs(prev => ({ ...prev, [slot]: value }));
    };

    const handleSlotSubmit = async (slot, e) => {
        e.preventDefault();
        const title = slotInputs[slot]?.trim();
        if (!title) return;

        try {
            const response = await tasksApi.create({
                title,
                due_date: date,
                scheduled_time: slot,
                category: selectedCategory,
                priority: selectedPriority,
                recurrence: selectedRecurrence,
            });
            if (response.task) {
                setTasks([...tasks, response.task]);
                setSlotInputs(prev => ({ ...prev, [slot]: '' }));
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleTask = async (taskId, currentStatus) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        try {
            await tasksApi.update(taskId, { status: newStatus });
        } catch (err) {
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: currentStatus } : t));
            setError(err.message);
        }
    };

    const handleDeleteTask = async (taskId) => {
        const originalTasks = tasks;
        setTasks(tasks.filter(t => t.id !== taskId));
        try {
            await tasksApi.delete(taskId);
        } catch (err) {
            setTasks(originalTasks);
            setError(err.message);
        }
    };

    const changeDate = useCallback((days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        setDate(d.toISOString().split('T')[0]);
    }, [date]);

    // Drag and Drop handlers
    const handleDragStart = (e, task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetSlot) => {
        e.preventDefault();
        if (!draggedTask || draggedTask.scheduled_time === targetSlot) {
            setDraggedTask(null);
            return;
        }

        // Check if slot is occupied
        const existingTask = tasks.find(t => t.scheduled_time === targetSlot && t.due_date === date);
        if (existingTask) {
            setError('This time slot already has a task');
            setDraggedTask(null);
            return;
        }

        // Optimistic update
        setTasks(tasks.map(t =>
            t.id === draggedTask.id ? { ...t, scheduled_time: targetSlot } : t
        ));

        try {
            await tasksApi.update(draggedTask.id, { scheduled_time: targetSlot });
        } catch (err) {
            setTasks(tasks.map(t =>
                t.id === draggedTask.id ? { ...t, scheduled_time: draggedTask.scheduled_time } : t
            ));
            setError(err.message);
        }
        setDraggedTask(null);
    };

    const getTaskForSlot = (time, dayDate = date) => {
        return tasks.find(t => t.scheduled_time === time && t.due_date === dayDate && !t.deleted_at);
    };

    const getCategoryColor = (cat) => CATEGORIES.find(c => c.id === cat)?.color || '#6b7280';
    const getPriorityColor = (pri) => PRIORITIES.find(p => p.id === pri)?.color || '#f59e0b';

    const completedCount = tasks.filter(t => t.status === 'done').length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
    const isToday = date === new Date().toISOString().split('T')[0];

    // Line graph data
    const getLineGraphData = (dayTasks) => {
        return TIME_SLOTS.map((slot) => {
            const task = dayTasks.find(t => t.scheduled_time === slot);
            if (!task) return null;
            return { slot, completed: task.status === 'done' };
        }).filter(Boolean);
    };

    const renderLineGraph = (dayTasks, width = 800, height = 100) => {
        const graphData = getLineGraphData(dayTasks);
        if (graphData.length === 0) return null;

        const padding = 40;
        const graphWidth = width - padding * 2;
        const points = graphData.map((d, i) => ({
            x: padding + (i / Math.max(graphData.length - 1, 1)) * graphWidth,
            y: d.completed ? 25 : 75,
            ...d
        }));

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        return (
            <svg className="line-graph" viewBox={`0 0 ${width} ${height}`}>
                <line x1={padding} y1={25} x2={width - padding} y2={25} stroke="rgba(16, 185, 129, 0.2)" strokeDasharray="4" />
                <line x1={padding} y1={75} x2={width - padding} y2={75} stroke="rgba(239, 68, 68, 0.2)" strokeDasharray="4" />
                <text x="8" y="29" className="graph-label success">Done</text>
                <text x="8" y="79" className="graph-label pending">Todo</text>
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>
                <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => (
                    <g key={i}>
                        <circle cx={p.x} cy={p.y} r="5" fill={p.completed ? '#10b981' : '#ef4444'} />
                        <text x={p.x} y={height - 5} textAnchor="middle" className="graph-time">{p.slot}</text>
                    </g>
                ))}
            </svg>
        );
    };

    return (
        <div className="planner-container">
            {/* Header */}
            <div className="planner-header">
                <div className="header-left">
                    <div className="view-toggle">
                        <button className={`toggle-btn ${viewMode === 'day' ? 'active' : ''}`} onClick={() => setViewMode('day')}>Day</button>
                        <button className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
                    </div>
                    <button className="today-btn" onClick={() => setDate(new Date().toISOString().split('T')[0])}>Today</button>
                </div>

                <div className="date-nav">
                    <button className="nav-btn" onClick={() => changeDate(viewMode === 'week' ? -7 : -1)}>←</button>
                    <div className="date-display">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input" />
                        {isToday && <span className="today-badge">Today</span>}
                    </div>
                    <button className="nav-btn" onClick={() => changeDate(viewMode === 'week' ? 7 : 1)}>→</button>
                </div>

                <div className="header-right">
                    <div className="stats-mini">
                        <span className="stat-done">{completedCount}</span>
                        <span className="stat-sep">/</span>
                        <span className="stat-total">{tasks.length}</span>
                    </div>
                    <div className="progress-mini">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Quick Options */}
            <div className="quick-options">
                <div className="option-group">
                    <label>Category:</label>
                    <div className="category-pills">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                className={`pill ${selectedCategory === cat.id ? 'active' : ''}`}
                                style={{ '--pill-color': cat.color }}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="option-group">
                    <label>Priority:</label>
                    <div className="priority-pills">
                        {PRIORITIES.map(pri => (
                            <button
                                key={pri.id}
                                className={`pill ${selectedPriority === pri.id ? 'active' : ''}`}
                                style={{ '--pill-color': pri.color }}
                                onClick={() => setSelectedPriority(pri.id)}
                            >
                                {pri.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="option-group">
                    <label>Repeat:</label>
                    <div className="recurrence-pills">
                        {RECURRENCES.map(rec => (
                            <button
                                key={rec.id || 'once'}
                                className={`pill ${selectedRecurrence === rec.id ? 'active' : ''}`}
                                style={{ '--pill-color': '#6366f1' }}
                                onClick={() => setSelectedRecurrence(rec.id)}
                                title={rec.label}
                            >
                                {rec.icon} {rec.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Time Blocks Bar */}
            <div className="time-blocks-bar">
                <div className="time-blocks-label">Time Blocks:</div>
                <div className="time-blocks-list">
                    {timeBlocks.map(block => (
                        <div
                            key={block.id}
                            className="time-block-chip"
                            style={{ '--block-color': block.color }}
                            title={`${block.start_time} - ${block.end_time}`}
                        >
                            <span className="block-icon">{block.icon}</span>
                            <span className="block-name">{block.name}</span>
                            <span className="block-time">{block.start_time}-{block.end_time}</span>
                        </div>
                    ))}
                    <button className="add-block-btn" onClick={() => setShowBlockModal(true)}>
                        + Manage Blocks
                    </button>
                </div>
            </div>

            {/* Time Blocks Modal */}
            {showBlockModal && (
                <div className="modal-overlay" onClick={() => { setShowBlockModal(false); setEditingBlock(null); }}>
                    <div className="modal-content time-blocks-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Manage Time Blocks</h2>
                            <button className="modal-close" onClick={() => { setShowBlockModal(false); setEditingBlock(null); }}>×</button>
                        </div>

                        <div className="modal-body">
                            {/* Existing Blocks */}
                            <div className="existing-blocks">
                                <h3>Your Time Blocks</h3>
                                {timeBlocks.length === 0 ? (
                                    <p className="no-blocks">No time blocks yet. Create one below!</p>
                                ) : (
                                    <div className="blocks-list">
                                        {timeBlocks.map(block => (
                                            <div key={block.id} className="block-item" style={{ '--block-color': block.color }}>
                                                <div className="block-info">
                                                    <span className="block-icon">{block.icon}</span>
                                                    <span className="block-name">{block.name}</span>
                                                    <span className="block-range">{block.start_time} - {block.end_time}</span>
                                                </div>
                                                <div className="block-actions">
                                                    <button onClick={() => setEditingBlock({ ...block })}>Edit</button>
                                                    <button className="delete-btn" onClick={() => handleDeleteBlock(block.id)}>Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Create/Edit Form */}
                            <div className="block-form">
                                <h3>{editingBlock ? 'Edit Block' : 'Create New Block'}</h3>
                                <div className="form-row">
                                    <label>Name:</label>
                                    <input
                                        type="text"
                                        value={editingBlock ? editingBlock.name : newBlock.name}
                                        onChange={e => editingBlock
                                            ? setEditingBlock({ ...editingBlock, name: e.target.value })
                                            : setNewBlock({ ...newBlock, name: e.target.value })
                                        }
                                        placeholder="e.g., College, Work, Gym"
                                    />
                                </div>
                                <div className="form-row time-row">
                                    <div>
                                        <label>Start Time:</label>
                                        <input
                                            type="time"
                                            value={editingBlock ? editingBlock.start_time : newBlock.start_time}
                                            onChange={e => editingBlock
                                                ? setEditingBlock({ ...editingBlock, start_time: e.target.value })
                                                : setNewBlock({ ...newBlock, start_time: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label>End Time:</label>
                                        <input
                                            type="time"
                                            value={editingBlock ? editingBlock.end_time : newBlock.end_time}
                                            onChange={e => editingBlock
                                                ? setEditingBlock({ ...editingBlock, end_time: e.target.value })
                                                : setNewBlock({ ...newBlock, end_time: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <label>Color:</label>
                                    <input
                                        type="color"
                                        value={editingBlock ? editingBlock.color : newBlock.color}
                                        onChange={e => editingBlock
                                            ? setEditingBlock({ ...editingBlock, color: e.target.value })
                                            : setNewBlock({ ...newBlock, color: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-row">
                                    <label>Icon:</label>
                                    <select
                                        value={editingBlock ? editingBlock.icon : newBlock.icon}
                                        onChange={e => editingBlock
                                            ? setEditingBlock({ ...editingBlock, icon: e.target.value })
                                            : setNewBlock({ ...newBlock, icon: e.target.value })
                                        }
                                    >
                                        <option value="📚">📚 Study</option>
                                        <option value="💼">💼 Work</option>
                                        <option value="🏠">🏠 Home</option>
                                        <option value="🏋️">🏋️ Exercise</option>
                                        <option value="🍽️">🍽️ Meals</option>
                                        <option value="😴">😴 Sleep</option>
                                        <option value="🎮">🎮 Leisure</option>
                                        <option value="🚗">🚗 Commute</option>
                                    </select>
                                </div>
                                <div className="form-actions">
                                    {editingBlock ? (
                                        <>
                                            <button className="cancel-btn" onClick={() => setEditingBlock(null)}>Cancel</button>
                                            <button className="save-btn" onClick={handleUpdateBlock}>Save Changes</button>
                                        </>
                                    ) : (
                                        <button className="create-btn" onClick={handleCreateBlock}>Create Block</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && <div className="planner-error">{error} <button onClick={() => setError('')}>×</button></div>}

            {/* Line Graph */}
            <div className="graph-container">
                <h3 className="graph-title">Completion Flow</h3>
                {loading ? <div className="graph-loading">Loading...</div>
                    : tasks.filter(t => t.scheduled_time).length === 0
                        ? <div className="graph-empty">Add tasks to see your progress flow</div>
                        : renderLineGraph(viewMode === 'day' ? tasks : tasks.filter(t => t.due_date === date))}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="shortcuts-hint">
                <span>⌨️ Shortcuts:</span>
                <code>T</code> Today
                <code>←/→</code> Navigate
                <code>D</code> Day
                <code>W</code> Week
            </div>

            {/* Timeline View */}
            {viewMode === 'day' ? (
                <div className="timeline-container">
                    {loading ? <div className="loading">Loading...</div> : (
                        <div className="timeline">
                            {TIME_SLOTS.map((slot, slotIndex) => {
                                const task = getTaskForSlot(slot);
                                const isCurrentHour = new Date().getHours() === parseInt(slot.split(':')[0]) && isToday;
                                const hasTask = !!task;
                                const block = getBlockForSlot(slot);
                                const isBlockStart = block && (slotIndex === 0 || !getBlockForSlot(TIME_SLOTS[slotIndex - 1]) || getBlockForSlot(TIME_SLOTS[slotIndex - 1])?.id !== block.id);
                                const isBlockEnd = block && (slotIndex === TIME_SLOTS.length - 1 || !getBlockForSlot(TIME_SLOTS[slotIndex + 1]) || getBlockForSlot(TIME_SLOTS[slotIndex + 1])?.id !== block.id);

                                return (
                                    <div
                                        key={slot}
                                        className={`timeline-slot ${isCurrentHour ? 'current' : ''} ${hasTask ? 'has-task' : ''} ${draggedTask ? 'drop-target' : ''} ${block ? 'in-block' : ''} ${isBlockStart ? 'block-start' : ''} ${isBlockEnd ? 'block-end' : ''}`}
                                        style={block ? { '--block-color': block.color } : {}}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, slot)}
                                    >
                                        {isBlockStart && (
                                            <div className="block-label" style={{ backgroundColor: block.color }}>
                                                {block.icon} {block.name}
                                            </div>
                                        )}
                                        <div className="slot-time">{slot}</div>
                                        <div className="slot-line">
                                            {hasTask && <div className={`slot-marker ${task.status === 'done' ? 'completed' : 'pending'}`} style={{ borderColor: getCategoryColor(task.category) }}></div>}
                                        </div>
                                        <div className="slot-content">
                                            {hasTask ? (
                                                <div
                                                    className={`timeline-task ${task.status}`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, task)}
                                                    onClick={() => handleToggleTask(task.id, task.status)}
                                                >
                                                    <div className="task-category-bar" style={{ backgroundColor: getCategoryColor(task.category) }}></div>
                                                    <div className="task-priority-dot" style={{ backgroundColor: getPriorityColor(task.priority) }}></div>
                                                    <span className="task-check">{task.status === 'done' ? '✓' : ''}</span>
                                                    <span className="task-text">{task.title}</span>
                                                    {task.recurrence && <span className="task-recurrence">🔁</span>}
                                                    <button className="task-expand" onClick={(e) => { e.stopPropagation(); setExpandedTask(expandedTask === task.id ? null : task.id); }}>⋯</button>
                                                    <button className="task-delete" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}>×</button>
                                                </div>
                                            ) : (
                                                <form onSubmit={(e) => handleSlotSubmit(slot, e)} className="slot-form">
                                                    <input
                                                        type="text"
                                                        value={slotInputs[slot] || ''}
                                                        onChange={(e) => handleSlotInputChange(slot, e.target.value)}
                                                        placeholder="Add task..."
                                                        className="slot-input"
                                                    />
                                                </form>
                                            )}
                                            {expandedTask === task?.id && (
                                                <div className="task-details">
                                                    <div className="detail-row">
                                                        <span className="detail-label">Category:</span>
                                                        <span className="detail-value" style={{ color: getCategoryColor(task.category) }}>{task.category}</span>
                                                    </div>
                                                    <div className="detail-row">
                                                        <span className="detail-label">Priority:</span>
                                                        <span className="detail-value" style={{ color: getPriorityColor(task.priority) }}>{task.priority}</span>
                                                    </div>
                                                    {task.notes && <div className="detail-notes">{task.notes}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="week-container">
                    {getWeekDays(date).map(dayDate => {
                        const dayTasks = tasks.filter(t => t.due_date === dayDate);
                        const dayName = new Date(dayDate).toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNum = new Date(dayDate).getDate();
                        const isSelectedDay = dayDate === date;

                        return (
                            <div key={dayDate} className={`week-day ${isSelectedDay ? 'selected' : ''}`}>
                                <div className="week-day-header" onClick={() => { setDate(dayDate); setViewMode('day'); }}>
                                    <span className="week-day-name">{dayName}</span>
                                    <span className="week-day-num">{dayNum}</span>
                                    <span className="week-day-count">{dayTasks.filter(t => t.status === 'done').length}/{dayTasks.length}</span>
                                </div>
                                <div className="week-day-graph">
                                    {dayTasks.filter(t => t.scheduled_time).length > 0 ? renderLineGraph(dayTasks, 180, 50) : <div className="week-no-data">No tasks</div>}
                                </div>
                                <div className="week-day-tasks">
                                    {dayTasks.slice(0, 4).map(task => (
                                        <div key={task.id} className={`week-task ${task.status}`}>
                                            <div className="week-task-cat" style={{ backgroundColor: getCategoryColor(task.category) }}></div>
                                            <span className="week-task-time">{task.scheduled_time || '--'}</span>
                                            <span className="week-task-title">{task.title}</span>
                                        </div>
                                    ))}
                                    {dayTasks.length > 4 && <div className="week-more">+{dayTasks.length - 4} more</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
