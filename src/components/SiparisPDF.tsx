import React from 'react'
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Roboto',
        backgroundColor: '#FFFFFF',
        padding: 40,
        color: '#1e293b'
    },
    // Upper Banner
    banner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 3,
        borderBottomColor: '#0f172a',
        paddingBottom: 15,
        marginBottom: 30
    },
    bannerLeft: {
        flexDirection: 'column'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b',
        letterSpacing: 2
    },
    bannerRight: {
        textAlign: 'right'
    },
    companyMark: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2f855a' // Premium green
    },
    companySubMark: {
        fontSize: 9,
        color: '#475569'
    },
    // Meta / Doc Info
    metaGrid: {
        flexDirection: 'row',
        marginBottom: 30,
        gap: 20
    },
    metaBox: {
        flex: 1,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    metaLabel: {
        fontSize: 9,
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    metaValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    // Wallets / Addresses
    walletRow: {
        flexDirection: 'row',
        marginBottom: 30,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 15
    },
    walletBox: {
        flex: 1
    },
    walletTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    walletContent: {
        fontSize: 10,
        lineHeight: 1.5,
        color: '#334155'
    },
    // Table Structure
    table: {
        width: '100%',
        marginBottom: 20
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 2,
        borderBottomColor: '#94a3b8',
        alignItems: 'center',
        height: 30
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#475569',
        textTransform: 'uppercase',
        paddingHorizontal: 5
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
        paddingVertical: 10,
        minHeight: 30
    },
    tableCell: {
        fontSize: 10,
        color: '#334155',
        paddingHorizontal: 5
    },
    // Totals Area
    totalsArea: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10
    },
    totalsBox: {
        width: 250
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    totalLabel: {
        fontSize: 10,
        color: '#64748b'
    },
    totalValue: {
        fontSize: 10,
        fontWeight: 'bold'
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 2,
        borderTopColor: '#0f172a',
        marginTop: 5
    },
    grandTotalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    grandTotalValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2f855a'
    },
    // Notes Area
    notesArea: {
        marginTop: 40,
        padding: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 4
    },
    notesTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 5,
        textTransform: 'uppercase'
    },
    notesContent: {
        fontSize: 9,
        color: '#475569',
        lineHeight: 1.5
    },
    // Signatures
    signatureRow: {
        flexDirection: 'row',
        marginTop: 50,
        justifyContent: 'space-between'
    },
    signatureBox: {
        width: 200,
        alignItems: 'center'
    },
    signatureLine: {
        width: 150,
        borderBottomWidth: 1,
        borderBottomColor: '#94a3b8',
        marginBottom: 5
    },
    signatureText: {
        fontSize: 9,
        color: '#64748b'
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10
    },
    footerText: {
        fontSize: 8,
        color: '#94a3b8'
    }
})

interface SiparisPDFProps {
    siparis: any
    tedarikci: any
    rfq: any
    kalemler: any[]
    sender: any
}

