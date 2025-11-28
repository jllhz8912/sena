export const PROGRAM_TYPES = [
  'Población Vulnerable',
  'Campesena',
  'Regular',
  'Articulación',
  'Otros'
] as const;

export type ProgramType = typeof PROGRAM_TYPES[number];

export const LOT_TYPES = [
  'Mecánica',
  'Agropecuaria',
  'Sistemas',
  'Actividad Física',
  'Alimentos',
  'Turismo',
  'Confecciones y Artesanías',
  'Ferretería',
  'FIC y Placa Huella',
  'Belleza',
  'Papelería',
  'Granja',
  'Química',
  'Fotovoltaico',
  'Área de Salud'
] as const;

export const UNIT_TYPES = [
  'Unidad (Und)',
  'Caja',
  'Paquete',
  'Litro (L)',
  'Mililitro (ml)',
  'Kilogramo (kg)',
  'Gramo (g)',
  'Metro (m)',
  'Centímetro (cm)',
  'Metro Cuadrado (m2)',
  'Metro Cúbico (m3)',
  'Rollo',
  'Galón',
  'Lata',
  'Bulto',
  'Juego/Kit',
  'Par',
  'Pliego',
  'Resma'
] as const;

export interface Material {
  id: string;
  unspscCode?: string; // Made optional per user request
  codeName: string;
  technicalDescription: string;
  unitOfMeasure: string;
  imageUrl?: string; // Base64 or URL
}

export interface TrainingRequest {
  id: string;
  instructorName: string;
  programType: ProgramType;
  lotType: string;
  trainingName: string;
  materials: Material[];
  createdAt: number;
}