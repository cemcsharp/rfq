import { getTumDegerlendirmeler } from '@/lib/actions'
import { auth } from '@/auth'
import Link from 'next/link'

export default async function DegerlendirmelerPage() {
    const session = await auth()
    if (!session || !session.user || !['ADMIN', 'SATINALMA', 'BIRIM'].includes(session.user.role)) {
        return <div className="p-10 text-center font-bold text-rose-600">Bu sayfayı görüntüleme yetkiniz bulunmuyor.</div>
    }
    const degerlendirmeler = await getTumDegerlendirmeler()

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        {session.user.role === 'BIRIM' ? 'Geçmiş Değerlendirmelerim' : 'Tedarikçi Değerlendirmeleri'}
                    </h2>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-2 ml-4">
                        Tedarikçi bazlı kalite ve teslimat performans puanları
                    </p>
                </div>
            </div>

            {/* Content Table */}
            <div className="premium-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#0f172a] text-white">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tarih</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sipariş / Talep</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tedarikçi</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Genel Puan</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sonuç</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksiyon</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {degerlendirmeler.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Henüz Hiç Değerlendirme Bulunmuyor
                                    </td>
                                </tr>
                            ) : (
                                degerlendirmeler.map((deg: any) => (
                                    <tr key={deg.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 align-middle">
                                            <div className="text-[11px] font-bold text-slate-800">
                                                {new Date(deg.tarih).toLocaleDateString('tr-TR')}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-medium">
                                                {new Date(deg.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="text-[11px] font-black text-indigo-600 tracking-tight">
                                                #{deg.siparis.barkod}
                                            </div>
                                            <div className="text-[9px] text-slate-500 uppercase w-32 truncate">
                                                {deg.siparis.talep.konu}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex items-center gap-3">
                                                {deg.tedarikci.logo ? (
                                                    <img src={deg.tedarikci.logo} alt="" className="w-8 h-8 rounded border border-slate-200 object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                        {deg.tedarikci.ad.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[11px] font-bold text-slate-800">{deg.tedarikci.ad}</p>
                                                    <p className="text-[9px] text-slate-400 uppercase">Vergi No: {deg.tedarikci.vergiNo || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="text-[15px] font-black text-slate-800">
                                                {deg.genelPuan.toFixed(2)} <span className="text-[10px] text-slate-400">/ 5.0</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <span className={`px-3 py-1.5 rounded-md text-[9px] font-black tracking-widest uppercase border border-opacity-50
                                                ${deg.sonuc === 'ONAYLI' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                  deg.sonuc === 'CALISABILIR' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                  deg.sonuc === 'SARTLI' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                  'bg-rose-50 text-rose-600 border-rose-200'}
                                            `}>
                                                {deg.sonuc}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 align-middle text-right">
                                            <Link 
                                                href={`/talepler/${deg.siparis.talep.id}`}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded text-[9px] font-bold uppercase tracking-widest transition-colors inline-block"
                                            >
                                                İncele
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
