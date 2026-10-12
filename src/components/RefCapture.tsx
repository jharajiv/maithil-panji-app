"use client";
import { useEffect } from "react";
import { captureRef } from "@/lib/invite";

/** remembers an invitation code (?ref=…) from the link that brought the visitor here; shows nothing */
export function RefCapture() {
  useEffect(() => { captureRef(window.location.search); }, []);
  return null;
}
