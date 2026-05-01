'use client'

import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { RfqPdfTemplate } from './RfqPdfTemplate'
import { RfqListPdfTemplate } from './RfqListPdfTemplate'

interface ExportExcelButtonProps {
    data: any[]
    fileName: string
    sheetName: string
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({ data, fileName, sheetName }) => {
    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        XLSX.writeFile(wb, `${fileName}.xlsx`)
    }

    return (
        <button
            onClick={handleExport}
            className="bg-emerald-600 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm uppercase tracking-widest flex items-center gap-2"
        >
            📊 Excel'e Aktar
        </button>
    )
}

interface OrderPdfButtonProps {
    order: any
}

export const OrderPdfButton: React.FC<OrderPdfButtonProps> = ({ order }) => {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    if (!mounted) return (
        <button className="bg-slate-800/50 text-white/50 px-5 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-md flex items-center gap-2 cursor-wait">
            📄 Sipariş Formu PDF
        </button>
    )

    return (
        <a
            href={`/api/siparis/${order.id}/pdf`}
            download={`Siparis-${order.barkod}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-800 text-white px-5 py-2 rounded text-[11px] font-bold hover:bg-slate-900 transition-all uppercase tracking-widest shadow-md flex items-center gap-2 no-underline"
        >
            📄 Sipariş Formu PDF
        </a>
    )
}

interface RfqPdfButtonProps {
    rfq: any
    scores: any[]
}

export const RfqPdfButton: React.FC<RfqPdfButtonProps> = ({ rfq, scores }) => {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    if (!mounted) return (
        <button className="bg-slate-800/50 text-white/50 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest shadow-md flex items-center gap-2 cursor-wait">
            📄 RFQ Özeti PDF
        </button>
    )

    return (
        <PDFDownloadLink
            document={<RfqPdfTemplate rfq={rfq} scores={scores} />}
            fileName={`RFQ-${rfq.rfqNo}.pdf`}
            className="bg-slate-800 text-white px-4 py-2 rounded text-xs font-bold hover:bg-slate-900 transition-all uppercase tracking-widest shadow-md flex items-center gap-2 no-underline"
        >
            {({ loading }) => (loading ? 'Hazırlanıyor...' : '📄 RFQ Özeti PDF')}
        </PDFDownloadLink>
    )
}

interface RfqListPdfButtonProps {
    rfqs: any[]
}

export const RfqListPdfButton: React.FC<RfqListPdfButtonProps> = ({ rfqs }) => {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    if (!mounted) return (
        <button className="bg-slate-800/50 text-white/50 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 cursor-wait">
            📄 PDF Listesi
        </button>
    )

    return (
        <PDFDownloadLink
            document={<RfqListPdfTemplate rfqs={rfqs} />}
            fileName={`RFQ-Listesi-${new Date().toISOString().split('T')[0]}.pdf`}
            className="bg-slate-800 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-slate-900 transition-all uppercase tracking-widest shadow-sm flex items-center gap-2 no-underline"
        >
            {({ loading }) => (loading ? '...' : '📄 PDF Listesi')}
        </PDFDownloadLink>
    )
}
