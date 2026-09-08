/**
 * Native Thermal Printer Bridge
 * Supports: WebUSB (browser), Electron IPC, TAURI commands
 * Falls back to browser print if no native bridge available
 */

// ============================================================
// Types
// ============================================================

/** @typedef {{ vendorId: number, productId: number, interfaceNumber?: number, endpointOut?: number }} USBPrinterConfig */

interface USBPrinterConfig {
  vendorId: number;
  productId: number;
  interfaceNumber?: number;
  endpointOut?: number;
}

interface PrinterBridgeConfig {
  type: 'webusb' | 'electron' | 'tauri' | 'browser';
  config?: USBPrinterConfig | USBPrinterConfig[];
}

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  barber?: string;
}

interface ReceiptData {
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  createdAt: string;
  paymentMethod: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  footer: string;
  qrDataUrl: string;
  widthMm: 80 | 58;
  kickDrawer?: boolean;
  logoUrl?: string;
  [key: string]: unknown;
}

interface ReceiptBuildOptions {
  widthMm?: number;
  codepage?: string;
  cutPaper?: boolean;
  kickDrawer?: boolean;
  includeQR?: boolean;
}

/** @typedef {{
 *   invoiceId: string,
 *   invoiceNo: string,
 *   customerName: string,
 *   createdAt: string,
 *   paymentMethod: string,
 *   items: Array<{ name: string; qty: number; price: number; barber?: string }>,
 *   subtotal: number,
 *   discount: number,
 *   total: number,
 *   shopName: string,
 *   shopPhone: string,
 *   shopAddress: string,
 *   footer: string,
 *   qrDataUrl: string,
 *   widthMm: 80 | 58
 * }} ReceiptData */

// ============================================================
// ESC/POS Commands
// ============================================================

const ESC_POS = {
  // Initialization
  INIT: new Uint8Array([0x1b, 0x40]),

  // Text formatting
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([0x1b, 0x2d, 0x01]),
  UNDERLINE_OFF: new Uint8Array([0x1b, 0x2d, 0x00]),
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
  FONT_SIZE_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]),
  FONT_SIZE_LARGE: new Uint8Array([0x1d, 0x21, 0x11]),
  FONT_SIZE_XL: new Uint8Array([0x1d, 0x21, 0x22]),

  // Line feed
  LF: new Uint8Array([0x0a]),
  CR: new Uint8Array([0x0d]),
  FEED_LINES: (n: number) => new Uint8Array([0x1b, 0x64, n]),

  // Cut paper
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),

  // Cash drawer
  KICK_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),

  // Barcode/QR
  QR_CODE: (data: string) => {
    const bytes = new TextEncoder().encode(data);
    const len = bytes.length + 3;
    const cmd = new Uint8Array([
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    ]);
    const dataCmd = new Uint8Array([
      0x1d,
      0x28,
      0x6b,
      len & 0xff,
      (len >> 8) & 0xff,
      0x31,
      0x50,
      0x30,
    ]);
    const endCmd = new Uint8Array([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ]);
    return [cmd, dataCmd, bytes, endCmd];
  },

  // Arabic shaping (requires printer with Arabic support)
  // For printers without Arabic: pre-shape text using arabic-reshaper
  SET_CODEPAGE_ARABIC: new Uint8Array([0x1b, 0x74, 0x0f]), // Code page 15 (Arabic)
  SET_CODEPAGE_UTF8: new Uint8Array([0x1b, 0x74, 0x13]), // Code page 19 (UTF-8)
};

// ============================================================
// Text Encoding Helpers
// ============================================================

