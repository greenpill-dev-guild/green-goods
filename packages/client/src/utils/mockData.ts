export const mockCampaigns: any[] = [
  {
    id: "1",
    title: "Campaign 1",
    description: "Description 1",
    capitals: ["Cultural", "Intellectual", "Social"],
    created_at: "2021-08-01",
    team: ["afo-wefa.eth", "0xwildhare.eth"],
    details:
      "https://drive.google.com/file/d/10tHbt9sDKN1GdE2IQZ4Mu2c0YAQg56lr/view?usp=sharing",
    creator: "afo-wefa.eth",
    hypercertID: 1,
    end_date: "2021-08-31",
    start_date: "2021-08-01",
    logo: "https://source.unsplash.com/random/200x200",
    banner: "https://source.unsplash.com/random/800x200",
  },
  {
    id: "2",
    title: "Campaign 2",
    description: "Description 2",
    capitals: ["Cultural", "Intellectual", "Social"],
    created_at: "2021-08-01",
    team: ["afo-wefa.eth", "0xwildhare.eth"],
    details:
      "https://drive.google.com/file/d/10tHbt9sDKN1GdE2IQZ4Mu2c0YAQg56lr/view?usp=sharing",
    creator: "afo-wefa.eth",
    hypercertID: 2,
    end_date: "2021-08-31",
    start_date: "2021-08-01",
    logo: "https://source.unsplash.com/random/200x200",
    banner: "https://source.unsplash.com/random/800x200",
  },
  {
    id: "3",
    title: "Campaign 3",
    description: "Description 3",
    capitals: ["Cultural", "Intellectual", "Social"],
    created_at: "2021-08-01",
    team: ["afo-wefa.eth", "0xwildhare.eth"],
    details:
      "https://drive.google.com/file/d/10tHbt9sDKN1GdE2IQZ4Mu2c0YAQg56lr/view?usp=sharing",
    creator: "afo-wefa.eth",
    hypercertID: 3,
    end_date: "2021-08-31",
    start_date: "2021-08-01",
    logo: "https://source.unsplash.com/random/200x200",
    banner: "https://source.unsplash.com/random/800x200",
  },
];

export const mockContributions: any[] = [
  {
    id: "1",
    cammpaignAddrs: "0x123",
    title: "Contribution 1",
    description: "Description 1",
    value: 5,
    user: "afo-wefa.eth",
    capitals: ["Cultural", "Intellectual", "Social"],
    proof: [
      "https://bafybeif4rv4cjeuzx3daq5yqpjiy2y5dqgfl3pjlsnghzmsoaih35erpdu.ipfs.dweb.link/",
    ],
    created_at: "2021-08-01",
    status: "pending",
  },
  {
    id: "293",
    cammpaignAddrs: "0x123",
    title: "Contribution 2",
    description: "Description 2",
    value: 5,
    user: "afo-wefa.eth",
    capitals: ["Cultural", "Intellectual", "Social"],
    proof: [
      "https://bafybeif4rv4cjeuzx3daq5yqpjiy2y5dqgfl3pjlsnghzmsoaih35erpdu.ipfs.dweb.link/",
    ],
    created_at: "2021-08-01",
    status: "pending",
  },
  {
    id: "128",
    cammpaignAddrs: "0x123",
    title: "Contribution 3",
    description: "Description 3",
    value: 5,
    user: "afo-wefa.eth",
    capitals: ["Cultural", "Intellectual", "Social"],
    proof: [
      "https://bafybeif4rv4cjeuzx3daq5yqpjiy2y5dqgfl3pjlsnghzmsoaih35erpdu.ipfs.dweb.link/",
    ],
    created_at: "2021-08-01",
    status: "pending",
  },
];

export const mockConfirmations: any[] = [
  {
    id: "1",
    contributionID: "128",
    attester: "0x123",
    approval: true,
    created_at: "2021-08-01",
    feedback: "Good job",
  },
  {
    id: "2",
    contributionID: "293",
    attester: "0x123",
    approval: true,
    created_at: "2021-08-01",
    feedback: "Good joob",
  },
  {
    id: "3",
    contributionID: "163",
    attester: "0x123",
    approval: false,
    created_at: "2021-08-01",
    feedback: "Bad job",
  },
];
