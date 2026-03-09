"use client";

import { useEffect } from "react";

const DENSITY_KEY = "forge-density";

export default function DensityBoot() {
  useEffect(() => {
    const stored = localStorage.getItem(DENSITY_KEY);
    const density = stored === "compact" ? "compact" : "comfortable";
    document.documentElement.setAttribute("data-density", density);
  }, []);

  return null;
}

