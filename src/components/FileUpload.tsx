'use client'

import { useState, useRef } from 'react'
import { useNotification } from '@/context/NotificationContext'

interface FileUploadProps {
    relatedEntity: string
    entityId: number
    onSuccess?: () => void
    label?: string
}

export default function FileUpload({ relatedEntity, entityId, onSuccess, label = "Dosya Yükle" }: FileUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { showAlert } = useNotification()

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        setUploading(true)
        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData()
                formData.append('file', files[i])
                formData.append('relatedEntity', relatedEntity)
                formData.append('entityId', entityId.toString())

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })

                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.error || 'Yükleme başarısız')
                }
            }

            showAlert(`${files.length} dosya başarıyla yüklendi`, 'success')
            if (onSuccess) onSuccess()
        } catch (err) {
            showAlert('Hata: ' + (err as Error).message, 'error')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files)
        }
    }

    return (
        <div
            className={`group relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center cursor-pointer ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 shadow-sm hover:shadow-md'
                }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
            />

            <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                    {uploading ? (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    )}
                </div>
                <div>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if(!uploading) fileInputRef.current?.click(); }}
                        disabled={uploading}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest disabled:opacity-50 border-b border-transparent hover:border-indigo-700 pb-0.5"
                    >
                        {uploading ? 'Yükleniyor...' : label}
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">veya dosyayı buraya sürükleyin</p>
                </div>
            </div>
        </div>
    )
}
