// Re-export FormTextarea from shared package for backward compatibility
// The client used "FormText" name, so we alias it
// New code should import FormTextarea directly from @green-goods/shared/components
import { FormTextarea } from "@green-goods/shared";
export type { FormTextareaProps as FormTextProps } from "@green-goods/shared";
export { FormTextarea as FormText };
