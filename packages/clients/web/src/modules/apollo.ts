import { ApolloClient, InMemoryCache } from "@apollo/client";

export const contractClient = new ApolloClient({
  uri: "https://flyby-router-demo.herokuapp.com/",
  cache: new InMemoryCache(),
});

export const attestationClient = new ApolloClient({
  uri: "https://sepolia.easscan.org/graphql", // https://base.easscan.org/graphql
  cache: new InMemoryCache(),
});
