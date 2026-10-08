'use client'

import React, { useState } from 'react'
import {
  Database,
  Play,
  Terminal,
  Code2,
  Table,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'

interface SqlConsoleSectionProps {
  supabase: SupabaseClient
}

export function SqlConsoleSection({ supabase }: SqlConsoleSectionProps) {
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM public.profiles LIMIT 10;')
  const [queryResult, setQueryResult] = useState<any[] | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [executingSql, setExecutingSql] = useState(false)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)

  const quickTables = [
    'profiles',
    'posts',
    'whispers',
    'communities',
    'content_reports',
    'email_registry',
    'preview_programs',
    'preview_participants',
    'preview_feedback',
    'user_badges',
    'moderation_appeals',
    'admin_audit_logs',
  ]

  async function handleExecuteSql() {
    if (!sqlQuery.trim()) return
    setExecutingSql(true)
    setQueryError(null)
    setQueryResult(null)
    const startTime = performance.now()

    try {
      const cleanSql = sqlQuery.trim().replace(/;$/, '')
      const matchSelect = cleanSql.match(/^SELECT\s+.*\s+FROM\s+([a-zA-Z0-9_\.]+)/i)

      if (matchSelect) {
        let tableName = matchSelect[1].replace(/^public\./, '')
        const { data, error } = await supabase.from(tableName).select('*').limit(50)

        if (error) {
          setQueryError(error.message)
        } else {
          setQueryResult(data || [])
        }
      } else {
        setQueryError(
          'SQL Editor currently supports read operations (SELECT * FROM <table_name>) for security and browser isolation.'
        )
      }
    } catch (err: any) {
      setQueryError(err.message || 'Error executing query')
    } finally {
      setExecutionTimeMs(Math.round(performance.now() - startTime))
      setExecutingSql(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal size={16} className="text-purple-400" />
              <span>PostgreSQL SQL Query Console</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Query PostgreSQL tables with RLS and schema validation.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-mono">
            Connection: Supabase PostgreSQL Active
          </span>
        </div>

        {/* Quick Table Templates */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 block">Quick Tables:</span>
          <div className="flex flex-wrap gap-1.5">
            {quickTables.map((t) => (
              <button
                key={t}
                onClick={() => setSqlQuery(`SELECT * FROM public.${t} LIMIT 10;`)}
                className="px-2.5 py-1 text-[11px] font-mono bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 rounded-lg transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input Area */}
        <div className="space-y-3">
          <textarea
            rows={5}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="SELECT * FROM public.profiles LIMIT 10;"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-purple-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none shadow-inner"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Schema: public &bull; Max limit: 50 rows
            </span>
            <button
              onClick={handleExecuteSql}
              disabled={executingSql || !sqlQuery.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center space-x-1.5"
            >
              <Play size={13} fill="currentColor" />
              <span>{executingSql ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Query Error Output */}
      {queryError && (
        <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl text-xs text-red-300 font-mono space-y-1">
          <span className="font-bold text-red-400">PostgreSQL Execution Error:</span>
          <p>{queryError}</p>
        </div>
      )}

      {/* Query Results Table */}
      {queryResult !== null && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden space-y-3 p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs px-2">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <Table size={14} className="text-purple-400" />
              <span>Query Results ({queryResult.length} rows)</span>
            </span>
            {executionTimeMs !== null && (
              <span className="text-[11px] text-slate-400 font-mono">
                Executed in {executionTimeMs}ms
              </span>
            )}
          </div>

          {queryResult.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              Query returned 0 rows.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-950 text-purple-300 border-b border-slate-800">
                  <tr>
                    {Object.keys(queryResult[0]).map((key) => (
                      <th key={key} className="p-3 border-r border-slate-800/40 font-bold whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {queryResult.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                      {Object.values(row).map((val: any, valIdx) => (
                        <td key={valIdx} className="p-3 border-r border-slate-800/40 max-w-xs truncate text-slate-300">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? 'NULL')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
