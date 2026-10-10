'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  X,
  Pin,
  Image as ImageIcon,
  Film,
  Mic,
  Link as LinkIcon,
  FileText,
  ExternalLink,
  Volume2,
  Calendar,
  Sparkles
} from 'lucide-react'
import VoiceWaveformPlayer from '@/components/common/VoiceWaveformPlayer'

export type GalleryTab = 'all' | 'pinned' | 'media' | 'audio' | 'links'

interface ChatMediaGalleryDrawerProps {
  isOpen: boolean
  onClose: () => void
  messages: any[]
  partnerName: string
  isGroup?: boolean
  currentUserId: string
  onTogglePinMessage: (messageId: string, isPinned: boolean) => void
  onSelectImagePreview: (url: string) => void
}

export function ChatMediaGalleryDrawer({
  isOpen,
  onClose,
  messages,
  partnerName,
  isGroup = false,
  currentUserId,
  onTogglePinMessage,
  onSelectImagePreview,
}: ChatMediaGalleryDrawerProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<GalleryTab>('all')

  if (!isOpen) return null

  // Extract media items
  const pinnedMessages = messages.filter((m) => m.is_pinned)
  const imageMessages = messages.filter((m) => !!m.image_url)
  const videoMessages = messages.filter((m) => !!m.video_url)
  const audioMessages = messages.filter((m) => !!m.audio_url)

  // URL extraction regex
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const linkMessages = messages.filter((m) => m.content && urlRegex.test(m.content))

  // Filter based on active tab
  let displayedItems: any[] = []
  if (activeTab === 'all') {
    displayedItems = messages.filter(
      (m) => m.is_pinned || m.image_url || m.video_url || m.audio_url || (m.content && urlRegex.test(m.content))
    )
  } else if (activeTab === 'pinned') {
    displayedItems = pinnedMessages
  } else if (activeTab === 'media') {
    displayedItems = [...imageMessages, ...videoMessages]
  } else if (activeTab === 'audio') {
    displayedItems = audioMessages
  } else if (activeTab === 'links') {
    displayedItems = linkMessages
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <Sparkles size={16} className="text-purple-600" />
              <span>Media & Pinned Assets</span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Shared in {isGroup ? 'Group Chat' : `@${partnerName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-gray-100 px-3 bg-gray-50/50 gap-1 overflow-x-auto py-2">
          {[
            { id: 'all', label: 'All Assets', count: displayedItems.length },
            { id: 'pinned', label: 'Pinned', count: pinnedMessages.length, icon: Pin },
            { id: 'media', label: 'Media', count: imageMessages.length + videoMessages.length, icon: ImageIcon },
            { id: 'audio', label: 'Voice Notes', count: audioMessages.length, icon: Mic },
            { id: 'links', label: 'Links', count: linkMessages.length, icon: LinkIcon },
          ].map((tab: any) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as GalleryTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {Icon && <Icon size={12} />}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400 space-y-2">
              <div className="text-3xl">🗂️</div>
              <p className="text-xs font-semibold text-gray-600">No {activeTab} assets found</p>
              <p className="text-[11px] text-gray-400 max-w-xs">
                Photos, voice notes, links, and pinned messages will be cataloged here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedItems.map((item) => {
                const isItemPinned = !!item.is_pinned
                const isImage = !!item.image_url
                const isVideo = !!item.video_url
                const isAudio = !!item.audio_url
                const extractedUrls = item.content?.match(urlRegex) || []

                return (
                  <div
                    key={item.id}
                    className={`card p-3 transition-all relative group border ${
                      isItemPinned ? 'border-purple-200 bg-purple-50/20 shadow-xs' : 'border-gray-100'
                    }`}
                  >
                    {/* Item Meta & Pin Toggle */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Calendar size={11} />
                        <span>
                          {new Date(item.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.sender?.display_name && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-gray-700">
                              {item.sender.display_name}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => onTogglePinMessage(item.id, !isItemPinned)}
                        className={`p-1 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold ${
                          isItemPinned
                            ? 'text-purple-600 bg-purple-100'
                            : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title={isItemPinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin size={12} className={isItemPinned ? 'fill-purple-600' : ''} />
                        <span>{isItemPinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                    </div>

                    {/* Image Render */}
                    {isImage && (
                      <div
                        onClick={() => onSelectImagePreview(item.image_url)}
                        className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100 cursor-pointer group/img"
                      >
                        <Image
                          src={item.image_url}
                          alt="Shared photo"
                          fill
                          className="object-cover group-hover/img:scale-105 transition-transform duration-200"
                        />
                      </div>
                    )}

                    {/* Video Render */}
                    {isVideo && (
                      <div className="rounded-xl overflow-hidden bg-black max-h-48">
                        <video src={item.video_url} controls className="w-full max-h-48" />
                      </div>
                    )}

                    {/* Audio Render */}
                    {isAudio && (
                      <div className="pt-1">
                        <VoiceWaveformPlayer audioUrl={item.audio_url} compact={true} theme="brand" />
                      </div>
                    )}

                    {/* Extracted Links Render */}
                    {extractedUrls.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {extractedUrls.map((url: string, idx: number) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-purple-50 border border-gray-100 hover:border-purple-200 transition-colors group/link"
                          >
                            <LinkIcon size={13} className="text-purple-600 flex-shrink-0" />
                            <span className="text-xs text-purple-700 underline truncate flex-1">
                              {url}
                            </span>
                            <ExternalLink size={12} className="text-gray-400 group-hover/link:text-purple-600" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Text Snippet if present alongside media or pinned */}
                    {item.content && !isAudio && item.content !== '📷 Photo' && item.content !== '🎥 Video' && (
                      <p className="text-xs text-gray-700 pt-1 leading-relaxed line-clamp-3">
                        {item.content}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
