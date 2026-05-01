export function renderRfqEmail(talep: any, tedarikci: any, sender: any, portalUrl?: string) {
    const kalemlerHtml = talep.kalemler.map((k: any) => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568;">${k.aciklama}</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568; text-align: center;">${k.miktar}</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568; text-align: center;">${k.birim}</td>
        </tr>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; background-color: #f7fafc; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: #2d3748; color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #edf2f7; color: #718096; padding: 20px; text-align: center; font-size: 12px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .th { background: #f8fafc; padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
            .btn { display: inline-block; background: #10b981; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 25px; font-size: 14px; }
            .signature { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e2e8f0; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">TEKLİF İSTEMİ (RFQ)</h1>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 12px;">Ref No: ${talep.barkod}</p>
            </div>
            <div class="content">
                <p>Sayın <strong>${tedarikci.ad}</strong>,</p>
                <p>Aşağıda detayları belirtilen malzemeler/hizmetler için şirketimize özel fiyat teklifinizi iletmenizi rica ederiz.</p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 13px;"><strong>Talep Konusu:</strong> ${talep.konu}</p>
                    <p style="margin: 5px 0 0; font-size: 13px;"><strong>Gerekçe/Not:</strong> ${talep.gerekce}</p>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th class="th">Açıklama</th>
                            <th class="th" style="text-align: center;">Miktar</th>
                            <th class="th" style="text-align: center;">Birim</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${kalemlerHtml}
                    </tbody>
                </table>

                <p style="margin-top: 25px; font-size: 14px;">Teklifinizi aşağıdaki butonu kullanarak online formumuz üzerinden iletebilirsiniz.</p>
                
                <div style="text-align: center;">
                    <a href="${portalUrl || '#'}" class="btn">📋 Teklif Formunu Doldur</a>
                </div>

                <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                    <strong>Son Teklif Tarihi:</strong> ${new Date(talep.sonTeklifTarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>

                <div class="signature">
                    <p style="margin: 0; color: #4a5568;">Saygılarımızla,</p>
                    <p style="margin: 5px 0 0; font-weight: bold; color: #2d3748;">${sender.name}</p>
                    <p style="margin: 0; font-size: 12px; color: #718096;">${sender.title}</p>
                </div>
            </div>
            <div class="footer">
                <p>Bu e-posta <strong>PRU - Satınalma Platformu</strong> sistemi tarafından otomatik olarak oluşturulmuştur.</p>
                <p>&copy; ${new Date().getFullYear()} Kurumsal Tedarik Yönetimi</p>
            </div>
        </div>
    </body>
    </html>
    `
}

export function renderRfqClosedEmail(rfqTitle: string, rfqNo: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; background-color: #f7fafc; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: #2d3748; color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #edf2f7; color: #718096; padding: 20px; text-align: center; font-size: 12px; }
            .signature { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e2e8f0; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">İHALE KAPANDI</h1>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 12px;">RFQ No: ${rfqNo}</p>
            </div>
            <div class="content">
                <p>Sayın Tedarikçimiz,</p>
                <p><strong>${rfqTitle}</strong> konulu ihale süreci erken sonlandırılmış ve teklif alımına kapatılmıştır.</p>
                <p>İlginiz için teşekkür ederiz.</p>
                
                <div class="signature">
                    <p style="margin: 0; color: #4a5568;">Satınalma Departmanı</p>
                </div>
            </div>
            <div class="footer">
                <p>Bu e-posta <strong>PRU - Satınalma Platformu</strong> sistemi tarafından otomatik olarak oluşturulmuştur.</p>
                <p>&copy; ${new Date().getFullYear()} Kurumsal Tedarik Yönetimi</p>
            </div>
        </div>
    </body>
    </html>
    `
}

export function renderOrderEmail(siparis: any, tedarikci: any, rfq: any, kalemler: any[], sender: any) {
    const siparisTarihi = new Date().toLocaleDateString('tr-TR')

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 20px; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .header { background: #0f172a; color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 40px; }
            .footer { background: #f1f5f9; color: #64748b; padding: 20px; text-align: center; font-size: 13px; border-top: 1px solid #e2e8f0; }
            .icon-box { display: inline-block; width: 60px; height: 60px; background: #10b981; border-radius: 50%; color: white; line-height: 60px; font-size: 24px; margin-bottom: 20px; }
            .attachment-info { margin-top: 30px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; text-align: center; color: #334155; }
            .attachment-info strong { color: #0f172a; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="icon-box">✓</div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Siparişiniz Onaylandı</h1>
                <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">Bizi tercih ettiğiniz için teşekkür ederiz.</p>
            </div>
            <div class="content">
                <p style="font-size: 16px;">Sayın <strong>${tedarikci.ad}</strong>,</p>
                <p style="font-size: 15px;">Aşağıda özet bilgileri yer alan yeni siparişinizin sisteme girişi ve onayı tamamlanmıştır.</p>
                
                <div style="margin: 25px 0; border-left: 3px solid #10b981; padding-left: 15px;">
                    <p style="margin: 0 0 5px;"><strong>Sipariş No (PO):</strong> ${siparis.barkod}</p>
                    <p style="margin: 0 0 5px;"><strong>İlgili RFQ:</strong> ${rfq.rfqNo} - ${rfq.baslik}</p>
                    <p style="margin: 0;"><strong>Sipariş Tarihi:</strong> ${siparisTarihi}</p>
                </div>

                <div class="attachment-info">
                    📎 Resmi <strong>Sipariş Emri (Purchase Order)</strong> evrakınızı PDF dosyası biçiminde bu e-postanın ekinde bulabilirsiniz. Bütün detaylar evrakta yer almaktadır.
                </div>
                
                <p style="margin-top: 30px; font-size: 15px;">
                    Sipariş onayı (Order Confirmation) ve termin süreniz ile ilgili geri dönüşünüzü beklemekteyiz.
                </p>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1;">
                    <p style="margin: 0; color: #475569; font-size: 14px;">Saygılarımızla,</p>
                    <p style="margin: 5px 0 0; font-weight: 700; color: #0f172a;">${sender.name}</p>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 13px;">${sender.title}</p>
                </div>
            </div>
            <div class="footer">
                Bu mesaj PRU Satınalma ve Tedarik Zinciri Uygulaması tarafından gönderilmiştir. <br>
                Kurumsal Tedarik Merkezi
            </div>
        </div>
    </body>
    </html>
    `
}

export function renderThankYouEmail(tedarikci: any, rfq: any) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; background-color: #f7fafc; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: #4a5568; color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #edf2f7; color: #718096; padding: 20px; text-align: center; font-size: 12px; }
            .signature { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e2e8f0; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">İHALE SONUÇLANDI</h1>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 12px;">RFQ No: ${rfq.rfqNo}</p>
            </div>
            <div class="content">
                <p>Sayın <strong>${tedarikci.ad}</strong>,</p>
                <p><strong>${rfq.baslik}</strong> konulu ihale süreci tamamlanmıştır.</p>
                <p>Yapılan değerlendirme sonucunda teklifiniz uygun bulunmamıştır veya ihale başka bir tedarikçiye verilmiştir.</p>
                <p>Sürece katılımınız ve değerli teklifiniz için teşekkür ederiz. Gelecek ihalelerde tekrar çalışmayı ümit ederiz.</p>
                
                <div class="signature">
                    <p style="margin: 0; color: #4a5568;">Satınalma Departmanı</p>
                </div>
            </div>
            <div class="footer">
                <p>Bu e-posta <strong>PRU - Satınalma Platformu</strong> sistemi tarafından otomatik olarak oluşturulmuştur.</p>
                <p>&copy; ${new Date().getFullYear()} Kurumsal Tedarik Yönetimi</p>
            </div>
        </div>
    </body>
    </html>
    `
}
export function renderEvaluationRequestEmail(siparis: any, evaluationLink: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; background-color: #f7fafc; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: #2d3748; color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #edf2f7; color: #718096; padding: 20px; text-align: center; font-size: 12px; }
            .btn { display: inline-block; background: #2d3748; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 25px; font-size: 14px; }
            .info-box { background: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 20px; letter-spacing: 1px; text-transform: uppercase;">Tedarikçi Değerlendirme Talebi</h1>
            </div>
            <div class="content">
                <p>Sayın İlgili,</p>
                <p><strong>${siparis.barkod}</strong> numaralı siparişimiz tamamlanmış ve ürün/hizmet teslim alınmıştır.</p>
                <p>Hizmet kalitemizi artırmak ve tedarikçi performanslarını izlemek amacıyla, bu süreçle ilgili görüşlerinizi paylaşmanızı rica ederiz.</p>
                
                <div class="info-box">
                    <p style="margin: 0; font-size: 13px;"><strong>Tedarikçi:</strong> ${siparis.tedarikci?.ad || '-'}</p>
                    <p style="margin: 5px 0 0; font-size: 13px;"><strong>Sipariş Konusu:</strong> ${siparis.talep?.konu || '-'}</p>
                </div>

                <p style="font-size: 14px;">Lütfen aşağıdaki butona tıklayarak değerlendirme formunu doldurunuz. Bu işlem yaklaşık 2 dakikanızı alacaktır.</p>
                
                <div style="text-align: center;">
                    <a href="${evaluationLink}" class="btn">⭐ Değerlendirme Formunu Aç</a>
                </div>

                <p style="margin-top: 25px; font-size: 12px; color: #718096;">
                    Bu link size özeldir ve tek seferlik kullanım içindir.
                </p>
            </div>
            <div class="footer">
                <p>Bu e-posta <strong>PRU - Satınalma Platformu</strong> sistemi tarafından otomatik olarak oluşturulmuştur.</p>
                <p>&copy; ${new Date().getFullYear()} Kurumsal Tedarik Yönetimi</p>
            </div>
        </div>
    </body>
    </html>
    `
}