export const SiparisPDF = ({ siparis, tedarikci, rfq, kalemler, sender }: SiparisPDFProps) => {
    let genelToplam = 0
    let mainCurrency = 'TRY'

    // Formatted items
    const formattedItems = kalemler.map((k, i) => {
        const teklif = k.siparisSecimi?.teklif
        if (teklif?.paraBirimi) mainCurrency = teklif.paraBirimi

        const kalemTeklif = teklif?.kalemler.find((tk: any) => tk.talepKalem.id === k.talepKalemId)
        const birimFiyat = kalemTeklif ? Number(kalemTeklif.birimFiyat) : 0
        const miktar = k.miktar || k.talepKalem.miktar
        const tutar = birimFiyat * miktar
        genelToplam += tutar

        return {
            no: i + 1,
            aciklama: k.talepKalem.aciklama,
            miktar: `${miktar} ${k.talepKalem.birim}`,
            fiyat: `${birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${mainCurrency}`,
            tutarValue: tutar,
            tutarStr: `${tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${mainCurrency}`
        }
    })

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                
                {/* HEAD BANNER */}
                <View style={styles.banner}>
                    <View style={styles.bannerLeft}>
                        <Text style={styles.title}>SİPARİŞ FORMU</Text>
                        <Text style={styles.subtitle}>PURCHASE ORDER (PO)</Text>
                    </View>
                    <View style={styles.bannerRight}>
                        <Text style={styles.companyMark}>PRU KURUMSAL</Text>
                        <Text style={styles.companySubMark}>Tedarik Zinciri Yönetimi</Text>
                    </View>
                </View>

                {/* META INFO GRID */}
                <View style={styles.metaGrid}>
                    <View style={styles.metaBox}>
                        <Text style={styles.metaLabel}>Sipariş No (PO Number)</Text>
                        <Text style={styles.metaValue}>{siparis.barkod}</Text>
                    </View>
                    <View style={styles.metaBox}>
                        <Text style={styles.metaLabel}>Tarih (Date)</Text>
                        <Text style={styles.metaValue}>{new Date().toLocaleDateString('tr-TR')}</Text>
                    </View>
                    <View style={styles.metaBox}>
                        <Text style={styles.metaLabel}>İlgili İhale (RFQ)</Text>
                        <Text style={styles.metaValue}>{rfq?.rfqNo || '-'}</Text>
                    </View>
                </View>

                {/* ADDRESS WALLETS */}
                <View style={styles.walletRow}>
                    <View style={styles.walletBox}>
                        <Text style={styles.walletTitle}>Siparişi Veren (Müşteri)</Text>
                        <Text style={styles.walletContent}><Text style={{ fontWeight: 'bold' }}>PRU Satınalma</Text></Text>
                        <Text style={styles.walletContent}>Yetkili: {sender.name} ({sender.title})</Text>
                        <Text style={styles.walletContent}>E-Posta: {sender.email}</Text>
                        <Text style={styles.walletContent}>Telefon: {sender.phone || '-'}</Text>
                    </View>
                    <View style={styles.walletBox}>
                        <Text style={styles.walletTitle}>Satıcı (Tedarikçi)</Text>
                        <Text style={styles.walletContent}><Text style={{ fontWeight: 'bold' }}>{tedarikci.ad}</Text></Text>
                        <Text style={styles.walletContent}>İlgili Kişi: {tedarikci.yetkiliKisi || '-'}</Text>
                        <Text style={styles.walletContent}>E-Posta: {tedarikci.email || '-'}</Text>
                        <Text style={styles.walletContent}>Vergi No: {tedarikci.vergiNo || '-'}</Text>
                    </View>
                </View>

                {/* ITEMS TABLE */}
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { width: '5%' }]}>No</Text>
                        <Text style={[styles.tableHeaderCell, { width: '45%' }]}>Ürün / Hizmet Tanımı</Text>
                        <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'center' }]}>Miktar</Text>
                        <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>B.Fiyat</Text>
                        <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Tutar</Text>
                    </View>
                    {formattedItems.map((item, index) => (
                        <View style={styles.tableRow} key={index}>
                            <Text style={[styles.tableCell, { width: '5%' }]}>{item.no}</Text>
                            <Text style={[styles.tableCell, { width: '45%', fontWeight: 'bold' }]}>{item.aciklama}</Text>
                            <Text style={[styles.tableCell, { width: '15%', textAlign: 'center' }]}>{item.miktar}</Text>
                            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>{item.fiyat}</Text>
                            <Text style={[styles.tableCell, { width: '20%', textAlign: 'right', fontWeight: 'bold' }]}>{item.tutarStr}</Text>
                        </View>
                    ))}
                </View>

                {/* TOTALS */}
                <View style={styles.totalsArea}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Ara Toplam:</Text>
                            <Text style={styles.totalValue}>{genelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {mainCurrency}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>KDV (%):</Text>
                            <Text style={styles.totalValue}>Belirtilmemiş</Text>
                        </View>
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>GENEL TOPLAM:</Text>
                            <Text style={styles.grandTotalValue}>{genelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {mainCurrency}</Text>
                        </View>
                    </View>
                </View>

                {/* T&C (NOTES) */}
                <View style={styles.notesArea}>
                    <Text style={styles.notesTitle}>Şartlar ve Notlar (Terms & Conditions)</Text>
                    <Text style={styles.notesContent}>1. Fatura üzerine Sipariş Numarası (PO No) yazılması zorunludur.</Text>
                    <Text style={styles.notesContent}>2. Eksik evrakla yapılan teslimatlarda fatura kabul edilmeyecektir.</Text>
                    <Text style={styles.notesContent}>3. Siparişin tedarikçi tarafından e-posta ile teyit edilmesi esastır.</Text>
                    {siparis.aciklama && (
                        <Text style={[styles.notesContent, { marginTop: 10, fontWeight: 'bold' }]}>
                            Özel Not: {siparis.aciklama}
                        </Text>
                    )}
                </View>

                {/* SIGNATURES */}
                <View style={styles.signatureRow}>
                    <View style={styles.signatureBox}>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureText}>Tedarikçi Firma Yetkilisi (Kaşe/İmza)</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureText}>PRU Satınalma Onay (E-İmza)</Text>
                    </View>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Bu belge PRU Kurumsal Yazılım Sistemi tarafından elektronik ortamda {new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.</Text>
                </View>

            </Page>
        </Document>
    )
}
