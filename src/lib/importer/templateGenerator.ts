import * as XLSX from "xlsx";

export const downloadSampleInventoryTemplate = (format: "xlsx" | "csv" = "xlsx") => {
  const headers = [
    "Product Name",
    "SKU",
    "Primary Category",
    "Subcategory",
    "Purchase Price",
    "Retail Price",
    "Discount",
    "Stock Units",
    "Min Stock Alert",
    "Global BarCode",
    "Batch Number",
    "Expiry Date",
    "Product Images",
    "MetaData",
  ];

  const sampleRows = [
    [
      "Panadol Extra 500mg (100 Tabs)",
      "MED-001",
      "Medicines",
      "Pain Relief",
      "115.00",
      "150.00",
      "0",
      "42",
      "10",
      "8901234567890",
      "LOT-9921A",
      "2027-12-31",
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300",
      '{"pack_size":"100 Tablets","strength":"500mg"}',
    ],
    [
      "Amoxicillin 500mg Capsules",
      "MED-002",
      "Medicines",
      "Antibiotics",
      "220.00",
      "280.00",
      "10%",
      "30",
      "15",
      "8901234567891",
      "LOT-8830B",
      "2026-11-30",
      "",
      '{"prescription_required":true}',
    ],
    [
      "Organic Honey 500g Jar",
      "GROC-101",
      "Grocery",
      "Organic Foods",
      "450.00",
      "600.00",
      "0",
      "25",
      "5",
      "8901234567892",
      "LOT-7740C",
      "2028-06-15",
      "",
      '{"weight":"500g","origin":"Northern Valleys"}',
    ],
  ];

  if (format === "csv") {
    let csv = headers.map((h) => `"${h}"`).join(",") + "\n";
    for (const r of sampleRows) {
      csv += r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n";
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "geflow_sample_inventory_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    // Set column widths
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Template");
    XLSX.writeFile(wb, "geflow_sample_inventory_template.xlsx");
  }
};
