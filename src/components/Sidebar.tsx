'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export default function Sidebar({ isOpen, isCollapsed, onClose }: { isOpen?: boolean, isCollapsed?: boolean, onClose?: () => void }) {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const user = session?.user
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : '??'

    const menuGroups = [
        {
            title: 'Genel',
            items: [
                { href: '/', icon: '📊', label: 'Operasyonel Panel', roles: ['ADMIN', 'SATINALMA', 'BIRIM'] },
                { href: '/raporlar', icon: '📈', label: 'Raporlama Paneli', roles: ['ADMIN', 'SATINALMA', 'BIRIM'] },
            ]
        },
        {
            title: 'Kullanıcı & Organizasyon',
            items: [
                { href: '/kullanici-yonetimi', icon: '👥', label: 'Kullanıcı Yönetimi', roles: ['ADMIN'] },
            ]
        },
        {
            title: 'Satınalma Süreçleri',
            items: [
                { href: '/talepler', icon: '📝', label: 'Satınalma Talepleri', roles: ['ADMIN', 'SATINALMA', 'BIRIM'] },
                { href: '/rfq', icon: '📨', label: 'Teklif İstemleri (RFQ)', roles: ['ADMIN', 'SATINALMA'] },
                { href: '/siparisler', icon: '⚙️', label: 'Sipariş Süreçleri', roles: ['ADMIN', 'SATINALMA'] },
                { href: '/degerlendirmeler', icon: '⭐', label: 'Geçmiş Değerlendirmeler', roles: ['ADMIN', 'SATINALMA', 'BIRIM'] },
            ]
        },
        {
            title: 'Finans & Hukuk',
            items: [
                { href: '/finans', icon: '💰', label: 'Finansal Kayıtlar', roles: ['ADMIN', 'SATINALMA'] },
                { href: '/sozlesmeler', icon: '📜', label: 'Sözleşme & SLA', roles: ['ADMIN', 'SATINALMA'] },
            ]
        },
        {
            title: 'Tedarikçi Yönetimi',
            items: [
                { href: '/tedarikci', icon: '🤝', label: 'Tedarikçi İlişkileri', roles: ['ADMIN', 'SATINALMA'] },
                { href: '/tedarikci/kategoriler', icon: '🏷️', label: 'Tedarikçi Kategorileri', roles: ['ADMIN', 'SATINALMA'] },
                { href: '/tedarikci/kategori-onay', icon: '✅', label: 'Kategori Onayları', roles: ['ADMIN'] },
            ]
        }
    ]

    const sidebarClass = `
        fixed lg:sticky top-0 left-0 z-50 h-screen transition-all duration-300 ease-in-out bg-slate-950 border-r border-white/5 p-4 
        flex flex-col gap-6 shadow-2xl
        ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${!isOpen && isCollapsed ? 'lg:w-20' : 'lg:w-64'}
    `

    return (
        <aside className={sidebarClass}>
            {/* Brand Logo */}
            <div className={`flex items-center ${isCollapsed && !isOpen ? 'justify-center' : 'justify-between'} px-2 border-b border-white/5 pb-5`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="min-w-[36px] w-9 h-9 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-[11px] font-black shadow-lg shadow-blue-500/30">
                        PRU
                    </div>
                    {(!isCollapsed || isOpen) && (
                        <div className="flex flex-col whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="text-[13px] font-bold tracking-tight leading-none">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-blue-200">PRU</span>
                                <span className="text-white/90"> Satınalma</span>
                            </span>
                            <span className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">Kurumsal Yönetim Sistemi</span>
                        </div>
                    )}
                </div>
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="lg:hidden text-slate-400 hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-6 overflow-y-auto flex-1 pr-2 sidebar-scroll">
                {!mounted || status === 'loading' || (status === 'authenticated' && !user?.role) ? (
                    <div className="flex flex-col gap-2 px-2 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-8 bg-white/5 rounded w-full"></div>
                        ))}
                    </div>
                ) : (
                    menuGroups.map((group, groupIdx) => {
                        const filteredItems = group.items.filter(item => item.roles.includes(user?.role || ''))
                        if (filteredItems.length === 0) return null

                        return (
                            <div key={groupIdx} className="flex flex-col gap-1">
                                {(!isCollapsed || isOpen) && (
                                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 px-3 font-bold opacity-80">
                                        {group.title}
                                    </div>
                                )}
                                <div className="flex flex-col gap-0.5">
                                    {filteredItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={isCollapsed && !isOpen ? item.label : ''}
                                            onClick={onClose}
                                            className={`group flex items-center ${isCollapsed && !isOpen ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded transition-all duration-200 ${pathname === item.href
                                                ? 'bg-white/5 text-white shadow-inner border border-white/5'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                                }`}
                                        >
                                            <span className={`text-[12px] opacity-70 group-hover:opacity-100 transition-opacity ${pathname === item.href ? 'opacity-100' : ''}`}>
                                                {item.icon}
                                            </span>
                                            {(!isCollapsed || isOpen) && (
                                                <span className="text-[11px] font-medium tracking-wide uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                                                    {item.label}
                                                </span>
                                            )}
                                            {pathname === item.href && (!isCollapsed || isOpen) && (
                                                <div className="ml-auto w-1 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                )}
            </nav>

            {/* Footer Navigation */}
            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                <Link
                    href="/profil"
                    onClick={onClose}
                    title={isCollapsed && !isOpen ? 'Profil Ayarları' : ''}
                    className={`flex items-center ${isCollapsed && !isOpen ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded transition-all duration-200 border border-transparent ${pathname === '/profil'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                        }`}
                >
                    <span className="text-[12px]">👤</span>
                    {(!isCollapsed || isOpen) && (
                        <span className="text-[11px] font-medium tracking-wide uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-300">Profil Ayarları</span>
                    )}
                </Link>

                {user?.role === 'ADMIN' && (
                    <Link
                        href="/ayarlar"
                        onClick={onClose}
                        title={isCollapsed && !isOpen ? 'Sistem Yapılandırma' : ''}
                        className={`flex items-center ${isCollapsed && !isOpen ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded transition-all duration-200 border border-transparent ${pathname === '/ayarlar'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                            }`}
                    >
                        <span className="text-[12px]">⚙️</span>
                        {(!isCollapsed || isOpen) && (
                            <span className="text-[11px] font-medium tracking-wide uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-300">Sistem Yapılandırma</span>
                        )}
                    </Link>
                )}

                <div className={`p-2 bg-white/5 rounded-xl border border-white/10 mt-1 overflow-hidden transition-all duration-300`}>
                    <div className={`flex items-center ${isCollapsed && !isOpen ? 'justify-center' : 'gap-3'}`}>
                        <div className="min-w-[32px] w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold border border-blue-500/30 overflow-hidden">
                            {user?.image ? (
                                <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                initials
                            )}
                        </div>
                        {(!isCollapsed || isOpen) && (
                            <>
                                <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                                    <span className="text-[10px] text-white font-medium truncate">{user?.name || 'Kullanıcı'}</span>
                                    <span className="text-[8px] text-slate-400 truncate">{user?.email || ''}</span>
                                </div>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="text-slate-400 hover:text-white transition-colors p-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                                        <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    )
}
