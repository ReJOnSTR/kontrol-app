import html2pdf from 'html2pdf.js';

/**
 * Clean, distortion-free client-side PDF export utility.
 * Operates directly on the live on-screen element (avoiding off-screen blank canvas bugs),
 * temporarily applies print-clean styling, captures exact A4 dimensions, and downloads directly.
 */
export async function exportElementToCleanPdf(containerElement, filename = 'Rapor.pdf', isLandscape = false) {
    if (!containerElement) {
        throw new Error('PDF için içerik elementi bulunamadı.');
    }

    // 1. Locate the best target element for export
    const target = containerElement.querySelector('.pdf-pages-container') ||
                   containerElement.querySelector('.pdf-report-container') ||
                   containerElement.querySelector('.print-body') ||
                   containerElement;

    // 2. Find any scrollable parent and temporarily reset scroll to 0 for exact canvas capture
    let scrollParent = null;
    let originalScrollTop = 0;
    let curr = target.parentElement;
    while (curr && curr !== document.body) {
        const overflow = window.getComputedStyle(curr).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
            scrollParent = curr;
            originalScrollTop = curr.scrollTop;
            curr.scrollTop = 0;
            break;
        }
        curr = curr.parentElement;
    }

    // 3. Mark elements with clean export class to hide badges/shadows and normalize gaps
    const layoutWrapper = target.closest('.pdf-viewer-layout') || target;
    layoutWrapper.classList.add('is-pdf-exporting');
    target.classList.add('is-pdf-exporting');

    // Also hide badges and buttons directly just to be 100% resilient
    const hiddenElements = target.querySelectorAll('.pdf-page-header-badge, .pdf-actions-bar, .web-print-toolbar, button');
    hiddenElements.forEach(el => {
        el.dataset.prevDisplay = el.style.display;
        el.style.display = 'none';
    });

    try {
        // Small tick to allow browser to repaint layout without badges/shadows
        await new Promise(r => setTimeout(r, 60));

        const opt = {
            margin: 0, // 0 margin ensures 1:1 exact match with 210mm x 297mm A4 geometry
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2, // High resolution for razor-sharp typography and crisp table borders
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollY: 0,
                scrollX: 0
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: isLandscape ? 'landscape' : 'portrait'
            },
            pagebreak: {
                mode: ['css', 'legacy']
            }
        };

        await html2pdf().set(opt).from(target).save();
    } finally {
        // 4. Restore original state
        layoutWrapper.classList.remove('is-pdf-exporting');
        target.classList.remove('is-pdf-exporting');

        hiddenElements.forEach(el => {
            el.style.display = el.dataset.prevDisplay || '';
            delete el.dataset.prevDisplay;
        });

        if (scrollParent) {
            scrollParent.scrollTop = originalScrollTop;
        }
    }
}
