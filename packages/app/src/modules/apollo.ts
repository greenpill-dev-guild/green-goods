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
export const campaignsQuery = gql`
  query Campaigns {
    campaigns {
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

// {
//   "where": {
//     "attester" : {
//       "equals": "user"
//     },
//     },
//     "schemaId" : {
//       "equals": "contribution"
//     }
//   }
export const userContributionsQuery = gql`
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
//     "recipient" : {
//       "equals": "user"
//     }
//     },
//     "schemaId" : {
//       "equals": "confirmation"
//     }
//   }
export const userConfirmationsQuery = gql`
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
