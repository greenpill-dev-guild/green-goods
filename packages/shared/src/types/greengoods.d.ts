/* eslint-disable */
/* biome-ignore format: generated file */

/**
 * Green Goods Global Type Definitions
 * 
 * These types are globally available across all packages.
 * Do not import them - they are automatically available.
 */

declare interface Link<T> {
	title: string;
	Icon: T;
	link: string;
	action?: () => void;
}

declare enum Capital {
	SOCIAL,
	MATERIAL,
	FINANCIAL,
	LIVING,
	INTELLECTUAL,
	EXPERIENTIAL,
	SPIRITUAL,
	CULTURAL,
}

// ============================================
// Gardener Types
// ============================================

declare interface GardenerCard {
	id: string; // Privy ID
	account?: string; // Smart Account Address
	username?: string | null; // Unique username
	email?: string;
	phone?: string;
	location?: string;
	avatar?: string | null;
	registeredAt: number;
}

// ============================================
// Garden Types - Single Source of Truth
// ============================================

declare interface GardenCard {
	id: string;
	name: string;
	location: string;
	bannerImage: string;
	operators: string[];
}

declare interface Garden extends GardenCard {
	chainId: number;
	tokenAddress: string;
	tokenID: bigint; // Canonical type: bigint
	description: string;
	createdAt: number;
	gardeners: string[];
	communityToken?: string;
	assessments: GardenAssessment[];
	works: Work[];
}

// ============================================
// Plant & Species Types
// ============================================

declare interface PlantInfo {
	genus: string;
	height: number;
	latitude: number;
	longitude: number;
	image: string;
}

declare interface SpeciesRegistry {
	trees: PlantInfo[];
	weeds: PlantInfo[];
}

// ============================================
// Assessment Types
// ============================================

declare interface GardenAssessment {
	id: string;
	authorAddress: string;
	gardenAddress: string;
	title: string;
	description: string;
	assessmentType: string;
	capitals: string[];
	metricsCid: string | null;
	metrics: Record<string, unknown> | null;
	evidenceMedia: string[];
	reportDocuments: string[];
	impactAttestations: string[];
	startDate: number | null;
	endDate: number | null;
	location: string;
	tags: string[];
	createdAt: number;
}

declare interface AssessmentDraft {
	title: string;
	description: string;
	assessmentType: string;
	capitals: string[];
	metrics: Record<string, any>;
	evidenceMedia: File[];
	reportDocuments: string[];
	impactAttestations: string[];
	startDate: number;
	endDate: number;
	location: string;
	tags: string[];
}

// ============================================
// Action Types
// ============================================

declare interface ActionCard {
	id: string;
	startTime: number;
	endTime: number;
	title: string;
	instructions?: string;
	capitals: Capital[];
	media: string[];
	createdAt: number;
}

declare interface Action extends ActionCard {
	description: string;
	inputs: WorkInput[];
	mediaInfo?: {
		title: string;
		description?: string;
		maxImageCount?: number;
		required?: boolean;
		minImageCount?: number;
		needed?: string[];
		optional?: string[];
	};
	details?: {
		title: string;
		description: string;
		feedbackPlaceholder: string;
	};
	review?: {
		title: string;
		description: string;
	};
}

declare interface WorkInput {
	key: string;
	title: string;
	placeholder: string;
	type: "text" | "textarea" | "select" | "number";
	required: boolean;
	options: string[];
}

// ============================================
// Work Types
// ============================================

declare interface WorkDraft {
	actionUID: number;
	title: string;
	plantSelection: string[];
	plantCount: number;
	feedback: string;
	media: File[];
}

declare interface WorkCard {
	id: string;
	title: string;
	actionUID: number;
	gardenerAddress: string;
	gardenAddress: string;
	feedback: string;
	metadata: string;
	media: string[];
	createdAt: number;
}

declare interface Work extends WorkCard {
	status: "pending" | "approved" | "rejected";
}

declare interface WorkMetadata {
	plantCount: number;
	plantSelection: string[];
}

// ============================================
// Work Approval Types
// ============================================

declare interface WorkApprovalDraft {
	actionUID: number;
	workUID: string;
	approved: boolean;
	feedback?: string;
}

declare interface WorkApproval extends WorkApprovalDraft {
	id: string;
	gardenerAddress: string;
	operatorAddress: string;
	createdAt: number;
}

// ============================================
// Action Instruction Types
// ============================================

declare interface ActionInstructionConfig {
	description: string;
	uiConfig: {
		media: {
			title: string;
			description: string;
			maxImageCount: number;
			minImageCount: number;
			required: boolean;
			needed: string[];
			optional: string[];
		};
		details: {
			title: string;
			description: string;
			feedbackPlaceholder: string;
			inputs: WorkInput[];
		};
		review: {
			title: string;
			description: string;
		};
	};
}