function encodeText(text: string, codepage = "utf8"): Uint8Array {
  if (codepage === "utf8") {
    return new TextEncoder().encode(text);
  }
  // For legacy codepages, you'd need a proper encoder
  return new TextEncoder().encode(text);
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================
// Receipt Builder
// ============================================================

function buildReceiptESCPOS(data: ReceiptData, options: ReceiptBuildOptions = {}): Uint8Array {
  const {
    widthMm = 80,
    codepage = "utf8",
    cutPaper = true,
    kickDrawer = false,
    includeQR = true,
  } = options;

  const cols = widthMm === 58 ? 32 : 42;
  const commands: Uint8Array[] = [];

  // Initialize
  commands.push(ESC_POS.INIT);
  commands.push(ESC_POS.SET_CODEPAGE_UTF8);
  commands.push(ESC_POS.ALIGN_CENTER);

  // Logo placeholder (if printer supports graphics)
  // commands.push(...printLogo());

  // Shop name
  commands.push(ESC_POS.FONT_SIZE_XL);
  commands.push(ESC_POS.BOLD_ON);
  commands.push(encodeText(data.shopName + "\n", codepage));
  commands.push(ESC_POS.FONT_SIZE_NORMAL);
  commands.push(ESC_POS.BOLD_OFF);

  // Shop info
  if (data.shopPhone)
    commands.push(encodeText(`ت: ${data.shopPhone}\n`, codepage));
  if (data.shopAddress)
    commands.push(encodeText(`${data.shopAddress}\n`, codepage));
  commands.push(ESC_POS.LF);

  // Divider
  commands.push(encodeText("=".repeat(cols) + "\n", codepage));

  // Receipt title
  commands.push(ESC_POS.BOLD_ON);
  commands.push(encodeText("إيصال مبيعات\n", codepage));
  commands.push(ESC_POS.BOLD_OFF);
  commands.push(ESC_POS.LF);

  // Meta section
  commands.push(ESC_POS.ALIGN_RIGHT);
  commands.push(encodeText(`رقم الفاتورة: #${data.invoiceNo}\n`, codepage));
  commands.push(encodeText(`التاريخ: ${data.createdAt}\n`, codepage));
  commands.push(encodeText(`العميل: ${data.customerName}\n`, codepage));

  const paymentLabels: Record<string, string> = {
    cash: "نقدي",
    card: "شبكة",
    visa: "فيزا",
    mada: "مدى",
    wallet: "محفظة",
    instapay: "انستا باي",
  };
  commands.push(
    encodeText(
      `الدفع: ${paymentLabels[data.paymentMethod] || data.paymentMethod}\n`,
      codepage,
    ),
  );
  commands.push(ESC_POS.LF);

  // Items table header
  commands.push(
    encodeText(
      "الصنف".padEnd(22) + "ك".padStart(3) + "الإجمالي".padStart(12) + "\n",
      codepage,
    ),
  );
  commands.push(encodeText("-".repeat(cols) + "\n", codepage));

  // Items
  for (const item of data.items) {
    const name =
      item.name.length > 20 ? item.name.substring(0, 20) + ".." : item.name;
    const barber = item.barber ? ` (${item.barber})` : "";
    const line1 = name + barber;
    const qty = String(item.qty).padStart(3);
    const total = formatCurrencyESC(item.price).padStart(12);
    commands.push(encodeText(`${line1.padEnd(22)}${qty}${total}\n`, codepage));
  }

  commands.push(encodeText("-".repeat(cols) + "\n", codepage));

  // Totals
  commands.push(ESC_POS.ALIGN_RIGHT);
  commands.push(
    encodeText(
      `المجموع الفرعي: ${formatCurrencyESC(data.subtotal)}\n`,
      codepage,
    ),
  );
  if (data.discount > 0) {
    commands.push(
      encodeText(`الخصم: -${formatCurrencyESC(data.discount)}\n`, codepage),
    );
  }
  commands.push(ESC_POS.BOLD_ON);
  commands.push(ESC_POS.FONT_SIZE_LARGE);
  commands.push(
    encodeText(`الإجمالي: ${formatCurrencyESC(data.total)}\n`, codepage),
  );
  commands.push(ESC_POS.FONT_SIZE_NORMAL);
  commands.push(ESC_POS.BOLD_OFF);
  commands.push(ESC_POS.LF);

  // QR Code
  if (includeQR && data.qrDataUrl) {
    // Note: QR from dataURL needs to be converted to raw bytes for ESC/POS
    // This is a simplified version - real implementation would decode the dataURL
    commands.push(ESC_POS.ALIGN_CENTER);
    commands.push(encodeText("[QR Code - امسح للتقييم]\n", codepage));
    commands.push(ESC_POS.LF);
  }

  // Footer
  commands.push(encodeText(data.footer + "\n", codepage));
  commands.push(encodeText("شكراً لزيارتكم\n", codepage));
  commands.push(ESC_POS.LF);
  commands.push(ESC_POS.LF);

  // Cut paper
  if (cutPaper) {
    commands.push(ESC_POS.CUT_PARTIAL);
  }

  // Kick drawer
  if (kickDrawer) {
    commands.push(ESC_POS.KICK_DRAWER);
  }

  return concatUint8Arrays(...commands);
}

function formatCurrencyESC(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(typeof value === "number" ? value : (value ? parseFloat(String(value)) : 0));
}

// ============================================================
// WebUSB Bridge
// ============================================================

class WebUSBPrinter {
  device: any = null;
  endpointOut: any = null;
  constructor() {
    this.device = null;
    this.endpointOut = null;
  }

  async requestDevice(filters: any[] = []): Promise<any> {
    if (!(navigator as any).usb) {
      throw new Error("WebUSB غير مدعوم في هذا المتصفح. استخدم Chrome/Edge.");
    }

    const defaultFilters = [
      { vendorId: 0x0416 }, // Epson
      { vendorId: 0x04b8 }, // Epson
      { vendorId: 0x0519 }, // Star Micronics
      { vendorId: 0x1fc9 }, // NCR
      { vendorId: 0x0dd4 }, // Custom
      { vendorId: 0x1504 }, // Bixolon
    ];

    this.device = await (navigator as any).usb.requestDevice({
      filters: filters.length > 0 ? filters : defaultFilters,
    });

    await this.device.open();
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

    // Claim interface 0 (usually the printing interface)
    await this.device.claimInterface(0);

    // Find OUT endpoint
    const usbInterface = this.device.configuration.interfaces[0];
    this.endpointOut = usbInterface.alternate.endpoints.find(
      (ep: any) => ep.direction === "out" && ep.type === "bulk",
    );

    if (!this.endpointOut) {
      throw new Error("لم يتم العثور على نقطة إخراج USB للطباعة");
    }

    return this.device;
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.device || !this.endpointOut) {
      throw new Error("الطابعة غير متصلة. استخدم requestDevice() أولاً.");
    }

    await this.device.transferOut(this.endpointOut.endpointNumber, data);
  }

  async close(): Promise<void> {
    if (this.device) {
      try {
        await this.device.releaseInterface(0);
        await this.device.close();
      } catch (e) {
        console.warn("Error closing USB device:", e);
      }
      this.device = null;
      this.endpointOut = null;
    }
  }
}

