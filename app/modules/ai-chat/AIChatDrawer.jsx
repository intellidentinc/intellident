'use client'

import { useState, useEffect, useRef } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import { X, Plus, Send, Bot, Trash2, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const QUICK_PROMPTS = [
  'What services do you offer?',
  'What are your operating hours?',
  'How do I book an appointment?',
  'How do I cancel an appointment?',
]

export default function AIChatDrawer({ open, onClose }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!open) return
    loadSessions()
  }, [open])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, sending])

  async function loadSessions() {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/ai/chat')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
      }
    } finally {
      setSessionsLoading(false)
    }
  }

  async function loadSession(sessionId) {
    setActiveSessionId(sessionId)
    const res = await fetch(`/api/ai/chat/${sessionId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
    }
  }

  function newChat() {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
  }

  async function sendMessage(text) {
    const userMessage = (text ?? input).trim()
    if (!userMessage || sending) return
    setInput('')
    setSending(true)

    const optimistic = [...messages, { role: 'USER', content: userMessage, _temp: true }]
    setMessages(optimistic)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId: activeSessionId }),
      })

      if (res.ok) {
        const data = await res.json()
        setActiveSessionId(data.sessionId)
        setMessages([
          ...optimistic.filter((m) => !m._temp),
          { role: 'USER', content: userMessage },
          { role: 'ASSISTANT', content: data.message.content },
        ])
        loadSessions()
      } else {
        const data = await res.json()
        setMessages([
          ...optimistic.filter((m) => !m._temp),
          { role: 'ASSISTANT', content: data.error ?? 'Something went wrong. Please try again.' },
        ])
      }
    } catch {
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }

  async function deleteSession(sessionId, e) {
    e.stopPropagation()
    await fetch(`/api/ai/chat/${sessionId}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (activeSessionId === sessionId) newChat()
  }

  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 640 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'row',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
          },
        },
      }}
    >
      {/* ── Session history panel ────────────────────────────────────────── */}
      <Box
        sx={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'column',
          bgcolor: '#f8fafc',
        }}
      >
        <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant='body2' fontWeight={700} color='text.primary'>
            Chat History
          </Typography>
        </Box>

        <Box sx={{ p: 1.5, pb: 0.5 }}>
          <Box
            onClick={newChat}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              '&:hover': { bgcolor: '#dbeafe' },
            }}
          >
            <Plus size={13} color='#2563eb' />
            <Typography variant='caption' fontWeight={700} color='#1d4ed8'>
              New Chat
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.5 }}>
          {sessionsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
              <CircularProgress size={14} sx={{ color: '#2563eb' }} />
            </Box>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <Typography variant='caption' color='text.disabled' sx={{ px: 1.5, py: 1, display: 'block' }}>
              No conversations yet
            </Typography>
          )}

          {sessions.map((s) => (
            <Box
              key={s.id}
              onClick={() => loadSession(s.id)}
              sx={{
                px: 1.5,
                py: 0.9,
                mb: 0.25,
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: activeSessionId === s.id ? '#dbeafe' : 'transparent',
                '&:hover': { bgcolor: activeSessionId === s.id ? '#dbeafe' : '#f1f5f9' },
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover .delete-btn': { opacity: 1 },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant='caption'
                  color={activeSessionId === s.id ? '#1d4ed8' : 'text.primary'}
                  fontWeight={activeSessionId === s.id ? 600 : 400}
                  sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}
                >
                  {s.title ?? 'Conversation'}
                </Typography>
                <Typography variant='caption' color='text.disabled' sx={{ fontSize: '0.65rem' }}>
                  {new Date(s.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </Typography>
              </Box>
              <Tooltip title='Delete'>
                <IconButton
                  className='delete-btn'
                  size='small'
                  onClick={(e) => deleteSession(s.id, e)}
                  sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, ml: 0.25, flexShrink: 0 }}
                >
                  <Trash2 size={12} color='#94a3b8' />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fff',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              bgcolor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={18} color='#2563eb' />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant='body2' fontWeight={700} color='text.primary'>
              IntelliDent AI
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1 }}>
              AI-powered dental assistant
            </Typography>
          </Box>
          {/* Mobile: new chat */}
          <Tooltip title='New chat'>
            <IconButton
              size='small'
              onClick={newChat}
              sx={{ display: { sm: 'none' }, mr: 0.5 }}
            >
              <Plus size={16} />
            </IconButton>
          </Tooltip>
          <IconButton size='small' onClick={onClose}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            bgcolor: '#fafbfc',
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !sending && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 2,
                py: 4,
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 3,
                  bgcolor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={26} color='#2563eb' />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant='body2' fontWeight={700} color='text.primary'>
                  How can I help you?
                </Typography>
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                  Ask me about appointments, services, or clinic information.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', maxWidth: 280 }}>
                {QUICK_PROMPTS.map((q) => (
                  <Box
                    key={q}
                    onClick={() => sendMessage(q)}
                    sx={{
                      px: 1.5,
                      py: 0.9,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: '#fff',
                      textAlign: 'center',
                      '&:hover': { bgcolor: '#f0f7ff', borderColor: '#93c5fd' },
                    }}
                  >
                    <Typography variant='caption' color='text.primary'>
                      {q}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <Box
              key={msg.id ?? i}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: 0.75,
              }}
            >
              {msg.role === 'ASSISTANT' && (
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 1.5,
                    bgcolor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <Bot size={14} color='#2563eb' />
                </Box>
              )}
              <Box
                sx={{
                  maxWidth: '78%',
                  px: 1.75,
                  py: 1,
                  borderRadius: msg.role === 'USER' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  bgcolor: msg.role === 'USER' ? '#2563eb' : '#fff',
                  boxShadow: msg.role === 'ASSISTANT' ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                  border: msg.role === 'ASSISTANT' ? '1px solid' : 'none',
                  borderColor: 'divider',
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
                  color: msg.role === 'USER' ? '#fff' : '#334155',
                  '& p': { m: 0, mb: 0.75, '&:last-child': { mb: 0 } },
                  '& strong': { fontWeight: 700 },
                  '& em': { fontStyle: 'italic' },
                  '& ul, & ol': { pl: 2.5, m: 0, mb: 0.75 },
                  '& li': { mb: 0.25 },
                  '& code': { bgcolor: msg.role === 'USER' ? 'rgba(255,255,255,0.2)' : '#f1f5f9', px: 0.5, py: 0.125, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.8rem' },
                  '& h1, & h2, & h3': { fontWeight: 700, mb: 0.5, mt: 1, '&:first-of-type': { mt: 0 } },
                  '& h1': { fontSize: '1rem' },
                  '& h2': { fontSize: '0.9375rem' },
                  '& h3': { fontSize: '0.875rem' },
                  '& hr': { my: 1, borderColor: 'divider' },
                }}
              >
                {msg.role === 'ASSISTANT' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }}>
                    {msg.content}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}

          {/* Typing indicator */}
          {sending && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: 1.5,
                  bgcolor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={14} color='#2563eb' />
              </Box>
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  borderRadius: '14px 14px 14px 3px',
                  bgcolor: '#fff',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                }}
              >
                <CircularProgress size={12} sx={{ color: '#2563eb' }} />
                <Typography variant='caption' color='text.secondary'>
                  Thinking...
                </Typography>
              </Box>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        <Divider />

        {/* Input bar */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#fff' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size='small'
            placeholder='Ask me anything... (Enter to send, Shift+Enter for newline)'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.875rem' } }}
          />
          <Box
            component='button'
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              border: 'none',
              bgcolor: !input.trim() || sending ? '#e2e8f0' : '#2563eb',
              color: !input.trim() || sending ? '#94a3b8' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
              '&:hover:not(:disabled)': { bgcolor: '#1d4ed8' },
            }}
          >
            <Send size={16} />
          </Box>
        </Box>
      </Box>
    </Drawer>
  )
}
