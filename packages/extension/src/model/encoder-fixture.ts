import fixture from "./encoder-fixture.json";

// SYNTHETIC fixture for the encoder measurement: 40 invented requirements and 120 invented document
// sections of about 200 words. Each requirement has exactly one section written to satisfy it and
// two same-topic sections written not to. No real garden, person, project or review appears.

export interface EncoderFixture {
  synthetic: true;
  note: string;
  requirements: Array<{ id: string; text: string; satisfiedBy: string }>;
  sections: Array<{ id: string; text: string }>;
  sanitySample: { queries: string[]; documents: string[] };
}

export const ENCODER_FIXTURE = fixture as EncoderFixture;

export function correctSectionIndexes(data: EncoderFixture = ENCODER_FIXTURE): number[] {
  const index = new Map(data.sections.map((section, i) => [section.id, i]));
  return data.requirements.map((requirement) => {
    const found = index.get(requirement.satisfiedBy);
    if (found === undefined) throw new Error(`${requirement.id} points at a missing section ${requirement.satisfiedBy}`);
    return found;
  });
}
