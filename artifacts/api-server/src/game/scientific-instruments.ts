import type { ScientificInstrument } from "@workspace/api-zod";

// Game-balance values supplied for Mission: Infinity, not manufacturer offers.
export const scientificInstruments: ScientificInstrument[] = [
  { id: "panchromatic-camera", name: "Panchromatic Camera", price: 2000000, massKg: 3, powerW: 12, quality: 60, maxSciencePoints: 100,
    description: "Records detailed images of the lunar surface across a broad range of visible light.", scientificPurpose: "Document terrain, craters, and the landing site." },
  { id: "multispectral-camera", name: "Multispectral Camera", price: 5000000, massKg: 5, powerW: 20, quality: 75, maxSciencePoints: 180,
    description: "Captures images in several wavelength bands.", scientificPurpose: "Identify minerals and differences in surface composition." },
  { id: "lunar-magnetometer", name: "Lunar Magnetometer", price: 3000000, massKg: 2, powerW: 5, quality: 70, maxSciencePoints: 130,
    description: "Measures the strength and direction of the local magnetic field.", scientificPurpose: "Investigate the magnetism of lunar rocks." },
  { id: "radiation-detector", name: "Radiation Detector", price: 4000000, massKg: 3, powerW: 8, quality: 80, maxSciencePoints: 160,
    description: "Detects ionizing radiation reaching the surface.", scientificPurpose: "Analyze the Moon's radiation environment." },
  { id: "lunar-spectrometer", name: "Lunar Spectrometer", price: 8000000, massKg: 8, powerW: 25, quality: 85, maxSciencePoints: 250,
    description: "Analyzes the spectrum of radiation reflected or emitted by materials.", scientificPurpose: "Study the mineral composition of the surface." },
  { id: "subsurface-radar", name: "Subsurface Radar", price: 12000000, massKg: 15, powerW: 60, quality: 90, maxSciencePoints: 320,
    description: "Transmits radar waves and analyzes echoes from beneath the surface.", scientificPurpose: "Investigate regolith layers and subsurface structures." },
  { id: "advanced-sample-analyzer", name: "Advanced Sample Analyzer", price: 15000000, massKg: 12, powerW: 45, quality: 95, maxSciencePoints: 400,
    description: "Performs chemical and mineralogical analysis of collected samples.", scientificPurpose: "Obtain detailed information about lunar material." },
];
