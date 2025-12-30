const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure PDFs directory exists
const PDFS_DIR = path.join(__dirname, '../../pdfs');
if (!fs.existsSync(PDFS_DIR)) {
  fs.mkdirSync(PDFS_DIR, { recursive: true });
  console.log('Created PDFs directory:', PDFS_DIR);
}

/**
 * Generate QR code and PDF for a delivery
 * @param {Object} delivery - Delivery object with trackingCode and other details
 * @param {Object} sender - Sender user object
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generateDeliveryPDF(delivery, sender) {
  const trackingCode = delivery.trackingCode;
  const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const trackingUrl = `${publicUrl}/track/${trackingCode}`;

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 200,
    margin: 1
  });

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const fileName = `delivery-${trackingCode}-${Date.now()}.pdf`;
  const filePath = path.join(PDFS_DIR, fileName);
  
  // Create write stream
  const writeStream = fs.createWriteStream(filePath);
  
  // Pipe PDF to file
  doc.pipe(writeStream);

  // Header
  doc.fontSize(24)
     .fillColor('#C9A227')
     .text('Brillar Delivery', 50, 50, { align: 'center' });

  doc.fontSize(16)
     .fillColor('#000000')
     .text('Delivery Label', 50, 90, { align: 'center' });

  // QR Code
  const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
  doc.image(qrImageBuffer, 50, 130, { width: 150, height: 150 });
  
  doc.fontSize(10)
     .fillColor('#666666')
     .text('Scan to track delivery', 50, 290, { align: 'center', width: 150 });

  // Tracking Code
  doc.fontSize(20)
     .fillColor('#000000')
     .text(`Tracking Code: ${trackingCode}`, 50, 320, { align: 'center' });

  // Delivery Details
  let yPos = 380;
  doc.fontSize(12)
     .fillColor('#000000')
     .text('Delivery Details', 50, yPos, { underline: true });

  yPos += 30;
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Title: ${delivery.title}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Description: ${delivery.description}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Priority: ${delivery.priority}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Status: ${delivery.status}`, 50, yPos);

  // Receiver Information
  yPos += 40;
  doc.fontSize(12)
     .fillColor('#000000')
     .text('Receiver Information', 50, yPos, { underline: true });

  yPos += 30;
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Name: ${delivery.receiverName}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Phone: ${delivery.receiverPhone}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Address: ${delivery.destinationAddress}`, 50, yPos, { width: 450 });

  // Sender Information
  yPos += 40;
  doc.fontSize(12)
     .fillColor('#000000')
     .text('Sender Information', 50, yPos, { underline: true });

  yPos += 30;
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Name: ${sender.name}`, 50, yPos);
  
  yPos += 20;
  doc.text(`Email: ${sender.email}`, 50, yPos);

  // Footer
  const pageHeight = doc.page.height;
  doc.fontSize(8)
     .fillColor('#999999')
     .text(`Created: ${new Date(delivery.createdAt).toLocaleString()}`, 50, pageHeight - 50, { align: 'center' });
  
  doc.text(`Track at: ${trackingUrl}`, 50, pageHeight - 30, { align: 'center' });

  // Finalize PDF and wait for it to be written
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('PDF generated successfully:', fileName);
      resolve(fileName);
    });
    writeStream.on('error', (err) => {
      console.error('Write stream error:', err);
      reject(err);
    });
    doc.on('error', (err) => {
      console.error('PDF document error:', err);
      reject(err);
    });
    doc.end();
  });
}

/**
 * Get PDF file path
 * @param {string} fileName - PDF file name
 * @returns {string} - Full path to PDF file
 */
function getPDFPath(fileName) {
  return path.join(PDFS_DIR, fileName);
}

module.exports = {
  generateDeliveryPDF,
  getPDFPath,
  PDFS_DIR
};

