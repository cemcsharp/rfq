'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getFaturalar, getSiparisler, createFatura, updateFatura, deleteFatura, finalizeAttachments } from '@/lib/actions'
import { ExportExcelButton } from '@/components/ExportButtons'
import { useNotification } from '@/context/NotificationContext'
import FileUpload from '@/components/FileUpload'
import AttachmentList from '@/components/AttachmentList'
import { Pagination } from '@/components/Pagination'

function FinansContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [faturalar, setFaturalar] = useState<any[]>([])
    const [siparisler, setSiparisler] = useState<any[]>([])
    const [showModal, setShowModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedFatura, setSelectedFatura] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const { showAlert, showConfirm } = useNotification()
    const [refreshFiles, setRefreshFiles] = useState(0)
    const [step, setStep] = useState(1)

    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [tempId] = useState(() => Math.floor(Math.random() * 1000000))
    const [activeView, setActiveView] = useState<'LIST' | 'CALENDAR'>('LIST')

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    // Haftalık Takvim Mantığı
    const getNextFriday = (date: Date) => {
        const d = new Date(date)
        const day = d.getDay()
        const diff = (day <= 5) ? (5 - day) : (12 - day)
        d.setDate(d.getDate() + diff)
        d.setHours(0, 0, 0, 0)
        return d
    }

    const groupFaturalarByWeek = (fats: any[]) => {
        const groups: { [key: string]: any[] } = {}
        fats.forEach(f => {
            const friday = getNextFriday(new Date(f.vadeTarihi))
            const key = friday.toISOString().split('T')[0]
            if (!groups[key]) groups[key] = []
            groups[key].push(f)
        })
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    }

    const filteredFaturalar = useMemo(() => {
        return faturalar.filter(f => {
            const matchesSearch =
                f.faturaNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (f.siparis?.tedarikci && f.siparis.tedarikci.ad.toLowerCase().includes(searchTerm.toLowerCase()))

            const matchesStatus = statusFilter === 'ALL' || f.odemeDurumu === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [faturalar, searchTerm, statusFilter])

    const paginatedFaturalar = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredFaturalar.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredFaturalar, currentPage])

    const totalPages = Math.ceil(filteredFaturalar.length / itemsPerPage)

    const weeklyGroups = useMemo(() => groupFaturalarByWeek(filteredFaturalar), [filteredFaturalar])

    const exportData = useMemo(() => {
        return faturalar.map(f => ({
            Vade: new Date(f.vadeTarihi).toLocaleDateString('tr-TR'),
            FaturaNo: f.faturaNo,
            SiparisRef: f.siparis.barkod,
            Tutar: f.tutar,
            Durum: f.odemeDurumu
        }))
    }, [faturalar])

    const [formData, setFormData] = useState({
        siparisId: '',
        faturaNo: '',
        tutar: '',
        vadeTarihi: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [fData, sData] = await Promise.all([getFaturalar(), getSiparisler()])
            setFaturalar(fData)
            setSiparisler(sData)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const sipId = searchParams.get('siparisId')
        if (sipId && siparisler.length > 0) {
            setFormData(prev => ({ ...prev, siparisId: sipId }))
            setShowModal(true)
        }
    }, [searchParams, siparisler])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const fatura = await createFatura({
                siparisId: parseInt(formData.siparisId),
                faturaNo: formData.faturaNo,
                tutar: parseFloat(formData.tutar),
                vadeTarihi: new Date(formData.vadeTarihi)
            })

            // Dosyaları kesinleştir
            await finalizeAttachments('FATURA_DRAFT', tempId, 'FATURA', fatura.id)

            setShowModal(false)
            setFormData({ siparisId: '', faturaNo: '', tutar: '', vadeTarihi: '' })
            fetchData()
            showAlert('Fatura başarıyla oluşturuldu', 'success')
        } catch (err) {
            showAlert('Hata: ' + (err as Error).message, 'error')
        }
    }

    const [editFormData, setEditFormData] = useState({
        faturaNo: '',
        tutar: '',
        vadeTarihi: '',
        odemeDurumu: ''
    })

    function handleEdit(fat: any) {
        setSelectedFatura(fat)
        setEditFormData({
            faturaNo: fat.faturaNo,
            tutar: fat.tutar.toString(),
            vadeTarihi: new Date(fat.vadeTarihi).toISOString().split('T')[0],
            odemeDurumu: fat.odemeDurumu
        })
        setShowEditModal(true)
    }

    async function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            await updateFatura(selectedFatura.id, {
                faturaNo: editFormData.faturaNo,
                tutar: parseFloat(editFormData.tutar),
                vadeTarihi: new Date(editFormData.vadeTarihi),
                odemeDurumu: editFormData.odemeDurumu
            })
            setShowEditModal(false)
            setSelectedFatura(null)
            fetchData()
            showAlert('Fatura başarıyla güncellendi', 'success')
        } catch (err) {
            showAlert('Hata: ' + (err as Error).message, 'error')
        }
    }

    async function handleDelete(id: number) {
        const confirmed = await showConfirm('Bu faturayı silmek istediğinize emin misiniz?')
        if (confirmed) {
            try {
                await deleteFatura(id)
                fetchData()
                showAlert('Fatura başarıyla silindi', 'success')
            } catch (err) {
                showAlert('Hata: ' + (err as Error).message, 'error')
            }
        }
    }

    const getVadeDurumu = (vadeTarihi: string, odemeDurumu: string) => {
        if (odemeDurumu === 'ODENDI') return { label: 'ÖDENDİ', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
        const vade = new Date(vadeTarihi)
        const bugun = new Date()
        bugun.setHours(0, 0, 0, 0)
        vade.setHours(0, 0, 0, 0)
        if (vade < bugun) return { label: 'GECİKMİŞ', class: 'bg-rose-50 text-rose-600 border-rose-100' }
        const fark = Math.ceil((vade.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24))
        if (fark <= 3) return { label: 'YAKLAŞAN', class: 'bg-amber-50 text-amber-600 border-amber-100' }
        return { label: 'BEKLEMEDE', class: 'bg-slate-50 text-slate-500 border-slate-100' }
    }

    const stats = useMemo(() => ({
        toplamBekleyen: faturalar.filter(f => f.odemeDurumu === 'ODENMEDI').reduce((sum, f) => sum + Number(f.tutar), 0),
        kritikOdemeler: faturalar.filter(f => {
            const durum = getVadeDurumu(f.vadeTarihi, f.odemeDurumu)
            return durum.label === 'GECİKMİŞ' || durum.label === 'YAKLAŞAN'
        }).length,
        buAyOdenen: faturalar.filter(f => {
            const d = new Date(f.vadeTarihi)
            const today = new Date()
            return f.odemeDurumu === 'ODENDI' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
        }).reduce((sum, f) => sum + Number(f.tutar), 0)
    }), [faturalar])

    return (
        <div className="flex flex-col gap-6 animate-in">
            {/* Header Area - Dashboard Style */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">Finansal Kayıtlar</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter italic">Tedarik zinciri ödemeleri ve fatura takibi</p>
                </div>
                <div className="flex gap-2">
                    <ExportExcelButton
                        data={exportData}
                        fileName="FinansalKayitlar"
                        sheetName="Faturalar"
                    />
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-slate-700 text-white px-4 py-1.5 rounded text-[10px] font-medium border border-slate-600 hover:bg-slate-800 uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                        Yeni Kayıt Oluştur
                    </button>
                </div>
            </div>

            {/* Stats Dashboard - Corporate Style */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="premium-card p-5 border-t-2 border-t-slate-800">
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mb-2">Toplam Bekleyen</p>
                    <div className="text-xl font-bold text-slate-800 tracking-tight">
                        ₺{stats.toplamBekleyen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="premium-card p-5 border-t-2 border-t-rose-500">
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mb-2">Kritik Riskler</p>
                    <div className="text-xl font-bold text-rose-600 tracking-tight">
                        {stats.kritikOdemeler} <span className="text-[10px] text-slate-400 font-medium ml-1">Kayıt</span>
                    </div>
                </div>

                <div className="premium-card p-5 border-t-2 border-t-emerald-500">
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mb-2">Bu Dönem Ödenen</p>
                    <div className="text-xl font-bold text-emerald-600 tracking-tight">
                        ₺{stats.buAyOdenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="premium-card p-5 border-t-2 border-t-indigo-500">
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mb-2">Veri Tutarlılığı</p>
                    <div className="flex items-center gap-3">
                        <div className="text-xl font-bold text-indigo-600 tracking-tight">%85</div>
                        <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full w-[85%]"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Selector & Filter Bar */}
            <div className="premium-card p-4 flex flex-wrap items-center gap-4 bg-slate-50/30">
                <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 mr-2">
                    <button
                        onClick={() => setActiveView('LIST')}
                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'LIST' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Liste
                    </button>
                    <button
                        onClick={() => setActiveView('CALENDAR')}
                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'CALENDAR' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Takvim
                    </button>
                </div>

                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="İşlem No veya Tedarikçi İsmi..."
                        className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded text-[11px] font-medium outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setCurrentPage(1)
                        }}
                    />
                </div>
                <div className="w-48">
                    <select
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[10px] font-bold text-slate-600 outline-none cursor-pointer uppercase tracking-widest"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="ALL">TÜM DURUMLAR</option>
                        <option value="ODENMEDI">BEKLEMEDE</option>
                        <option value="ODENDI">ÖDENDİ</option>
                        <option value="IPTAL">İPTAL EDİLDİ</option>
                    </select>
                </div>
                {(searchTerm || statusFilter !== 'ALL') && (
                    <button
                        onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
                        className="text-[10px] text-rose-500 font-bold uppercase tracking-widest hover:underline"
                    >
                        Temizle
                    </button>
                )}
            </div>

            {/* Main Data Content */}
            {activeView === 'LIST' ? (
                <div className="premium-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                    <th className="px-6 py-4">Vade Tarihi</th>
                                    <th className="px-6 py-4">Fatura Ref</th>
                                    <th className="px-6 py-4">Sipariş</th>
                                    <th className="px-6 py-4">Net Tutar</th>
                                    <th className="px-6 py-4">Durum</th>
                                    <th className="px-6 py-4 text-right">Aksiyonlar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] animate-pulse">Veriler Çekiliyor...</td></tr>
                                ) : paginatedFaturalar.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-[10px] uppercase font-medium">Kayıt bulunamadı.</td></tr>
                                ) : paginatedFaturalar.map((fatura: any) => {
                                    const durum = getVadeDurumu(fatura.vadeTarihi, fatura.odemeDurumu)
                                    return (
                                        <tr key={fatura.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-slate-700">{new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}</span>
                                                    <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter">İşlem: {new Date(fatura.createdAt).toLocaleDateString('tr-TR')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-indigo-600 uppercase">{fatura.faturaNo}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-medium text-slate-600 uppercase">{fatura.siparis?.barkod}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-slate-800">₺{Number(fatura.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold border tracking-tighter uppercase ${durum.class}`}>
                                                    {durum.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1.5 justify-end transition-all">
                                                    <Link href={`/finans/${fatura.id}`} className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-all" title="İncele">👁️</Link>
                                                    <button onClick={() => handleDelete(fatura.id)} className="p-1.5 rounded text-slate-400 hover:text-rose-500 transition-all" title="Sil">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {activeView === 'LIST' && (
                        <div className="p-4 border-t border-slate-50 scale-90 origin-right">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                totalItems={filteredFaturalar.length}
                                itemsPerPage={itemsPerPage}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-500">
                    {weeklyGroups.map(([date, items]) => {
                        const total = (items as any[]).reduce((sum: number, item: any) => sum + Number(item.tutar), 0)
                        const paid = (items as any[]).filter((i: any) => i.odemeDurumu === 'ODENDI').length
                        const percent = items.length > 0 ? (paid / items.length) * 100 : 0

                        return (
                            <div key={date} className="premium-card overflow-hidden group hover:border-slate-300 transition-all">
                                <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white border-2 border-slate-800 rounded-xl p-2 text-center min-w-[60px] shadow-sm">
                                            <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">CUMA</div>
                                            <div className="text-sm font-black text-slate-800 leading-none">{new Date(date).getDate()}</div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase leading-none mt-1">{new Date(date).toLocaleDateString('tr-TR', { month: 'short' })}</div>
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} ÖDEMELERİ</h4>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{items.length} Kayıtlı Fatura</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-slate-800">₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-24 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{paid}/{items.length} TAMAM</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-0 bg-white overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                    <th className="px-4 py-3">Talep No</th>
                                                    <th className="px-4 py-3">Sipariş No</th>
                                                    <th className="px-4 py-3">Fatura Ref</th>
                                                    <th className="px-4 py-3">Tedarikçi</th>
                                                    <th className="px-4 py-3">Ödeme Koşulu</th>
                                                    <th className="px-4 py-3 text-right">Tutar</th>
                                                    <th className="px-4 py-3">Durum</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(items as any[]).map((f: any) => {
                                                    const durum = getVadeDurumu(f.vadeTarihi, f.odemeDurumu)
                                                    const odemeKosulu = f.siparis?.odemePlani?.[0]?.aciklama ||
                                                        (f.siparis?.odemePlani?.[0]?.vadeGun ? `${f.siparis.odemePlani[0].vadeGun} GÜN VADE` : 'PEŞİN')

                                                    return (
                                                        <tr key={f.id} className="hover:bg-slate-50/30 transition-colors cursor-pointer group/item">
                                                            <td className="px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-tighter" onClick={() => router.push(`/finans/${f.id}`)}>{f.siparis?.talep?.barkod || '-'}</td>
                                                            <td className="px-4 py-3 text-[10px] font-black text-slate-800 uppercase tracking-tighter">{f.siparis?.barkod || '-'}</td>
                                                            <td className="px-4 py-3 text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{f.faturaNo}</td>
                                                            <td className="px-4 py-3 text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{f.siparis?.tedarikci?.ad || 'Bilinmeyen'}</td>
                                                            <td className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{odemeKosulu}</td>
                                                            <td className="px-4 py-3 text-[11px] font-black text-slate-800 text-right">₺{Number(f.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black border tracking-tighter uppercase ${durum.class}`}>
                                                                    {durum.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {weeklyGroups.length === 0 && (
                        <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                            <span className="text-4xl block mb-4">📅</span>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Takvim Verisi Bulunamadı</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Filtrelerinize uygun kayıt bulunmamaktadır.</p>
                        </div>
                    )}
                </div>
            )}

            {/* MODALS */}
            {/* STEPPER SLIDE-OVER (CREATE) */}
            <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${showModal ? 'visible' : 'invisible'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => {
                        setShowModal(false)
                        setStep(1)
                    }}
                />

                {/* Panel Container */}
                <div className="absolute inset-y-0 right-0 max-w-full flex">
                    <div
                        className={`w-screen max-w-md transform transition-transform duration-300 ease-in-out ${showModal ? 'translate-x-0' : 'translate-x-full'} bg-white shadow-2xl flex flex-col`}
                    >
                        {/* Panel Header */}
                        <div className="bg-slate-800 text-white px-6 py-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-sm font-bold uppercase tracking-widest">Finansal Kayıt Sihirbazı</h2>
                                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter mt-0.5 italic">Kontrollü Veri Girişi</p>
                                </div>
                                <button
                                    onClick={() => { setShowModal(false); setStep(1); }}
                                    className="text-white opacity-50 hover:opacity-100 transition-opacity"
                                >
                                    <span className="text-2xl leading-none">×</span>
                                </button>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center justify-between px-2">
                                <div className="absolute top-[15px] left-0 w-full h-0.5 bg-white/5 z-0"></div>
                                {[1, 2, 3].map((s) => (
                                    <div key={s} className="relative z-10 flex flex-col items-center gap-3">
                                        <div
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all border-2 ${step === s ? 'bg-indigo-500 border-indigo-400 text-white scale-125 shadow-2xl shadow-indigo-500/50' :
                                                step > s ? 'bg-emerald-500 border-emerald-400 text-white' :
                                                    'bg-slate-800 border-slate-700 text-slate-500'
                                                }`}
                                        >
                                            {step > s ? '✓' : s}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${step === s ? 'text-white' : 'text-slate-500'}`}>
                                            {s === 1 ? 'SİPARİŞ' : s === 2 ? 'FİNANSMAN' : 'DİJİTAL ARŞİV'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        </div>

                        {/* Panel Body (Stepper Content) */}
                        <div className="flex-1 h-0 overflow-y-auto custom-scrollbar px-10 py-8">
                            <form onSubmit={handleSubmit} id="finans-form" className="h-full">
                                {step === 1 && (
                                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                            <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">KAYNAK SİPARİŞ BELİRLEME</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                            Faturanın matrahını ve tedarikçi bilgilerini oluşturacak olan ana siparişi listeden seçiniz. Sadece faturası kesilmemiş aktif siparişler listelenir.
                                        </p>
                                        <div className="grid grid-cols-1 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                                            {siparisler.map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, siparisId: s.id.toString() })}
                                                    className={`p-6 rounded-[32px] border-2 text-left transition-all relative overflow-hidden group ${formData.siparisId === s.id.toString()
                                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xl shadow-indigo-100/50'
                                                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <span className={`text-sm font-black uppercase tracking-tight ${formData.siparisId === s.id.toString() ? 'text-indigo-600' : 'text-slate-800'}`}>
                                                            {s.barkod}
                                                        </span>
                                                        {formData.siparisId === s.id.toString() && (
                                                            <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">AKTİF SEÇİM</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-600 mt-2 uppercase truncate relative z-10">{s.talep.konu}</div>
                                                    <div className="flex items-center gap-2 mt-4 relative z-10">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">T</div>
                                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{s.tedarikci?.ad || 'TEDARİKÇİ BELİRTİLMEDİ'}</div>
                                                    </div>
                                                    {formData.siparisId === s.id.toString() && (
                                                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full translate-y-1/2 translate-x-1/2 blur-xl"></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-10 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                            <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">FİNANSAL MATRAH VE VADE VERİLERİ</h3>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2">
                                                <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                                FATURA REFERANS NUMARASI *
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="Örn: FAT-2024-8892"
                                                className="w-full bg-slate-900 border border-slate-700 p-6 rounded-3xl text-xl font-black text-emerald-400 outline-none focus:border-emerald-500 transition-all uppercase tracking-[0.2em] text-center shadow-2xl"
                                                value={formData.faturaNo}
                                                onChange={(e) => setFormData({ ...formData, faturaNo: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block text-center">NET ÖDEME TUTARI (TL)</label>
                                                <div className="relative">
                                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">₺</span>
                                                    <input
                                                        required
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        className="w-full bg-slate-50 border border-slate-200 p-5 pl-12 rounded-3xl text-lg font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-sm text-right"
                                                        value={formData.tutar}
                                                        onChange={(e) => setFormData({ ...formData, tutar: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block text-center">MİLAT / VADE TARİHİ</label>
                                                <input
                                                    required
                                                    type="date"
                                                    className="w-full bg-slate-50 border border-slate-200 p-5 rounded-3xl text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
                                                    value={formData.vadeTarihi}
                                                    onChange={(e) => setFormData({ ...formData, vadeTarihi: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] flex items-center gap-4">
                                            <div className="text-2xl">ℹ️</div>
                                            <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                                Vade tarihi, ödeme listelerinin (P-List) otomatik oluşturulmasında ana parametre olarak kullanılacaktır.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                            <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">DİJİTAL BELGE VE ONAY MEKANİZMASI</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block text-center">RESMİ FATURA DOKÜMANI (E-FATURA PDF)</label>
                                            <div className="bg-slate-50 p-8 rounded-[40px] border-2 border-dashed border-slate-200 hover:border-emerald-300 transition-all flex flex-col items-center">
                                                <div className="mb-6 w-full">
                                                    <AttachmentList relatedEntity="FATURA_DRAFT" entityId={tempId} refreshTrigger={refreshFiles} />
                                                </div>
                                                <FileUpload
                                                    relatedEntity="FATURA_DRAFT"
                                                    entityId={tempId}
                                                    onSuccess={() => setRefreshFiles(prev => prev + 1)}
                                                    label="E-FATURA DOSYASINI BURAYA BIRAKIN"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex gap-4">
                                            <div className="text-2xl">🔒</div>
                                            <div className="space-y-1">
                                                <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest tracking-tighter">GÜVENLİK VE ARŞİV NOTU</h4>
                                                <p className="text-[10px] text-amber-700 leading-relaxed font-bold">
                                                    Yüklenen belgeler banka ödeme talimatlarına eklenmek üzere merkezi arşivde süresiz olarak saklanacaktır. Lütfen belgenin tam ve okunur olduğundan emin olunuz.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Panel Footer (Navigation) */}
                        <div className="px-10 py-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            {step > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setStep(step - 1)}
                                    className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all flex items-center gap-2"
                                >
                                    <span>←</span> GERİ GİT
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setStep(1); }}
                                    className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all"
                                >
                                    VAZGEÇ VE KAPAT
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    disabled={step === 1 && !formData.siparisId}
                                    onClick={() => setStep(step + 1)}
                                    className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-[0.98] disabled:opacity-30 flex items-center gap-3"
                                >
                                    DEVAM ET <span>→</span>
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    form="finans-form"
                                    className="bg-emerald-600 text-white px-12 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-200 active:scale-[0.98] flex items-center gap-3"
                                >
                                    💾 KAYDI TAMAMLA VE ARŞİVLE
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {
                showEditModal && selectedFatura && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                            <div className="p-3 border-b border-slate-50 bg-slate-50 flex justify-between items-center rounded-t text-[10px] font-medium text-slate-700 uppercase">
                                Güncelleme Modu: Kayıt Düzenle
                                <button onClick={() => { setShowEditModal(false); setSelectedFatura(null); }} className="text-slate-300 hover:text-slate-500">×</button>
                            </div>
                            <form onSubmit={handleEditSubmit} className="p-4 flex flex-col gap-3">
                                <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Fatura Barkod No</label><input required type="text" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={editFormData.faturaNo} onChange={(e) => setEditFormData({ ...editFormData, faturaNo: e.target.value })} /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Net Tutar (TL)</label><input required type="number" step="0.01" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={editFormData.tutar} onChange={(e) => setEditFormData({ ...editFormData, tutar: e.target.value })} /></div>
                                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Vade Tarihi</label><input required type="date" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={editFormData.vadeTarihi} onChange={(e) => setEditFormData({ ...editFormData, vadeTarihi: e.target.value })} /></div>
                                </div>
                                <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">İşlem Durumu</label><select className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={editFormData.odemeDurumu} onChange={(e) => setEditFormData({ ...editFormData, odemeDurumu: e.target.value })}><option value="ODENMEDI">BEKLEMEDE</option><option value="ODENDI">ÖDENDİ</option></select></div>

                                {/* Dosyalar (Edit Modu) */}
                                <div className="border-t border-slate-100 pt-2 mt-1">
                                    <label className="text-[9px] font-medium text-slate-400 uppercase ml-1 mb-1 block">Fatura Belgesi</label>
                                    <AttachmentList relatedEntity="FATURA" entityId={selectedFatura.id} refreshTrigger={refreshFiles} />
                                    <div className="mt-2">
                                        <FileUpload
                                            relatedEntity="FATURA"
                                            entityId={selectedFatura.id}
                                            onSuccess={() => setRefreshFiles(prev => prev + 1)}
                                            label="Belge Ekle"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-1">
                                    <button type="button" onClick={() => { setShowEditModal(false); setSelectedFatura(null); }} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">Vazgeç</button>
                                    <button type="submit" className="bg-slate-700 text-white px-4 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase">Güncelle</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

export default function FinansPage() {
    return (
        <Suspense fallback={<div className="p-8 uppercase text-[10px] text-slate-400 font-medium tracking-widest">Finansal Verilere Erişiliyor...</div>}>
            <FinansContent />
        </Suspense>
    )
}