// ============================================================
// Electron Bridge (for desktop app)
// ============================================================

class ElectronPrinter {
  isElectron: unknown;
  constructor() {
    this.isElectron = typeof window !== "undefined" && (window as any).electronAPI;
  }

  async print(data: unknown): Promise<unknown> {
    if (!this.isElectron) {
      throw new Error("ليس في بيئة Electron");
    }

    return await (window as any).electronAPI.printReceipt(data);
  }

  async listPrinters(): Promise<unknown[]> {
    if (!this.isElectron) return [];
    return await (window as any).electronAPI.listPrinters();
  }
}

// ============================================================
// TAURI Bridge (for desktop app)
// ============================================================

class TauriPrinter {
  isTauri: unknown;
  constructor() {
    this.isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
  }

  async print(data: unknown): Promise<unknown> {
    if (!this.isTauri) {
      throw new Error("ليس في بيئة TAURI");
    }

    const { invoke } = (window as any).__TAURI__.core;
    return await invoke("print_receipt", { receiptData: data });
  }

  async listPrinters(): Promise<unknown[]> {
    if (!this.isTauri) return [];
    const { invoke } = (window as any).__TAURI__.core;
    return await invoke("list_printers");
  }
}

// ============================================================
// Browser Print Fallback
// ============================================================

async function printViaBrowser(receiptData: ReceiptData): Promise<void> {
  // Use the existing printThermalReceipt from receipt.ts
  const { printThermalReceipt } = await import("@/lib/print/receipt");

  // Convert receiptData to invoice format expected by printThermalReceipt
  const invoice = {
    invoice_no: receiptData.invoiceNo,
    invoice_id: receiptData.invoiceId,
    customer_name: receiptData.customerName,
    created_at: receiptData.createdAt,
    payment_method: receiptData.paymentMethod,
    items: receiptData.items.map((item) => ({
      service_name: item.name,
      quantity: item.qty,
      total_price: item.price,
      barber_name: item.barber,
    })),
    subtotal_amount: receiptData.subtotal,
    discount_amount: receiptData.discount,
    total_amount: receiptData.total,
  };

  const settings = {
    salon_name: receiptData.shopName,
    shop_phone: receiptData.shopPhone,
    shop_address: receiptData.shopAddress,
    receipt_footer: receiptData.footer,
    logo_url: receiptData.logoUrl,
  };

  await printThermalReceipt(invoice, settings);
}

// ============================================================
// Unified Printer Manager
// ============================================================

class ThermalPrinterManager {
  webusb: WebUSBPrinter;
  electron: ElectronPrinter;
  tauri: TauriPrinter;
  currentBridge: any;
  currentConfig: PrinterBridgeConfig | null;
  constructor() {
    this.webusb = new WebUSBPrinter();
    this.electron = new ElectronPrinter();
    this.tauri = new TauriPrinter();
    this.currentBridge = null;
    this.currentConfig = null;
  }

