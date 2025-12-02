// js/pdf.js
export async function exportPdf(containerElement, filename = 'raport.pdf') {
  if (!containerElement) throw new Error('Brak zawartości do eksportu');
  const opt = {
    margin:       10,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  return new Promise((resolve, reject) => {
    try {
      html2pdf().set(opt).from(containerElement).save().then(() => resolve(true)).catch(err => reject(err));
    } catch (err) { reject(err); }
  });
}
