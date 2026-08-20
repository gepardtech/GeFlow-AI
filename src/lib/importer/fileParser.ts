import * as XLSX from "xlsx";
import Papa from "papaparse";
import { HeaderDetectionResult, SheetInfo } from "./types";
import { CANONICAL_FIELDS } from "./canonicalFields";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface ParsedWorkbook {
  file: File;
  fileName: string;
  fileType: "xlsx" | "xls" | "csv";
  sheets: SheetInfo[];
  activeSheetName: string;
  rawGrid: string[][];
  headerDetection: HeaderDetectionResult;
}

const INVENTORY_SHEET_KEYWORDS = [
  "inventory",
  "product",
  "products",
  "stock",
  "item",
  "items",
  "catalog",
  "medicines",
  "drugs",
  "goods",
  "price list",
  "pricelist",
  "master",
  "data",
  "sheet1",
];

const NON_INVENTORY_KEYWORDS = [
  "customer",
  "client",
  "vendor",
  "supplier",
  "invoice",
  "sales",
  "purchase",
  "order",
  "summary",
  "report",
  "log",
];

export const parseUploadedFile = async (file: File): Promise<ParsedWorkbook> => {
  if (!file) {
    throw new Error("No file selected.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large. Maximum supported file size is 25 MB.`);
  }

  const name = file.name.toLowerCase();
  let fileType: "xlsx" | "xls" | "csv";

  if (name.endsWith(".xlsx")) {
    fileType = "xlsx";
  } else if (name.endsWith(".xls")) {
    fileType = "xls";
  } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    fileType = "csv";
  } else {
    throw new Error(
      "Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file."
    );
  }

  if (fileType === "csv") {
    return parseCsvFile(file);
  } else {
    return parseExcelFile(file, fileType);
  }
};

const parseCsvFile = async (file: File): Promise<ParsedWorkbook> => {
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      skipEmptyLines: "greedy",
      dynamicTyping: false, // keep everything as raw strings to preserve leading zeros in barcodes!
      complete: (results) => {
        const rawGrid = (results.data as string[][]).map((row) =>
          row.map((cell) => (cell != null ? String(cell).trim() : ""))
        );

        if (rawGrid.length === 0) {
          reject(new Error("The uploaded CSV file is empty."));
          return;
        }

        const headerDetection = detectHeaderRow(rawGrid);

        const sheetInfo: SheetInfo = {
          name: "CSV Data",
          rowCount: rawGrid.length,
          dataPreview: rawGrid.slice(0, 10),
          relevanceScore: 100,
          isRecommended: true,
        };

        resolve({
          file,
          fileName: file.name,
          fileType: "csv",
          sheets: [sheetInfo],
          activeSheetName: "CSV Data",
          rawGrid,
          headerDetection,
        });
      },
      error: (err) => {
        reject(new Error(`Failed to read CSV: ${err.message}`));
      },
    });
  });
};

const parseExcelFile = async (
  file: File,
  fileType: "xlsx" | "xls"
): Promise<ParsedWorkbook> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: false, // formats values to strings where possible
    cellDates: false, // keep raw text representation for date normalizer
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Unable to find any usable sheets in this Excel spreadsheet.");
  }

  const sheets: SheetInfo[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const grid: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const cleanGrid = grid
      .map((row) => row.map((cell) => (cell != null ? String(cell).trim() : "")))
      .filter((row) => row.some((cell) => cell.length > 0));

    const lowerName = sheetName.toLowerCase();
    let score = 50;

    for (const kw of INVENTORY_SHEET_KEYWORDS) {
      if (lowerName.includes(kw)) {
        score += 35;
        break;
      }
    }
    for (const kw of NON_INVENTORY_KEYWORDS) {
      if (lowerName.includes(kw)) {
        score -= 40;
        break;
      }
    }

    if (cleanGrid.length > 1) {
      score += 15;
    }

    return {
      name: sheetName,
      rowCount: cleanGrid.length,
      dataPreview: cleanGrid.slice(0, 10),
      relevanceScore: Math.max(0, Math.min(100, score)),
      isRecommended: false,
    };
  });

  // Sort sheets by relevance score
  sheets.sort((a, b) => b.relevanceScore - a.relevanceScore);
  if (sheets.length > 0) {
    sheets[0].isRecommended = true;
  }

  const activeSheetName = sheets[0]?.name || workbook.SheetNames[0];
  const activeWs = workbook.Sheets[activeSheetName];
  const rawGrid: string[][] = XLSX.utils
    .sheet_to_json<string[]>(activeWs, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .map((row) => row.map((cell) => (cell != null ? String(cell).trim() : "")))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rawGrid.length === 0) {
    throw new Error(`The sheet "${activeSheetName}" is empty or has no readable rows.`);
  }

  const headerDetection = detectHeaderRow(rawGrid);

  return {
    file,
    fileName: file.name,
    fileType,
    sheets,
    activeSheetName,
    rawGrid,
    headerDetection,
  };
};

