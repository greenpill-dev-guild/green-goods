import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

export const contractClient = new ApolloClient({
  uri: "https://flyby-router-demo.herokuapp.com/",
  cache: new InMemoryCache(),
});

export const attestationClient = new ApolloClient({
  uri: "https://sepolia.easscan.org/graphql", // https://base.easscan.org/graphql
  cache: new InMemoryCache(),
});

// MOBILE

//   "where": {
//     "creator" : {
//       "equals": "user"
//     },
//   }
export const campaignsQuery = gql`
  query Campaigns($where: AttestationWhereInput) {
    campaigns(where: $where) {
      id
      account
      creator
      hypercert_id
      capitals
      metadata
      created_at
    }
  }
`;

//   "where": {
//     "recipient" : {
//       "equals": "campaign"
//     },
//     },
//     "schemaId" : {
//       "equals": "contribution"
//     }
//   }
export const campaignContributionsQuery = gql`
  query UserContributions($where: AttestationWhereInput) {
    attestations(where: $where) {
      id
      attester
      schemaId
      recipient
      timeCreated
      decodedDataJson
    }
  }
`;

//   "where": {
//     "schemaId" : {
//       "equals": "confirmation"
//     }
//   }
export const confirmationsQuery = gql`
  query UserContributions($where: AttestationWhereInput) {
    attestations(where: $where) {
      id
      attester
      schemaId
      recipient
      timeCreated
      decodedDataJson
    }
  }
`;

//   "where": {
//     "decodedDataJson" : {
//       "contains": "campaign"
//     }
//     },
//     "schemaId" : {
//       "equals": "confirmation"
//     }
//   }
export const campaignConfirmationsQuery = gql`
  query UserContributions($where: AttestationWhereInput) {
    attestations(where: $where) {
      id
      attester
      schemaId
      recipient
      timeCreated
      decodedDataJson
    }
  }
`;