  async detectAvailableBridges(): Promise<string[]> {
    const bridges: string[] = [];

    if ((navigator as any).usb) bridges.push("webusb");
    if (this.electron.isElectron) bridges.push("electron");
    if (this.tauri.isTauri) bridges.push("tauri");
    bridges.push("browser"); // Always available

    return bridges;
  }

  async connect(config: PrinterBridgeConfig): Promise<boolean> {
    this.currentConfig = config;

    switch (config.type) {
      case "webusb": {
        const filters: any[] = config.config ? (Array.isArray(config.config) ? config.config : [config.config]) : [];
        await this.webusb.requestDevice(filters);
        this.currentBridge = this.webusb;
        break;
      }
      case "electron":
        this.currentBridge = this.electron;
        break;
      case "tauri":
        this.currentBridge = this.tauri;
        break;
      case "browser":
        this.currentBridge = null; // Uses fallback
        break;
      default:
        throw new Error(`نوع طابعة غير مدعوم: ${config.type}`);
    }

    return true;
  }

  async print(receiptData: ReceiptData): Promise<void> {
    const escposData = buildReceiptESCPOS(receiptData, {
      widthMm: receiptData.widthMm || 80,
      cutPaper: true,
      kickDrawer: receiptData.kickDrawer || false,
    });

    if (this.currentBridge && this.currentConfig?.type !== "browser") {
      if (this.currentConfig?.type === "webusb") {
        await this.currentBridge.print(escposData);
      } else {
        await this.currentBridge.print(receiptData);
      }
    } else {
      // Browser fallback
      await printViaBrowser(receiptData);
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentBridge?.close) {
      await this.currentBridge.close();
    }
    this.currentBridge = null;
    this.currentConfig = null;
  }

  getBridgeType(): string | null {
    return this.currentConfig?.type || null;
  }

  isConnected(): boolean {
    return (
      this.currentBridge !== null || this.currentConfig?.type === "browser"
    );
  }
}

// Singleton instance
const thermalPrinter = new ThermalPrinterManager();

// ============================================================
// High-level API
// ============================================================

/**
 * Initialize printer connection
 * @param {PrinterBridgeConfig} config
 * @returns {Promise<boolean>}
 */
export async function initThermalPrinter(config: PrinterBridgeConfig): Promise<boolean> {
  return await thermalPrinter.connect(config);
}

/**
 * Print receipt using the connected printer
 * @param {ReceiptData} receiptData
 * @returns {Promise<void>}
 */
export async function printReceiptNative(receiptData: ReceiptData): Promise<void> {
  if (!thermalPrinter.isConnected()) {
    // Auto-detect and use browser fallback
    await thermalPrinter.connect({ type: "browser" });
  }
  return await thermalPrinter.print(receiptData);
}

/**
 * Disconnect from printer
 * @returns {Promise<void>}
 */
export async function disconnectThermalPrinter() {
  return await thermalPrinter.disconnect();
}

/**
 * Get available printer bridges
 * @returns {Promise<string[]>}
 */
export async function getAvailablePrinterBridges() {
  return await thermalPrinter.detectAvailableBridges();
}

/**
 * Build ESC/POS command buffer for raw printing
 * @param {ReceiptData} receiptData
 * @param {Object} options
 * @returns {Uint8Array}
 */
export function buildESCPOSCommands(receiptData: ReceiptData, options: ReceiptBuildOptions = {}): Uint8Array {
  return buildReceiptESCPOS(receiptData, options);
}

// ============================================================
// React Hook for easy integration
// ============================================================

import { useState, useCallback, useEffect } from "react";

export function useThermalPrinter() {
  const [bridgeType, setBridgeType] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [availableBridges, setAvailableBridges] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState<boolean>(false);

  useEffect(() => {
    thermalPrinter.detectAvailableBridges().then(setAvailableBridges);
  }, []);

  const connect = useCallback(async (config: PrinterBridgeConfig) => {
    setError(null);
    try {
      await thermalPrinter.connect(config);
      setBridgeType(config.type);
      setIsConnected(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setIsConnected(false);
      return false;
    }
  }, []);

  const print = useCallback(async (receiptData: ReceiptData) => {
    setError(null);
    setPrinting(true);
    try {
      await thermalPrinter.print(receiptData);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPrinting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await thermalPrinter.disconnect();
    setBridgeType(null);
    setIsConnected(false);
  }, []);

  return {
    bridgeType,
    isConnected,
    availableBridges,
    error,
    printing,
    connect,
    print,
    disconnect,
  };
}

export default thermalPrinter;
