import { pdfjs } from 'react-pdf'

const pdfWorkerUrl = new URL(
  '../../node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export { pdfjs }
