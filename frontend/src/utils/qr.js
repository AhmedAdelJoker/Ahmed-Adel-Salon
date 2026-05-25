import QRCode from "qrcode";

export const generatePublicQR = async (publicSlug) => {
  const url = `${window.location.origin}/${publicSlug}`;

  try {
    return await QRCode.toDataURL(url);
  } catch (e) {
    console.error("QR Error:", e);
    return "";
  }
};

export const getPublicUrl = (publicSlug) => {
  return `${window.location.origin}/${publicSlug}`;
};
