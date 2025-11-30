// pdf.js
export function exportPdf(element, filename = 'Raport.pdf') {
  const opt = {
    margin: 0.5,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  return html2pdf().set(opt).from(element).save();
}
