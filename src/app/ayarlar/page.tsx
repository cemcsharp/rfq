'use client'

import { useState, useEffect } from 'react'
import {
    getPersoneller, getBirimler, getYonetmelikMaddeleri, getAlimYontemleri,
    createPersonel, createBirim, createYonetmelik, createAlimYontemi,
    updatePersonel, updateBirim, updateYonetmelik, updateAlimYontemi,
    deletePersonel, deleteBirim, deleteYonetmelik, deleteAlimYontemi,
    getDegerlendirmeFormTipleri, createDegerlendirmeFormTipi, updateDegerlendirmeFormTipi, deleteDegerlendirmeFormTipi,
    createDegerlendirmeGrubu, updateDegerlendirmeGrubu, deleteDegerlendirmeGrubu,
    createDegerlendirmeSorusu, updateDegerlendirmeSorusu, deleteDegerlendirmeSorusu,
    getTedarikciKategorileri, createTedarikciKategori, updateTedarikciKategori, deleteTedarikciKategori,
    getSystemSettings, updateSystemSettings, upsertUserAccount, removeUserAccount
} from '@/lib/actions'
import { useNotification } from '@/context/NotificationContext'
import TedarikciBasvurulari from '@/components/TedarikciBasvurulari'

type TabType = 'yonetmelik' | 'yontem' | 'degerlendirme' | 'tedarikcibasvuru' | 'smtp'

