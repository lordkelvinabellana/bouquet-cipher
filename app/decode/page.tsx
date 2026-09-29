import type { Metadata } from "next";
import { DecodeEntry } from "@/screens/DecodeEntry";

export const metadata: Metadata = {
  title: "Decode a bouquet · Bouquet Cipher",
  description: "Open a bouquet with its QR code, its picture or its code, and read the message hidden in the flowers.",
};

export default function DecodePage() {
  return <DecodeEntry />;
}
