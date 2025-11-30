// js/pdf.js
// Proste opakowanie dla html2pdf.js (używa globalnego html2pdf)
export async function exportPdf(containerElement, filename = 'raport.pdf') {
  if (!containerElement) throw new Error('Brak zawartości do eksportu');
  // minimalne style dla wydruku
  containerElement.style.padding = '10mm';
  containerElement.style.background = '#fff';
  const opt = {
    margin:       10,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  // html2pdf jest załadowany globalnie przez CDN w index.html
  return new Promise((resolve, reject) => {
    try {
      html2pdf().set(opt).from(containerElement).save().then(() => resolve(true)).catch(err => reject(err));
    } catch (err) { reject(err); }
  });
}
