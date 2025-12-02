// js/pdf.js
// exportPdf(containerElement, filename)
export async function exportPdf(container, filename = 'raport.pdf') {
  const opt = {
    margin:       10,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
  };
  return new Promise((resolve, reject) => {
    try {
      html2pdf().set(opt).from(container).save().then(() => resolve(true)).catch(err => reject(err));
    } catch (err) { reject(err); }
  });
}