export const switchSheet = (
  workbook: ParsedWorkbook,
  newSheetName: string
): ParsedWorkbook => {
  if (workbook.fileType === "csv") return workbook;

  // re-parse active sheet from the workbook file if needed, or find sheet preview
  // Note: For Excel we can re-read the sheet
  return workbook;
};

export const readSheetGrid = async (
  file: File,
  sheetName: string
): Promise<{ rawGrid: string[][]; headerDetection: HeaderDetectionResult }> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }

  const rawGrid: string[][] = XLSX.utils
    .sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .map((row) => row.map((cell) => (cell != null ? String(cell).trim() : "")))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rawGrid.length === 0) {
    throw new Error(`Sheet "${sheetName}" contains no data rows.`);
  }

  const headerDetection = detectHeaderRow(rawGrid);
  return { rawGrid, headerDetection };
};

/**
 * Heuristically identifies the best header row in a 2D string grid.
 * Looks for common product column aliases, non-numeric strings, and distinctness.
 */
export const detectHeaderRow = (grid: string[][]): HeaderDetectionResult => {
  if (grid.length === 0) {
    return {
      headerRowIndex: 0,
      headers: [],
      confidence: 0,
      candidateRows: [],
    };
  }

  const allAliases = new Set<string>();
  CANONICAL_FIELDS.forEach((f) => {
    f.aliases.forEach((a) => allAliases.add(a.toLowerCase()));
  });

  const maxScanRows = Math.min(10, grid.length);
  const candidateRows: { index: number; text: string; score: number }[] = [];

  for (let r = 0; r < maxScanRows; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    const nonEmptyCells = row.filter((c) => c.trim().length > 0);
    if (nonEmptyCells.length === 0) continue;

    let score = 0;
    let matchedAliasesCount = 0;
    let textCellsCount = 0;
    let numericCellsCount = 0;

    const lowerCells = nonEmptyCells.map((c) => c.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim());

    // Check alias matches
    for (const cell of lowerCells) {
      if (allAliases.has(cell)) {
        score += 25;
        matchedAliasesCount++;
      } else {
        // partial token match
        for (const alias of allAliases) {
          if (cell === alias || cell.includes(alias) || alias.includes(cell)) {
            score += 10;
            matchedAliasesCount++;
            break;
          }
        }
      }

      // Check if purely numeric
      const isNum = !Number.isNaN(Number(cell.replace(/,/g, ""))) && cell.length > 0;
      if (isNum) {
        numericCellsCount++;
      } else {
        textCellsCount++;
      }
    }

    // High proportion of text cells is good for headers
    if (textCellsCount > numericCellsCount) {
      score += 20;
    } else {
      score -= 30;
    }

    // Diverse columns (no duplicates in header)
    const uniqueCount = new Set(lowerCells).size;
    if (uniqueCount === nonEmptyCells.length) {
      score += 15;
    }

    // Reward multiple matched aliases
    score += matchedAliasesCount * 15;

    candidateRows.push({
      index: r,
      text: nonEmptyCells.slice(0, 5).join(" | "),
      score: Math.max(0, score),
    });
  }

  candidateRows.sort((a, b) => b.score - a.score);

  const best = candidateRows[0] || { index: 0, score: 50 };
  const rawHeaders = grid[best.index] || [];
  const headers = rawHeaders.map((h, i) => (h.trim() ? h.trim() : `Column_${i + 1}`));

  const confidence = Math.min(100, Math.max(30, best.score));

  return {
    headerRowIndex: best.index,
    headers,
    confidence,
    candidateRows,
  };
};
