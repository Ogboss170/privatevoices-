'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, Plus, Trash2, Calendar, Check, X, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface ThoughtPromptItem {
  id: string
  tag: string
  prompt: string
  icon: string
  active_date: string
  is_active: boolean
  created_at: string
}

export default function AdminThoughtPromptsManager(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [prompts, setPrompts] = useState<ThoughtPromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [newTag, setNewTag] = useState('Daily Reflection')
  const [newPrompt, setNewPrompt] = useState('')
  const [newIcon, setNewIcon] = useState('💭')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadPrompts()
  }, [])

  async function loadPrompts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_thought_prompts')
        .select('*')
        .order('active_date', { ascending: false })

      if (data && !error) {
        setPrompts(data)
      }
    } catch (err) {
      console.error('Failed to load prompts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPrompt(e: React.FormEvent) {
    e.preventDefault()
    if (!newPrompt.trim()) return

    setSaving(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('daily_thought_prompts')
        .insert({
          tag: newTag.trim() || 'Daily Reflection',
          prompt: newPrompt.trim(),
          icon: newIcon || '💭',
          active_date: newDate,
          is_active: true,
          created_by: userRes.user?.id || null,
        })
        .select('*')
        .single()

      if (error) {
        setStatusMessage(`Error: ${error.message}`)
      } else if (data) {
        setPrompts((prev) => [data, ...prev])
        setNewPrompt('')
        setShowAddForm(false)
        setStatusMessage('New daily thought prompt published successfully!')
        setTimeout(() => setStatusMessage(null), 3000)
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePrompt(id: string) {
    if (!confirm('Are you sure you want to delete this prompt?')) return
    try {
      const { error } = await supabase.from('daily_thought_prompts').delete().eq('id', id)
      if (!error) {
        setPrompts((prev) => prev.filter((p) => p.id !== id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Daily Thought Prompts</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage the daily reflection prompts that appear at the top of the feed.</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          <span>{showAddForm ? 'Cancel' : 'New Prompt'}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-semibold">
          {statusMessage}
        </div>
      )}

      {/* Add New Prompt Form */}
      {showAddForm && (
        <form onSubmit={handleAddPrompt} className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Tag / Category</label>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="input-field text-xs py-1.5"
                placeholder="e.g. Daily Reflection"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Icon Emoji</label>
              <input
                type="text"
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                className="input-field text-xs py-1.5"
                placeholder="e.g. 💭, 🌱, 🎭"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Active Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="input-field text-xs py-1.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Prompt Question</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={2}
              className="input-field text-xs py-2 w-full"
              placeholder="e.g. What is an opinion or perspective you hold that you rarely share out loud?"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving || !newPrompt.trim()}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span>{saving ? 'Publishing…' : 'Schedule Prompt'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Prompts List */}
      <div className="space-y-2.5">
        {loading ? (
          <p className="text-xs text-gray-400 py-3 text-center">Loading prompt library…</p>
        ) : prompts.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">No prompts found in database. Fallback rotation is active.</p>
        ) : (
          prompts.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    {item.tag}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                    <Calendar size={11} />
                    <span>{item.active_date}</span>
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">"{item.prompt}"</p>
              </div>

              <button
                onClick={() => handleDeletePrompt(item.id)}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Delete prompt"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
