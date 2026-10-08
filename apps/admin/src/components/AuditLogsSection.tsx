'use client'

import React from 'react'
import {
  Lock,
  ShieldAlert,
  Search,
  Filter,
  FileSpreadsheet
} from 'lucide-react'

interface AuditLogsProps {
  logs: any[]
}

export function AuditLogsSection({ logs }: AuditLogsProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock size={16} className="text-purple-400" />
            <span>Immutable Administrative Audit Ledger</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Append-only PostgreSQL log tracking security events, role changes, badge awards, suspensions, and appeals.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/40 rounded-xl font-mono">
          Tamper-Proof Triggers Active
        </span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">Action</th>
              <th className="p-4">Target Type</th>
              <th className="p-4">Target ID</th>
              <th className="p-4">Reason / Notes</th>
              <th className="p-4">Admin ID</th>
              <th className="p-4 text-right">Timestamp (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                  No audit log entries recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/40">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">{log.target_type}</td>
                  <td className="p-4 text-slate-400 truncate max-w-[140px]">{log.target_id || 'N/A'}</td>
                  <td className="p-4 text-slate-300 font-sans text-xs">{log.reason || 'Automated / Direct action'}</td>
                  <td className="p-4 text-slate-500 truncate max-w-[120px]">{log.admin_id || 'System'}</td>
                  <td className="p-4 text-right text-slate-400 text-[11px]">
                    {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