export default function AyarlarPage() {
    const [activeTab, setActiveTab] = useState<TabType>('yonetmelik')
    const [data, setData] = useState({
        yonetmelikler: [] as any[],
        yontemler: [] as any[],
        formTipleri: [] as any[],
        settings: [] as any[]
    })
    const [loading, setLoading] = useState(true)
    const { showAlert, showConfirm } = useNotification()

    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState<any>({})
    const [settingsSearchTerm, setSettingsSearchTerm] = useState('')

    const getFilteredData = () => {
        const list = data[activeTab === 'yonetmelik' ? 'yonetmelikler' : 'yontemler'] as any[]

        if (!list) return []
        if (!settingsSearchTerm) return list

        return list.filter(item => {
            const searchStr = settingsSearchTerm.toLowerCase()
            
            if (activeTab === 'yonetmelik') return item.madde.toLowerCase().includes(searchStr) || item.aciklama.toLowerCase().includes(searchStr)
            if (activeTab === 'yontem') return item.ad.toLowerCase().includes(searchStr)
            return true
        })
    }

    const filteredList = getFilteredData()

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const [y, yo, ft, s] = await Promise.all([
                getYonetmelikMaddeleri(), getAlimYontemleri(), getDegerlendirmeFormTipleri(), getSystemSettings()
            ])
            setData({ yonetmelikler: y, yontemler: yo, formTipleri: ft, settings: s })
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const openModal = (mode: 'create' | 'edit', type: TabType, item?: any) => {
        setModalMode(mode)
        if (mode === 'edit' && item) {
            setEditingId(item.id)
            if (type === 'yonetmelik') setFormData({ madde: item.madde, aciklama: item.aciklama })
            if (type === 'yontem') setFormData({ ad: item.ad })
        } else {
            setEditingId(null)
            if (type === 'yonetmelik') setFormData({ madde: '', aciklama: '' })
            if (type === 'yontem') setFormData({ ad: '' })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (modalMode === 'create') {
                if (activeTab === 'yonetmelik') await createYonetmelik(formData.madde, formData.aciklama)
                if (activeTab === 'yontem') await createAlimYontemi(formData.ad)
            } else if (modalMode === 'edit' && editingId) {
                if (activeTab === 'yonetmelik') await updateYonetmelik(editingId, formData.madde, formData.aciklama)
                if (activeTab === 'yontem') await updateAlimYontemi(editingId, formData.ad)
            }
            setShowModal(false)
            fetchData()
            showAlert('Değişiklik kaydedildi.', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const handleDelete = async (id: number) => {
        if (!await showConfirm('Bu kaydı tamamen silmek istediğinize emin misiniz?')) return
        try {
            if (activeTab === 'yonetmelik') await deleteYonetmelik(id)
            if (activeTab === 'yontem') await deleteAlimYontemi(id)
            fetchData()
            showAlert('Kayıt başarıyla silindi.', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const tabs = [
        { id: 'yonetmelik', label: 'Mevzuat', icon: '⚖️' },
        { id: 'yontem', label: 'Yöntemler', icon: '🔄' },
        { id: 'tedarikcibasvuru', label: 'Başvurular', icon: '📋' },
        { id: 'degerlendirme', label: 'Metrikler', icon: '📊' },
        { id: 'smtp', label: 'E-Posta', icon: '📧' }
    ]

    return (
        <div className="flex flex-col gap-6 animate-in">
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">Sistem Konfigürasyonu</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter">Parametrik Veri ve Kriter Yönetimi</p>
                </div>
                {activeTab !== 'smtp' && activeTab !== 'degerlendirme' && activeTab !== 'tedarikcibasvuru' && (
                    <div className="flex items-center gap-4">
                        <div className="relative w-64">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Listede ara..."
                                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-[12px] outline-none focus:border-slate-400 transition-all"
                                value={settingsSearchTerm}
                                onChange={(e) => setSettingsSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => openModal('create', activeTab)}
                            className="bg-slate-800 text-white px-4 py-2 rounded text-[11px] font-bold hover:bg-slate-900 transition-all shadow-md uppercase tracking-widest"
                        >
                            Yeni Kayıt Oluştur
                        </button>
                    </div>
                )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`px-4 py-2 rounded text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${activeTab === tab.id
                            ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <span className="text-[12px] opacity-70">{tab.icon}</span>
                        <span className="uppercase tracking-widest">{tab.label}</span>
                    </button>
                ))}
            </div>

            {activeTab === 'degerlendirme' ? (
                <DegerlendirmeYonetimi data={data.formTipleri} onRefresh={fetchData} />
            ) : activeTab === 'smtp' ? (
                <SmtpAyarlari settings={data.settings} onRefresh={fetchData} />
            ) : activeTab === 'tedarikcibasvuru' ? (
                <TedarikciBasvurulari onRefresh={fetchData} />
            ) : (
                <div className="premium-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-medium tracking-widest">
                            <tr>
                                {activeTab === 'yontem' && (
                                    <th className="px-5 py-3 text-slate-500">Tanımlama</th>
                                )}
                                {activeTab === 'yonetmelik' && (
                                    <>
                                        <th className="px-5 py-3 text-slate-500">Madde Ref</th>
                                        <th className="px-5 py-3 text-slate-500">Kapsam / Açıklama</th>
                                    </>
                                )}
                                <th className="px-5 py-3 text-right text-slate-500">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-5 py-10 text-center uppercase tracking-widest text-[10px] text-slate-400 font-medium">Veriler İşleniyor...</td></tr>
                            ) : (
                                <>
                                    {activeTab === 'yonetmelik' && filteredList.map((y: any) => (
                                        <tr key={y.id} className="hover:bg-slate-50/50 transition-colors group text-[12px] font-medium text-slate-600">
                                            <td className="px-5 py-3 text-slate-800 uppercase tracking-tighter">{y.madde}</td>
                                            <td className="px-5 py-3 text-slate-400 leading-relaxed">{y.aciklama}</td>
                                            <ActionButtons onEdit={() => openModal('edit', 'yonetmelik', y)} onDelete={() => handleDelete(y.id)} />
                                        </tr>
                                    ))}
                                    {activeTab === 'yontem' && filteredList.map((yo: any) => (
                                        <tr key={yo.id} className="hover:bg-slate-50/50 transition-colors group text-[12px] font-medium text-slate-600">
                                            <td className="px-5 py-3 text-slate-800 uppercase tracking-tighter">{yo.ad}</td>
                                            <ActionButtons onEdit={() => openModal('edit', 'yontem', yo)} onDelete={() => handleDelete(yo.id)} />
                                        </tr>
                                    ))}
                                </>
                            )}
                            {!loading && filteredList.length === 0 && (
                                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-300 text-[10px] uppercase tracking-widest font-medium italic">Kayıtlı veri bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">
                            {modalMode === 'create' ? 'Yeni Veri Girişi' : 'Kayıt Güncelleme'}
                            <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-500">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
                            {activeTab === 'yontem' && (
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">İsim / Tanım</label>
                                    <input required className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.ad} onChange={e => setFormData({ ...formData, ad: e.target.value })} />
                                </div>
                            )}
                            {activeTab === 'yonetmelik' && (
                                <>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Madde No / Referans</label>
                                        <input required className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.madde} onChange={e => setFormData({ ...formData, madde: e.target.value })} />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Açıklama Detayları</label>
                                        <textarea required rows={2} className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400 resize-none" value={formData.aciklama} onChange={e => setFormData({ ...formData, aciklama: e.target.value })} />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button>
                                <button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">
                                    {modalMode === 'create' ? 'Sisteme Kaydet' : 'Senkronize Et'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) {
    return (
        <td className="px-5 py-3 text-right opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="flex justify-end gap-3 text-[10px] uppercase font-bold">
                <button onClick={onEdit} className="text-slate-700 hover:text-slate-950 border-b border-slate-200 hover:border-slate-800 pb-0.5 px-1 hover:bg-slate-50 rounded transition-all">Düzenle</button>
                <button onClick={onDelete} className="text-rose-600 hover:text-rose-800 border-b border-rose-100 hover:border-rose-600 pb-0.5 px-1 hover:bg-rose-50 rounded transition-all">Sil</button>
            </div>
        </td>
    )
}

function DegerlendirmeYonetimi({ data, onRefresh }: { data: any[], onRefresh: () => void }) {
    const { showAlert, showConfirm } = useNotification()
    const [selectedForm, setSelectedForm] = useState<any>(null)
    const [showFormModal, setShowFormModal] = useState(false)
    const [showGrupModal, setShowGrupModal] = useState(false)
    const [showSoruModal, setShowSoruModal] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [editingItem, setEditingItem] = useState<any>(null)
    const [formData, setFormData] = useState<any>({})

    const openFormModal = (mode: 'create' | 'edit', item?: any) => {
        setModalMode(mode)
        setEditingItem(item)
        setFormData(mode === 'edit' ? { ad: item.ad, aciklama: item.aciklama } : { ad: '', aciklama: '' })
        setShowFormModal(true)
    }

    const openGrupModal = (mode: 'create' | 'edit', item?: any) => {
        setModalMode(mode)
        setEditingItem(item)
        setFormData(mode === 'edit'
            ? { kod: item.kod, ad: item.ad, agirlik: item.agirlik, sira: item.sira }
            : { kod: '', ad: '', agirlik: 0, sira: 0 })
        setShowGrupModal(true)
    }

    const openSoruModal = (mode: 'create' | 'edit', item?: any) => {
        setModalMode(mode)
        setEditingItem(item)
        setFormData(mode === 'edit'
            ? { kod: item.kod, soru: item.soru, sira: item.sira }
            : { kod: '', soru: '', sira: 0 })
        setShowSoruModal(true)
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (modalMode === 'create') await createDegerlendirmeFormTipi(formData)
            else await updateDegerlendirmeFormTipi(editingItem.id, formData)
            setShowFormModal(false)
            onRefresh()
            showAlert('Model başarıyla güncellendi', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const handleGrupSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (modalMode === 'create') await createDegerlendirmeGrubu({ ...formData, formTipiId: selectedForm.id, agirlik: parseInt(formData.agirlik) })
            else await updateDegerlendirmeGrubu(editingItem.id, { ...formData, agirlik: parseInt(formData.agirlik) })
            setShowGrupModal(false)
            onRefresh()
            showAlert('Kategori başarıyla güncellendi', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const handleSoruSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (modalMode === 'create') await createDegerlendirmeSorusu({ ...formData, grupId: editingItem.grupId })
            else await updateDegerlendirmeSorusu(editingItem.id, formData)
            setShowSoruModal(false)
            onRefresh()
            showAlert('Kriter başarıyla güncellendi', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    return (
        <div className="flex flex-col gap-6 animate-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* FORM MODELS LIST */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Performans Modelleri</h3>
                        <button onClick={() => openFormModal('create')} className="text-[10px] text-slate-600 font-medium hover:text-slate-900 uppercase">Ekle +</button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {data.map(ft => (
                            <div
                                key={ft.id}
                                onClick={() => setSelectedForm(ft)}
                                className={`p-4 rounded border transition-all cursor-pointer flex justify-between items-center group ${selectedForm?.id === ft.id ? 'bg-slate-800 border-slate-700 shadow-md translate-x-1' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                            >
                                <div className="flex-1">
                                    <div className={`text-[12px] font-medium uppercase tracking-tighter ${selectedForm?.id === ft.id ? 'text-white' : 'text-slate-700'}`}>{ft.ad}</div>
                                    <div className={`text-[9px] mt-0.5 line-clamp-1 italic ${selectedForm?.id === ft.id ? 'text-slate-400' : 'text-slate-400'}`}>{ft.aciklama || 'Açıklama belirtilmedi.'}</div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openFormModal('edit', ft)} className={`p-1.5 transition-colors ${selectedForm?.id === ft.id ? 'text-slate-400 hover:text-white' : 'text-slate-300 hover:text-slate-600'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {data.length === 0 && <div className="text-center py-5 text-[10px] text-slate-300 uppercase italic">Model tanımlanmadı.</div>}
                    </div>
                </div>

                {/* CRITERIA MANAGEMENT */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {!selectedForm ? (
                        <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded h-64 flex flex-col items-center justify-center text-slate-300 text-[10px] uppercase tracking-widest gap-2">
                            <span>Yönetim Paneli için Model Seçiniz</span>
                            <div className="w-8 h-[1px] bg-slate-200"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 slide-in-bottom">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <div className="flex-1">
                                    <h3 className="text-[13px] font-medium text-slate-800 uppercase tracking-widest">{selectedForm.ad}</h3>
                                    <p className="text-[10px] text-slate-400 font-medium italic mt-0.5 lowercase tracking-tight">{selectedForm.aciklama}</p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Matris Ağırlığı:</div>
                                        <div className="flex-1 h-1 bg-slate-100 rounded-full max-w-[150px] overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-700 ${selectedForm.gruplar?.reduce((acc: number, g: any) => acc + g.agirlik, 0) === 100 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                                                style={{ width: `${Math.min(100, selectedForm.gruplar?.reduce((acc: number, g: any) => acc + g.agirlik, 0) || 0)}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-medium ${selectedForm.gruplar?.reduce((acc: number, g: any) => acc + g.agirlik, 0) === 100 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            %{selectedForm.gruplar?.reduce((acc: number, g: any) => acc + g.agirlik, 0) || 0} / 100
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => openGrupModal('create')} className="bg-slate-800 text-white px-3 py-1.5 rounded text-[10px] font-medium hover:bg-slate-900 transition-all uppercase tracking-widest">+ Kategori</button>
                            </div>

                            <div className="flex flex-col gap-4">
                                {selectedForm.gruplar?.map((grup: any) => (
                                    <div key={grup.id} className="bg-white border border-slate-100 rounded shadow-sm group">
                                        <div className="bg-slate-50/50 px-5 py-2.5 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-slate-200 text-slate-600 text-[9px] font-medium px-1.5 py-0.5 rounded tracking-tighter uppercase">{grup.kod}</span>
                                                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-tighter">{grup.ad}</span>
                                                <span className="text-[9px] text-slate-400 uppercase tracking-tighter border-l border-slate-200 pl-3">Ağırlık: %{grup.agirlik}</span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openSoruModal('create', { grupId: grup.id })} className="text-[9px] text-slate-400 font-medium hover:text-slate-700 uppercase">Soru++</button>
                                                <button onClick={() => openGrupModal('edit', grup)} className="text-[9px] text-slate-400 font-medium hover:text-slate-700 uppercase">Revize</button>
                                                <button onClick={async () => { if (await showConfirm('Silmek istediğinize emin misiniz?')) { await deleteDegerlendirmeGrubu(grup.id); onRefresh(); showAlert('Grup silindi', 'success'); } }} className="text-[9px] text-rose-300 font-medium hover:text-rose-600 uppercase">Sil</button>
                                            </div>
                                        </div>
                                        <div className="p-0 overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="text-[8px] text-slate-400 uppercase tracking-widest font-medium bg-slate-50/30 border-b border-slate-50">
                                                    <tr>
                                                        <th className="px-6 py-2 w-16">Kod</th>
                                                        <th className="px-6 py-2">Metrik / Kriter Metni</th>
                                                        <th className="px-6 py-2 text-right">Aksiyon</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-600">
                                                    {grup.sorular?.map((soru: any) => (
                                                        <tr key={soru.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                                            <td className="px-6 py-2.5 text-slate-300 font-medium">{soru.kod}</td>
                                                            <td className="px-6 py-2.5 text-slate-600 uppercase tracking-tighter">{soru.soru}</td>
                                                            <td className="px-6 py-2.5 text-right opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                <div className="flex justify-end gap-3 text-[9px] uppercase">
                                                                    <button onClick={() => openSoruModal('edit', soru)} className="text-slate-400 hover:text-slate-800">Düzelt</button>
                                                                    <button onClick={async () => { if (await showConfirm('Soruyu silmek istediğinize emin misiniz?')) { await deleteDegerlendirmeSorusu(soru.id); onRefresh(); showAlert('Soru silindi', 'success'); } }} className="text-rose-300 hover:text-rose-600">At</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!grup.sorular || grup.sorular.length === 0) && (
                                                        <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-300 uppercase italic text-[9px]">Soru/Kriter tanımlanmadı.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                                {(!selectedForm.gruplar || selectedForm.gruplar.length === 0) && (
                                    <div className="bg-white border border-dashed border-slate-100 rounded p-10 text-center text-slate-300 text-[10px] uppercase tracking-widest font-medium italic">
                                        Kategorik yapı tanımlanmadı.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* DEGERLENDIRME MODALS */}
            {showFormModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">Model Tanımlama<button onClick={() => setShowFormModal(false)} className="text-slate-300 hover:text-slate-500">×</button></div>
                        <form onSubmit={handleFormSubmit} className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Frenkans / Tip Adı</label>
                                <input required placeholder="Örn: SARF MALZEME ANALİZİ" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={formData.ad} onChange={e => setFormData({ ...formData, ad: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Kapsam Notu</label>
                                <textarea rows={2} className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none resize-none" value={formData.aciklama} onChange={e => setFormData({ ...formData, aciklama: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setShowFormModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button>
                                <button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">Sisteme İşle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showGrupModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">Kategori Yapılandırma<button onClick={() => setShowGrupModal(false)} className="text-slate-300 hover:text-slate-500">×</button></div>
                        <form onSubmit={handleGrupSubmit} className="p-4 flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Kod (Ref)</label><input required placeholder="A, B, C..." className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={formData.kod} onChange={e => setFormData({ ...formData, kod: e.target.value })} /></div>
                                <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Ağırlık (%)</label><input required type="number" min="0" max="100" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={formData.agirlik} onChange={e => setFormData({ ...formData, agirlik: e.target.value })} /></div>
                            </div>
                            <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Kategori Başlığı</label><input required placeholder="Örn: LOJİSTİK PERFORMANS" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={formData.ad} onChange={e => setFormData({ ...formData, ad: e.target.value })} /></div>
                            <div className="flex justify-end gap-2 mt-1"><button type="button" onClick={() => setShowGrupModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button><button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">Arşivle</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showSoruModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">Kriter/Metrik Tanımı<button onClick={() => setShowSoruModal(false)} className="text-slate-300 hover:text-slate-500">×</button></div>
                        <form onSubmit={handleSoruSubmit} className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Soru/Kriter Kodu</label><input required placeholder="A.1, A.2..." className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none" value={formData.kod} onChange={e => setFormData({ ...formData, kod: e.target.value })} /></div>
                            <div className="flex flex-col gap-0.5"><label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Kriter Metni</label><textarea rows={3} required placeholder="Değerlendirme kriterini tanımlayın..." className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none resize-none" value={formData.soru} onChange={e => setFormData({ ...formData, soru: e.target.value })} /></div>
                            <div className="flex justify-end gap-2 mt-1"><button type="button" onClick={() => setShowSoruModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button><button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">Senkronize Et</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function SmtpAyarlari({ settings, onRefresh }: { settings: any[], onRefresh: () => void }) {
    const { showAlert } = useNotification()
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        SMTP_HOST: settings.find(s => s.key === 'SMTP_HOST')?.value || '',
        SMTP_PORT: settings.find(s => s.key === 'SMTP_PORT')?.value || '587',
        SMTP_SECURE: settings.find(s => s.key === 'SMTP_SECURE')?.value || 'false',
        SMTP_USER: settings.find(s => s.key === 'SMTP_USER')?.value || '',
        SMTP_PASS: settings.find(s => s.key === 'SMTP_PASS')?.value || '',
        SMTP_FROM: settings.find(s => s.key === 'SMTP_FROM')?.value || ''
    })

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const updates = Object.entries(formData).map(([key, value]) => ({ key, value }))
            await updateSystemSettings(updates)
            showAlert('SMTP ayarları başarıyla güncellendi.', 'success')
            onRefresh()
        } catch (err) {
            showAlert('Hata: ' + (err as Error).message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="premium-card p-6 max-w-2xl mx-auto animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-4">
                <div className="bg-slate-800 p-3 rounded-xl shadow-lg">
                    <span className="text-2xl">📧</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">E-Posta (SMTP) Sunucu Ayarları</h3>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Sistem bildirimleri ve RFQ gönderimleri için yapılandırma</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">SMTP Host</label>
                    <input
                        type="text"
                        placeholder="Örn: smtp.gmail.com"
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_HOST}
                        onChange={(e) => setFormData({ ...formData, SMTP_HOST: e.target.value })}
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Port</label>
                        <select
                            className="text-[9px] font-bold text-slate-400 outline-none bg-transparent"
                            value={formData.SMTP_PORT}
                            onChange={(e) => setFormData({ ...formData, SMTP_PORT: e.target.value })}
                        >
                            <option value="587">TLS (587)</option>
                            <option value="465">SSL (465)</option>
                            <option value="25">Standard (25)</option>
                        </select>
                    </div>
                    <input
                        type="text"
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_PORT}
                        onChange={(e) => setFormData({ ...formData, SMTP_PORT: e.target.value })}
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Güvenli Bağlantı</label>
                    <select
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_SECURE}
                        onChange={(e) => setFormData({ ...formData, SMTP_SECURE: e.target.value })}
                    >
                        <option value="false">TLS / STARTTLS (Önerilen)</option>
                        <option value="true">SSL (Direct)</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Mail Kullanıcı Adı</label>
                    <input
                        type="email"
                        placeholder="kurumsal@sirket.com"
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_USER}
                        onChange={(e) => setFormData({ ...formData, SMTP_USER: e.target.value })}
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Uygulama Şifresi</label>
                    <input
                        type="password"
                        placeholder="••••••••••••••••"
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_PASS}
                        onChange={(e) => setFormData({ ...formData, SMTP_PASS: e.target.value })}
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gönderen İsmi (From Header)</label>
                    <input
                        type="text"
                        placeholder='"Satinalma PRO" <noreply@sirket.com>'
                        className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                        value={formData.SMTP_FROM}
                        onChange={(e) => setFormData({ ...formData, SMTP_FROM: e.target.value })}
                        required
                    />
                </div>

                <div className="col-span-2 mt-6 flex justify-end items-center gap-4 border-t border-slate-100 pt-6">
                    <p className="text-[10px] text-slate-400 italic">
                        * Bu bilgiler veritabanında saklanır ve öncelikli olarak kullanılır.
                    </p>
                    <button
                        type="submit"
                        disabled={saving}
                        className={`bg-slate-800 text-white px-8 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all active:scale-95 ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-900'}`}
                    >
                        {saving ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}
                    </button>
                </div>
            </form>
        </div>
    )
}
