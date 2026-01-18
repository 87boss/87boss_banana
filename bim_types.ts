export interface Dimensions {
    width: number; // in meters
    height: number; // in meters
    depth?: number; // in meters
    area?: number; // in square meters (optional, can be calculated)
}

export interface MaterialInfo {
    name: string;
    description?: string;
    estimatedCostPerUnit?: number;  // TWD
}

export type SurfaceType = 'wall' | 'floor' | 'ceiling' | 'window' | 'door' | 'partition';

export interface Surface {
    id: string;
    type: SurfaceType;
    material: MaterialInfo;
    dimensions: Dimensions;
    position?: string; // e.g., "North Wall", "Near Entrance"
}

export interface Furniture {
    id: string;
    name: string;
    category: string; // e.g., "Seating", "Storage", "Lighting"
    dimensions?: Dimensions;
    position?: string;
    material?: string;
    estimatedPrice?: number;
}

export interface QuotationItem {
    id: string;
    category: string; // e.g., "Mudwork", "Carpentry", "Painting", "Electrical"
    item: string;
    description: string;
    quantity: number;
    unit: string; // "m2", "ping", "set", "式"
    unitPrice: number;
    totalPrice: number;
}

export interface SpaceInfo {
    roomType: string;
    dimensions: Dimensions; // Overall room dimensions
    designStyle: string;
}

// Root object for the Gemini Vision Analysis
export interface BIMData {
    space: SpaceInfo;
    surfaces: Surface[];
    furniture: Furniture[];
    estimatedQuotation: QuotationItem[];
    totalEstimatedBudget: number;
    usageAnalysis: string; // Short description of how the space is used
}
