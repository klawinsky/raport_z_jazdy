// pdf.js
export function exportPdf(element, filename = 'Raport.pdf') {
  const opt = {
    margin: [12, 10, 12, 10], // mm top/right/bottom/left
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };
  return html2pdf().set(opt).from(element).save();
}
