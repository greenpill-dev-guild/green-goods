import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import projections from "@site/src/data/integration-projections.json";

type IntegrationNetwork = {
  chainId: number;
  name: string;
  status: string;
  recorded: string[];
};

type IntegrationRecord = {
  display: string;
  definition: string;
  networks: IntegrationNetwork[];
  totalNetworks: number;
  indexedContracts: string[];
};

type IntegrationProjectionProps = {
  id: string;
};

const statusLine = (
  <p>
    A deployment artifact does not by itself prove product activation, live indexing, or
    partner-service health. This projection regenerates from checked-in artifacts via{" "}
    <code>bun run docs:generate</code>.
  </p>
);

export function IntegrationProjection({id}: IntegrationProjectionProps) {
  const integration = (projections.integrations as Record<string, IntegrationRecord>)[id];
  if (!integration) {
    throw new Error(`Unknown integration projection id: ${id}`);
  }
  return (
    <>
      <Heading as="h2" id="deployment-projection">
        Checked-in deployment projection
      </Heading>
      {integration.networks.length === 0 ? (
        <p>
          No checked-in deployment artifact records components for this integration on any supported
          network. Per-network state lives in the{" "}
          <Link to="/builders/deployments/status">deployment status projection</Link>.
        </p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Network</th>
                <th>Status</th>
                <th>Recorded components</th>
              </tr>
            </thead>
            <tbody>
              {integration.networks.map((network) => (
                <tr key={network.chainId}>
                  <td>
                    {network.name} (<code>{network.chainId}</code>)
                  </td>
                  <td>{network.status}</td>
                  <td>
                    {network.recorded.map((field, index) => (
                      <span key={field}>
                        {index > 0 ? ", " : null}
                        <code>{field}</code>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {integration.networks.length < integration.totalNetworks ? (
            <p>
              Networks without recorded components are omitted; per-network state lives in the{" "}
              <Link to="/builders/deployments/status">deployment status projection</Link>.
            </p>
          ) : null}
        </>
      )}
      {integration.indexedContracts.length > 0 ? (
        <>
          <Heading as="h2" id="indexer-boundary">
            Indexer boundary
          </Heading>
          <p>
            Configured indexer contracts:{" "}
            {integration.indexedContracts.map((name, index) => (
              <span key={name}>
                {index > 0 ? ", " : null}
                <code>{name}</code>
              </span>
            ))}
            .
          </p>
        </>
      ) : null}
      {statusLine}
    </>
  );
}
