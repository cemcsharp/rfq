'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPersoneller, getBirimler, createTalep, finalizeAttachments } from '@/lib/actions'
import { useNotification } from '@/context/NotificationContext'
import FileUpload from '@/components/FileUpload'
import AttachmentList from '@/components/AttachmentList'
import { useSession } from 'next-auth/react'
import { BIRIMLER } from '@/lib/constants'

export default function YeniTalepPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const { showAlert } = useNotification()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [personeller, setPersoneller] = useState<any[]>([])
    const [birimler, setBirimler] = useState<any[]>([])
    const [refreshFiles, setRefreshFiles] = useState(0)
    const [tempId, setTempId] = useState(0)
    useEffect(() => {
        setTempId(Math.floor(Math.random() * 1000000))
    }, [])

    const [formData, setFormData] = useState({
        ilgiliKisiId: '',
        birimId: '',
        bildirimEmail: '',
        barkod: '',
        konu: '',
        gerekce: ''
    })
    const [formKalemler, setFormKalemler] = useState<any[]>([{ aciklama: '', miktar: 1, birim: 'ADET' }])

    useEffect(() => {
        const personelId = session?.user?.personelId
        if (personelId) {
            setFormData(prev => ({ ...prev, ilgiliKisiId: personelId.toString() }))
        }
    }, [session])

    useEffect(() => {
        async function fetchData() {
            try {
                const [pData, bData] = await Promise.all([
                    getPersoneller(),
                    getBirimler()
                ])
                setPersoneller(pData)
                setBirimler(bData)
            } catch (err) {
                console.error(err)
                showAlert('Veriler yüklenirken hata oluştu', 'error')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [showAlert])

    const addKalem = () => setFormKalemler([...formKalemler, { aciklama: '', miktar: 1, birim: 'ADET' }])
    const removeKalem = (index: number) => setFormKalemler(formKalemler.filter((_, i) => i !== index))
    const updateKalem = (index: number, field: string, value: any) => {
        const newKalemler = [...formKalemler]
        newKalemler[index] = { ...newKalemler[index], [field]: value }
        setFormKalemler(newKalemler)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (submitting) return
        if (!formData.ilgiliKisiId) {
            showAlert('Oturum bilgisi alınamadı. Lütfen sayfayı yenileyin.', 'error')
            return
        }
        setSubmitting(true)
        try {
            const talep = await createTalep({
                ...formData,
                ilgiliKisiId: parseInt(formData.ilgiliKisiId),
                birimId: formData.birimId ? parseInt(formData.birimId) : undefined,
                bildirimEmail: formData.bildirimEmail || undefined,
                kalemler: formKalemler
            })

            await finalizeAttachments('TALEP_DRAFT', tempId, 'TALEP', talep.id)
            showAlert('Talep başarıyla oluşturuldu', 'success')
            router.push('/talepler')
        } catch (err) {
            showAlert('Hata oluştu: ' + (err as Error).message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Sistem Hazırlanıyor...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 animate-in">
            {/* Page Header - Corporate Standard */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">Yeni Satınalma Talebi</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter">İhtiyaç Tanımlama ve Onay Süreci</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => router.back()}
                        className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded text-[10px] font-medium border border-slate-200 hover:bg-slate-100 uppercase tracking-widest transition-all"
                    >
                        Listeye Dön
                    </button>
                    <button
                        form="talep-form"
                        type="submit"
                        disabled={submitting}
                        className="bg-slate-700 text-white px-4 py-1.5 rounded text-[10px] font-medium border border-slate-600 hover:bg-slate-800 uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? 'İşleniyor...' : 'Kaydı Gönder'}
                    </button>
                </div>
            </div>

            <form id="talep-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* ÜST: ANA BİLGİLER VE DETAYLAR */}
                <div className="premium-card p-6 border-t-4 border-t-indigo-800 shadow-xl">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            <span className="text-lg">📋</span>
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest">Talep Üst Bilgileri</h3>
                            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase mt-0.5">Operasyonel referanslar, sorumlular ve teknik gereksinimler</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* 1. SÜTUN: KONU VE REFERANS */}
                        <div className="lg:col-span-2 flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Talep Başlığı</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Neye ihtiyacınız var? Kısa bir başlık girin..."
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-[12px] focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-sm"
                                    value={formData.konu}
                                    onChange={(e) => setFormData({ ...formData, konu: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">İlgili Birim</label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-[12px] focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-slate-700 cursor-pointer shadow-sm appearance-none"
                                        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, gray 50%), linear-gradient(135deg, gray 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                                        value={formData.birimId}
                                        onChange={(e) => {
                                            const bId = e.target.value;
                                            const birim = birimler.find(b => b.id.toString() === bId);
                                            setFormData({
                                                ...formData,
                                                birimId: bId,
                                                bildirimEmail: birim?.email || formData.bildirimEmail
                                            });
                                        }}
                                    >
                                        <option value="">Birim Seçin</option>
                                        {birimler.map(b => <option key={b.id} value={b.id}>{b.ad.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Barkod No / Proje Kodu</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="P-2024-XXX"
                                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-[12px] focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none font-bold placeholder:font-normal placeholder:text-slate-400 transition-all font-mono text-slate-700 shadow-sm"
                                        value={formData.barkod}
                                        onChange={(e) => setFormData({ ...formData, barkod: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. SÜTUN: GEREKÇE */}
                        <div className="lg:col-span-2 flex flex-col gap-1.5 h-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                                <span>Operasyonel Gerekçe</span>
                                <span className="text-slate-400 font-normal normal-case italic">* Neden bu alıma ihtiyacımız var?</span>
                            </label>
                            <textarea
                                required
                                placeholder="Talebin oluşma nedeniyle beraber varsa özel durumları, marka tercihlerinizi vs. bu kısımda detaylıca yazabilirsiniz..."
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-[12px] focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none font-medium text-slate-700 transition-all resize-none shadow-sm flex-1 min-h-[120px]"
                                value={formData.gerekce}
                                onChange={(e) => setFormData({ ...formData, gerekce: e.target.value })}
                            />
                        </div>
                    </div>
                    
                    {/* BİLGİLENDİRME ÇUBUĞU */}
                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex flex-col items-center justify-center">
                                <span className="text-xs opacity-50">👤</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Talep Sahibi</span>
                                <span className="text-[11px] font-bold text-slate-700 uppercase">{session?.user?.name || 'Yükleniyor...'}</span>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                            <span className="text-[14px]">📩</span>
                            <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-widest">
                                Bildirim: {formData.bildirimEmail || 'Birim e-postasına gönderilecek'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ORTA: KALEMLER */}
                <div className="premium-card overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                <span className="text-sm">📦</span>
                            </div>
                            <div>
                                <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-widest">Talep Kalemleri</h3>
                                <p className="text-[9px] text-slate-500 font-medium tracking-widest uppercase mt-0.5">İstenilen ürün veya hizmetlerin listesi</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addKalem}
                            className="text-[10px] bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 font-bold hover:bg-slate-200 hover:text-slate-900 uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                            <span className="text-[12px]">+</span> Kalem Ekle
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                                <tr>
                                    <th className="px-6 py-4 w-16 text-center">Satır</th>
                                    <th className="px-6 py-4">Malzeme / Hizmet Açıklaması</th>
                                    <th className="px-6 py-4 w-32 text-center">Miktar</th>
                                    <th className="px-6 py-4 w-32 text-center">Birim</th>
                                    <th className="px-6 py-4 w-16 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {formKalemler.map((kalem, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr className="group transition-colors">
                                            <td className="px-6 py-4 align-top text-center pt-6">
                                                <span className="inline-flex w-7 h-7 bg-slate-100 rounded-full items-center justify-center text-[10px] font-bold text-slate-500 shadow-inner">
                                                    {(idx + 1).toString().padStart(2, '0')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-3">
                                                    <input
                                                        type="text"
                                                        required
                                                        className="w-full bg-slate-50/50 border border-slate-200 px-3 py-2.5 rounded text-[12px] focus:ring-1 focus:ring-blue-200 focus:border-blue-400 focus:bg-white outline-none font-bold text-slate-700 transition-all placeholder:font-normal placeholder:text-slate-400"
                                                        placeholder="Örn: X Marka A4 Fotokopi Kağıdı 80gr"
                                                        value={kalem.aciklama}
                                                        onChange={(e) => updateKalem(idx, 'aciklama', e.target.value)}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[14px]">📝</span>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent border-b border-slate-200 px-1 py-1 text-[11px] focus:border-blue-400 outline-none font-medium text-slate-500 italic placeholder:text-slate-300 transition-colors"
                                                            placeholder="Opsiyonel teknik detaylar, ebat, renk, versiyon..."
                                                            value={kalem.detay || ''}
                                                            onChange={(e) => updateKalem(idx, 'detay', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top pt-6">
                                                <input
                                                    type="number"
                                                    required
                                                    min="1"
                                                    className="w-full bg-slate-50/50 border border-slate-200 px-3 py-2.5 rounded text-[12px] focus:ring-1 focus:ring-blue-200 focus:border-blue-400 focus:bg-white outline-none font-bold text-slate-800 text-center transition-all"
                                                    value={kalem.miktar}
                                                    onChange={(e) => updateKalem(idx, 'miktar', parseFloat(e.target.value) || 1)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 align-top pt-6">
                                                <select
                                                    required
                                                    className="w-full bg-slate-50/50 border border-slate-200 px-3 py-2.5 rounded text-[12px] focus:ring-1 focus:ring-blue-200 focus:border-blue-400 focus:bg-white outline-none font-bold text-slate-600 text-center tracking-widest cursor-pointer appearance-none transition-all"
                                                    style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, gray 50%), linear-gradient(135deg, gray 50%, transparent 50%)', backgroundPosition: 'calc(100% - 15px) calc(1em + 2px), calc(100% - 10px) calc(1em + 2px)', backgroundSize: '4px 4px, 4px 4px', backgroundRepeat: 'no-repeat' }}
                                                    value={kalem.birim}
                                                    onChange={(e) => updateKalem(idx, 'birim', e.target.value)}
                                                >
                                                    {BIRIMLER.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right pt-6">
                                                {formKalemler.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeKalem(idx)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent hover:border-rose-100 hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all ml-auto focus:outline-none focus:ring-2 focus:ring-rose-200"
                                                        title="Satırı Sil"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                            Toplam {formKalemler.length} Kalem Listelendi
                        </div>
                    </div>
                </div>

                {/* ALT: DÖKÜMAN VE EKLER */}
                <div className="premium-card p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mx-32 -my-32 opacity-50"></div>
                    
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm border border-slate-200">
                                <span className="text-lg">📎</span>
                            </div>
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest">Ekler & Teknik Belgeler</h3>
                                <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase mt-0.5">Sartname, Teklif, Fiyat Araştırması dökümanları ekleyin (İsteğe bağlı)</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="flex flex-col gap-3">
                            <FileUpload
                                relatedEntity="TALEP_DRAFT"
                                entityId={tempId}
                                onSuccess={() => setRefreshFiles(prev => prev + 1)}
                                label="BİLGİSAYARINIZDAN DOSYA SEÇİN VEYA SÜRÜKLEYİN"
                            />
                            <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest mt-2 border-t border-slate-100 pt-3">
                                Desteklenen Formatlar: PDF, Word, Excel, JPG, PNG
                            </p>
                        </div>
                        <div className="bg-white border border-slate-100 shadow-inner rounded-xl p-5 h-full min-h-[160px] flex flex-col">
                            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                Yüklenen Dosyalar
                            </h4>
                            <div className="flex-1 overflow-auto bg-slate-50/50 rounded-lg border border-slate-100 p-2">
                                <AttachmentList relatedEntity="TALEP_DRAFT" entityId={tempId} refreshTrigger={refreshFiles} />
                            </div>
                        </div>
                    </div>
                </div>

            </form>
        </div>
    )
}
