/**
 * Core utility to parse PDF, DOCX, XLSX, and TXT files client-side.
 * Dynamically loads CDN versions of pdfjs, mammoth, and xlsx to avoid huge bundles.
 */

// Helper to inject a script tag dynamically
const loadScript = (id: string, src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

// Dynamically load PDF.js
const loadPdfJs = async (): Promise<any> => {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  await loadScript(
    "pdfjs-lib-cdn",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"
  );
  // Set up the worker
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
  return (window as any).pdfjsLib;
};

// Dynamically load Mammoth.js for docx
const loadMammoth = async (): Promise<any> => {
  if ((window as any).mammoth) {
    return (window as any).mammoth;
  }
  await loadScript(
    "mammoth-cdn",
    "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"
  );
  return (window as any).mammoth;
};

// Dynamically load SheetJS for xlsx
const loadXlsx = async (): Promise<any> => {
  if ((window as any).XLSX) {
    return (window as any).XLSX;
  }
  await loadScript(
    "xlsx-cdn",
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
  );
  return (window as any).XLSX;
};

// Format file sizes into human-readable strings
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export interface ParsedFile {
  name: string;
  type: "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "website" | "presentation" | "report";
  size: string;
  content: string;
}

export const parseFile = async (file: File): Promise<ParsedFile> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const sizeStr = formatFileSize(file.size);

  // Determine type matching store requirements
  let fileType: ParsedFile["type"] = "txt";
  if (extension === "pdf") fileType = "pdf";
  else if (extension === "docx") fileType = "docx";
  else if (extension === "xlsx" || extension === "xls" || extension === "csv") fileType = "xlsx";
  else if (extension === "pptx" || extension === "ppt") fileType = "pptx";

  // Parse based on extension
  if (fileType === "pdf") {
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        text += pageText + "\n";
      }

      const cleanText = text.replace(/\s+/g, " ").trim();
      if (!cleanText) {
        throw new Error("No text found in PDF (it might be scanned or image-only).");
      }

      return {
        name: file.name,
        type: "pdf",
        size: sizeStr,
        content: cleanText,
      };
    } catch (err: any) {
      throw new Error(`PDF Parsing Error: ${err.message || err}`);
    }
  }

  if (fileType === "docx") {
    try {
      const mammoth = await loadMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const cleanText = result.value.trim();
      if (!cleanText) {
        throw new Error("Document appears to be empty.");
      }
      return {
        name: file.name,
        type: "docx",
        size: sizeStr,
        content: cleanText,
      };
    } catch (err: any) {
      throw new Error(`Word Document Parsing Error: ${err.message || err}`);
    }
  }

  if (fileType === "xlsx") {
    try {
      const XLSX = await loadXlsx();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      let text = "";

      workbook.SheetNames.forEach((sheetName: string) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(worksheet);
        if (sheetText && sheetText.trim()) {
          text += `Sheet: ${sheetName}\n${sheetText}\n\n`;
        }
      });

      const cleanText = text.trim();
      if (!cleanText) {
        throw new Error("Spreadsheet appears to be empty.");
      }
      return {
        name: file.name,
        type: "xlsx",
        size: sizeStr,
        content: cleanText,
      };
    } catch (err: any) {
      throw new Error(`Spreadsheet Parsing Error: ${err.message || err}`);
    }
  }

  // Fallback / TXT / MD / JSON / etc.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      resolve({
        name: file.name,
        type: fileType,
        size: sizeStr,
        content: text.trim(),
      });
    };
    reader.onerror = () => {
      reject(new Error("Failed to read text file."));
    };
    reader.readAsText(file);
  });
};
