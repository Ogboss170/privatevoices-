'use client'

import React from 'react'
import Link from 'next/link'
import { X, Sparkles, Heart, MessageCircle, ArrowRight } from 'lucide-react'

interface GuestAuthModalProps {
  isOpen: boolean
  onClose: () => void
  actionTitle?: string
  actionDescription?: string
}

export default function GuestAuthModal({
  isOpen,
  onClose,
  actionTitle = 'Join the conversation',
  actionDescription = 'Sign in or create an account to like, comment, and connect with minds on Private Voices.',
}: GuestAuthModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-slate-800 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Brand / Visual Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 mb-5">
          <Sparkles size={28} />
        </div>

        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {actionTitle}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {actionDescription}
        </p>

        {/* Feature Highlights */}
        <div className="my-6 grid grid-cols-2 gap-3 text-left">
          <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
            <Heart size={18} className="text-rose-500 mb-1" />
            <p className="text-xs font-bold text-gray-900 dark:text-white">Like & React</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Support your favorite voices</p>
          </div>
          <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
            <MessageCircle size={18} className="text-brand-500 mb-1" />
            <p className="text-xs font-bold text-gray-900 dark:text-white">Comment & Share</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Share your genuine perspective</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/register"
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-full shadow-md flex items-center justify-center gap-2 transition-all group"
          >
            <span>Create Account</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-semibold rounded-full flex items-center justify-center transition-all"
          >
            Log In
          </Link>
        </div>

        <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
          By signing up, you agree to our Terms of Service & Privacy Policy.
        </p>
      </div>
    </div>
  )
}
