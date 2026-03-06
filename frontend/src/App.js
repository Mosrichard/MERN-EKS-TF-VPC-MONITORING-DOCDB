import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState('');
  const [view, setView] = useState('chat');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  
  const [todos, setTodos] = useState([]);
  const [task, setTask] = useState('');
  
  const [quotes, setQuotes] = useState([]);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (token) {
      fetch('/api/me', { headers: { Authorization: token } })
        .then(r => r.json())
        .then(data => {
          if (data.username) {
            setUser(data.username);
            loadUsers();
            loadTodos();
            loadQuotes();
          } else {
            logout();
          }
        })
        .catch(() => logout());
    }
  }, [token]);

  useEffect(() => {
    if (selectedUser && view === 'chat') {
      loadMessages();
      const interval = setInterval(loadMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, view]);

  const register = async () => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Registered! Now login');
    } else {
      alert(data.error || 'Registration failed');
    }
  };

  const login = async () => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.username);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser('');
    setUsers([]);
    setSelectedUser(null);
    setMessages([]);
    setTodos([]);
    setQuotes([]);
  };

  const loadUsers = async () => {
    const res = await fetch('/api/users', { headers: { Authorization: token } });
    const data = await res.json();
    setUsers(data);
  };

  const loadMessages = async () => {
    if (!selectedUser) return;
    const res = await fetch(`/api/messages/${selectedUser}`, { headers: { Authorization: token } });
    const data = await res.json();
    setMessages(data);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ to: selectedUser, message })
    });
    setMessage('');
    loadMessages();
  };

  const loadTodos = async () => {
    const res = await fetch('/api/todos', { headers: { Authorization: token } });
    const data = await res.json();
    setTodos(data);
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;
    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ task })
    });
    setTask('');
    loadTodos();
  };

  const toggleTodo = async (id) => {
    await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { Authorization: token }
    });
    loadTodos();
  };

  const deleteTodo = async (id) => {
    await fetch(`/api/todos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: token }
    });
    loadTodos();
  };

  const loadQuotes = async () => {
    const res = await fetch('/api/quotes');
    const data = await res.json();
    setQuotes(data);
  };

  const addQuote = async (e) => {
    e.preventDefault();
    if (!quote.trim()) return;
    await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ quote })
    });
    setQuote('');
    loadQuotes();
  };

  const deleteQuote = async (id) => {
    await fetch(`/api/quotes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: token }
    });
    loadQuotes();
  };

  if (!user) {
    return (
      <motion.div className="auth-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className="auth-card" initial={{ y: 20 }} animate={{ y: 0 }}>
          <h1>My App</h1>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="input" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="input" onKeyPress={e => e.key === 'Enter' && login()} />
          <div className="btn-group">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={login} className="btn btn-primary">Login</motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={register} className="btn btn-secondary">Register</motion.button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <h1>My App</h1>
        <div className="nav-tabs">
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => setView('chat')} className={`tab ${view === 'chat' ? 'active' : ''}`}>💬 Chat</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => setView('todos')} className={`tab ${view === 'todos' ? 'active' : ''}`}>✓ Todos</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => setView('quotes')} className={`tab ${view === 'quotes' ? 'active' : ''}`}>📝 Quotes</motion.button>
        </div>
        <div className="header-actions">
          <span className="username">{user}</span>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-icon">{theme === 'dark' ? '☀️' : '🌙'}</motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={logout} className="btn-icon">🚪</motion.button>
        </div>
      </div>

      {view === 'chat' && (
        <div className="chat-container">
          <div className="sidebar">
            <h3>Users</h3>
            {users.map(u => (
              <motion.div key={u._id} whileHover={{ scale: 1.02 }} onClick={() => setSelectedUser(u.username)} className={`user-item ${selectedUser === u.username ? 'active' : ''}`}>
                <div className="avatar">{u.username[0].toUpperCase()}</div>
                <span>{u.username}</span>
              </motion.div>
            ))}
          </div>
          <div className="chat-area">
            {selectedUser ? (
              <>
                <div className="chat-header"><h2>{selectedUser}</h2></div>
                <div className="messages">
                  <AnimatePresence>
                    {messages.map((m, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`message ${m.from === user ? 'sent' : 'received'}`}>
                        <div className="message-content">{m.message}</div>
                        <div className="message-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <form onSubmit={sendMessage} className="message-input">
                  <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." className="input" />
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" className="btn btn-primary">Send</motion.button>
                </form>
              </>
            ) : (
              <div className="empty-chat"><h2>Select a user to start chatting</h2></div>
            )}
          </div>
        </div>
      )}

      {view === 'todos' && (
        <div className="content-area">
          <form onSubmit={addTodo} className="add-form">
            <input value={task} onChange={e => setTask(e.target.value)} placeholder="What needs to be done?" className="input" />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" className="btn btn-primary">Add</motion.button>
          </form>
          <AnimatePresence>
            {todos.map(t => (
              <motion.div key={t._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={`todo-item ${t.done ? 'done' : ''}`}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t._id)} className="checkbox" />
                <span className="task">{t.task}</span>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteTodo(t._id)} className="btn-delete">✕</motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
          {todos.length === 0 && <div className="empty-state">No todos yet. Add one above!</div>}
        </div>
      )}

      {view === 'quotes' && (
        <div className="content-area">
          <form onSubmit={addQuote} className="add-form">
            <input value={quote} onChange={e => setQuote(e.target.value)} placeholder="Share your quote..." className="input" />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" className="btn btn-primary">Post</motion.button>
          </form>
          <AnimatePresence>
            {quotes.map(q => (
              <motion.div key={q._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="quote-card">
                <p className="quote-text">"{q.quote}"</p>
                <div className="quote-footer">
                  <span className="quote-author">- {q.username}</span>
                  {q.username === user && (
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteQuote(q._id)} className="btn-delete">✕</motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {quotes.length === 0 && <div className="empty-state">No quotes yet. Be the first to post!</div>}
        </div>
      )}
    </div>
  );
}

export default App;
